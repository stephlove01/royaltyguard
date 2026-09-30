import { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { pool } from '../database'
import { normalizeRoyaltyRow } from './normalizationService'
import { CanonicalRoyaltyRow } from './royaltySchema'
import { findApplicableRoyaltyRate } from './royaltyRateService'

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

const centsPerUnit = 100n
const microUnitsPerRate = 1_000_000n
const microUnitsPerCent = 10_000n

function parseScaledDecimal(value: string, scale: number): bigint {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value)

  if (!match) {
    throw new Error('Invalid decimal value in database or configuration')
  }

  const fraction = match[3] ?? ''

  if (fraction.length > scale && /[^0]/.test(fraction.slice(scale))) {
    throw new Error('Decimal value exceeds the supported precision')
  }

  const scaled = BigInt(match[2]) * 10n ** BigInt(scale) + BigInt(fraction.slice(0, scale).padEnd(scale, '0') || '0')
  return match[1] === '-' ? -scaled : scaled
}

function formatCents(cents: bigint): string {
  const negative = cents < 0n
  const absolute = negative ? -cents : cents
  const whole = absolute / centsPerUnit
  const fraction = (absolute % centsPerUnit).toString().padStart(2, '0')
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

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

function getThresholdCents(): bigint {
  const configured = process.env.DISCREPANCY_THRESHOLD ?? '0.00'
  const thresholdCents = parseScaledDecimal(configured, 2)

  if (thresholdCents < 0n) {
    throw new Error('DISCREPANCY_THRESHOLD must not be negative')
  }

  return thresholdCents
}

async function findOrCreateAudit(connection: PoolConnection, statementId: number): Promise<number> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    'SELECT id FROM audits WHERE statement_id = ? ORDER BY id LIMIT 1 FOR UPDATE',
    [statementId],
  )

  if (rows[0]) {
    return Number(rows[0].id)
  }

  const [result] = await connection.execute(
    'INSERT INTO audits (statement_id, status) VALUES (?, ?)',
    [statementId, 'pending'],
  )
  return Number((result as { insertId: number }).insertId)
}

async function readAudit(connection: PoolConnection, auditId: number): Promise<AuditRecord> {
  const [rows] = await connection.execute<AuditRecord[]>(
    `SELECT id, statement_id AS statementId, status,
      total_expected AS totalExpected, total_actual AS totalActual,
      total_difference AS totalDifference, created_at AS createdAt, updated_at AS updatedAt
    FROM audits WHERE id = ? LIMIT 1`,
    [auditId],
  )

  return rows[0]
}

async function readDiscrepancies(
  connection: PoolConnection,
  auditId: number,
): Promise<DiscrepancyRecord[]> {
  const [rows] = await connection.execute<DiscrepancyRecord[]>(
    `SELECT id, audit_id AS auditId, royalty_row_id AS royaltyRowId,
      expected_amount AS expectedAmount, actual_amount AS actualAmount,
      difference, threshold, status
    FROM discrepancies WHERE audit_id = ? ORDER BY id`,
    [auditId],
  )

  return rows
}

async function markAuditFailed(
  connection: PoolConnection,
  auditId: number,
  statementId: number,
): Promise<AuditRecord> {
  await connection.execute(
    `UPDATE audits SET status = 'failed', total_expected = 0,
      total_actual = 0, total_difference = 0 WHERE id = ?`,
    [auditId],
  )
  await connection.execute("UPDATE statements SET status = 'failed' WHERE id = ?", [statementId])
  return readAudit(connection, auditId)
}

export async function runStatementAudit(
  statementId: number,
  userId: number,
): Promise<RunAuditResult> {
  const thresholdCents = getThresholdCents()
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
    let totalExpectedCents = 0n
    let totalActualCents = 0n

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

      const plays = BigInt(row.eligibleUnits)
      const rateMicros = parseScaledDecimal(rate.rate, 6)
      const actualCents = parseScaledDecimal(row.actualPayout, 2)

      if (plays < 0n || rateMicros < 0n) {
        throw new Error('Royalty rows and rates must not be negative')
      }

      const expectedCents = (plays * rateMicros + microUnitsPerCent / 2n) / microUnitsPerCent
      const differenceCents = expectedCents - actualCents
      calculations.push({ row, expectedCents, actualCents, differenceCents })
      totalExpectedCents += expectedCents
      totalActualCents += actualCents
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

    await connection.execute(
      "UPDATE discrepancies SET status = 'resolved' WHERE audit_id = ? AND status <> 'resolved'",
      [auditId],
    )

    for (const calculation of calculations) {
      if (calculation.differenceCents > thresholdCents) {
        const values = [
          formatCents(calculation.expectedCents),
          formatCents(calculation.actualCents),
          formatCents(calculation.differenceCents),
          formatCents(thresholdCents),
        ]
        const [existing] = await connection.execute<RowDataPacket[]>(
          `SELECT id FROM discrepancies
          WHERE audit_id = ? AND royalty_row_id = ?
          ORDER BY id LIMIT 1 FOR UPDATE`,
          [auditId, calculation.row.id],
        )

        if (existing[0]) {
          await connection.execute(
            `UPDATE discrepancies
            SET expected_amount = ?, actual_amount = ?, difference = ?, threshold = ?, status = 'open'
            WHERE id = ?`,
            [...values, existing[0].id],
          )
        } else {
          await connection.execute(
            `INSERT INTO discrepancies (
              audit_id, royalty_row_id, expected_amount, actual_amount, difference, threshold
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [auditId, calculation.row.id, ...values],
          )
        }
      }
    }

    await connection.execute(
      `UPDATE audits SET status = 'completed', total_expected = ?,
        total_actual = ?, total_difference = ? WHERE id = ?`,
      [
        formatCents(totalExpectedCents),
        formatCents(totalActualCents),
        formatCents(totalExpectedCents - totalActualCents),
        auditId,
      ],
    )
    await connection.execute("UPDATE statements SET status = 'completed' WHERE id = ?", [statement.id])

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