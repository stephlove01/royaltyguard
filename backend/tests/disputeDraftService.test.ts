import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { GeminiDraftClient } from '../src/services/disputeDraftService'
import type { VerifiedDisputeFacts } from '../src/services/disputeDraftSchema'

const facts: VerifiedDisputeFacts = {
  discrepancyId: 3,
  auditId: 2,
  statementId: 5,
  platform: 'Spotify',
  statementPeriod: '2026-Q1',
  trackName: 'Sunset Echo',
  plays: '150000',
  territory: 'NG',
  actualPayout: '450.00',
  expectedPayout: '600.00',
  difference: '150.00',
  threshold: '0.00',
  discrepancyStatus: 'open',
  artistName: 'Demo Artist',
}

const validModelText = JSON.stringify({
  subject: 'Please review the Spotify statement discrepancy',
  body: 'Please review the recorded discrepancy for Sunset Echo.',
  facts_used: ['platform', 'trackName'],
  missing_information: ['contract reference'],
})

async function loadService() {
  // The service imports the database pool, but these tests never query it.
  process.env.DB_HOST ??= 'localhost'
  process.env.DB_PORT ??= '3306'
  process.env.DB_NAME ??= 'royaltyguard_test'
  process.env.DB_USER ??= 'test'
  process.env.DB_PASSWORD ??= ''
  return import('../src/services/disputeDraftService')
}

function clientReturning(text: string): GeminiDraftClient {
  return { models: { generateContent: async () => ({ text }) } }
}

test('generates and validates a draft using the configured Gemini model', async () => {
  const { requestAiDisputeDraft } = await loadService()
  let request: Parameters<GeminiDraftClient['models']['generateContent']>[0] | undefined
  const client: GeminiDraftClient = {
    models: {
      generateContent: async (input) => {
        request = input
        return { text: validModelText }
      },
    },
  }

  const result = await requestAiDisputeDraft(facts, 'royalties@example.com', {
    apiKey: 'test-key',
    model: 'test-model',
    client,
  })

  assert.equal(result.kind, 'draft')
  if (result.kind !== 'draft') return
  assert.equal(result.draft.subject, 'Please review the Spotify statement discrepancy')
  assert.deepEqual(result.draft.factsUsed, ['platform', 'trackName'])
  assert.equal(request?.model, 'test-model')
  assert.ok(request?.contents.includes('discrepancyId, auditId, statementId'))
  assert.equal(request?.config?.responseMimeType, 'application/json')
  assert.deepEqual(request?.config?.responseSchema && Object.keys(request.config.responseSchema as object), [
    'type', 'properties', 'required', 'propertyOrdering',
  ])
})

test('returns not_configured without an API key and does not call Gemini', async () => {
  const { requestAiDisputeDraft } = await loadService()
  let called = false
  const result = await requestAiDisputeDraft(facts, 'royalties@example.com', {
    apiKey: '',
    client: {
      models: {
        generateContent: async () => {
          called = true
          return { text: validModelText }
        },
      },
    },
  })

  assert.deepEqual(result, { kind: 'not_configured' })
  assert.equal(called, false)
})

test('returns ai_failed when the Gemini provider throws', async () => {
  const { requestAiDisputeDraft } = await loadService()
  const result = await requestAiDisputeDraft(facts, 'royalties@example.com', {
    apiKey: 'test-key',
    client: { models: { generateContent: async () => { throw new Error('provider detail') } } },
  })

  assert.deepEqual(result, { kind: 'ai_failed' })
})

test('logs safe Gemini provider diagnostics without credentials', async () => {
  const { requestAiDisputeDraft } = await loadService()
  const originalConsoleError = console.error
  const logged: unknown[][] = []
  console.error = (...args: unknown[]) => { logged.push(args) }

  try {
    await requestAiDisputeDraft(facts, 'royalties@example.com', {
      apiKey: 'secret-test-key',
      client: {
        models: {
          generateContent: async () => {
            const error = new Error(
              JSON.stringify({
                error: {
                  code: 404,
                  status: 'NOT_FOUND',
                  message: 'Model secret-test-key unavailable; Authorization: Bearer abc123',
                },
              }),
            ) as Error & { status: number }
            error.status = 404
            throw error
          },
        },
      },
    })
  } finally {
    console.error = originalConsoleError
  }

  assert.equal(logged.length, 1)
  assert.equal(logged[0][0], '[dispute-draft] Gemini request failed')
  assert.deepEqual(logged[0][1], {
    providerHttpStatus: 404,
    providerErrorCode: 'NOT_FOUND',
    message: 'Model [REDACTED] unavailable; Authorization: [REDACTED] [REDACTED]',
  })
  assert.equal(JSON.stringify(logged).includes('secret-test-key'), false)
  assert.equal(JSON.stringify(logged).includes('abc123'), false)
})

test('returns distinct safe outcomes for empty and malformed Gemini output', async () => {
  const { requestAiDisputeDraft } = await loadService()
  const empty = await requestAiDisputeDraft(facts, 'royalties@example.com', {
    apiKey: 'test-key', client: clientReturning('  '),
  })
  const malformed = await requestAiDisputeDraft(facts, 'royalties@example.com', {
    apiKey: 'test-key', client: clientReturning('not JSON'),
  })

  assert.deepEqual(empty, { kind: 'empty_response' })
  assert.deepEqual(malformed, { kind: 'invalid_json' })
})

test('rejects valid JSON that does not match the dispute draft schema', async () => {
  const { requestAiDisputeDraft } = await loadService()
  const invalid = JSON.stringify({
    subject: 'Review requested',
    body: 'Please review this discrepancy.',
    facts_used: ['unsupportedPath'],
    missing_information: [],
  })
  const result = await requestAiDisputeDraft(facts, 'royalties@example.com', {
    apiKey: 'test-key', client: clientReturning(invalid),
  })

  assert.deepEqual(result, { kind: 'schema_invalid' })
})

test('rejects unsupported fact paths from Gemini', async () => {
  const { requestAiDisputeDraft } = await loadService()
  const invalid = JSON.stringify({
    subject: 'Review requested',
    body: 'Please review this discrepancy.',
    facts_used: ['discrepancy_id'],
    missing_information: [],
  })
  const result = await requestAiDisputeDraft(facts, 'royalties@example.com', {
    apiKey: 'test-key', client: clientReturning(invalid),
  })

  assert.deepEqual(result, { kind: 'schema_invalid' })
})
