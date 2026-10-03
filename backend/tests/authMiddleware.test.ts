import assert from 'node:assert/strict'
import { test } from 'node:test'
import jwt from 'jsonwebtoken'
import type { NextFunction, Request, Response } from 'express'
import authenticateToken from '../src/middleware/authenticateToken'

function mockResponse(): { res: Response; status: () => number; body: () => unknown } {
  let statusCode = 0
  let payload: unknown

  const res = {
    status(code: number) {
      statusCode = code
      return res
    },
    json(value: unknown) {
      payload = value
      return res
    },
  } as unknown as Response

  return { res, status: () => statusCode, body: () => payload }
}

function mockRequest(authorization?: string): Request {
  return { get: () => authorization } as unknown as Request
}

test('rejects a request with no bearer token before reaching the send handler', () => {
  const { res, status, body } = mockResponse()
  let nextCalled = false
  const next = (() => {
    nextCalled = true
  }) as unknown as NextFunction

  authenticateToken(mockRequest(undefined), res, next)

  assert.equal(status(), 401)
  assert.equal(nextCalled, false)
  assert.deepEqual(body(), {
    success: false,
    error: { code: 'UNAUTHORIZED', message: 'A valid bearer token is required' },
  })
})

test('rejects a malformed authorization header', () => {
  const { res, status } = mockResponse()
  let nextCalled = false

  authenticateToken(
    mockRequest('Token abc'),
    res,
    (() => {
      nextCalled = true
    }) as unknown as NextFunction,
  )

  assert.equal(status(), 401)
  assert.equal(nextCalled, false)
})

test('rejects an invalid token', () => {
  const previousSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'test-secret'

  try {
    const { res, status } = mockResponse()
    let nextCalled = false

    authenticateToken(
      mockRequest('Bearer not-a-real-token'),
      res,
      (() => {
        nextCalled = true
      }) as unknown as NextFunction,
    )

    assert.equal(status(), 401)
    assert.equal(nextCalled, false)
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previousSecret
  }
})

test('attaches the authenticated user id for a valid token', () => {
  const previousSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'test-secret'

  try {
    const token = jwt.sign({ userId: 12 }, 'test-secret')
    const { res } = mockResponse()
    let nextCalled = false
    const req = mockRequest(`Bearer ${token}`)

    authenticateToken(
      req,
      res,
      (() => {
        nextCalled = true
      }) as unknown as NextFunction,
    )

    assert.equal(nextCalled, true)
    assert.deepEqual((req as unknown as { user: { id: number } }).user, { id: 12 })
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previousSecret
  }
})
