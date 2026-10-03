import { RequestHandler } from 'express'
import { AuthenticatedRequest } from '../middleware/authenticateToken'
import { validateRequest } from '../middleware/validateRequest'
import {
  createDisputeForUser,
  getDisputeForUser,
  listDisputesForUser,
  markDisputeSent,
  releaseDisputeSend,
  reserveDisputeForSending,
  updateDisputeDraftForUser,
} from '../services/disputeService'
import { createAiDisputeDraftForUser } from '../services/disputeDraftService'
import { sendApprovedDispute } from '../services/disputeSendService'

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

export const validateDisputeId = validateRequest(
  { id: { type: 'string', required: true, validate: positiveInteger } },
  'params',
)

export const validateDisputeQuery = validateRequest(
  {
    ...paginationRules,
    status: {
      type: 'string',
      validate: (value) => typeof value === 'string' && value.length <= 50,
      invalidMessage: 'status must be 50 characters or fewer',
    },
  },
  'query',
)

export const validateCreateDispute = validateRequest({
  discrepancyId: {
    type: 'number',
    required: true,
    validate: (value) => Number.isInteger(value) && Number(value) > 0 && Number(value) <= 4294967295,
    invalidMessage: 'discrepancyId must be a positive integer',
  },
  recipient: {
    type: 'string',
    required: true,
    validate: (value) =>
      typeof value === 'string' &&
      value.length <= 255 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()),
    invalidMessage: 'recipient must be a valid email address of 255 characters or fewer',
  },
  subject: {
    type: 'string',
    required: true,
    validate: (value) => typeof value === 'string' && value.trim().length <= 255,
    invalidMessage: 'subject must be 255 characters or fewer',
  },
  body: {
    type: 'string',
    required: true,
    validate: (value) => typeof value === 'string' && value.trim().length <= 20000,
    invalidMessage: 'body must be 20,000 characters or fewer',
  },
})

interface CreateDisputeBody {
  discrepancyId: number
  recipient: string
  subject: string
  body: string
}

const recipientRule = {
  type: 'string' as const,
  required: true,
  validate: (value: unknown) =>
    typeof value === 'string' &&
    value.length <= 255 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()),
  invalidMessage: 'recipient must be a valid email address of 255 characters or fewer',
}

const subjectRule = {
  type: 'string' as const,
  required: true,
  validate: (value: unknown) => typeof value === 'string' && value.trim().length <= 255,
  invalidMessage: 'subject must be 255 characters or fewer',
}

const bodyRule = {
  type: 'string' as const,
  required: true,
  validate: (value: unknown) => typeof value === 'string' && value.trim().length <= 20000,
  invalidMessage: 'body must be 20,000 characters or fewer',
}

export const validateCreateDisputeDraft = validateRequest({ recipient: recipientRule })

export const validateUpdateDispute = validateRequest({
  subject: subjectRule,
  body: bodyRule,
})

function sendNotFound(res: Parameters<RequestHandler>[1]): void {
  res.status(404).json({
    success: false,
    error: { code: 'DISPUTE_NOT_FOUND', message: 'Dispute not found' },
  })
}

export const createDispute: RequestHandler = async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).user.id
  const body = req.body as CreateDisputeBody

  try {
    const dispute = await createDisputeForUser({
      discrepancyId: body.discrepancyId,
      userId,
      recipient: body.recipient.trim(),
      subject: body.subject.trim(),
      body: body.body.trim(),
    })

    if (!dispute) {
      res.status(404).json({
        success: false,
        error: { code: 'DISCREPANCY_NOT_FOUND', message: 'Discrepancy not found' },
      })
      return
    }

    res.status(201).json({ success: true, data: { dispute } })
  } catch (error) {
    next(error)
  }
}

export const createDisputeDraft: RequestHandler = async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).user.id
  const discrepancyId = Number(req.params.id)
  const { recipient } = req.body as { recipient: string }

  try {
    const result = await createAiDisputeDraftForUser({
      discrepancyId,
      userId,
      recipient: recipient.trim(),
    })

    switch (result.kind) {
      case 'created':
        res.status(201).json({ success: true, data: { dispute: result.dispute } })
        return
      case 'discrepancy_not_found':
        res.status(404).json({
          success: false,
          error: { code: 'DISCREPANCY_NOT_FOUND', message: 'Discrepancy not found' },
        })
        return
      case 'not_configured':
        res.status(503).json({
          success: false,
          error: {
            code: 'DISPUTE_DRAFT_NOT_CONFIGURED',
            message: 'AI dispute drafting is not configured',
          },
        })
        return
      case 'ai_failed':
        res.status(502).json({
          success: false,
          error: {
            code: 'DISPUTE_DRAFT_FAILED',
            message: 'The AI dispute draft could not be generated',
          },
        })
        return
      case 'invalid_draft':
        res.status(502).json({
          success: false,
          error: { code: 'DISPUTE_DRAFT_INVALID', message: result.message },
        })
        return
    }
  } catch (error) {
    next(error)
  }
}

export const listDisputes: RequestHandler = async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).user.id
  const page = Number(req.query.page ?? 1)
  const limit = Number(req.query.limit ?? 20)

  try {
    const result = await listDisputesForUser(userId, {
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      page,
      limit,
    })

    res.status(200).json({
      success: true,
      data: result.disputes,
      pagination: { page, limit, total: result.total },
    })
  } catch (error) {
    next(error)
  }
}

export const getDispute: RequestHandler = async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).user.id

  try {
    const dispute = await getDisputeForUser(Number(req.params.id), userId)

    if (!dispute) {
      sendNotFound(res)
      return
    }

    res.status(200).json({ success: true, data: { dispute } })
  } catch (error) {
    next(error)
  }
}

export const updateDispute: RequestHandler = async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).user.id
  const disputeId = Number(req.params.id)
  const body = req.body as { subject: string; body: string }

  try {
    const result = await updateDisputeDraftForUser({
      disputeId,
      userId,
      subject: body.subject.trim(),
      body: body.body.trim(),
    })

    if (result === 'not_found') {
      sendNotFound(res)
      return
    }

    if (result === 'not_draft') {
      res.status(409).json({
        success: false,
        error: { code: 'DISPUTE_NOT_DRAFT', message: 'Only draft disputes can be edited' },
      })
      return
    }

    const dispute = await getDisputeForUser(disputeId, userId)

    if (!dispute) {
      sendNotFound(res)
      return
    }

    res.status(200).json({ success: true, data: { dispute } })
  } catch (error) {
    next(error)
  }
}

export const sendDispute: RequestHandler = async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).user.id
  const disputeId = Number(req.params.id)

  try {
    const outcome = await sendApprovedDispute(
      {
        getDispute: getDisputeForUser,
        reserve: reserveDisputeForSending,
        release: releaseDisputeSend,
        markSent: markDisputeSent,
        fetchImpl: fetch,
        webhookUrl: process.env.N8N_DISPUTE_SEND_WEBHOOK_URL,
        webhookSecret: process.env.N8N_WEBHOOK_SECRET,
      },
      disputeId,
      userId,
    )

    switch (outcome.kind) {
      case 'sent':
        res.status(200).json({ success: true, data: { dispute: outcome.dispute } })
        return
      case 'not_found':
        sendNotFound(res)
        return
      case 'not_draft':
        res.status(409).json({
          success: false,
          error: { code: 'DISPUTE_NOT_DRAFT', message: 'Only draft disputes can be sent' },
        })
        return
      case 'not_configured':
        res.status(503).json({
          success: false,
          error: {
            code: 'DISPUTE_SENDING_NOT_CONFIGURED',
            message: 'Dispute sending is not configured',
          },
        })
        return
      case 'send_failed':
        res.status(503).json({
          success: false,
          error: { code: 'DISPUTE_SEND_FAILED', message: 'The dispute could not be sent' },
        })
        return
    }
  } catch (error) {
    next(error)
  }
}