import { RowDataPacket } from 'mysql2/promise'
import { pool } from '../database'
import { createAiDisputeForUser, DisputeRecord } from './disputeService'
import {
  extractAiDisputeDraftPayload,
  parseAiDisputeDraft,
  ParsedAiDisputeDraft,
  VerifiedDisputeFacts,
} from './disputeDraftSchema'

// TASK-076 — AI dispute draft flow.
//
// The backend never lets the model invent financial values. It reads persisted
// audit/discrepancy/statement/artist records, forwards only those verified facts
// to the n8n Gemini draft workflow, validates the strict structured response,
// and persists the resulting draft with its provenance.

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
  const [rows] = await pool.execute<DisputeFactRow[]>(
    `SELECT
      d.id AS discrepancyId,
      d.audit_id AS auditId,
      au.statement_id AS statementId,
      d.expected_amount AS expectedPayout,
      d.actual_amount AS actualPayout,
      d.difference,
      d.threshold,
      d.status AS discrepancyStatus,
      s.platform,
      s.statement_period AS statementPeriod,
      r.track_name AS trackName,
      CAST(r.plays AS CHAR) AS plays,
      r.territory,
      ar.name AS artistName
    FROM discrepancies AS d
    INNER JOIN audits AS au ON au.id = d.audit_id
    INNER JOIN statements AS s ON s.id = au.statement_id
    INNER JOIN artists AS ar ON ar.id = s.artist_id
    INNER JOIN royalty_rows AS r ON r.id = d.royalty_row_id
    WHERE d.id = ? AND ar.user_id = ?
    LIMIT 1`,
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
): Promise<AiDraftRequestResult> {
  const webhookUrl = process.env.N8N_DISPUTE_DRAFT_WEBHOOK_URL
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET

  if (!webhookUrl || !webhookSecret) {
    return { kind: 'not_configured' }
  }

  let response: Response

  try {
    response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-Webhook-Secret': webhookSecret,
      },
      body: JSON.stringify({ discrepancy: facts }),
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
    return { kind: 'invalid_draft', message: 'AI draft response was not valid JSON' }
  }

  try {
    const draft = parseAiDisputeDraft(extractAiDisputeDraftPayload(payload))
    return { kind: 'draft', draft }
  } catch (error) {
    return {
      kind: 'invalid_draft',
      message: error instanceof Error ? error.message : 'AI draft response was invalid',
    }
  }
}

export async function createAiDisputeDraftForUser(
  input: CreateAiDisputeDraftInput,
): Promise<CreateAiDisputeDraftResult> {
  const assembled = await assembleVerifiedDisputeFacts(input.discrepancyId, input.userId)

  if (assembled.kind === 'not_found') {
    return { kind: 'discrepancy_not_found' }
  }

  const aiResult = await requestAiDisputeDraft(assembled.facts)

  if (aiResult.kind === 'not_configured') {
    return { kind: 'not_configured' }
  }

  if (aiResult.kind === 'ai_failed') {
    return { kind: 'ai_failed' }
  }

  if (aiResult.kind === 'invalid_draft') {
    return { kind: 'invalid_draft', message: aiResult.message }
  }

  const dispute = await createAiDisputeForUser({
    discrepancyId: input.discrepancyId,
    userId: input.userId,
    recipient: input.recipient,
    subject: aiResult.draft.subject,
    body: aiResult.draft.body,
    factsUsed: aiResult.draft.factsUsed,
    missingInformation: aiResult.draft.missingInformation,
  })

  if (!dispute) {
    return { kind: 'discrepancy_not_found' }
  }

  return { kind: 'created', dispute }
}
