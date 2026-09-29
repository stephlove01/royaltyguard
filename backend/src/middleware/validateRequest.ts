import { RequestHandler } from 'express'

export type RequestFieldType = 'string' | 'number' | 'boolean' | 'object' | 'array'
export type RequestDataSource = 'body' | 'query' | 'params'

export interface RequestFieldRule {
  type: RequestFieldType
  required?: boolean
  validate?: (value: unknown) => boolean
  invalidMessage?: string
}

export type RequestValidationSchema = Record<string, RequestFieldRule>

function matchesType(value: unknown, type: RequestFieldType): boolean {
  switch (type) {
    case 'string':
    case 'number':
    case 'boolean':
      return typeof value === type && (type !== 'number' || Number.isFinite(value))
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value)
    case 'array':
      return Array.isArray(value)
  }
}

export function validateRequest(
  schema: RequestValidationSchema,
  source: RequestDataSource = 'body',
): RequestHandler {
  return (req, res, next) => {
    const data = req[source] as unknown
    const errors: string[] = []

    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      errors.push(`${source} must be an object`)
    } else {
      const values = data as Record<string, unknown>

      for (const [field, rule] of Object.entries(schema)) {
        const value = values[field]

        if (value === undefined) {
          if (rule.required) {
            errors.push(`${field} is required`)
          }
          continue
        }

        if (value === null && rule.required) {
          errors.push(`${field} is required`)
          continue
        }

        if (!matchesType(value, rule.type)) {
          errors.push(`${field} must be a ${rule.type}`)
        } else if (rule.validate && !rule.validate(value)) {
          errors.push(rule.invalidMessage ?? `${field} is invalid`)
        } else if (rule.required && typeof value === 'string' && value.trim() === '') {
          errors.push(`${field} is required`)
        }
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors,
        },
      })
      return
    }

    next()
  }
}