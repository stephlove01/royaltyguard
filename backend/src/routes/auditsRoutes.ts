import { Router } from 'express'
import {
  getAudit,
  listAudits,
  validateAuditId,
  validateAuditQuery,
} from '../controllers/auditsController'
import authenticateToken from '../middleware/authenticateToken'

const auditsRoutes = Router()

auditsRoutes.get('/', authenticateToken, validateAuditQuery, listAudits)
auditsRoutes.get('/:id', authenticateToken, validateAuditId, getAudit)

export default auditsRoutes