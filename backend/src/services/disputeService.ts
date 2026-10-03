import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { pool } from '../database'

export interface DisputeRecord extends RowDataPacket {
  id: number
  discrepancyId: number
  recipient: string
  subject: string
  body: string
  source: string
  factsUsed: string[] | null
  missingInformation: string[] | null
  generatedAt: Date | null
  status: string
  sentAt: Date | null
  responseAt: Date | null
  followUpAt: Date | null
  createdAt: Date
  updatedAt: Date
  difference?: string
  expectedAmount?: string
  actualAmount?: string
  discrepancyStatus?: string
  threshold?: string
  trackName?: string
  plays?: string
  territory?: string
  statementId?: number
  platform?: string
  statementPeriod?: string
}

export interface CreateDisputeInput {
  discrepancyId: number
  userId: number
  recipient: string
  subject: string
  body: string
}

export interface CreateAiDisputeInput extends CreateDisputeInput {
  factsUsed: string[]
  missingInformation: string[]
}

export interface UpdateDisputeDraftInput {
  disputeId: number
  userId: number
  subject: string
  body: string
}

export type UpdateDisputeDraftResult = 'updated' | 'not_found' | 'not_draft'

export interface DisputeListOptions {
  status?: string
  page: number
  limit: number
}

const disputeColumns = `
  dp.id,
  dp.discrepancy_id AS discrepancyId,
  dp.recipient,
  dp.subject,
  dp.body,
  dp.source,
  dp.facts_used AS factsUsed,
  dp.missing_information AS missingInformation,
  dp.generated_at AS generatedAt,
  dp.status,
  dp.sent_at AS sentAt,
  dp.response_at AS responseAt,
  dp.follow_up_at AS followUpAt,
  dp.created_at AS createdAt,
  dp.updated_at AS updatedAt,
  d.difference,
  d.expected_amount AS expectedAmount,
  d.actual_amount AS actualAmount,
  d.threshold,
  d.status AS discrepancyStatus,
  r.track_name AS trackName,
  CAST(r.plays AS CHAR) AS plays,
  r.territory,
  s.id AS statementId,
  s.platform,
  s.statement_period AS statementPeriod
`

const ownershipJoins = `
  FROM disputes AS dp
  INNER JOIN discrepancies AS d ON d.id = dp.discrepancy_id
  INNER JOIN audits AS au ON au.id = d.audit_id
  INNER JOIN statements AS s ON s.id = au.statement_id
  INNER JOIN artists AS a ON a.id = s.artist_id
  INNER JOIN royalty_rows AS r ON r.id = d.royalty_row_id
`

export async function createDisputeForUser(
  input: CreateDisputeInput,
): Promise<DisputeRecord | null> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO disputes (discrepancy_id, recipient, subject, body)
    SELECT d.id, ?, ?, ?
    FROM discrepancies AS d
    INNER JOIN audits AS au ON au.id = d.audit_id
    INNER JOIN statements AS s ON s.id = au.statement_id
    INNER JOIN artists AS a ON a.id = s.artist_id
    WHERE d.id = ? AND a.user_id = ?`,
    [input.recipient, input.subject, input.body, input.discrepancyId, input.userId],
  )

  if (result.affectedRows !== 1) {
    return null
  }

  return getDisputeForUser(result.insertId, input.userId)
}

export async function createAiDisputeForUser(
  input: CreateAiDisputeInput,
): Promise<DisputeRecord | null> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO disputes (
      discrepancy_id, recipient, subject, body, source, facts_used,
      missing_information, generated_at
    )
    SELECT d.id, ?, ?, ?, 'ai', ?, ?, CURRENT_TIMESTAMP
    FROM discrepancies AS d
    INNER JOIN audits AS au ON au.id = d.audit_id
    INNER JOIN statements AS s ON s.id = au.statement_id
    INNER JOIN artists AS a ON a.id = s.artist_id
    WHERE d.id = ? AND a.user_id = ?`,
    [
      input.recipient,
      input.subject,
      input.body,
      JSON.stringify(input.factsUsed),
      JSON.stringify(input.missingInformation),
      input.discrepancyId,
      input.userId,
    ],
  )

  if (result.affectedRows !== 1) {
    return null
  }

  return getDisputeForUser(result.insertId, input.userId)
}

export async function updateDisputeDraftForUser(
  input: UpdateDisputeDraftInput,
): Promise<UpdateDisputeDraftResult> {
  const existing = await getDisputeForUser(input.disputeId, input.userId)

  if (!existing) {
    return 'not_found'
  }

  if (existing.status !== 'draft') {
    return 'not_draft'
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE disputes AS dp
    INNER JOIN discrepancies AS d ON d.id = dp.discrepancy_id
    INNER JOIN audits AS au ON au.id = d.audit_id
    INNER JOIN statements AS s ON s.id = au.statement_id
    INNER JOIN artists AS a ON a.id = s.artist_id
    SET dp.subject = ?, dp.body = ?
    WHERE dp.id = ? AND a.user_id = ? AND dp.status = 'draft'`,
    [input.subject, input.body, input.disputeId, input.userId],
  )

  return result.affectedRows === 1 ? 'updated' : 'not_draft'
}

export async function listDisputesForUser(
  userId: number,
  options: DisputeListOptions,
): Promise<{ disputes: DisputeRecord[]; total: number }> {
  const conditions = ['a.user_id = ?']
  const values: Array<number | string> = [userId]

  if (options.status) {
    conditions.push('dp.status = ?')
    values.push(options.status)
  }

  const where = conditions.join(' AND ')
  const offset = (options.page - 1) * options.limit
  const [disputes] = await pool.execute<DisputeRecord[]>(
    `SELECT ${disputeColumns}
    ${ownershipJoins}
    WHERE ${where}
    ORDER BY dp.created_at DESC, dp.id DESC
    LIMIT ? OFFSET ?`,
    [...values, options.limit, offset],
  )
  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
    ${ownershipJoins}
    WHERE ${where}`,
    values,
  )

  return { disputes, total: Number(countRows[0]?.total ?? 0) }
}

export async function getDisputeForUser(
  disputeId: number,
  userId: number,
): Promise<DisputeRecord | null> {
  const [rows] = await pool.execute<DisputeRecord[]>(
    `SELECT ${disputeColumns}
    ${ownershipJoins}
    WHERE dp.id = ? AND a.user_id = ?
    LIMIT 1`,
    [disputeId, userId],
  )

  return rows[0] ?? null
}

export async function reserveDisputeForSending(
  disputeId: number,
  userId: number,
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE disputes AS dp
    INNER JOIN discrepancies AS d ON d.id = dp.discrepancy_id
    INNER JOIN audits AS au ON au.id = d.audit_id
    INNER JOIN statements AS s ON s.id = au.statement_id
    INNER JOIN artists AS a ON a.id = s.artist_id
    SET dp.status = 'sending'
    WHERE dp.id = ? AND a.user_id = ? AND dp.status = 'draft'`,
    [disputeId, userId],
  )

  return result.affectedRows === 1
}

export async function releaseDisputeSend(disputeId: number, userId: number): Promise<void> {
  await pool.execute(
    `UPDATE disputes AS dp
    INNER JOIN discrepancies AS d ON d.id = dp.discrepancy_id
    INNER JOIN audits AS au ON au.id = d.audit_id
    INNER JOIN statements AS s ON s.id = au.statement_id
    INNER JOIN artists AS a ON a.id = s.artist_id
    SET dp.status = 'draft'
    WHERE dp.id = ? AND a.user_id = ? AND dp.status = 'sending'`,
    [disputeId, userId],
  )
}

export async function markDisputeSent(disputeId: number, userId: number): Promise<DisputeRecord | null> {
  await pool.execute(
    `UPDATE disputes AS dp
    INNER JOIN discrepancies AS d ON d.id = dp.discrepancy_id
    INNER JOIN audits AS au ON au.id = d.audit_id
    INNER JOIN statements AS s ON s.id = au.statement_id
    INNER JOIN artists AS a ON a.id = s.artist_id
    SET dp.status = 'sent', dp.sent_at = CURRENT_TIMESTAMP
    WHERE dp.id = ? AND a.user_id = ? AND dp.status = 'sending'`,
    [disputeId, userId],
  )

  return getDisputeForUser(disputeId, userId)
}