import { RequestHandler } from 'express'
import { pool } from '../database'
import { validateRequest } from '../middleware/validateRequest'
import { periodStartDate, runStatementAudit } from '../services/auditService'
import {
  normalizePlatform,
  normalizeRoyaltyStatement,
  normalizeTerritory,
} from '../services/normalizationService'
import { findApplicableRoyaltyRate } from '../services/royaltyRateService'
import { CanonicalRoyaltyStatement } from '../services/royaltySchema'
import {
  N8nAuditRowResult,
  persistN8nAuditResult as saveN8nAuditResult,
} from '../services/n8nAuditPersistenceService'
import {
  createN8nStatement as persistN8nStatement,
  getN8nStatementOwner,
  N8nSourceMetadata,
} from '../services/n8nStatementService'

interface StatementUploadedBody {
  sourceFileId: string
  fileName: string
  mimeType: string
}

export const statementUploaded: RequestHandler = (req, res) => {
  const body = req.body as StatementUploadedBody

  res.status(202).json({
    success: true,
    data: {
      accepted: true,
      sourceFileId: body.sourceFileId,
      fileName: body.fileName,
      mimeType: body.mimeType,
    },
  })
}

export const getN8nRoyaltyRate: RequestHandler = async (req, res, next) => {
  let platform: string
  let territory: string
  let periodStart: string | null

  try {
    platform = normalizePlatform(req.query.platform)
    territory = normalizeTerritory(req.query.territory)
    periodStart = periodStartDate(String(req.query.statementPeriod).trim())
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_RATE_QUERY',
        message: error instanceof Error ? error.message : 'Rate query is invalid',
      },
    })
    return
  }

  if (!periodStart) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_STATEMENT_PERIOD',
        message: 'statementPeriod must be a year, month, date, or quarter such as 2026-Q1',
      },
    })
    return
  }

  const tier = typeof req.query.tier === 'string' ? req.query.tier.trim() : ''
  if (tier) {
    res.status(422).json({
      success: false,
      error: {
        code: 'TIER_RATE_NOT_SUPPORTED',
        message: 'The configured royalty_rates table does not contain tier-specific rates',
      },
    })
    return
  }

  let connection
  try {
    connection = await pool.getConnection()
    const rate = await findApplicableRoyaltyRate(connection, { platform, territory, periodStart })

    if (!rate) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ROYALTY_RATE_NOT_FOUND',
          message: 'No applicable royalty rate was found for the requested platform, territory, and statement period',
        },
      })
      return
    }

    res.status(200).json({
      success: true,
      data: {
        platform: rate.platform,
        territory: rate.territory,
        rate: rate.rate,
        currency: rate.currency,
        source: rate.source,
      },
    })
  } catch (error) {
    next(error)
  } finally {
    connection?.release()
  }
}

const positiveInteger = (value: unknown): boolean =>
  typeof value === 'string' &&
  /^\d+$/.test(value) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0 &&
  Number(value) <= 4294967295

export const validateN8nStatementId = validateRequest(
  {
    id: {
      type: 'string',
      required: true,
      validate: positiveInteger,
      invalidMessage: 'id must be a positive integer',
    },
  },
  'params',
)

export const createN8nStatement: RequestHandler = async (req, res, next) => {
  const body = req.body as {
    platform: unknown
    statementPeriod: unknown
    rows: unknown
    sourceMetadata: unknown
  }
  const metadata = body.sourceMetadata

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'sourceMetadata must be an object' },
    })
    return
  }

  const rawMetadata = metadata as Record<string, unknown>
  const requiredFields = ['sourceFileId', 'fileName', 'mimeType'] as const
  const optionalFields = ['sourceLocation', 'createdTime', 'modifiedTime'] as const
  const metadataValues: Record<string, string> = {}

  for (const field of requiredFields) {
    const value = rawMetadata[field]
    const maximumLength = field === 'mimeType' ? 100 : 255
    if (typeof value !== 'string' || !value.trim() || value.length > maximumLength) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `sourceMetadata.${field} is invalid` },
      })
      return
    }
    metadataValues[field] = value.trim()
  }

  for (const field of optionalFields) {
    const value = rawMetadata[field]
    if (value === undefined || value === null || value === '') continue
    if (typeof value !== 'string' || value.length > 2048) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `sourceMetadata.${field} is invalid` },
      })
      return
    }
    metadataValues[field] = value.trim()
  }

  let statement: CanonicalRoyaltyStatement
  try {
    statement = normalizeRoyaltyStatement({
      platform: body.platform,
      statementPeriod: body.statementPeriod,
      rows: body.rows,
    })
    if (statement.rows.length === 0 || statement.rows.length > 10000) {
      throw new Error('rows must contain between 1 and 10000 items')
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ROYALTY_STATEMENT',
        message: error instanceof Error ? error.message : 'Royalty statement is invalid',
      },
    })
    return
  }

  const sourceMetadata: N8nSourceMetadata = {
    sourceFileId: metadataValues.sourceFileId,
    fileName: metadataValues.fileName,
    mimeType: metadataValues.mimeType,
    ...(metadataValues.sourceLocation ? { sourceLocation: metadataValues.sourceLocation } : {}),
    ...(metadataValues.createdTime ? { createdTime: metadataValues.createdTime } : {}),
    ...(metadataValues.modifiedTime ? { modifiedTime: metadataValues.modifiedTime } : {}),
  }

  try {
    const result = await persistN8nStatement({ ...statement, sourceMetadata })

    if (result.kind === 'not_configured') {
      res.status(503).json({
        success: false,
        error: {
          code: 'N8N_ARTIST_NOT_CONFIGURED',
          message: 'n8n statement artist is not configured',
        },
      })
      return
    }

    if (result.kind === 'artist_not_found') {
      res.status(503).json({
        success: false,
        error: {
          code: 'N8N_ARTIST_NOT_FOUND',
          message: 'Configured n8n statement artist was not found',
        },
      })
      return
    }

    res.status(result.idempotentReplay ? 200 : 201).json({
      success: true,
      data: {
        statementId: result.statementId,
        sourceMetadata,
        idempotentReplay: result.idempotentReplay,
      },
    })
  } catch (error) {
    next(error)
  }
}

export const runN8nAudit: RequestHandler = async (req, res, next) => {
  try {
    const statementId = Number(req.params.id)
    const owner = await getN8nStatementOwner(statementId)

    if (owner.kind === 'not_configured') {
      res.status(503).json({
        success: false,
        error: {
          code: 'N8N_ARTIST_NOT_CONFIGURED',
          message: 'n8n statement artist is not configured',
        },
      })
      return
    }

    if (owner.kind === 'not_found') {
      res.status(404).json({
        success: false,
        error: { code: 'STATEMENT_NOT_FOUND', message: 'Statement not found' },
      })
      return
    }

    const result = await runStatementAudit(statementId, owner.userId)

    if (result.kind === 'not_found') {
      res.status(404).json({
        success: false,
        error: { code: 'STATEMENT_NOT_FOUND', message: 'Statement not found' },
      })
      return
    }

    if (result.kind === 'failed') {
      res.status(422).json({
        success: false,
        error: {
          code: result.code,
          message: result.message,
          ...(result.missingRates ? { details: result.missingRates } : {}),
        },
        data: { audit: result.audit },
      })
      return
    }

    res.status(200).json({
      success: true,
      data: { audit: result.audit, discrepancies: result.discrepancies },
    })
  } catch (error) {
    next(error)
  }
}

const nonNegativeMoney = /^(?:0|[1-9]\d*)\.\d{2}$/
const signedMoney = /^-?(?:0|[1-9]\d*)\.\d{2}$/
const nonNegativeRate = /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/

export const persistN8nAuditResult: RequestHandler = async (req, res, next) => {
  const body = req.body as Record<string, unknown>
  const isPositiveId = typeof body.statementId === 'number' &&
    Number.isSafeInteger(body.statementId) && body.statementId > 0
  const isValidMoney = (value: unknown, pattern: RegExp): value is string =>
    typeof value === 'string' && pattern.test(value)

  if (
    !isPositiveId ||
    typeof body.sourceFileId !== 'string' ||
    !body.sourceFileId.trim() ||
    body.sourceFileId.length > 255 ||
    !isValidMoney(body.threshold, nonNegativeMoney) ||
    !isValidMoney(body.totalExpected, nonNegativeMoney) ||
    !isValidMoney(body.totalActual, nonNegativeMoney) ||
    !isValidMoney(body.totalDifference, signedMoney) ||
    !Array.isArray(body.results) ||
    body.results.length === 0 ||
    body.results.length > 10000
  ) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_AUDIT_RESULT', message: 'Audit result payload is invalid' },
    })
    return
  }

  const results: N8nAuditRowResult[] = []
  for (const value of body.results) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_AUDIT_RESULT', message: 'Each result must be an object' },
      })
      return
    }

    const row = value as Record<string, unknown>
    if (
      typeof row.trackName !== 'string' || !row.trackName.trim() || row.trackName.length > 255 ||
      typeof row.eligibleUnits !== 'string' || !/^\d+$/.test(row.eligibleUnits) ||
      typeof row.territory !== 'string' || !row.territory.trim() || row.territory.length > 100 ||
      (row.tier !== null && (typeof row.tier !== 'string' || row.tier.length > 100)) ||
      !isValidMoney(row.actualPayout, nonNegativeMoney) ||
      typeof row.rate !== 'string' || !nonNegativeRate.test(row.rate) ||
      !isValidMoney(row.expectedPayout, nonNegativeMoney) ||
      !isValidMoney(row.difference, signedMoney) ||
      !isValidMoney(row.shortfall, nonNegativeMoney) ||
      typeof row.isDiscrepancy !== 'boolean'
    ) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_AUDIT_RESULT', message: 'A result row has invalid fields' },
      })
      return
    }

    results.push({
      trackName: row.trackName.trim(),
      eligibleUnits: row.eligibleUnits,
      territory: row.territory.trim().toUpperCase(),
      tier: row.tier === null || row.tier.trim() === '' ? null : row.tier.trim(),
      actualPayout: row.actualPayout,
      rate: row.rate,
      expectedPayout: row.expectedPayout,
      difference: row.difference,
      shortfall: row.shortfall,
      isDiscrepancy: row.isDiscrepancy,
    })
  }

  try {
    const result = await saveN8nAuditResult({
      statementId: Number(body.statementId),
      sourceFileId: body.sourceFileId.trim(),
      threshold: body.threshold,
      totalExpected: body.totalExpected,
      totalActual: body.totalActual,
      totalDifference: body.totalDifference,
      results,
    })

    if (result.kind === 'statement_not_found') {
      res.status(404).json({
        success: false,
        error: { code: 'STATEMENT_NOT_FOUND', message: 'Statement/source file pair was not found' },
      })
      return
    }

    if (result.kind === 'royalty_rows_mismatch') {
      res.status(409).json({
        success: false,
        error: { code: 'ROYALTY_ROWS_MISMATCH', message: 'Audit rows do not match the stored statement rows' },
      })
      return
    }

    res.status(200).json({
      success: true,
      data: {
        statementId: body.statementId,
        sourceFileId: body.sourceFileId,
        auditId: result.auditId,
        resultCount: results.length,
        discrepancyCount: result.discrepancyCount,
      },
    })
  } catch (error) {
    next(error)
  }
}
