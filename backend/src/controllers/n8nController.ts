import { RequestHandler } from 'express'

interface StatementUploadedBody {
  sourceFileId: string
  fileName: string
  mimeType: string
}

export const statementUploaded: RequestHandler = (req, res) => {
  const body = req.body as StatementUploadedBody

  res.status(202).json({
    success: true,
    data: {
      accepted: true,
      sourceFileId: body.sourceFileId,
      fileName: body.fileName,
      mimeType: body.mimeType,
    },
  })
}
