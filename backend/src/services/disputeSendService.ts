import type { DisputeRecord } from './disputeService'
import { parseScaledDecimal } from './royaltyCalculationService'

// TASK-079 / TASK-080 — reserve once, and mark sent only with a Gmail message ID.
export interface SendReceipt {
  success: true
  provider: 'gmail'
  deliveryStatus?: 'sent'
  disputeId: number
  idempotencyKey: string
  messageId: string
  threadId?: string | null
  sentAt?: string
  [key: string]: unknown
}

export interface DisputeSendLogEntry {
  event: 'delivery_skipped' | 'request_started' | 'request_failed' | 'response_rejected' | 'delivery_sent'
  disputeId: number
  reason?: string
  httpStatus?: number
  durationMs?: number
  errorName?: string
  host?: string
  path?: string
}

export interface DisputeSendDependencies {
  getDispute: (disputeId: number, userId: number) => Promise<DisputeRecord | null>
  reserve: (disputeId: number, userId: number) => Promise<boolean>
  release: (disputeId: number, userId: number) => Promise<void>
  markUncertain: (disputeId: number, userId: number) => Promise<void>
  markSent: (disputeId: number, userId: number, receipt: SendReceipt) => Promise<DisputeRecord | null>
  fetchImpl: typeof fetch
  webhookUrl: string | undefined
  webhookSecret: string | undefined
  webhookHeaderName: string | undefined
  timeoutMs?: number
  log?: (entry: DisputeSendLogEntry) => void
}

export type DisputeSendOutcome =
  | { kind: 'sent'; dispute: DisputeRecord }
  | { kind: 'not_found' }
  | { kind: 'not_draft' }
  | { kind: 'not_configured' }
  | { kind: 'ineligible' }
  | { kind: 'send_failed' }
  | { kind: 'send_uncertain' }

export interface DisputeSendPayload {
  idempotencyKey: string
  deliveryMode: 'automatic'
  dispute: {
    id: number
    recipient: string
    subject: string
    body: string
    artistName?: string
    platform?: string
    trackName?: string
    statementPeriod?: string
    audit: {
      discrepancyId: number
      discrepancyStatus?: string
      expectedAmount?: string
      actualAmount?: string
      difference?: string
      threshold?: string
    }
  }
}

export function buildDisputeWebhookUrl(
  baseUrlValue: string | undefined,
  pathValue: string | undefined,
): string | undefined {
  const baseUrl = baseUrlValue?.trim().replace(/\/+$/, '')
  const path = pathValue?.trim()
  const webhookPath = path?.startsWith('/webhook/')
    ? path
    : path && /^[A-Za-z0-9._~-]+$/.test(path)
      ? `/webhook/${path}`
      : undefined
  if (!baseUrl || !webhookPath || webhookPath.includes('?') || webhookPath.includes('#')) {
    return undefined
  }

  try {
    const url = new URL(`${baseUrl}${webhookPath}`)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname.includes('/webhook-test/')
    ) {
      return undefined
    }

    return url.toString()
  } catch {
    return undefined
  }
}

export function buildDisputeSendPayload(dispute: DisputeRecord): DisputeSendPayload {
  return {
    idempotencyKey: `dispute-${dispute.id}`,
    deliveryMode: 'automatic',
    dispute: {
      id: dispute.id,
      recipient: dispute.recipient,
      subject: dispute.subject,
      body: dispute.body,
      artistName: dispute.artistName,
      platform: dispute.platform,
      trackName: dispute.trackName,
      statementPeriod: dispute.statementPeriod,
      audit: {
        discrepancyId: dispute.discrepancyId,
        discrepancyStatus: dispute.discrepancyStatus,
        expectedAmount: dispute.expectedAmount,
        actualAmount: dispute.actualAmount,
        difference: dispute.difference,
        threshold: dispute.threshold,
      },
    },
  }
}

function isEligibleForAutomaticDelivery(dispute: DisputeRecord): boolean {
  const expectedAmount = dispute.expectedAmount
  const actualAmount = dispute.actualAmount
  const difference = dispute.difference
  const threshold = dispute.threshold
  if (
    !dispute.recipient.trim() ||
    !dispute.subject.trim() ||
    !dispute.body.trim() ||
    !dispute.artistName?.trim() ||
    !dispute.platform?.trim() ||
    !dispute.trackName?.trim() ||
    !dispute.statementPeriod?.trim() ||
    typeof expectedAmount !== 'string' ||
    typeof actualAmount !== 'string' ||
    typeof difference !== 'string' ||
    typeof threshold !== 'string' ||
    dispute.discrepancyStatus?.toLowerCase() !== 'open'
  ) {
    return false
  }

  const expectedCents = parseScaledDecimal(expectedAmount, 2)
  const actualCents = parseScaledDecimal(actualAmount, 2)
  const differenceCents = parseScaledDecimal(difference, 2)
  const thresholdCents = parseScaledDecimal(threshold, 2)

  return expectedCents > actualCents && differenceCents > thresholdCents
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function responseDeliveryIsUncertain(payload: unknown): boolean {
  return isPlainObject(payload) && payload.deliveryStatus === 'send_uncertain'
}

export function parseSuccessfulSendReceipt(
  payload: unknown,
  expectedDisputeId: number,
  expectedIdempotencyKey: string,
): SendReceipt | null {
  if (!isPlainObject(payload) || payload.success !== true || payload.provider !== 'gmail') return null
  if (
    (payload.deliveryStatus !== undefined && payload.deliveryStatus !== 'sent') ||
    payload.disputeId !== expectedDisputeId ||
    payload.idempotencyKey !== expectedIdempotencyKey
  ) return null
  if (typeof payload.messageId !== 'string' || payload.messageId.trim() === '') return null
  if (payload.threadId !== undefined && payload.threadId !== null && typeof payload.threadId !== 'string') return null
  if (payload.sentAt !== undefined && typeof payload.sentAt !== 'string') return null
  return payload as SendReceipt
}

function logDelivery(
  dependencies: DisputeSendDependencies,
  entry: DisputeSendLogEntry,
): void {
  dependencies.log?.(entry)
}

export async function sendDisputeAutomatically(
  dependencies: DisputeSendDependencies,
  disputeId: number,
  userId: number,
): Promise<DisputeSendOutcome> {
  const dispute = await dependencies.getDispute(disputeId, userId)
  if (!dispute) {
    logDelivery(dependencies, { event: 'delivery_skipped', disputeId, reason: 'not_found' })
    return { kind: 'not_found' }
  }

  const webhookUrl = dependencies.webhookUrl?.trim()
  const webhookSecret = dependencies.webhookSecret?.trim()
  const webhookHeaderName = dependencies.webhookHeaderName?.trim()
  if (
    webhookHeaderName &&
    webhookHeaderName.toLowerCase() !== 'x-n8n-webhook-secret'
  ) {
    logDelivery(dependencies, {
      event: 'delivery_skipped',
      disputeId,
      reason: 'unexpected_webhook_header_name',
    })
    return { kind: 'not_configured' }
  }
  if (!webhookUrl || !webhookSecret || !webhookHeaderName) {
    const reason = !webhookUrl ? 'missing_webhook_url' : !webhookSecret ? 'missing_webhook_secret' : 'missing_header_name'
    logDelivery(dependencies, { event: 'delivery_skipped', disputeId, reason })
    return { kind: 'not_configured' }
  }
  let endpoint: URL
  try {
    endpoint = new URL(webhookUrl)
    if (
      !['http:', 'https:'].includes(endpoint.protocol) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash ||
      endpoint.pathname.includes('/webhook-test/')
    ) {
      throw new Error('Invalid production webhook URL')
    }
  } catch {
    logDelivery(dependencies, { event: 'delivery_skipped', disputeId, reason: 'invalid_webhook_url' })
    return { kind: 'not_configured' }
  }
  if (dispute.status !== 'draft') {
    logDelivery(dependencies, { event: 'delivery_skipped', disputeId, reason: 'not_draft' })
    return { kind: 'not_draft' }
  }
  if (dispute.sendAttemptedAt) {
    logDelivery(dependencies, { event: 'delivery_skipped', disputeId, reason: 'previous_attempt' })
    return { kind: 'not_draft' }
  }
  if (!isEligibleForAutomaticDelivery(dispute)) {
    logDelivery(dependencies, { event: 'delivery_skipped', disputeId, reason: 'ineligible' })
    return { kind: 'ineligible' }
  }
  if (!(await dependencies.reserve(disputeId, userId))) {
    logDelivery(dependencies, { event: 'delivery_skipped', disputeId, reason: 'reservation_unavailable' })
    return { kind: 'not_draft' }
  }

  let response: Response
  const startedAt = Date.now()
  logDelivery(dependencies, {
    event: 'request_started',
    disputeId,
    host: endpoint.host,
    path: endpoint.pathname,
  })
  try {
    response = await dependencies.fetchImpl(webhookUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        [webhookHeaderName]: webhookSecret,
      },
      body: JSON.stringify(buildDisputeSendPayload(dispute)),
      signal: AbortSignal.timeout(dependencies.timeoutMs ?? 15000),
    })
  } catch (error) {
    // A timeout can occur after n8n has already accepted the email. Preserve
    // the reservation and idempotency key instead of risking a duplicate send.
    logDelivery(dependencies, {
      event: 'request_failed',
      disputeId,
      durationMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : 'NonError',
    })
    await dependencies.markUncertain(disputeId, userId)
    return { kind: 'send_uncertain' }
  }

  const receipt: unknown = await response.json().catch(() => null)
  const payload = buildDisputeSendPayload(dispute)
  const successfulReceipt = response.ok
    ? parseSuccessfulSendReceipt(receipt, dispute.id, payload.idempotencyKey)
    : null
  if (!successfulReceipt) {
    const reason = responseDeliveryIsUncertain(receipt)
      ? 'upstream_send_uncertain'
      : response.ok
        ? 'invalid_receipt'
        : 'upstream_http_error'
    logDelivery(dependencies, {
      event: 'response_rejected',
      disputeId,
      httpStatus: response.status,
      durationMs: Date.now() - startedAt,
      reason,
    })
    if (response.status >= 500 || responseDeliveryIsUncertain(receipt) || response.ok) {
      await dependencies.markUncertain(disputeId, userId)
      return { kind: 'send_uncertain' }
    }

    await dependencies.release(disputeId, userId)
    return { kind: 'send_failed' }
  }

  const sentDispute = await dependencies.markSent(disputeId, userId, successfulReceipt)
  if (sentDispute) {
    logDelivery(dependencies, {
      event: 'delivery_sent',
      disputeId,
      httpStatus: response.status,
      durationMs: Date.now() - startedAt,
    })
    return { kind: 'sent', dispute: sentDispute }
  }

  logDelivery(dependencies, {
    event: 'response_rejected',
    disputeId,
    httpStatus: response.status,
    durationMs: Date.now() - startedAt,
    reason: 'could_not_persist_receipt',
  })
  await dependencies.markUncertain(disputeId, userId)
  return { kind: 'send_uncertain' }
}
