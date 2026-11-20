import { RequestHandler } from 'express'
import { AuthenticatedRequest } from '../middleware/authenticateToken'
import { validateRequest } from '../middleware/validateRequest'
import {
  createDisputeForUser,
  getDisputeForUser,
  listDisputesForUser,
  markDisputeSent,
  markDisputeSendUncertain,
  releaseDisputeSend,
  reserveDisputeForSending,
  updateDisputeDraftForUser,
} from '../services/disputeService'
import { createAiDisputeDraftForUser } from '../services/disputeDraftService'
import {
  buildDisputeWebhookUrl,
  sendDisputeAutomatically,
  type DisputeSendOutcome,
} from '../services/disputeSendService'

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

function configuredDisputeWebhookUrl(): string | undefined {
  return buildDisputeWebhookUrl(
    process.env.N8N_BASE_URL,
    process.env.N8N_DISPUTE_WEBHOOK_PATH,
  )
}

function deliverDisputeAutomatically(disputeId: number, userId: number): Promise<DisputeSendOutcome> {
  return sendDisputeAutomatically(
    {
      getDispute: getDisputeForUser,
      reserve: reserveDisputeForSending,
      release: releaseDisputeSend,
      markUncertain: markDisputeSendUncertain,
      markSent: markDisputeSent,
      fetchImpl: fetch,
      webhookUrl: configuredDisputeWebhookUrl(),
      webhookSecret: process.env.N8N_WEBHOOK_SECRET,
      webhookHeaderName: process.env.N8N_WEBHOOK_HEADER_NAME,
      log: (entry) => console.info('[RoyaltyGuard dispute delivery]', entry),
    },
    disputeId,
    userId,
  )
}

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

    const delivery = await deliverDisputeAutomatically(dispute.id, userId)
    const deliveredDispute = delivery.kind === 'sent' ? delivery.dispute : await getDisputeForUser(dispute.id, userId)
    res.status(201).json({ success: true, data: { dispute: deliveredDispute ?? dispute, delivery: delivery.kind } })
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
        {
          const delivery = await deliverDisputeAutomatically(result.dispute.id, userId)
          const dispute = delivery.kind === 'sent'
            ? delivery.dispute
            : await getDisputeForUser(result.dispute.id, userId)
          res.status(201).json({
            success: true,
            data: { dispute: dispute ?? result.dispute, delivery: delivery.kind },
          })
        }
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
      case 'empty_response':
        res.status(502).json({
          success: false,
          error: {
            code: 'DISPUTE_DRAFT_EMPTY_RESPONSE',
            message: 'The AI provider returned an empty dispute draft',
          },
        })
        return
      case 'invalid_json':
        res.status(502).json({
          success: false,
          error: {
            code: 'DISPUTE_DRAFT_INVALID_JSON',
            message: 'The AI provider returned invalid JSON for the dispute draft',
          },
        })
        return
      case 'schema_invalid':
        res.status(502).json({
          success: false,
          error: {
            code: 'DISPUTE_DRAFT_SCHEMA_INVALID',
            message: 'The AI provider response did not match the dispute draft schema',
          },
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
    const outcome = await deliverDisputeAutomatically(disputeId, userId)

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
      case 'ineligible':
        res.status(409).json({
          success: false,
          error: { code: 'DISPUTE_NOT_ELIGIBLE', message: 'Required dispute or statement details are missing' },
        })
        return
      case 'send_failed':
        res.status(503).json({
          success: false,
          error: { code: 'DISPUTE_SEND_FAILED', message: 'The dispute could not be sent' },
        })
        return
      case 'send_uncertain':
        res.status(409).json({
          success: false,
          error: {
            code: 'DISPUTE_SEND_UNCERTAIN',
            message: 'Delivery could not be confirmed. The dispute is locked to prevent a duplicate send.',
          },
        })
        return
    }
  } catch (error) {
    next(error)
  }
}
