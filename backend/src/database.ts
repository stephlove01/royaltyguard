import 'dotenv/config'
import { createPool } from 'mysql2/promise'

const requiredVariables = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'] as const
const missingVariables = requiredVariables.filter((name) => {
  const value = process.env[name]
  return value === undefined || (name !== 'DB_PASSWORD' && value.trim() === '')
})

if (missingVariables.length > 0) {
  throw new Error(
    `Missing required database environment variable(s): ${missingVariables.join(', ')}`,
  )
}

const port = Number(process.env.DB_PORT)

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('DB_PORT must be an integer between 1 and 65535')
}

export const pool = createPool({
  host: process.env.DB_HOST,
  port,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

export const query = pool.query.bind(pool)