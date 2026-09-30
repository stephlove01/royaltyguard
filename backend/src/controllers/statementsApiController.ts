import { access } from 'node:fs/promises'
import { extname } from 'node:path'
import { RequestHandler } from 'express'
import { AuthenticatedRequest } from '../middleware/authenticateToken'
import { validateRequest } from '../middleware/validateRequest'
import {
  artistBelongsToUser,
  createStatement as persistStatement,
  getStatementById as findStatementById,
  listStatementsForUser,
} from '../services/statementService'
import { getUserStatementFilePath } from '../utils/statementStorage'

const statementIdRule = {
  type: 'string' as const,
  required: true,
  validate: (value: unknown) =>
    typeof value === 'string' &&
    /^\d+$/.test(value) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0 &&
    Number(value) <= 4294967295,
  invalidMessage: 'id must be a positive integer',
}

export const validateStatementId = validateRequest({ id: statementIdRule }, 'params')

export const validateCreateStatement = validateRequest({
  artistId: {
    type: 'number',
    required: true,
    validate: (value) => Number.isInteger(value) && Number(value) > 0 && Number(value) <= 4294967295,
    invalidMessage: 'artistId must be a positive integer',
  },
  platform: {
    type: 'string',
    required: true,
    validate: (value) => typeof value === 'string' && value.trim().length <= 100,
    invalidMessage: 'platform must be 100 characters or fewer',
  },
  statementPeriod: {
    type: 'string',
    required: true,
    validate: (value) => typeof value === 'string' && value.trim().length <= 100,
    invalidMessage: 'statementPeriod must be 100 characters or fewer',
  },
  fileName: {
    type: 'string',
    required: true,
    validate: (value) => typeof value === 'string' && value.trim().length <= 255,
    invalidMessage: 'fileName must be 255 characters or fewer',
  },
  storedFilename: {
    type: 'string',
    required: true,
    validate: (value) =>
      typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(csv|pdf)$/.test(
        value,
      ),
    invalidMessage: 'storedFilename must be a generated CSV or PDF filename',
  },
})

interface CreateStatementBody {
  artistId: number
  platform: string
  statementPeriod: string
  fileName: string
  storedFilename: string
}

function sendNotFound(res: Parameters<RequestHandler>[1], code: string, message: string): void {
  res.status(404).json({
    success: false,
    error: { code, message },
  })
}

export const createStatement: RequestHandler = async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).user.id
  const body = req.body as CreateStatementBody
  const fileType = extname(body.storedFilename).slice(1) as 'csv' | 'pdf'
  const storageLocation = getUserStatementFilePath(userId, body.storedFilename)

  try {
    if (!(await artistBelongsToUser(body.artistId, userId))) {
      sendNotFound(res, 'ARTIST_NOT_FOUND', 'Artist not found for this user')
      return
    }
  } catch (error) {
    next(error)
    return
  }

  try {
    await access(storageLocation)
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      res.status(400).json({
        success: false,
        error: {
          code: 'UPLOADED_FILE_NOT_FOUND',
          message: 'The uploaded statement file was not found for this user',
        },
      })
      return
    }

    next(error)
    return
  }

  try {
    const statement = await persistStatement({
      userId,
      artistId: body.artistId,
      platform: body.platform.trim(),
      fileName: body.fileName.trim(),
      fileType,
      statementPeriod: body.statementPeriod.trim(),
      storageLocation,
    })

    if (!statement) {
      sendNotFound(res, 'ARTIST_NOT_FOUND', 'Artist not found for this user')
      return
    }

    res.status(201).json({
      success: true,
      data: { statement },
    })
  } catch (error) {
    next(error)
  }
}

export const getStatement: RequestHandler = async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).user.id
  const statementId = Number(req.params.id)

  try {
    const statement = await findStatementById(statementId, userId)

    if (!statement) {
      sendNotFound(res, 'STATEMENT_NOT_FOUND', 'Statement not found')
      return
    }

    res.status(200).json({
      success: true,
      data: { statement },
    })
  } catch (error) {
    next(error)
  }
}

export const listStatements: RequestHandler = async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).user.id

  try {
    const statements = await listStatementsForUser(userId)
    res.status(200).json({
      success: true,
      data: { statements },
    })
  } catch (error) {
    next(error)
  }
}