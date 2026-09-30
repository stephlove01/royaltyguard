import { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { pool } from '../database'
import {
  findOrCreateAudit,
  markAuditFailed,
  persistCompletedAudit,
  readAudit,
  readDiscrepancies,
} from './auditPersistenceService'
import { normalizeRoyaltyRow } from './normalizationService'
import { CanonicalRoyaltyRow } from './royaltySchema'
import { findApplicableRoyaltyRate } from './royaltyRateService'
import { calculateRoyalty } from './royaltyCalculationService'
import { getDiscrepancyThresholdCents } from './discrepancyThresholdService'

interface StatementForAudit extends RowDataPacket {
  id: number
  platform: string
  statementPeriod: string
}

interface StatementSummary extends RowDataPacket {
  id: number
  platform: string
  statementPeriod: string
}

interface DatabaseRoyaltyRow extends RowDataPacket {
  id: number
  trackName: string
  eligibleUnits: string
  territory: string
  tier: string | null
  actualPayout: string
}

export interface AuditRecord extends RowDataPacket {
  id: number
  statementId: number
  status: 'pending' | 'completed' | 'failed'
  totalExpected: string
  totalActual: string
  totalDifference: string
  createdAt: Date
  updatedAt: Date
}

export interface DiscrepancyRecord extends RowDataPacket {
  id: number
  auditId: number
  royaltyRowId: number
  expectedAmount: string
  actualAmount: string
  difference: string
  threshold: string
  status: string
  trackName?: string
  plays?: string
  territory?: string
  platform?: string
  statementPeriod?: string
}

export interface MissingRateRow {
  royaltyRowId: number
  trackName: string
  territory: string
}

export interface AuditListOptions {
  status?: string
  statementId?: number
  page: number
  limit: number
}

export interface AuditDetail {
  audit: AuditRecord
  statement: {
    id: number
    platform: string
    statementPeriod: string
  }
  discrepancies: DiscrepancyRecord[]
}

export type RunAuditResult =
  | { kind: 'not_found' }
  | {
      kind: 'failed'
      audit: AuditRecord
      code: 'NO_ROYALTY_ROWS' | 'ROYALTY_RATE_NOT_FOUND' | 'INVALID_STATEMENT_PERIOD'
      message: string
      missingRates?: MissingRateRow[]
    }
  | { kind: 'completed'; audit: AuditRecord; discrepancies: DiscrepancyRecord[] }

function periodStartDate(statementPeriod: string): string | null {
  let date: string | undefined
  const quarter = /^(\d{4})-Q([1-4])$/i.exec(statementPeriod)

  if (quarter) {
    const month = (Number(quarter[2]) - 1) * 3 + 1
    date = `${quarter[1]}-${String(month).padStart(2, '0')}-01`
  } else if (/^\d{4}$/.test(statementPeriod)) {
    date = `${statementPeriod}-01-01`
  } else if (/^\d{4}-\d{2}$/.test(statementPeriod)) {
    date = `${statementPeriod}-01`
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(statementPeriod)) {
    date = statementPeriod
  }

  if (!date) {
    return null
  }

  const parsed = new Date(`${date}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date
    ? null
    : date
}

export async function runStatementAudit(
  statementId: number,
  userId: number,
): Promise<RunAuditResult> {
  const thresholdCents = getDiscrepancyThresholdCents()
  const connection = await pool.getConnection()
  let transactionStarted = false

  try {
    await connection.beginTransaction()
    transactionStarted = true

    const [statements] = await connection.execute<StatementForAudit[]>(
      `SELECT s.id, s.platform, s.statement_period AS statementPeriod
      FROM statements AS s
      INNER JOIN artists AS a ON a.id = s.artist_id
      WHERE s.id = ? AND a.user_id = ?
      FOR UPDATE`,
      [statementId, userId],
    )
    const statement = statements[0]

    if (!statement) {
      await connection.rollback()
      transactionStarted = false
      return { kind: 'not_found' }
    }

    const auditId = await findOrCreateAudit(connection, statement.id)
    const periodStart = periodStartDate(statement.statementPeriod)

    if (!periodStart) {
      const audit = await markAuditFailed(connection, auditId, statement.id)
      await connection.commit()
      transactionStarted = false
      return {
        kind: 'failed',
        audit,
        code: 'INVALID_STATEMENT_PERIOD',
        message: 'Statement period must be a year, month, date, or quarter such as 2026-Q1',
      }
    }

    const [royaltyRows] = await connection.execute<DatabaseRoyaltyRow[]>(
      `SELECT id, track_name AS trackName, CAST(plays AS CHAR) AS eligibleUnits,
        territory, tier, CAST(actual_payout AS CHAR) AS actualPayout
      FROM royalty_rows WHERE statement_id = ? ORDER BY id`,
      [statement.id],
    )

    if (royaltyRows.length === 0) {
      const audit = await markAuditFailed(connection, auditId, statement.id)
      await connection.commit()
      transactionStarted = false
      return {
        kind: 'failed',
        audit,
        code: 'NO_ROYALTY_ROWS',
        message: 'The statement has no royalty rows to audit',
      }
    }

    const canonicalRows: Array<CanonicalRoyaltyRow & { id: number }> = royaltyRows.map((row) => ({
      ...normalizeRoyaltyRow(row),
      id: row.id,
    }))

    const calculations: Array<{
      row: CanonicalRoyaltyRow & { id: number }
      expectedCents: bigint
      actualCents: bigint
      differenceCents: bigint
    }> = []
    const missingRates: MissingRateRow[] = []

    for (const row of canonicalRows) {
      const rate = await findApplicableRoyaltyRate(connection, {
        platform: statement.platform,
        territory: row.territory,
        periodStart,
      })

      if (!rate) {
        missingRates.push({
          royaltyRowId: row.id,
          trackName: row.trackName,
          territory: row.territory,
        })
        continue
      }

      const calculation = calculateRoyalty(row.eligibleUnits, rate.rate, row.actualPayout)
      calculations.push({ row, ...calculation })
    }

    if (missingRates.length > 0) {
      const audit = await markAuditFailed(connection, auditId, statement.id)
      await connection.commit()
      transactionStarted = false
      return {
        kind: 'failed',
        audit,
        code: 'ROYALTY_RATE_NOT_FOUND',
        message: 'No applicable royalty rate was found for one or more royalty rows',
        missingRates,
      }
    }

    await persistCompletedAudit(
      connection,
      auditId,
      statement.id,
      calculations.map((calculation) => ({
        royaltyRowId: calculation.row.id,
        expectedCents: calculation.expectedCents,
        actualCents: calculation.actualCents,
        differenceCents: calculation.differenceCents,
      })),
      thresholdCents,
    )

    const audit = await readAudit(connection, auditId)
    const discrepancies = await readDiscrepancies(connection, auditId)
    await connection.commit()
    transactionStarted = false

    return { kind: 'completed', audit, discrepancies }
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback()
    }
    throw error
  } finally {
    connection.release()
  }
}

export async function listAuditsForUser(
  userId: number,
  options: AuditListOptions,
): Promise<{ audits: AuditRecord[]; total: number }> {
  const conditions = ['a.user_id = ?']
  const values: Array<number | string> = [userId]

  if (options.status) {
    conditions.push('au.status = ?')
    values.push(options.status)
  }

  if (options.statementId !== undefined) {
    conditions.push('au.statement_id = ?')
    values.push(options.statementId)
  }

  const where = conditions.join(' AND ')
  const offset = (options.page - 1) * options.limit
  const [audits] = await pool.execute<AuditRecord[]>(
    `SELECT au.id, au.statement_id AS statementId, au.status,
      au.total_expected AS totalExpected, au.total_actual AS totalActual,
      au.total_difference AS totalDifference, au.created_at AS createdAt,
      au.updated_at AS updatedAt
    FROM audits AS au
    INNER JOIN statements AS s ON s.id = au.statement_id
    INNER JOIN artists AS a ON a.id = s.artist_id
    WHERE ${where}
    ORDER BY au.created_at DESC, au.id DESC
    LIMIT ? OFFSET ?`,
    [...values, options.limit, offset],
  )
  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
    FROM audits AS au
    INNER JOIN statements AS s ON s.id = au.statement_id
    INNER JOIN artists AS a ON a.id = s.artist_id
    WHERE ${where}`,
    values,
  )

  return { audits, total: Number(countRows[0]?.total ?? 0) }
}

export async function getAuditForUser(
  auditId: number,
  userId: number,
): Promise<AuditDetail | null> {
  const [audits] = await pool.execute<AuditRecord[]>(
    `SELECT au.id, au.statement_id AS statementId, au.status,
      au.total_expected AS totalExpected, au.total_actual AS totalActual,
      au.total_difference AS totalDifference, au.created_at AS createdAt,
      au.updated_at AS updatedAt
    FROM audits AS au
    INNER JOIN statements AS s ON s.id = au.statement_id
    INNER JOIN artists AS a ON a.id = s.artist_id
    WHERE au.id = ? AND a.user_id = ?
    LIMIT 1`,
    [auditId, userId],
  )
  const audit = audits[0]

  if (!audit) {
    return null
  }

  const [statements] = await pool.execute<StatementSummary[]>(
    `SELECT s.id, s.platform, s.statement_period AS statementPeriod
    FROM statements AS s
    INNER JOIN artists AS a ON a.id = s.artist_id
    WHERE s.id = ? AND a.user_id = ?
    LIMIT 1`,
    [audit.statementId, userId],
  )
  const [discrepancies] = await pool.execute<DiscrepancyRecord[]>(
    `SELECT d.id, d.audit_id AS auditId, d.royalty_row_id AS royaltyRowId,
      d.expected_amount AS expectedAmount, d.actual_amount AS actualAmount,
      d.difference, d.threshold, d.status, r.track_name AS trackName,
      CAST(r.plays AS CHAR) AS plays, r.territory
    FROM discrepancies AS d
    INNER JOIN royalty_rows AS r ON r.id = d.royalty_row_id
    WHERE d.audit_id = ?
    ORDER BY d.id`,
    [audit.id],
  )

  return { audit, statement: statements[0], discrepancies }
}