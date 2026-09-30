import { RequestHandler } from 'express'
import { AuthenticatedRequest } from '../middleware/authenticateToken'
import { validateRequest } from '../middleware/validateRequest'
import {
  getAuditForUser,
  listAuditsForUser,
  runStatementAudit,
} from '../services/auditService'

const positiveInteger = (value: unknown): boolean =>
  typeof value === 'string' &&
  /^\d+$/.test(value) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0 &&
  Number(value) <= 4294967295

const paginationRules = {
  page: {
    type: 'string' as const,
    validate: positiveInteger,
    invalidMessage: 'page must be a positive integer',
  },
  limit: {
    type: 'string' as const,
    validate: (value: unknown) => positiveInteger(value) && Number(value) <= 100,
    invalidMessage: 'limit must be an integer between 1 and 100',
  },
}

export const validateAuditId = validateRequest(
  { id: { type: 'string', required: true, validate: positiveInteger } },
  'params',
)

export const validateAuditQuery = validateRequest(
  {
    ...paginationRules,
    status: {
      type: 'string',
      validate: (value) => ['pending', 'completed', 'failed'].includes(String(value)),
      invalidMessage: 'status must be pending, completed, or failed',
    },
    statementId: {
      type: 'string',
      validate: positiveInteger,
      invalidMessage: 'statementId must be a positive integer',
    },
  },
  'query',
)

export const runAudit: RequestHandler = async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).user.id

  try {
    const result = await runStatementAudit(Number(req.params.id), userId)

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

export const listAudits: RequestHandler = async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).user.id
  const page = Number(req.query.page ?? 1)
  const limit = Number(req.query.limit ?? 20)

  try {
    const result = await listAuditsForUser(userId, {
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      statementId:
        typeof req.query.statementId === 'string' ? Number(req.query.statementId) : undefined,
      page,
      limit,
    })

    res.status(200).json({
      success: true,
      data: result.audits,
      pagination: { page, limit, total: result.total },
    })
  } catch (error) {
    next(error)
  }
}

export const getAudit: RequestHandler = async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).user.id

  try {
    const audit = await getAuditForUser(Number(req.params.id), userId)

    if (!audit) {
      res.status(404).json({
        success: false,
        error: { code: 'AUDIT_NOT_FOUND', message: 'Audit not found' },
      })
      return
    }

    res.status(200).json({ success: true, data: audit })
  } catch (error) {
    next(error)
  }
}