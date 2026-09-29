import { ErrorRequestHandler } from 'express'

const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err)
    return
  }

  const error = err as { status?: unknown; statusCode?: unknown } | null
  const candidateStatus = error?.status ?? error?.statusCode
  const status =
    typeof candidateStatus === 'number' &&
    Number.isInteger(candidateStatus) &&
    candidateStatus >= 400 &&
    candidateStatus <= 599
      ? candidateStatus
      : 500

  if (status >= 500) {
    console.error('Unexpected API error:', err)
  }

  res.status(status).json({
    success: false,
    error: {
      code: status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR',
      message: 'Something went wrong',
    },
  })
}

export default errorHandler