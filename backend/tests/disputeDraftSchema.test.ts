import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DISPUTE_FACT_PATHS,
  extractAiDisputeDraftPayload,
  parseAiDisputeDraft,
} from '../src/services/disputeDraftSchema'

type DraftInput = Record<string, unknown>

function validDraft(overrides: DraftInput = {}): DraftInput {
  return {
    subject: 'Royalty discrepancy for Sunset Echo',
    body: 'Please review the reported payout recorded for Sunset Echo.',
    facts_used: ['trackName', 'difference'],
    missing_information: [],
    ...overrides,
  }
}

test('accepts a valid draft and trims whitespace', () => {
  const draft = parseAiDisputeDraft(validDraft())

  assert.equal(draft.subject, 'Royalty discrepancy for Sunset Echo')
  assert.deepEqual(draft.factsUsed, ['trackName', 'difference'])
  assert.deepEqual(draft.missingInformation, [])
})

test('every supported fact path is accepted', () => {
  const draft = parseAiDisputeDraft(validDraft({ facts_used: [...DISPUTE_FACT_PATHS] }))

  assert.deepEqual(draft.factsUsed, [...DISPUTE_FACT_PATHS])
})

test('rejects a missing or empty subject', () => {
  assert.throws(() => parseAiDisputeDraft(validDraft({ subject: '' })), /subject is required/)
  assert.throws(() => parseAiDisputeDraft(validDraft({ subject: '   ' })), /subject is required/)
  const { subject, ...withoutSubject } = validDraft()
  assert.throws(() => parseAiDisputeDraft(withoutSubject), /subject is required/)
})

test('rejects a missing or empty body', () => {
  assert.throws(() => parseAiDisputeDraft(validDraft({ body: '' })), /body is required/)
  assert.throws(() => parseAiDisputeDraft(validDraft({ body: 42 })), /body is required/)
})

test('rejects over-long subject and body values', () => {
  assert.throws(() => parseAiDisputeDraft(validDraft({ subject: 'a'.repeat(256) })), /subject must be 255/)
  assert.throws(() => parseAiDisputeDraft(validDraft({ body: 'a'.repeat(20001) })), /body must be 20,000/)
})

test('rejects facts_used and missing_information that are not string arrays', () => {
  assert.throws(() => parseAiDisputeDraft(validDraft({ facts_used: 'trackName' })), /facts_used must be an array/)
  assert.throws(
    () => parseAiDisputeDraft(validDraft({ facts_used: ['trackName', 5] })),
    /facts_used must contain non-empty strings/,
  )
  assert.throws(
    () => parseAiDisputeDraft(validDraft({ missing_information: [''] })),
    /missing_information must contain non-empty strings/,
  )
})

test('rejects a fact path that was not supplied', () => {
  assert.throws(
    () => parseAiDisputeDraft(validDraft({ facts_used: ['expectedPayout', 'contractTerm'] })),
    /facts_used contains unsupported fact path contractTerm/,
  )
})

test('rejects unsupported or AI-invented top-level fields', () => {
  assert.throws(
    () => parseAiDisputeDraft(validDraft({ shortfall: '100.00' })),
    /unsupported field shortfall/,
  )
})

test('rejects non-object payloads', () => {
  assert.throws(() => parseAiDisputeDraft(null), /must be an object/)
  assert.throws(() => parseAiDisputeDraft('draft'), /must be an object/)
  assert.throws(() => parseAiDisputeDraft([]), /must be an object/)
})

test('normalises direct, output-wrapped, and draft-wrapped payloads', () => {
  const draft = validDraft()

  assert.deepEqual(extractAiDisputeDraftPayload(draft), draft)
  assert.deepEqual(extractAiDisputeDraftPayload({ output: draft }), draft)
  assert.deepEqual(extractAiDisputeDraftPayload({ draft }), draft)
  assert.equal(extractAiDisputeDraftPayload('nope'), 'nope')
})
