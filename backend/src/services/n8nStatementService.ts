import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { pool } from '../database'
import { CanonicalRoyaltyStatement } from './royaltySchema'

export interface N8nSourceMetadata {
  sourceFileId: string
  fileName: string
  mimeType: string
  sourceLocation?: string
  createdTime?: string
  modifiedTime?: string
}

export interface CreateN8nStatementInput extends CanonicalRoyaltyStatement {
  sourceMetadata: N8nSourceMetadata
}

interface ArtistRow extends RowDataPacket {
  id: number
}

interface StatementOwnerRow extends RowDataPacket {
  userId: number
}

export type CreateN8nStatementResult =
  | { kind: 'created'; statementId: number; idempotentReplay: false }
  | { kind: 'existing'; statementId: number; idempotentReplay: true }
  | { kind: 'not_configured' }
  | { kind: 'artist_not_found' }

export type N8nStatementOwnerResult =
  | { kind: 'found'; userId: number }
  | { kind: 'not_configured' }
  | { kind: 'not_found' }

function configuredArtistId(): number | null {
  const value = process.env.N8N_STATEMENT_ARTIST_ID

  if (!value || !/^\d+$/.test(value)) return null

  const artistId = Number(value)
  return Number.isSafeInteger(artistId) && artistId > 0 && artistId <= 4294967295
    ? artistId
    : null
}

export async function createN8nStatement(
  input: CreateN8nStatementInput,
): Promise<CreateN8nStatementResult> {
  const artistId = configuredArtistId()
  if (!artistId) return { kind: 'not_configured' }

  const connection = await pool.getConnection()
  let transactionStarted = false

  try {
    await connection.beginTransaction()
    transactionStarted = true

    const [existingStatements] = await connection.execute<RowDataPacket[]>(
      'SELECT id FROM statements WHERE source_file_id = ? LIMIT 1 FOR UPDATE',
      [input.sourceMetadata.sourceFileId],
    )

    if (existingStatements[0]) {
      await connection.commit()
      transactionStarted = false
      return {
        kind: 'existing',
        statementId: Number(existingStatements[0].id),
        idempotentReplay: true,
      }
    }

    const [artists] = await connection.execute<ArtistRow[]>(
      'SELECT id FROM artists WHERE id = ? LIMIT 1 FOR UPDATE',
      [artistId],
    )

    if (!artists[0]) {
      await connection.rollback()
      transactionStarted = false
      return { kind: 'artist_not_found' }
    }

    const storageLocation = `google-drive://${encodeURIComponent(input.sourceMetadata.sourceFileId)}`
    const [statementResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO statements (
        artist_id, platform, file_name, file_type, statement_period,
        storage_location, source_metadata, source_file_id
      ) VALUES (?, ?, ?, 'csv', ?, ?, ?, ?)`,
      [
        artistId,
        input.platform,
        input.sourceMetadata.fileName,
        input.statementPeriod,
        storageLocation,
        JSON.stringify(input.sourceMetadata),
        input.sourceMetadata.sourceFileId,
      ],
    )
    const statementId = statementResult.insertId

    for (const row of input.rows) {
      await connection.execute(
        `INSERT INTO royalty_rows (
          statement_id, track_name, plays, territory, tier, actual_payout
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          statementId,
          row.trackName,
          row.eligibleUnits,
          row.territory,
          row.tier,
          row.actualPayout,
        ],
      )
    }

    await connection.commit()
    transactionStarted = false
    return { kind: 'created', statementId, idempotentReplay: false }
  } catch (error) {
    if (transactionStarted) await connection.rollback()

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ER_DUP_ENTRY'
    ) {
      const [existingStatements] = await connection.execute<RowDataPacket[]>(
        'SELECT id FROM statements WHERE source_file_id = ? LIMIT 1',
        [input.sourceMetadata.sourceFileId],
      )
      if (existingStatements[0]) {
        return {
          kind: 'existing',
          statementId: Number(existingStatements[0].id),
          idempotentReplay: true,
        }
      }
    }

    throw error
  } finally {
    connection.release()
  }
}

export async function getN8nStatementOwner(
  statementId: number,
): Promise<N8nStatementOwnerResult> {
  const artistId = configuredArtistId()
  if (!artistId) return { kind: 'not_configured' }

  const [rows] = await pool.execute<StatementOwnerRow[]>(
    `SELECT a.user_id AS userId
    FROM statements AS s
    INNER JOIN artists AS a ON a.id = s.artist_id
    WHERE s.id = ? AND a.id = ?
    LIMIT 1`,
    [statementId, artistId],
  )

  return rows[0]
    ? { kind: 'found', userId: Number(rows[0].userId) }
    : { kind: 'not_found' }
}