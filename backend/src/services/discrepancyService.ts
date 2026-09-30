import { RowDataPacket } from 'mysql2/promise'
import { pool } from '../database'

export interface DiscrepancyRecord extends RowDataPacket {
  id: number
  auditId: number
  statementId: number
  royaltyRowId: number
  expectedAmount: string
  actualAmount: string
  difference: string
  threshold: string
  status: string
  trackName: string
  plays: string
  territory: string
  platform: string
  statementPeriod: string
  createdAt: Date
}

export interface DiscrepancyListOptions {
  status?: string
  auditId?: number
  page: number
  limit: number
}

const discrepancyColumns = `
  d.id,
  d.audit_id AS auditId,
  au.statement_id AS statementId,
  d.royalty_row_id AS royaltyRowId,
  d.expected_amount AS expectedAmount,
  d.actual_amount AS actualAmount,
  d.difference,
  d.threshold,
  d.status,
  r.track_name AS trackName,
  CAST(r.plays AS CHAR) AS plays,
  r.territory,
  s.platform,
  s.statement_period AS statementPeriod,
  d.created_at AS createdAt
`

const ownershipJoins = `
  FROM discrepancies AS d
  INNER JOIN audits AS au ON au.id = d.audit_id
  INNER JOIN statements AS s ON s.id = au.statement_id
  INNER JOIN artists AS a ON a.id = s.artist_id
  INNER JOIN royalty_rows AS r ON r.id = d.royalty_row_id
`

export async function listDiscrepanciesForUser(
  userId: number,
  options: DiscrepancyListOptions,
): Promise<{ discrepancies: DiscrepancyRecord[]; total: number }> {
  const conditions = ['a.user_id = ?']
  const values: Array<number | string> = [userId]

  if (options.status) {
    conditions.push('d.status = ?')
    values.push(options.status)
  }

  if (options.auditId !== undefined) {
    conditions.push('d.audit_id = ?')
    values.push(options.auditId)
  }

  const where = conditions.join(' AND ')
  const offset = (options.page - 1) * options.limit
  const [discrepancies] = await pool.execute<DiscrepancyRecord[]>(
    `SELECT ${discrepancyColumns}
    ${ownershipJoins}
    WHERE ${where}
    ORDER BY d.created_at DESC, d.id DESC
    LIMIT ? OFFSET ?`,
    [...values, options.limit, offset],
  )
  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
    ${ownershipJoins}
    WHERE ${where}`,
    values,
  )

  return { discrepancies, total: Number(countRows[0]?.total ?? 0) }
}

export async function getDiscrepancyForUser(
  discrepancyId: number,
  userId: number,
): Promise<DiscrepancyRecord | null> {
  const [rows] = await pool.execute<DiscrepancyRecord[]>(
    `SELECT ${discrepancyColumns}
    ${ownershipJoins}
    WHERE d.id = ? AND a.user_id = ?
    LIMIT 1`,
    [discrepancyId, userId],
  )

  return rows[0] ?? null
}