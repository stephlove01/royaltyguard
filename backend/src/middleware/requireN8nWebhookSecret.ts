import { timingSafeEqual } from 'node:crypto'
import { RequestHandler } from 'express'

const requireN8nWebhookSecret: RequestHandler = (req, res, next) => {
  const configuredSecret = process.env.N8N_WEBHOOK_SECRET
  const providedSecret = req.get('X-N8N-Webhook-Secret')

  if (!configuredSecret || !providedSecret) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'A valid webhook secret is required',
      },
    })
    return
  }

  const expected = Buffer.from(configuredSecret)
  const provided = Buffer.from(providedSecret)

  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'A valid webhook secret is required',
      },
    })
    return
  }

  next()
}

export default requireN8nWebhookSecret