import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildDisputeSendPayload,
  sendApprovedDispute,
  sendReceiptFailed,
  type DisputeSendDependencies,
} from '../src/services/disputeSendService'
import type { DisputeRecord } from '../src/services/disputeService'

const WEBHOOK_URL = 'http://localhost:5678/webhook/royaltyguard-dispute-send'

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
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
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
}

function harness(options: HarnessOptions = {}): {
  deps: DisputeSendDependencies
  calls: { reserve: number; release: number; markSent: number }
  sentBody: () => unknown
} {
  const calls = { reserve: 0, release: 0, markSent: 0 }
  let capturedBody: unknown = null

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
    markSent: async () => {
      calls.markSent += 1
      return options.markSentResult === undefined
        ? disputeRecord({ status: 'sent', sentAt: new Date('2026-01-02T00:00:00Z') })
        : options.markSentResult
    },
    fetchImpl: (async (_url: string, init?: RequestInit) => {
      capturedBody = init?.body ? JSON.parse(String(init.body)) : null
      if (options.respond) return options.respond()
      return jsonResponse({ success: true })
    }) as unknown as typeof fetch,
    webhookUrl: options.webhookUrl === undefined ? WEBHOOK_URL : options.webhookUrl ?? undefined,
    webhookSecret:
      options.webhookSecret === undefined ? 'shared-secret' : options.webhookSecret ?? undefined,
  }

  return { deps, calls, sentBody: () => capturedBody }
}

test('sends an approved draft and marks it sent', async () => {
  const { deps, calls, sentBody } = harness()
  const outcome = await sendApprovedDispute(deps, 7, 1)

  assert.equal(outcome.kind, 'sent')
  assert.equal(calls.reserve, 1)
  assert.equal(calls.markSent, 1)
  assert.equal(calls.release, 0)
  assert.deepEqual(sentBody(), {
    idempotencyKey: 'dispute-7',
    dispute: {
      id: 7,
      recipient: 'royalties@example.com',
      subject: 'Royalty discrepancy',
      body: 'Please review the reported payout.',
    },
  })
})

test('returns not_found for an unknown or unowned dispute', async () => {
  const { deps, calls } = harness({ dispute: null })
  const outcome = await sendApprovedDispute(deps, 999, 1)

  assert.equal(outcome.kind, 'not_found')
  assert.equal(calls.reserve, 0)
  assert.equal(calls.markSent, 0)
})

test('returns not_draft when the dispute is not a complete draft', async () => {
  const { deps, calls } = harness({ dispute: disputeRecord({ status: 'sent' }) })
  const outcome = await sendApprovedDispute(deps, 7, 1)

  assert.equal(outcome.kind, 'not_draft')
  assert.equal(calls.reserve, 0)
})

test('returns not_draft when reservation loses the race', async () => {
  const { deps, calls } = harness({ reserveResult: false })
  const outcome = await sendApprovedDispute(deps, 7, 1)

  assert.equal(outcome.kind, 'not_draft')
  assert.equal(calls.reserve, 1)
  assert.equal(calls.markSent, 0)
})

test('returns not_configured when the send webhook is not configured', async () => {
  const { deps, calls } = harness({ webhookUrl: null })
  const outcome = await sendApprovedDispute(deps, 7, 1)

  assert.equal(outcome.kind, 'not_configured')
  assert.equal(calls.reserve, 0)
})

test('releases the draft when the n8n request fails (network error)', async () => {
  const { deps, calls } = harness({
    respond: async () => {
      throw new Error('connection refused')
    },
  })
  const outcome = await sendApprovedDispute(deps, 7, 1)

  assert.equal(outcome.kind, 'send_failed')
  assert.equal(calls.release, 1)
  assert.equal(calls.markSent, 0)
})

test('releases the draft on a Gmail failure surfaced as an HTTP error', async () => {
  const { deps, calls } = harness({ respond: async () => jsonResponse({ error: 'gmail failed' }, 500) })
  const outcome = await sendApprovedDispute(deps, 7, 1)

  assert.equal(outcome.kind, 'send_failed')
  assert.equal(calls.release, 1)
  assert.equal(calls.markSent, 0)
})

test('releases the draft when the send receipt reports failure', async () => {
  const { deps, calls } = harness({ respond: async () => jsonResponse({ success: false, error: 'gmail' }) })
  const outcome = await sendApprovedDispute(deps, 7, 1)

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
    markSent: async () => {
      status = 'sent'
      sends += 1
      return disputeRecord({ status: 'sent' })
    },
    fetchImpl: (async () => jsonResponse({ success: true })) as unknown as typeof fetch,
    webhookUrl: WEBHOOK_URL,
    webhookSecret: 'shared-secret',
  }

  const first = await sendApprovedDispute(deps, 7, 1)
  const second = await sendApprovedDispute(deps, 7, 1)

  assert.equal(first.kind, 'sent')
  assert.equal(second.kind, 'not_draft')
  assert.equal(sends, 1)
})

test('builds a stable idempotency key from the dispute id', () => {
  assert.equal(
    buildDisputeSendPayload({ id: 42, recipient: 'a@b.co', subject: 's', body: 'b' }).idempotencyKey,
    'dispute-42',
  )
})

test('treats an explicit failure receipt as failed', () => {
  assert.equal(sendReceiptFailed({ success: false }), true)
  assert.equal(sendReceiptFailed({ success: true }), false)
  assert.equal(sendReceiptFailed(null), false)
  assert.equal(sendReceiptFailed('ok'), false)
})

