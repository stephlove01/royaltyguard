import { RowDataPacket } from 'mysql2/promise'
import { pool } from '../database'
import { createAiDisputeForUser, DisputeRecord } from './disputeService'
import {
  extractAiDisputeDraftPayload,
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
  | { kind: 'invalid_draft'; message: string }

export type CreateAiDisputeDraftResult =
  | { kind: 'created'; dispute: DisputeRecord }
  | { kind: 'discrepancy_not_found' }
  | { kind: 'not_configured' }
  | { kind: 'ai_failed' }
  | { kind: 'invalid_draft'; message: string }

export interface CreateAiDisputeDraftInput {
  discrepancyId: number
  userId: number
  recipient: string
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
  recipient: string,
): Promise<AiDraftRequestResult> {
  const webhookUrl = process.env.N8N_DISPUTE_DRAFT_WEBHOOK_URL
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET

  if (!webhookUrl || !webhookSecret) {
    return { kind: 'not_configured' }
  }

  const prompt = [
    'You are the dispute-drafting assistant inside RoyaltyGuard, a fictional capstone/demo royalty-audit system.',
    '',
    'Create a professional email draft using ONLY the VERIFIED FACTS below.',
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
    '',
    'Return JSON matching exactly:',
    '{',
    '  "subject": "string",',
    '  "body": "string",',
    '  "facts_used": ["string"],',
    '  "missing_information": ["string"]',
    '}',
  ].join('\n')

  let response: Response

  try {
    response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-Webhook-Secret': webhookSecret,
      },
      body: JSON.stringify({
        recipient: recipient.trim(),
        discrepancy: facts,
        prompt,
      }),
      signal: AbortSignal.timeout(20000),
    })
  } catch {
    return { kind: 'ai_failed' }
  }

  if (!response.ok) {
    return { kind: 'ai_failed' }
  }

  let payload: unknown

  try {
    payload = await response.json()
  } catch {
    return {
      kind: 'invalid_draft',
      message: 'AI draft response was not valid JSON',
    }
  }

  try {
    const draft = parseAiDisputeDraft(
      extractAiDisputeDraftPayload(payload),
    )

    return {
      kind: 'draft',
      draft,
    }
  } catch (error) {
    return {
      kind: 'invalid_draft',
      message:
        error instanceof Error
          ? error.message
          : 'AI draft response was invalid',
    }
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

  if (aiResult.kind === 'invalid_draft') {
    return {
      kind: 'invalid_draft',
      message: aiResult.message,
    }
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