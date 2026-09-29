import bcrypt from 'bcryptjs'
import { RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { pool } from '../database'
import { getJwtSecret } from '../utils/jwt'

interface UserRecord extends RowDataPacket {
  id: number
  name: string
  email: string
  password_hash: string
}

interface AuthRequestBody {
  name: string
  email: string
  password: string
}

function isDuplicateEmailError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ER_DUP_ENTRY'
  )
}

function sendInvalidCredentials(res: Parameters<RequestHandler>[1]): void {
  res.status(401).json({
    success: false,
    error: {
      code: 'INVALID_CREDENTIALS',
      message: 'Email or password is incorrect',
    },
  })
}

export const register: RequestHandler = async (req, res, next) => {
  const { name, email, password } = req.body as AuthRequestBody
  const normalizedEmail = email.trim().toLowerCase()

  try {
    const passwordHash = await bcrypt.hash(password, 10)
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name.trim(), normalizedEmail, passwordHash],
    )

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: result.insertId,
          name: name.trim(),
          email: normalizedEmail,
        },
      },
    })
  } catch (error) {
    if (isDuplicateEmailError(error)) {
      res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email already exists',
        },
      })
      return
    }

    next(error)
  }
}

export const login: RequestHandler = async (req, res, next) => {
  const { email, password } = req.body as AuthRequestBody
  const normalizedEmail = email.trim().toLowerCase()

  try {
    const [users] = await pool.execute<UserRecord[]>(
      'SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1',
      [normalizedEmail],
    )
    const user = users[0]

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      sendInvalidCredentials(res)
      return
    }

    const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '1h' })

    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      },
    })
  } catch (error) {
    next(error)
  }
}