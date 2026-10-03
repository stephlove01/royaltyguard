import type { DisputeRecord } from './disputeService'

// TASK-079 — Deterministic orchestration for the user-approved dispute send.
//
// The RoyaltyGuard frontend calls POST /api/disputes/:id/send. The backend
// reserves the draft, forwards it to the configured n8n webhook, and only marks
// the dispute `sent` when n8n reports a successful receipt. All dependencies are
// injected so the send flow can be tested without a live database, n8n, or Gmail.

export interface DisputeSendDependencies {
  getDispute: (disputeId: number, userId: number) => Promise<DisputeRecord | null>
  reserve: (disputeId: number, userId: number) => Promise<boolean>
  release: (disputeId: number, userId: number) => Promise<void>
  markSent: (disputeId: number, userId: number) => Promise<DisputeRecord | null>
  fetchImpl: typeof fetch
  webhookUrl: string | undefined
  webhookSecret: string | undefined
  timeoutMs?: number
}

export type DisputeSendOutcome =
  | { kind: 'sent'; dispute: DisputeRecord }
  | { kind: 'not_found' }
  | { kind: 'not_draft' }
  | { kind: 'not_configured' }
  | { kind: 'send_failed' }

export interface DisputeSendPayload {
  idempotencyKey: string
  dispute: {
    id: number
    recipient: string
    subject: string
    body: string
  }
}

export function buildDisputeSendPayload(
  dispute: Pick<DisputeRecord, 'id' | 'recipient' | 'subject' | 'body'>,
): DisputeSendPayload {
  return {
    idempotencyKey: `dispute-${dispute.id}`,
    dispute: {
      id: dispute.id,
      recipient: dispute.recipient,
      subject: dispute.subject,
      body: dispute.body,
    },
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// n8n returns a structured send receipt. A receipt that explicitly reports
// failure (for example a Gmail error surfaced by the workflow) is treated as a
// failed send even when the HTTP status is 2xx.
export function sendReceiptFailed(payload: unknown): boolean {
  return isPlainObject(payload) && payload.success === false
}

export async function sendApprovedDispute(
  dependencies: DisputeSendDependencies,
  disputeId: number,
  userId: number,
): Promise<DisputeSendOutcome> {
  const dispute = await dependencies.getDispute(disputeId, userId)

  if (!dispute) {
    return { kind: 'not_found' }
  }

  if (!dependencies.webhookUrl || !dependencies.webhookSecret) {
    return { kind: 'not_configured' }
  }

  if (dispute.status !== 'draft') {
    return { kind: 'not_draft' }
  }

  if (!(await dependencies.reserve(disputeId, userId))) {
    return { kind: 'not_draft' }
  }

  let response: Response

  try {
    response = await dependencies.fetchImpl(dependencies.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-Webhook-Secret': dependencies.webhookSecret,
      },
      body: JSON.stringify(buildDisputeSendPayload(dispute)),
      signal: AbortSignal.timeout(dependencies.timeoutMs ?? 15000),
    })
  } catch {
    await dependencies.release(disputeId, userId)
    return { kind: 'send_failed' }
  }

  let receipt: unknown = null
  if (response.ok) {
    receipt = await response.json().catch(() => null)
  }

  if (!response.ok || sendReceiptFailed(receipt)) {
    await dependencies.release(disputeId, userId)
    return { kind: 'send_failed' }
  }

  const sentDispute = await dependencies.markSent(disputeId, userId)

  if (!sentDispute) {
    return { kind: 'not_found' }
  }

  return { kind: 'sent', dispute: sentDispute }
}
