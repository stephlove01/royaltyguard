import { NextFunction, Request, RequestHandler, Response } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { getJwtSecret } from '../utils/jwt'

export interface AuthenticatedRequest extends Request {
  user: {
    id: number
  }
}

function sendUnauthorized(res: Response): void {
  res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'A valid bearer token is required',
    },
  })
}

const authenticateToken: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authorization = req.get('authorization')
  const match = authorization?.match(/^Bearer\s+(\S+)$/i)

  if (!match) {
    sendUnauthorized(res)
    return
  }

  const secret = getJwtSecret()

  try {
    const payload = jwt.verify(match[1], secret)

    if (
      typeof payload === 'string' ||
      typeof (payload as JwtPayload).userId !== 'number' ||
      !Number.isInteger((payload as JwtPayload).userId)
    ) {
      sendUnauthorized(res)
      return
    }

    ;(req as AuthenticatedRequest).user = { id: (payload as JwtPayload).userId as number }
    next()
  } catch {
    sendUnauthorized(res)
  }
}

export default authenticateToken