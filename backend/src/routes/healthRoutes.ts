import { Router } from 'express'

const healthRoutes = Router()

healthRoutes.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
  })
})

export default healthRoutes