import { PoolConnection, RowDataPacket } from 'mysql2/promise'
import type { AuditRecord, DiscrepancyRecord } from './auditService'
import { exceedsDiscrepancyThreshold } from './discrepancyThresholdService'
import { formatCents } from './royaltyCalculationService'

export interface PersistedCalculation {
  royaltyRowId: number
  expectedCents: bigint
  actualCents: bigint
  differenceCents: bigint
}

export async function findOrCreateAudit(
  connection: PoolConnection,
  statementId: number,
): Promise<number> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    'SELECT id FROM audits WHERE statement_id = ? ORDER BY id LIMIT 1 FOR UPDATE',
    [statementId],
  )

  if (rows[0]) return Number(rows[0].id)

  const [result] = await connection.execute(
    'INSERT INTO audits (statement_id, status) VALUES (?, ?)',
    [statementId, 'pending'],
  )
  return Number((result as { insertId: number }).insertId)
}

export async function readAudit(
  connection: PoolConnection,
  auditId: number,
): Promise<AuditRecord> {
  const [rows] = await connection.execute<AuditRecord[]>(
    `SELECT id, statement_id AS statementId, status,
      total_expected AS totalExpected, total_actual AS totalActual,
      total_difference AS totalDifference, created_at AS createdAt, updated_at AS updatedAt
    FROM audits WHERE id = ? LIMIT 1`,
    [auditId],
  )
  return rows[0]
}

export async function readDiscrepancies(
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

export async function markAuditFailed(
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

export async function persistCompletedAudit(
  connection: PoolConnection,
  auditId: number,
  statementId: number,
  calculations: PersistedCalculation[],
  thresholdCents: bigint,
): Promise<void> {
  await connection.execute(
    "UPDATE discrepancies SET status = 'resolved' WHERE audit_id = ? AND status <> 'resolved'",
    [auditId],
  )

  for (const calculation of calculations) {
    if (!exceedsDiscrepancyThreshold(calculation.differenceCents, thresholdCents)) continue

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
      [auditId, calculation.royaltyRowId],
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
        [auditId, calculation.royaltyRowId, ...values],
      )
    }
  }

  const totalExpectedCents = calculations.reduce((total, item) => total + item.expectedCents, 0n)
  const totalActualCents = calculations.reduce((total, item) => total + item.actualCents, 0n)

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
  await connection.execute("UPDATE statements SET status = 'completed' WHERE id = ?", [statementId])
}
