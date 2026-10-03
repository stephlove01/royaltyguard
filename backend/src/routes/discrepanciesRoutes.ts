import { Router } from 'express'
import {
  getDiscrepancy,
  listDiscrepancies,
  validateDiscrepancyId,
  validateDiscrepancyQuery,
} from '../controllers/discrepanciesController'
import {
  createDisputeDraft,
  validateCreateDisputeDraft,
} from '../controllers/disputesController'
import authenticateToken from '../middleware/authenticateToken'

const discrepanciesRoutes = Router()

discrepanciesRoutes.get('/', authenticateToken, validateDiscrepancyQuery, listDiscrepancies)
discrepanciesRoutes.get('/:id', authenticateToken, validateDiscrepancyId, getDiscrepancy)

// TASK-076 — request an AI-generated dispute draft from an owned discrepancy.
discrepanciesRoutes.post(
  '/:id/dispute-draft',
  authenticateToken,
  validateDiscrepancyId,
  validateCreateDisputeDraft,
  createDisputeDraft,
)

export default discrepanciesRoutes