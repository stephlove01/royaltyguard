import { resolve } from 'node:path'

export function getUserStatementDirectory(userId: number): string {
  return resolve(process.env.UPLOAD_DIR || 'uploads', `user-${userId}`)
}

export function getUserStatementFilePath(userId: number, filename: string): string {
  return resolve(getUserStatementDirectory(userId), filename)
}