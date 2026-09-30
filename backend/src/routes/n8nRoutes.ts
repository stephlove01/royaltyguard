import { Router } from 'express'
import { statementUploaded } from '../controllers/n8nController'
import requireN8nWebhookSecret from '../middleware/requireN8nWebhookSecret'
import { validateRequest } from '../middleware/validateRequest'

const n8nRoutes = Router()

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
