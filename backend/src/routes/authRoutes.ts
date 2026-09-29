import { Router } from 'express'
import { login, register } from '../controllers/authController'
import { validateRequest } from '../middleware/validateRequest'

const authRoutes = Router()
const validEmail = (value: unknown): boolean =>
  typeof value === 'string' &&
  value.length <= 255 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

authRoutes.post(
  '/register',
  validateRequest({
    name: {
      type: 'string',
      required: true,
      validate: (value) => typeof value === 'string' && value.trim().length <= 100,
      invalidMessage: 'name must be 100 characters or fewer',
    },
    email: {
      type: 'string',
      required: true,
      validate: validEmail,
      invalidMessage: 'email must be a valid email address',
    },
    password: {
      type: 'string',
      required: true,
      validate: (value) =>
        typeof value === 'string' && value.length >= 8 && Buffer.byteLength(value, 'utf8') <= 72,
      invalidMessage: 'password must be at least 8 characters and no more than 72 bytes',
    },
  }),
  register,
)

authRoutes.post(
  '/login',
  validateRequest({
    email: {
      type: 'string',
      required: true,
      validate: validEmail,
      invalidMessage: 'email must be a valid email address',
    },
    password: { type: 'string', required: true },
  }),
  login,
)

export default authRoutes