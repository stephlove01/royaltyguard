import { Router } from 'express'
import { uploadStatement } from '../controllers/statementsController'
import { runAudit } from '../controllers/auditsController'
import {
  createStatement,
  getStatement,
  listStatements,
  validateCreateStatement,
  validateStatementId,
} from '../controllers/statementsApiController'
import authenticateToken from '../middleware/authenticateToken'
import uploadStatementFile from '../middleware/statementUpload'

const statementsRoutes = Router()

statementsRoutes.post(
  '/',
  authenticateToken,
  validateCreateStatement,
  createStatement,
)
statementsRoutes.post('/:id/run-audit', authenticateToken, validateStatementId, runAudit)
statementsRoutes.get('/', authenticateToken, listStatements)
statementsRoutes.get('/:id', authenticateToken, validateStatementId, getStatement)
statementsRoutes.post(
  '/upload',
  authenticateToken,
  uploadStatementFile,
  uploadStatement,
)

export default statementsRoutes