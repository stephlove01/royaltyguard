import { Router } from 'express'

import {
  createDispute,
  createDisputeDraft,
  getDispute,
  listDisputes,
  sendDispute,
  updateDispute,
  validateCreateDispute,
  validateCreateDisputeDraft,
  validateDisputeId,
  validateDisputeQuery,
  validateUpdateDispute,
} from '../controllers/disputesController'

import authenticateToken from '../middleware/authenticateToken'

const disputesRoutes = Router()

disputesRoutes.post('/', authenticateToken, validateCreateDispute, createDispute)

disputesRoutes.get('/', authenticateToken, validateDisputeQuery, listDisputes)

disputesRoutes.post(
  '/:id/draft',
  authenticateToken,
  validateDisputeId,
  validateCreateDisputeDraft,
  createDisputeDraft,
)

disputesRoutes.get('/:id', authenticateToken, validateDisputeId, getDispute)

disputesRoutes.patch(
  '/:id',
  authenticateToken,
  validateDisputeId,
  validateUpdateDispute,
  updateDispute,
)

disputesRoutes.post('/:id/send', authenticateToken, validateDisputeId, sendDispute)

export default disputesRoutes