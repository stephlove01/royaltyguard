import { Router } from 'express'
import {
  getDiscrepancy,
  listDiscrepancies,
  validateDiscrepancyId,
  validateDiscrepancyQuery,
} from '../controllers/discrepanciesController'
import authenticateToken from '../middleware/authenticateToken'

const discrepanciesRoutes = Router()

discrepanciesRoutes.get('/', authenticateToken, validateDiscrepancyQuery, listDiscrepancies)
discrepanciesRoutes.get('/:id', authenticateToken, validateDiscrepancyId, getDiscrepancy)

export default discrepanciesRoutes