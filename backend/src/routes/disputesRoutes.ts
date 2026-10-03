import { Router } from 'express'
import {
  createDispute,
  getDispute,
  listDisputes,
  sendDispute,
  updateDispute,
  validateCreateDispute,
  validateDisputeId,
  validateDisputeQuery,
  validateUpdateDispute,
} from '../controllers/disputesController'
import authenticateToken from '../middleware/authenticateToken'

const disputesRoutes = Router()

disputesRoutes.post('/', authenticateToken, validateCreateDispute, createDispute)
disputesRoutes.get('/', authenticateToken, validateDisputeQuery, listDisputes)
disputesRoutes.get('/:id', authenticateToken, validateDisputeId, getDispute)
disputesRoutes.patch('/:id', authenticateToken, validateDisputeId, validateUpdateDispute, updateDispute)
disputesRoutes.post('/:id/send', authenticateToken, validateDisputeId, sendDispute)

export default disputesRoutes