import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildDisputeWebhookUrl,
  buildDisputeSendPayload,
  parseSuccessfulSendReceipt,
  sendDisputeAutomatically,
  type DisputeSendDependencies,
  type DisputeSendLogEntry,
} from '../src/services/disputeSendService'
import type { DisputeRecord } from '../src/services/disputeService'

const WEBHOOK_URL = 'http://localhost:5678/webhook/royaltyguard-multiplatform-approved-send'

function sendReceipt(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    deliveryStatus: 'sent',
    idempotencyKey: 'dispute-7',
    disputeId: 7,
    provider: 'gmail',
    messageId: 'message-1',
    ...overrides,
  }
}

function disputeRecord(overrides: Partial<DisputeRecord> = {}): DisputeRecord {
  return {
    id: 7,
    discrepancyId: 3,
    recipient: 'royalties@example.com',
    subject: 'Royalty discrepancy',
    body: 'Please review the reported payout.',
    source: 'manual',
    factsUsed: null,
    missingInformation: null,
    generatedAt: null,
    status: 'draft',
    sentAt: null,
    responseAt: null,
    followUpAt: null,
    artistName: 'Demo Artist',
    platform: 'Spotify',
    trackName: 'Sunset Echo',
    statementPeriod: '2026-Q1',
    expectedAmount: '600.00',
    actualAmount: '450.00',
    difference: '150.00',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    discrepancyStatus: 'open',
    threshold: '50.00',
    ...overrides,
  } as DisputeRecord
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

interface HarnessOptions {
  dispute?: DisputeRecord | null
  reserveResult?: boolean
  markSentResult?: DisputeRecord | null
  respond?: () => Promise<Response>
  webhookUrl?: string | null
  webhookSecret?: string | null
  webhookHeaderName?: string | null
}

function harness(options: HarnessOptions = {}): {
  deps: DisputeSendDependencies
  calls: { reserve: number; release: number; markUncertain: number; markSent: number }
  sentBody: () => unknown
  request: () => { url: string | null; init: RequestInit | undefined }
  logs: DisputeSendLogEntry[]
} {
  const calls = { reserve: 0, release: 0, markUncertain: 0, markSent: 0 }
  let capturedBody: unknown = null
  let capturedUrl: string | null = null
  let capturedInit: RequestInit | undefined
  const logs: DisputeSendLogEntry[] = []

  const deps: DisputeSendDependencies = {
    getDispute: async () =>
      options.dispute === undefined ? disputeRecord() : options.dispute,
    reserve: async () => {
      calls.reserve += 1
      return options.reserveResult ?? true
    },
    release: async () => {
      calls.release += 1
    },
    markUncertain: async () => {
      calls.markUncertain += 1
    },
    markSent: async () => {
      calls.markSent += 1
      return options.markSentResult === undefined
        ? disputeRecord({ status: 'sent', sentAt: new Date('2026-01-02T00:00:00Z') })
        : options.markSentResult
    },
    fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url)
      capturedInit = init
      capturedBody = init?.body ? JSON.parse(String(init.body)) : null
      if (options.respond) return options.respond()
      return jsonResponse(sendReceipt())
    }) as unknown as typeof fetch,
    webhookUrl: options.webhookUrl === undefined ? WEBHOOK_URL : options.webhookUrl ?? undefined,
    webhookSecret:
      options.webhookSecret === undefined ? 'shared-secret' : options.webhookSecret ?? undefined,
    webhookHeaderName:
      options.webhookHeaderName === undefined ? 'X-N8N-Webhook-Secret' : options.webhookHeaderName ?? undefined,
    log: (entry) => logs.push(entry),
  }

  return {
    deps,
    calls,
    sentBody: () => capturedBody,
    request: () => ({ url: capturedUrl, init: capturedInit }),
    logs,
  }
}

test('sends an eligible dispute automatically and marks it sent', async () => {
  const { deps, calls, sentBody, request, logs } = harness()
  const outcome = await sendDisputeAutomatically(deps, 7, 1)

  assert.equal(outcome.kind, 'sent')
  assert.equal(calls.reserve, 1)
  assert.equal(calls.markSent, 1)
  assert.equal(calls.release, 0)
  const body = sentBody() as { idempotencyKey: string; deliveryMode: string; dispute: { id: number } }
  assert.equal(body.idempotencyKey, 'dispute-7')
  assert.equal(body.deliveryMode, 'automatic')
  assert.equal(body.dispute.id, 7)
  const sentRequest = request()
  assert.equal(sentRequest.url, WEBHOOK_URL)
  assert.equal(sentRequest.init?.method, 'POST')
  assert.equal((sentRequest.init?.headers as Record<string, string>)['X-N8N-Webhook-Secret'], 'shared-secret')
  assert.equal((sentRequest.init?.headers as Record<string, string>).Accept, 'application/json')
  assert.ok(sentRequest.init?.signal)
  assert.deepEqual(logs.map(({ event }) => event), ['request_started', 'delivery_sent'])
  assert.ok(logs.every((entry) => !('recipient' in entry) && !('subject' in entry) && !('messageId' in entry)))
})

test('builds only a valid production webhook URL', () => {
  assert.equal(
    buildDisputeWebhookUrl(
      'http://localhost:5678/',
      '/webhook/royaltyguard-multiplatform-approved-send',
    ),
    WEBHOOK_URL,
  )
  assert.equal(
    buildDisputeWebhookUrl(
      'http://localhost:5678',
      'royaltyguard-multiplatform-approved-send',
    ),
    WEBHOOK_URL,
  )
  assert.equal(buildDisputeWebhookUrl('http://localhost:5678', '/webhook-test/test'), undefined)
  assert.equal(buildDisputeWebhookUrl('http://localhost:5678', 'webhook/path'), undefined)
  assert.equal(buildDisputeWebhookUrl('file://localhost', '/webhook/path'), undefined)
  assert.equal(buildDisputeWebhookUrl('http://user:pass@localhost:5678', '/webhook/path'), undefined)
})

test('posts to the production route when configured with the bare webhook slug', async () => {
  const webhookUrl = buildDisputeWebhookUrl(
    'http://localhost:5678',
    'royaltyguard-multiplatform-approved-send',
  )
  assert.ok(webhookUrl)
  const { deps, request } = harness({ webhookUrl })

  const outcome = await sendDisputeAutomatically(deps, 7, 1)

  assert.equal(outcome.kind, 'sent')
  assert.equal(request().url, WEBHOOK_URL)
})

test('returns not_found for an unknown or unowned dispute', async () => {
  const { deps, calls } = harness({ dispute: null })
  const outcome = await sendDisputeAutomatically(deps, 999, 1)

  assert.equal(outcome.kind, 'not_found')
  assert.equal(calls.reserve, 0)
  assert.equal(calls.markSent, 0)
})

test('returns not_draft when the dispute is not a complete draft', async () => {
  const { deps, calls } = harness({ dispute: disputeRecord({ status: 'sent' }) })
  const outcome = await sendDisputeAutomatically(deps, 7, 1)

  assert.equal(outcome.kind, 'not_draft')
  assert.equal(calls.reserve, 0)
})

test('does not retry a draft with a recorded previous send attempt', async () => {
  const { deps, calls, request } = harness({
    dispute: disputeRecord({ sendAttemptedAt: new Date('2026-11-09T12:00:00Z') }),
  })
  const outcome = await sendDisputeAutomatically(deps, 7, 1)

  assert.equal(outcome.kind, 'not_draft')
  assert.equal(calls.reserve, 0)
  assert.equal(request().url, null)
})

test('returns not_draft when reservation loses the race', async () => {
  const { deps, calls } = harness({ reserveResult: false })
  const outcome = await sendDisputeAutomatically(deps, 7, 1)

  assert.equal(outcome.kind, 'not_draft')
  assert.equal(calls.reserve, 1)
  assert.equal(calls.markSent, 0)
})

test('returns not_configured when the send webhook is not configured', async () => {
  const { deps, calls } = harness({ webhookUrl: null })
  const outcome = await sendDisputeAutomatically(deps, 7, 1)

  assert.equal(outcome.kind, 'not_configured')
  assert.equal(calls.reserve, 0)
})

test('does not send with a header name the active n8n workflow does not validate', async () => {
  const { deps, calls, request } = harness({ webhookHeaderName: 'Authorization' })
  const outcome = await sendDisputeAutomatically(deps, 7, 1)

  assert.equal(outcome.kind, 'not_configured')
  assert.equal(calls.reserve, 0)
  assert.equal(request().url, null)
})

test('does not send when required statement details are missing', async () => {
  const { deps, calls } = harness({ dispute: disputeRecord({ trackName: undefined }) })
  const outcome = await sendDisputeAutomatically(deps, 7, 1)

  assert.equal(outcome.kind, 'ineligible')
  assert.equal(calls.reserve, 0)
})

test('does not send when the underpayment does not exceed its threshold', async () => {
  const { deps, calls } = harness({
    dispute: disputeRecord({ difference: '50.00', threshold: '50.00' }),
  })
  const outcome = await sendDisputeAutomatically(deps, 7, 1)

  assert.equal(outcome.kind, 'ineligible')
  assert.equal(calls.reserve, 0)
})

test('does not send closed discrepancies even when the recorded amount exceeds threshold', async () => {
  const { deps, calls } = harness({
    dispute: disputeRecord({ discrepancyStatus: 'closed' }),
  })
  const outcome = await sendDisputeAutomatically(deps, 7, 1)

  assert.equal(outcome.kind, 'ineligible')
  assert.equal(calls.reserve, 0)
})

test('locks the dispute when the n8n request times out or fails before a receipt', async () => {
  const { deps, calls, logs } = harness({
    respond: async () => {
      throw new Error('connection refused')
    },
  })
  const outcome = await sendDisputeAutomatically(deps, 7, 1)

  assert.equal(outcome.kind, 'send_uncertain')
  assert.equal(calls.release, 0)
  assert.equal(calls.markUncertain, 1)
  assert.equal(calls.markSent, 0)
  assert.deepEqual(logs.at(-1), {
    event: 'request_failed',
    disputeId: 7,
    durationMs: logs.at(-1)?.durationMs,
    errorName: 'Error',
  })
})

test('locks the dispute when n8n succeeds without a Gmail message ID', async () => {
  const { deps, calls } = harness({
    respond: async () => jsonResponse(sendReceipt({ messageId: null })),
  })
  const outcome = await sendDisputeAutomatically(deps, 7, 1)

  assert.equal(outcome.kind, 'send_uncertain')
  assert.equal(calls.markUncertain, 1)
  assert.equal(calls.release, 0)
  assert.equal(calls.markSent, 0)
})

test('does not mark sent for an uncertain or mismatched n8n receipt', async (t) => {
  for (const [name, receipt] of [
    ['explicitly uncertain', sendReceipt({ deliveryStatus: 'send_uncertain' })],
    ['different dispute', sendReceipt({ disputeId: 8 })],
    ['different idempotency key', sendReceipt({ idempotencyKey: 'dispute-8' })],
  ] as const) {
    await t.test(name, async () => {
      const { deps, calls } = harness({ respond: async () => jsonResponse(receipt) })
      const outcome = await sendDisputeAutomatically(deps, 7, 1)
      assert.equal(outcome.kind, 'send_uncertain')
      assert.equal(calls.markSent, 0)
      assert.equal(calls.markUncertain, 1)
      assert.equal(calls.release, 0)
    })
  }
})

test('locks the dispute on an upstream server error because Gmail delivery may be uncertain', async () => {
  const { deps, calls } = harness({
    respond: async () => jsonResponse({ success: false }, 502),
  })
  const outcome = await sendDisputeAutomatically(deps, 7, 1)

  assert.equal(outcome.kind, 'send_uncertain')
  assert.equal(calls.markUncertain, 1)
  assert.equal(calls.release, 0)
})

test('locks the dispute when Gmail returns a server error without a delivery receipt', async () => {
  const { deps, calls } = harness({ respond: async () => jsonResponse({ error: 'gmail failed' }, 500) })
  const outcome = await sendDisputeAutomatically(deps, 7, 1)

  assert.equal(outcome.kind, 'send_uncertain')
  assert.equal(calls.markUncertain, 1)
  assert.equal(calls.release, 0)
  assert.equal(calls.markSent, 0)
})

test('releases the draft when the send receipt reports failure', async () => {
  const { deps, calls } = harness({
    respond: async () => jsonResponse({ success: false, error: 'invalid dispute payload' }, 400),
  })
  const outcome = await sendDisputeAutomatically(deps, 7, 1)

  assert.equal(outcome.kind, 'send_failed')
  assert.equal(calls.release, 1)
  assert.equal(calls.markSent, 0)
})

test('a repeated send is rejected once the dispute is already sent', async () => {
  let status = 'draft'
  let sends = 0

  const deps: DisputeSendDependencies = {
    getDispute: async () => disputeRecord({ status }),
    reserve: async () => {
      if (status !== 'draft') return false
      status = 'sending'
      return true
    },
    release: async () => {
      status = 'draft'
    },
    markUncertain: async () => {
      status = 'send_uncertain'
    },
    markSent: async () => {
      status = 'sent'
      sends += 1
      return disputeRecord({ status: 'sent' })
    },
    fetchImpl: (async () => jsonResponse(sendReceipt())) as unknown as typeof fetch,
    webhookUrl: WEBHOOK_URL,
    webhookSecret: 'shared-secret',
    webhookHeaderName: 'X-N8N-Webhook-Secret',
  }

  const first = await sendDisputeAutomatically(deps, 7, 1)
  const second = await sendDisputeAutomatically(deps, 7, 1)

  assert.equal(first.kind, 'sent')
  assert.equal(second.kind, 'not_draft')
  assert.equal(sends, 1)
})

test('builds the automatic-send contract with persisted eligibility facts and a stable key', () => {
  const payload = buildDisputeSendPayload(disputeRecord({ id: 42 }))

  assert.equal(payload.idempotencyKey, 'dispute-42')
  assert.equal(payload.deliveryMode, 'automatic')
  assert.deepEqual(payload.dispute.audit, {
    discrepancyId: 3,
    discrepancyStatus: 'open',
    expectedAmount: '600.00',
    actualAmount: '450.00',
    difference: '150.00',
    threshold: '50.00',
  })
})

test('requires a Gmail receipt with a message identifier before marking sent', () => {
  const activeWorkflowReceipt = sendReceipt()
  delete activeWorkflowReceipt.deliveryStatus
  assert.equal(
    parseSuccessfulSendReceipt(activeWorkflowReceipt, 7, 'dispute-7')?.messageId,
    'message-1',
  )
  assert.equal(parseSuccessfulSendReceipt({ success: true }, 7, 'dispute-7'), null)
  assert.equal(
    parseSuccessfulSendReceipt(sendReceipt({ success: false }), 7, 'dispute-7'),
    null,
  )
})
