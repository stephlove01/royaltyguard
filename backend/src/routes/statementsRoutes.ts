import { Router } from 'express'
import { uploadStatement } from '../controllers/statementsController'
import authenticateToken from '../middleware/authenticateToken'
import uploadStatementFile from '../middleware/statementUpload'

const statementsRoutes = Router()

statementsRoutes.post(
  '/upload',
  authenticateToken,
  uploadStatementFile,
  uploadStatement,
)

export default statementsRoutes