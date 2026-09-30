import { mkdir } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { NextFunction, Request, RequestHandler, Response } from 'express'
import multer from 'multer'
import { AuthenticatedRequest } from './authenticateToken'
import { getUserStatementDirectory } from '../utils/statementStorage'

const maxFileSize = 10 * 1024 * 1024

const storage = multer.diskStorage({
  destination: (req, _file, callback) => {
    const userDirectory = getUserStatementDirectory((req as AuthenticatedRequest).user.id)

    mkdir(userDirectory, { recursive: true })
      .then(() => callback(null, userDirectory))
      .catch((error: NodeJS.ErrnoException) => callback(error, ''))
  },
  filename: (_req, file, callback) => {
    callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: maxFileSize, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = extname(file.originalname).toLowerCase()

    if (extension !== '.csv' && extension !== '.pdf') {
      const error = Object.assign(new Error('Only CSV and PDF files are allowed'), {
        status: 400,
      })
      callback(error)
      return
    }

    callback(null, true)
  },
})

const uploadSingleFile = upload.single('file')

const uploadStatementFile: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  uploadSingleFile(req, res, (error?: unknown) => {
    if (error instanceof multer.MulterError) {
      Object.assign(error, {
        status: error.code === 'LIMIT_FILE_SIZE' ? 413 : 400,
      })
    }

    next(error)
  })
}

export default uploadStatementFile