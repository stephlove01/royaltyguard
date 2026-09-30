import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { pool } from '../database'

export type StatementStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface StatementRecord extends RowDataPacket {
  id: number
  artistId: number
  platform: string
  fileName: string
  fileType: string
  statementPeriod: string
  status: StatementStatus
  createdAt: Date
  updatedAt: Date
}

export interface CreateStatementInput {
  userId: number
  artistId: number
  platform: string
  fileName: string
  fileType: 'csv' | 'pdf'
  statementPeriod: string
  storageLocation: string
}

export async function artistBelongsToUser(artistId: number, userId: number): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM artists WHERE id = ? AND user_id = ? LIMIT 1',
    [artistId, userId],
  )

  return rows.length > 0
}

const statementColumns = `
  s.id,
  s.artist_id AS artistId,
  s.platform,
  s.file_name AS fileName,
  s.file_type AS fileType,
  s.statement_period AS statementPeriod,
  s.status,
  s.created_at AS createdAt,
  s.updated_at AS updatedAt
`

export async function createStatement(
  input: CreateStatementInput,
): Promise<StatementRecord | null> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO statements (
      artist_id, platform, file_name, file_type, statement_period, storage_location
    )
    SELECT a.id, ?, ?, ?, ?, ?
    FROM artists AS a
    WHERE a.id = ? AND a.user_id = ?`,
    [
      input.platform,
      input.fileName,
      input.fileType,
      input.statementPeriod,
      input.storageLocation,
      input.artistId,
      input.userId,
    ],
  )

  if (result.affectedRows !== 1) {
    return null
  }

  return getStatementById(result.insertId, input.userId)
}

export async function getStatementById(
  statementId: number,
  userId: number,
): Promise<StatementRecord | null> {
  const [rows] = await pool.execute<StatementRecord[]>(
    `SELECT ${statementColumns}
    FROM statements AS s
    INNER JOIN artists AS a ON a.id = s.artist_id
    WHERE s.id = ? AND a.user_id = ?
    LIMIT 1`,
    [statementId, userId],
  )

  return rows[0] ?? null
}

export async function listStatementsForUser(userId: number): Promise<StatementRecord[]> {
  const [rows] = await pool.execute<StatementRecord[]>(
    `SELECT ${statementColumns}
    FROM statements AS s
    INNER JOIN artists AS a ON a.id = s.artist_id
    WHERE a.user_id = ?
    ORDER BY s.created_at DESC, s.id DESC`,
    [userId],
  )

  return rows
}

export async function updateStatementStatus(
  statementId: number,
  userId: number,
  status: StatementStatus,
): Promise<StatementRecord | null> {
  await pool.execute<ResultSetHeader>(
    `UPDATE statements AS s
    INNER JOIN artists AS a ON a.id = s.artist_id
    SET s.status = ?
    WHERE s.id = ? AND a.user_id = ?`,
    [status, statementId, userId],
  )

  return getStatementById(statementId, userId)
}