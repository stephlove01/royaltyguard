import { RequestHandler } from 'express'

export const uploadStatement: RequestHandler = (req, res) => {
  const file = req.file

  if (!file) {
    res.status(400).json({
      success: false,
      error: {
        code: 'FILE_REQUIRED',
        message: 'A statement file is required in the file field',
      },
    })
    return
  }

  res.status(201).json({
    success: true,
    data: {
      originalFilename: file.originalname,
      storedFilename: file.filename,
      fileSize: file.size,
      mimeType: file.mimetype,
    },
  })
}