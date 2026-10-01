import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { pool } from '../database'

export interface N8nAuditRowResult {
  trackName: string
  eligibleUnits: string
  territory: string
  tier: string | null
  actualPayout: string
  rate: string
  expectedPayout: string
  difference: string
  shortfall: string
  isDiscrepancy: boolean
}

export interface PersistN8nAuditResultInput {
  statementId: number
  sourceFileId: string
  threshold: string
  totalExpected: string
  totalActual: string
  totalDifference: string
  results: N8nAuditRowResult[]
}

interface StatementRow extends RowDataPacket {
  id: number
}

interface RoyaltyRow extends RowDataPacket {
  id: number
  trackName: string
  eligibleUnits: string
  territory: string
  tier: string | null
  actualPayout: string
}

export type PersistN8nAuditResultOutcome =
  | { kind: 'persisted'; auditId: number; discrepancyCount: number }
  | { kind: 'statement_not_found' }
  | { kind: 'royalty_rows_mismatch' }

export async function persistN8nAuditResult(
  input: PersistN8nAuditResultInput,
): Promise<PersistN8nAuditResultOutcome> {
  const connection = await pool.getConnection()
  let transactionStarted = false

  try {
    await connection.beginTransaction()
    transactionStarted = true

    const [statements] = await connection.execute<StatementRow[]>(
      `SELECT id FROM statements
      WHERE id = ? AND source_file_id = ?
      LIMIT 1 FOR UPDATE`,
      [input.statementId, input.sourceFileId],
    )
    if (!statements[0]) {
      await connection.rollback()
      transactionStarted = false
      return { kind: 'statement_not_found' }
    }

    const [royaltyRows] = await connection.execute<RoyaltyRow[]>(
      `SELECT id, track_name AS trackName, CAST(plays AS CHAR) AS eligibleUnits,
        territory, tier, CAST(actual_payout AS CHAR) AS actualPayout
      FROM royalty_rows WHERE statement_id = ? ORDER BY id FOR UPDATE`,
      [input.statementId],
    )

    if (
      royaltyRows.length !== input.results.length ||
      royaltyRows.some((row, index) => {
        const result = input.results[index]
        return row.trackName !== result.trackName ||
          row.eligibleUnits !== result.eligibleUnits ||
          row.territory !== result.territory ||
          row.tier !== result.tier ||
          row.actualPayout !== result.actualPayout
      })
    ) {
      await connection.rollback()
      transactionStarted = false
      return { kind: 'royalty_rows_mismatch' }
    }

    const [auditRows] = await connection.execute<RowDataPacket[]>(
      'SELECT id FROM audits WHERE statement_id = ? LIMIT 1 FOR UPDATE',
      [input.statementId],
    )
    let auditId: number

    if (auditRows[0]) {
      auditId = Number(auditRows[0].id)
      await connection.execute(
        `UPDATE audits SET status = 'completed', total_expected = ?,
          total_actual = ?, total_difference = ? WHERE id = ?`,
        [input.totalExpected, input.totalActual, input.totalDifference, auditId],
      )
    } else {
      const [auditInsert] = await connection.execute<ResultSetHeader>(
        `INSERT INTO audits (
          statement_id, status, total_expected, total_actual, total_difference
        ) VALUES (?, 'completed', ?, ?, ?)`,
        [input.statementId, input.totalExpected, input.totalActual, input.totalDifference],
      )
      auditId = auditInsert.insertId
    }

    await connection.execute(
      "UPDATE discrepancies SET status = 'resolved' WHERE audit_id = ? AND status <> 'resolved'",
      [auditId],
    )

    let discrepancyCount = 0
    for (let index = 0; index < input.results.length; index++) {
      const result = input.results[index]
      if (!result.isDiscrepancy) continue

      discrepancyCount++
      await connection.execute(
        `INSERT INTO discrepancies (
          audit_id, royalty_row_id, expected_amount, actual_amount,
          difference, threshold, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'open')
        ON DUPLICATE KEY UPDATE
          expected_amount = VALUES(expected_amount),
          actual_amount = VALUES(actual_amount),
          difference = VALUES(difference),
          threshold = VALUES(threshold),
          status = 'open'`,
        [
          auditId,
          royaltyRows[index].id,
          result.expectedPayout,
          result.actualPayout,
          result.difference,
          input.threshold,
        ],
      )
    }

    await connection.execute("UPDATE statements SET status = 'completed' WHERE id = ?", [input.statementId])
    await connection.commit()
    transactionStarted = false

    return { kind: 'persisted', auditId, discrepancyCount }
  } catch (error) {
    if (transactionStarted) await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}