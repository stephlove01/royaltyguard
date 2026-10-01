import { Router } from 'express'
import {
  createN8nStatement,
  getN8nRoyaltyRate,
  persistN8nAuditResult,
  runN8nAudit,
  statementUploaded,
  validateN8nStatementId,
} from '../controllers/n8nController'
import requireN8nWebhookSecret from '../middleware/requireN8nWebhookSecret'
import { validateRequest } from '../middleware/validateRequest'

const n8nRoutes = Router()

n8nRoutes.get(
  '/royalty-rate',
  requireN8nWebhookSecret,
  validateRequest(
    {
      platform: {
        type: 'string',
        required: true,
        validate: (value) => typeof value === 'string' && value.trim().length <= 100,
        invalidMessage: 'platform must be 100 characters or fewer',
      },
      territory: {
        type: 'string',
        required: true,
        validate: (value) => typeof value === 'string' && value.trim().length <= 100,
        invalidMessage: 'territory must be 100 characters or fewer',
      },
      tier: {
        type: 'string',
        validate: (value) => typeof value === 'string' && value.trim().length <= 100,
        invalidMessage: 'tier must be 100 characters or fewer',
      },
      statementPeriod: {
        type: 'string',
        required: true,
        validate: (value) => typeof value === 'string' && value.trim().length <= 100,
        invalidMessage: 'statementPeriod must be 100 characters or fewer',
      },
    },
    'query',
  ),
  getN8nRoyaltyRate,
)

n8nRoutes.post(
  '/audit-results',
  requireN8nWebhookSecret,
  validateRequest({
    statementId: {
      type: 'number',
      required: true,
      validate: (value) => Number.isSafeInteger(value) && Number(value) > 0,
      invalidMessage: 'statementId must be a positive integer',
    },
    sourceFileId: {
      type: 'string',
      required: true,
      validate: (value) => typeof value === 'string' && value.trim().length <= 255,
      invalidMessage: 'sourceFileId must be 255 characters or fewer',
    },
    threshold: { type: 'string', required: true },
    totalExpected: { type: 'string', required: true },
    totalActual: { type: 'string', required: true },
    totalDifference: { type: 'string', required: true },
    results: {
      type: 'array',
      required: true,
      validate: (value) => Array.isArray(value) && value.length > 0 && value.length <= 10000,
      invalidMessage: 'results must contain between 1 and 10000 rows',
    },
  }),
  persistN8nAuditResult,
)

n8nRoutes.post(
  '/statements',
  requireN8nWebhookSecret,
  validateRequest({
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
    rows: {
      type: 'array',
      required: true,
      validate: (value) => Array.isArray(value) && value.length <= 10000,
      invalidMessage: 'rows must contain no more than 10000 items',
    },
    sourceMetadata: { type: 'object', required: true },
  }),
  createN8nStatement,
)

n8nRoutes.post(
  '/statements/:id/run-audit',
  requireN8nWebhookSecret,
  validateN8nStatementId,
  runN8nAudit,
)

n8nRoutes.post(
  '/statement-uploaded',
  requireN8nWebhookSecret,
  validateRequest({
    sourceFileId: {
      type: 'string',
      required: true,
      validate: (value) => typeof value === 'string' && value.trim().length <= 255,
      invalidMessage: 'sourceFileId must be 255 characters or fewer',
    },
    fileName: {
      type: 'string',
      required: true,
      validate: (value) => typeof value === 'string' && value.trim().length <= 255,
      invalidMessage: 'fileName must be 255 characters or fewer',
    },
    mimeType: {
      type: 'string',
      required: true,
      validate: (value) => typeof value === 'string' && value.trim().length <= 100,
      invalidMessage: 'mimeType must be 100 characters or fewer',
    },
  }),
  statementUploaded,
)

export default n8nRoutes
