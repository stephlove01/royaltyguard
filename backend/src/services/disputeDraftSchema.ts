// TASK-076 — Deterministic validation for AI-generated dispute drafts.
//
// AI may draft language only. These helpers reject any AI output that does not
// match the strict { subject, body, facts_used, missing_information } contract or
// that references a fact path RoyaltyGuard did not supply. Financial values are
// always taken from persisted audit/discrepancy records, never from the model.

export const DISPUTE_DRAFT_MAX_SUBJECT_LENGTH = 255
export const DISPUTE_DRAFT_MAX_BODY_LENGTH = 20000
export const DISPUTE_DRAFT_MAX_LIST_ITEMS = 50

// The only verified, persisted fact paths the draft prompt may cite.
export const DISPUTE_FACT_PATHS = [
  'discrepancyId',
  'auditId',
  'statementId',
  'platform',
  'statementPeriod',
  'trackName',
  'plays',
  'territory',
  'actualPayout',
  'expectedPayout',
  'difference',
  'threshold',
  'discrepancyStatus',
  'artistName',
] as const

export type DisputeFactPath = (typeof DISPUTE_FACT_PATHS)[number]

export interface VerifiedDisputeFacts {
  discrepancyId: number
  auditId: number
  statementId: number
  platform: string
  statementPeriod: string
  trackName: string
  plays: string
  territory: string
  actualPayout: string
  expectedPayout: string
  difference: string
  threshold: string
  discrepancyStatus: string
  artistName: string
}

export interface ParsedAiDisputeDraft {
  subject: string
  body: string
  factsUsed: string[]
  missingInformation: string[]
}

const ALLOWED_KEYS = ['subject', 'body', 'facts_used', 'missing_information'] as const
const FACT_PATH_SET = new Set<string>(DISPUTE_FACT_PATHS)

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireStringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`)
  }

  if (value.length > DISPUTE_DRAFT_MAX_LIST_ITEMS) {
    throw new Error(`${field} must contain at most ${DISPUTE_DRAFT_MAX_LIST_ITEMS} items`)
  }

  return value.map((item) => {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new Error(`${field} must contain non-empty strings`)
    }

    return item.trim()
  })
}

export function parseAiDisputeDraft(value: unknown): ParsedAiDisputeDraft {
  if (!isPlainObject(value)) {
    throw new Error('AI dispute draft must be an object')
  }

  for (const key of Object.keys(value)) {
    if (!(ALLOWED_KEYS as readonly string[]).includes(key)) {
      throw new Error(`unsupported field ${key}`)
    }
  }

  const subject = value.subject
  const body = value.body

  if (typeof subject !== 'string' || subject.trim() === '') {
    throw new Error('subject is required')
  }

  if (subject.trim().length > DISPUTE_DRAFT_MAX_SUBJECT_LENGTH) {
    throw new Error(`subject must be ${DISPUTE_DRAFT_MAX_SUBJECT_LENGTH} characters or fewer`)
  }

  if (typeof body !== 'string' || body.trim() === '') {
    throw new Error('body is required')
  }

  if (body.trim().length > DISPUTE_DRAFT_MAX_BODY_LENGTH) {
    throw new Error('body must be 20,000 characters or fewer')
  }

  const factsUsed = requireStringList(value.facts_used, 'facts_used')
  for (const path of factsUsed) {
    if (!FACT_PATH_SET.has(path)) {
      throw new Error(`facts_used contains unsupported fact path ${path}`)
    }
  }

  const missingInformation = requireStringList(value.missing_information, 'missing_information')

  return {
    subject: subject.trim(),
    body: body.trim(),
    factsUsed,
    missingInformation,
  }
}

// n8n may respond with the draft directly, under `output` (Information Extractor),
// or nested under `draft`. Normalise before validating.
export function extractAiDisputeDraftPayload(payload: unknown): unknown {
  if (isPlainObject(payload)) {
    if (typeof payload.subject === 'string') return payload
    if (isPlainObject(payload.output)) return payload.output
    if (isPlainObject(payload.draft)) return payload.draft
  }

  return payload
}
