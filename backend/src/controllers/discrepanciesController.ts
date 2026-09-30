import { RequestHandler } from 'express'
import { AuthenticatedRequest } from '../middleware/authenticateToken'
import { validateRequest } from '../middleware/validateRequest'
import {
  getDiscrepancyForUser,
  listDiscrepanciesForUser,
} from '../services/discrepancyService'

const positiveInteger = (value: unknown): boolean =>
  typeof value === 'string' &&
  /^\d+$/.test(value) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0 &&
  Number(value) <= 4294967295

const paginationRules = {
  page: {
    type: 'string' as const,
    validate: (value: unknown) => positiveInteger(value),
    invalidMessage: 'page must be a positive integer',
  },
  limit: {
    type: 'string' as const,
    validate: (value: unknown) => positiveInteger(value) && Number(value) <= 100,
    invalidMessage: 'limit must be an integer between 1 and 100',
  },
}

export const validateDiscrepancyId = validateRequest(
  { id: { type: 'string', required: true, validate: positiveInteger } },
  'params',
)

export const validateDiscrepancyQuery = validateRequest(
  {
    ...paginationRules,
    status: {
      type: 'string',
      validate: (value) => typeof value === 'string' && value.length <= 50,
      invalidMessage: 'status must be 50 characters or fewer',
    },
    auditId: {
      type: 'string',
      validate: positiveInteger,
      invalidMessage: 'auditId must be a positive integer',
    },
  },
  'query',
)

export const listDiscrepancies: RequestHandler = async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).user.id
  const page = Number(req.query.page ?? 1)
  const limit = Number(req.query.limit ?? 20)

  try {
    const result = await listDiscrepanciesForUser(userId, {
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      auditId: typeof req.query.auditId === 'string' ? Number(req.query.auditId) : undefined,
      page,
      limit,
    })

    res.status(200).json({
      success: true,
      data: result.discrepancies,
      pagination: { page, limit, total: result.total },
    })
  } catch (error) {
    next(error)
  }
}

export const getDiscrepancy: RequestHandler = async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).user.id

  try {
    const discrepancy = await getDiscrepancyForUser(Number(req.params.id), userId)

    if (!discrepancy) {
      res.status(404).json({
        success: false,
        error: { code: 'DISCREPANCY_NOT_FOUND', message: 'Discrepancy not found' },
      })
      return
    }

    res.status(200).json({ success: true, data: { discrepancy } })
  } catch (error) {
    next(error)
  }
}