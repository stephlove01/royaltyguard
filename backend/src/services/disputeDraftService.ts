import { GoogleGenAI, Type } from '@google/genai'
import { RowDataPacket } from 'mysql2/promise'
import { pool } from '../database'
import { createAiDisputeForUser, DisputeRecord } from './disputeService'
import {
  parseAiDisputeDraft,
  ParsedAiDisputeDraft,
  VerifiedDisputeFacts,
} from './disputeDraftSchema'

interface DisputeFactRow extends RowDataPacket, VerifiedDisputeFacts {}

export type AssembleDisputeFactsResult =
  | { kind: 'found'; facts: VerifiedDisputeFacts }
  | { kind: 'not_found' }

export type AiDraftRequestResult =
  | { kind: 'draft'; draft: ParsedAiDisputeDraft }
  | { kind: 'not_configured' }
  | { kind: 'ai_failed' }
  | { kind: 'empty_response' }
  | { kind: 'invalid_json' }
  | { kind: 'schema_invalid' }

export type CreateAiDisputeDraftResult =
  | { kind: 'created'; dispute: DisputeRecord }
  | { kind: 'discrepancy_not_found' }
  | { kind: 'not_configured' }
  | { kind: 'ai_failed' }
  | { kind: 'empty_response' }
  | { kind: 'invalid_json' }
  | { kind: 'schema_invalid' }

export interface CreateAiDisputeDraftInput {
  discrepancyId: number
  userId: number
  recipient: string
}

interface GeminiDraftResponse {
  text?: string
}

export interface GeminiDraftClient {
  models: {
    generateContent: (input: {
      model: string
      contents: string
      config?: {
        responseMimeType: string
        responseSchema: unknown
        temperature: number
      }
    }) => Promise<GeminiDraftResponse>
  }
}

const DISPUTE_DRAFT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING, description: 'A concise, professional email subject.' },
    body: { type: Type.STRING, description: 'A factual email body for the recipient to review.' },
    facts_used: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Exact supplied camelCase fact paths used in the email.',
    },
    missing_information: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Relevant information unavailable in the supplied facts.',
    },
  },
  required: ['subject', 'body', 'facts_used', 'missing_information'],
  propertyOrdering: ['subject', 'body', 'facts_used', 'missing_information'],
} as const

const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash'

interface GeminiErrorDiagnostics {
  providerHttpStatus: number | null
  providerErrorCode: string | number | null
  message: string
}

function getGeminiErrorDiagnostics(error: unknown, apiKey: string): GeminiErrorDiagnostics {
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown } | null
  const rawMessage = typeof candidate?.message === 'string' ? candidate.message : 'Unknown provider error'
  let parsedMessage: unknown

  try {
    parsedMessage = JSON.parse(rawMessage)
  } catch {
    parsedMessage = undefined
  }

  const parsedError =
    typeof parsedMessage === 'object' && parsedMessage !== null && 'error' in parsedMessage
      ? (parsedMessage as { error?: unknown }).error
      : parsedMessage
  const providerError =
    typeof parsedError === 'object' && parsedError !== null
      ? (parsedError as { status?: unknown; code?: unknown; message?: unknown })
      : undefined
  const status = candidate?.status
  const numericCode = typeof candidate?.code === 'number' ? candidate.code : undefined
  const providerCode = providerError?.status ?? providerError?.code
  let message = typeof providerError?.message === 'string' ? providerError.message : rawMessage

  // Never emit credentials or authorization material, even if an upstream error echoes it.
  if (apiKey) message = message.split(apiKey).join('[REDACTED]')
  message = message
    .replace(/\bBearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/(api[_-]?key\s*[:=]\s*)[^\s,"'}]+/gi, '$1[REDACTED]')
    .replace(/(authorization\s*[:=]\s*)[^\s,"'}]+/gi, '$1[REDACTED]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 500)

  return {
    providerHttpStatus: typeof status === 'number' ? status : numericCode ?? null,
    providerErrorCode:
      typeof providerCode === 'string' || typeof providerCode === 'number'
        ? providerCode
        : typeof candidate?.code === 'string'
          ? candidate.code
          : null,
    message,
  }
}

export async function assembleVerifiedDisputeFacts(
  discrepancyId: number,
  userId: number,
): Promise<AssembleDisputeFactsResult> {
  const sql = [
    'SELECT',
    '  d.id AS discrepancyId,',
    '  d.audit_id AS auditId,',
    '  au.statement_id AS statementId,',
    '  d.expected_amount AS expectedPayout,',
    '  d.actual_amount AS actualPayout,',
    '  d.difference,',
    '  d.threshold,',
    '  d.status AS discrepancyStatus,',
    '  s.platform,',
    '  s.statement_period AS statementPeriod,',
    '  r.track_name AS trackName,',
    '  CAST(r.plays AS CHAR) AS plays,',
    '  r.territory,',
    '  ar.name AS artistName',
    'FROM discrepancies AS d',
    'INNER JOIN audits AS au ON au.id = d.audit_id',
    'INNER JOIN statements AS s ON s.id = au.statement_id',
    'INNER JOIN artists AS ar ON ar.id = s.artist_id',
    'INNER JOIN royalty_rows AS r ON r.id = d.royalty_row_id',
    'WHERE d.id = ? AND ar.user_id = ?',
    'LIMIT 1',
  ].join('\n')

  const [rows] = await pool.execute<DisputeFactRow[]>(
    sql,
    [discrepancyId, userId],
  )

  const facts = rows[0]

  if (!facts) {
    return { kind: 'not_found' }
  }

  return {
    kind: 'found',
    facts: {
      discrepancyId: Number(facts.discrepancyId),
      auditId: Number(facts.auditId),
      statementId: Number(facts.statementId),
      platform: String(facts.platform),
      statementPeriod: String(facts.statementPeriod),
      trackName: String(facts.trackName),
      plays: String(facts.plays),
      territory: String(facts.territory),
      actualPayout: String(facts.actualPayout),
      expectedPayout: String(facts.expectedPayout),
      difference: String(facts.difference),
      threshold: String(facts.threshold),
      discrepancyStatus: String(facts.discrepancyStatus),
      artistName: String(facts.artistName),
    },
  }
}

export async function requestAiDisputeDraft(
  facts: VerifiedDisputeFacts,
  _recipient: string,
  options: {
    apiKey?: string
    model?: string
    client?: GeminiDraftClient
  } = {},
): Promise<AiDraftRequestResult> {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY

  if (!apiKey) {
    return { kind: 'not_configured' }
  }

  const prompt = [
    'You are the dispute-drafting assistant inside RoyaltyGuard, a fictional capstone/demo royalty-audit system.',
    '',
    'Draft a professional, factual email asking the recipient to review the discrepancy, using only the VERIFIED FACTS below.',
    '',
    'VERIFIED FACTS:',
    JSON.stringify(facts, null, 2),
    '',
    'Rules:',
    '1. Use only the supplied verified facts.',
    '2. Do not calculate any new financial values.',
    '3. Do not change, round, reinterpret, or invent any supplied amount, play count, platform, territory, identifier, or date.',
    '4. Do not invent a royalty rate if one is not supplied.',
    '5. Do not claim fraud, breach of contract, illegality, or wrongdoing.',
    '6. Do not invent a recipient name, account number, contract clause, correspondence history, payment reference, deadline, or contact details.',
    '7. Describe the issue neutrally as a discrepancy or variance requiring review.',
    '8. Ask the recipient to review the statement and the identified discrepancy.',
    '9. Put unknown information in missing_information instead of guessing.',
    '10. facts_used must list only verified facts actually used in the subject/body.',
    `11. facts_used must contain exact supplied camelCase fact paths: ${Object.keys(facts).join(', ')}.`,
    '',
    'Return only the requested structured JSON object. Do not use Markdown fences or add commentary.',
  ].join('\n')

  let response: GeminiDraftResponse

  try {
    const client: GeminiDraftClient = options.client ?? {
      models: {
        generateContent: async (input) => {
          const result = await new GoogleGenAI({ apiKey }).models.generateContent(input)
          return { text: result.text }
        },
      },
    }
    response = await client.models.generateContent({
      model: options.model ?? process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: DISPUTE_DRAFT_RESPONSE_SCHEMA,
        temperature: 0.2,
      },
    })
  } catch (error) {
    console.error('[dispute-draft] Gemini request failed', getGeminiErrorDiagnostics(error, apiKey))
    return { kind: 'ai_failed' }
  }

  if (typeof response.text !== 'string' || response.text.trim() === '') {
    return { kind: 'empty_response' }
  }

  let payload: unknown
  try {
    payload = JSON.parse(response.text)
  } catch {
    return { kind: 'invalid_json' }
  }

  try {
    const draft = parseAiDisputeDraft(payload)

    return {
      kind: 'draft',
      draft,
    }
  } catch (error) {
    return { kind: 'schema_invalid' }
  }
}

export async function createAiDisputeDraftForUser(
  input: CreateAiDisputeDraftInput,
): Promise<CreateAiDisputeDraftResult> {
  const assembled = await assembleVerifiedDisputeFacts(
    input.discrepancyId,
    input.userId,
  )

  if (assembled.kind === 'not_found') {
    return { kind: 'discrepancy_not_found' }
  }

  const aiResult = await requestAiDisputeDraft(
    assembled.facts,
    input.recipient,
  )

  if (aiResult.kind === 'not_configured') {
    return { kind: 'not_configured' }
  }

  if (aiResult.kind === 'ai_failed') {
    return { kind: 'ai_failed' }
  }

  if (aiResult.kind === 'empty_response' || aiResult.kind === 'invalid_json' || aiResult.kind === 'schema_invalid') {
    return { kind: aiResult.kind }
  }

  const dispute = await createAiDisputeForUser({
    discrepancyId: input.discrepancyId,
    userId: input.userId,
    recipient: input.recipient.trim(),
    subject: aiResult.draft.subject,
    body: aiResult.draft.body,
    factsUsed: aiResult.draft.factsUsed,
    missingInformation: aiResult.draft.missingInformation,
  })

  if (!dispute) {
    return { kind: 'discrepancy_not_found' }
  }

  return {
    kind: 'created',
    dispute,
  }
}
