import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/PageComponents'
import { ApiError, getApiErrorMessage } from '../services/apiClient'
import { getStatements, uploadStatementFile } from '../services/royaltyguardApi'
import type { StatementOverview, StatementUploadResult } from '../services/royaltyguardApi'
import { formatDate, formatFileSize } from '../utils/formatters'

const maxUploadSize = 10 * 1024 * 1024

function uploadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 413) {
    return 'This file is larger than the 10 MB upload limit.'
  }
  return getApiErrorMessage(error, 'The file could not be uploaded. Please try again.')
}

function StatementLink({ statement }: { statement: StatementOverview }) {
  return (
    <Link
      className="font-semibold text-brand underline decoration-brand/25 underline-offset-4 transition-colors hover:decoration-brand focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      to={`/statements/${statement.id}`}
    >
      View statement
    </Link>
  )
}

function StatementsPage() {
  const [statements, setStatements] = useState<StatementOverview[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<StatementUploadResult | null>(null)

  useEffect(() => {
    let active = true

    getStatements()
      .then((records) => {
        if (active) setStatements(records)
      })
      .catch((requestError: unknown) => {
        if (!active) return
        setError(getApiErrorMessage(requestError, 'We could not load your statements.'))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [reloadKey])

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUploadError('')
    setUploadResult(null)

    if (!file) {
      setUploadError('Choose a CSV or PDF statement first.')
      return
    }
    if (!/\.(csv|pdf)$/i.test(file.name)) {
      setUploadError('Only CSV and PDF files are supported.')
      return
    }
    if (file.size > maxUploadSize) {
      setUploadError('This file is larger than the 10 MB upload limit.')
      return
    }

    setUploading(true)
    try {
      const result = await uploadStatementFile(file)
      setUploadResult(result)
      setFile(null)
    } catch (requestError) {
      setUploadError(uploadErrorMessage(requestError))
    } finally {
      setUploading(false)
    }
  }

  const uploadAction = (
    <button
      className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      onClick={() => {
        setIsUploadOpen((open) => !open)
        setUploadError('')
        setUploadResult(null)
      }}
      type="button"
    >
      <span aria-hidden="true" className="text-lg leading-none">+</span>
      Upload statement
    </button>
  )

  return (
    <div className="page-enter mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Library"
        title="Statements"
        description="Your source documents and their processing status."
        action={uploadAction}
      />

      {isUploadOpen && (
        <section className="my-7 border-y border-line bg-white px-4 py-5 sm:px-6" aria-labelledby="upload-heading">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-brand">Local file storage</p>
              <h2 id="upload-heading" className="mt-1 font-display text-2xl font-medium text-ink">
                Upload a statement file
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                CSV and PDF files up to 10 MB are accepted. This stores the file; it does not create a statement record or start an audit.
              </p>
            </div>
            <button
              aria-label="Close upload panel"
              className="grid size-10 shrink-0 place-items-center rounded-lg border border-line text-xl text-muted transition-colors hover:border-brand/40 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              onClick={() => setIsUploadOpen(false)}
              type="button"
            >
              ×
            </button>
          </div>

          <form className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={handleUpload}>
            <div className="min-w-0 flex-1">
              <label className="block text-sm font-semibold text-ink" htmlFor="statement-file">
                Statement file
              </label>
              <input
                accept=".csv,.pdf,text/csv,application/pdf"
                className="mt-2 block min-h-12 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-lavender file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                id="statement-file"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null)
                  setUploadError('')
                  setUploadResult(null)
                }}
                type="file"
              />
              <p className="mt-2 text-xs text-muted">{file ? `${file.name} · ${formatFileSize(file.size)}` : 'CSV or PDF · Maximum 10 MB'}</p>
            </div>
            <button
              className="min-h-12 rounded-lg border border-brand px-4 text-sm font-semibold text-brand transition-colors hover:bg-lavender focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-wait disabled:opacity-60"
              disabled={uploading || !file}
              type="submit"
            >
              {uploading ? 'Uploading...' : 'Store file'}
            </button>
          </form>

          {uploadError && <p className="mt-4 text-sm text-red-900" role="alert">{uploadError}</p>}
          {uploadResult && (
            <p className="mt-4 border-l-2 border-brand bg-lavender px-4 py-3 text-sm leading-6 text-brand-deep" role="status">
              <span className="font-semibold">File stored:</span> {uploadResult.originalFilename} ({formatFileSize(uploadResult.fileSize)}). A statement record must be associated with an artist before it appears in this list.
            </p>
          )}
        </section>
      )}

      {error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setError('')
            setIsLoading(true)
            setReloadKey((current) => current + 1)
          }}
        />
      ) : isLoading ? (
        <LoadingState label="Loading your statements..." />
      ) : statements.length === 0 ? (
        <EmptyState
          title="No statements yet"
          description="Upload your first royalty statement to begin an audit."
          action={uploadAction}
        />
      ) : (
        <section className="pt-7" aria-label="Statement records">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted">
              <span className="font-semibold text-ink">{statements.length}</span> {statements.length === 1 ? 'statement' : 'statements'}
            </p>
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-line bg-white lg:block">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead className="border-b border-line bg-canvas text-[0.66rem] font-bold uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th className="px-5 py-4">Platform</th>
                  <th className="px-5 py-4">Statement</th>
                  <th className="px-5 py-4">Period</th>
                  <th className="px-5 py-4">Created</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {statements.map((statement) => (
                  <tr className="transition-colors hover:bg-canvas/60" key={statement.id}>
                    <td className="px-5 py-4 text-sm font-semibold text-ink">{statement.platform}</td>
                    <td className="px-5 py-4">
                      <span className="block max-w-[280px] truncate text-sm font-medium text-ink" title={statement.fileName}>{statement.fileName}</span>
                      <span className="mt-1 block text-xs uppercase text-muted">{statement.fileType}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-ink">{statement.statementPeriod}</td>
                    <td className="px-5 py-4 text-sm text-muted">{formatDate(statement.createdAt)}</td>
                    <td className="px-5 py-4"><StatusBadge status={statement.status} /></td>
                    <td className="px-5 py-4 text-right"><StatementLink statement={statement} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-line border-y border-line lg:hidden">
            {statements.map((statement) => (
              <li className="py-5" key={statement.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{statement.platform}</p>
                    <p className="mt-1 truncate text-sm text-muted" title={statement.fileName}>{statement.fileName}</p>
                  </div>
                  <StatusBadge status={statement.status} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div><dt className="text-muted">Period</dt><dd className="mt-1 font-medium text-ink">{statement.statementPeriod}</dd></div>
                  <div><dt className="text-muted">File type</dt><dd className="mt-1 font-medium uppercase text-ink">{statement.fileType}</dd></div>
                  <div><dt className="text-muted">Created</dt><dd className="mt-1 font-medium text-ink">{formatDate(statement.createdAt)}</dd></div>
                </dl>
                <div className="mt-4"><StatementLink statement={statement} /></div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export default StatementsPage