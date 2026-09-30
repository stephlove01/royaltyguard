import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/PageComponents'
import { ApiError, getApiErrorMessage } from '../services/apiClient'
import { getAudit, getAudits, getStatement, runAudit } from '../services/royaltyguardApi'
import type { AuditDetail, StatementOverview } from '../services/royaltyguardApi'
import { formatDate, formatDecimal } from '../utils/formatters'

function StatementDetailPage() {
  const { id } = useParams()
  const statementId = Number(id)
  const validId = Boolean(id && /^\d+$/.test(id) && Number.isSafeInteger(statementId) && statementId > 0)
  const [statement, setStatement] = useState<StatementOverview | null>(null)
  const [auditDetail, setAuditDetail] = useState<AuditDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState('')
  const [auditError, setAuditError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!validId) return
    let active = true

    async function loadStatement() {
      try {
        const record = await getStatement(statementId)
        if (!active) return
        setStatement(record)

        const auditList = await getAudits(1, 1, statementId)
        if (!active || auditList.data.length === 0) return

        const details = await getAudit(auditList.data[0].id)
        if (active) setAuditDetail(details)
      } catch (requestError) {
        if (!active) return
        setError(getApiErrorMessage(requestError, 'We could not load this statement.'))
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadStatement()
    return () => {
      active = false
    }
  }, [statementId, validId, reloadKey])

  async function handleRunAudit() {
    if (!statement) return
    setAuditError('')
    setIsRunning(true)

    try {
      const result = await runAudit(statement.id)
      const refreshedStatement = await getStatement(statement.id)
      setStatement(refreshedStatement)
      setAuditDetail({
        audit: result.audit,
        statement: {
          id: refreshedStatement.id,
          platform: refreshedStatement.platform,
          statementPeriod: refreshedStatement.statementPeriod,
        },
        discrepancies: result.discrepancies,
      })
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        const responseData = requestError.data as { audit?: AuditDetail['audit'] } | undefined
        if (responseData?.audit && statement) {
          setAuditDetail({
            audit: responseData.audit,
            statement: {
              id: statement.id,
              platform: statement.platform,
              statementPeriod: statement.statementPeriod,
            },
            discrepancies: [],
          })
        }
      }
      setAuditError(getApiErrorMessage(requestError, 'The audit could not be completed.'))
    } finally {
      setIsRunning(false)
    }
  }

  if (!validId) {
    return (
      <div className="mx-auto max-w-7xl">
        <EmptyState
          title="Statement not found"
          description="The statement ID in this address is not valid."
          action={<Link className="font-semibold text-brand underline underline-offset-4" to="/statements">Back to statements</Link>}
        />
      </div>
    )
  }

  return (
    <div className="page-enter mx-auto max-w-7xl">
      <Link
        className="mb-6 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-brand underline decoration-brand/25 underline-offset-4 hover:decoration-brand focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        to="/statements"
      >
        <span aria-hidden="true">←</span> Back to statements
      </Link>

      {error ? (
        <ErrorState
          message={error}
          title={error.includes('not found') ? 'Statement not found' : 'Statement unavailable'}
          onRetry={() => {
            setError('')
            setIsLoading(true)
            setStatement(null)
            setAuditDetail(null)
            setReloadKey((current) => current + 1)
          }}
        />
      ) : isLoading ? (
        <LoadingState label="Loading statement details..." />
      ) : statement ? (
        <>
          <PageHeader
            eyebrow={`${statement.platform} · ${statement.statementPeriod}`}
            title={statement.fileName}
            description="Statement metadata and audit evidence from your royalty records."
            action={
              <button
                className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-wait disabled:opacity-60"
                disabled={isRunning}
                onClick={handleRunAudit}
                type="button"
              >
                {isRunning ? 'Running audit...' : auditDetail ? 'Run audit again' : 'Run audit'}
              </button>
            }
          />

          <section className="grid gap-4 border-b border-line py-6 sm:grid-cols-2 lg:grid-cols-4" aria-label="Statement metadata">
            <div><p className="text-xs font-semibold text-muted">Platform</p><p className="mt-2 text-sm font-semibold text-ink">{statement.platform}</p></div>
            <div><p className="text-xs font-semibold text-muted">Statement period</p><p className="mt-2 text-sm font-semibold text-ink">{statement.statementPeriod}</p></div>
            <div><p className="text-xs font-semibold text-muted">File type</p><p className="mt-2 text-sm font-semibold uppercase text-ink">{statement.fileType}</p></div>
            <div><p className="text-xs font-semibold text-muted">Status</p><div className="mt-2"><StatusBadge status={statement.status} /></div></div>
            <div><p className="text-xs font-semibold text-muted">Created</p><p className="mt-2 text-sm font-semibold text-ink">{formatDate(statement.createdAt)}</p></div>
          </section>

          {auditError && (
            <div className="my-6 border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900" role="alert">
              <span className="font-semibold">Audit needs attention.</span> {auditError}
            </div>
          )}

          {isRunning ? (
            <LoadingState label="Comparing royalty rows with configured demo rates..." />
          ) : auditDetail ? (
            <section className="pt-8" aria-labelledby="audit-result-heading">
              <div className="flex flex-col justify-between gap-3 border-b border-line pb-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-muted">Audit result</p>
                  <h2 id="audit-result-heading" className="mt-1 font-display text-2xl font-medium text-ink">Royalty comparison</h2>
                </div>
                <StatusBadge status={auditDetail.audit.status} />
              </div>

              <div className="grid grid-cols-2 gap-3 py-5 sm:grid-cols-4">
                {[
                  { label: 'Expected payout', value: auditDetail.audit.totalExpected },
                  { label: 'Actual payout', value: auditDetail.audit.totalActual },
                  { label: 'Difference', value: auditDetail.audit.totalDifference },
                  { label: 'Discrepancies', value: String(auditDetail.discrepancies.length) },
                ].map((metric) => (
                  <div className="min-h-28 rounded-lg border border-line bg-white p-4" key={metric.label}>
                    <p className="text-xs font-semibold text-muted">{metric.label}</p>
                    <p className="mt-5 font-display text-2xl font-medium tabular-nums text-ink">{metric.label === 'Discrepancies' ? metric.value : formatDecimal(metric.value)}</p>
                  </div>
                ))}
              </div>

              {auditDetail.discrepancies.length === 0 ? (
                <p className="border-l-2 border-brand bg-lavender px-4 py-3 text-sm leading-6 text-brand-deep">
                  No discrepancies were returned for this audit.
                </p>
              ) : (
                <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-white">
                  <table className="w-full min-w-[720px] border-collapse text-left">
                    <thead className="border-b border-line bg-canvas text-[0.66rem] font-bold uppercase tracking-[0.14em] text-muted">
                      <tr><th className="px-4 py-3">Track</th><th className="px-4 py-3">Plays</th><th className="px-4 py-3">Expected</th><th className="px-4 py-3">Actual</th><th className="px-4 py-3">Difference</th><th className="px-4 py-3">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {auditDetail.discrepancies.map((discrepancy) => (
                        <tr key={discrepancy.id}>
                          <td className="px-4 py-3 text-sm font-medium text-ink">{discrepancy.trackName ?? `Royalty row ${discrepancy.royaltyRowId}`}</td>
                          <td className="px-4 py-3 text-sm tabular-nums text-muted">{discrepancy.plays ?? '—'}</td>
                          <td className="px-4 py-3 text-sm tabular-nums text-ink">{formatDecimal(discrepancy.expectedAmount)}</td>
                          <td className="px-4 py-3 text-sm tabular-nums text-ink">{formatDecimal(discrepancy.actualAmount)}</td>
                          <td className="px-4 py-3 text-sm font-semibold tabular-nums text-brand">{formatDecimal(discrepancy.difference)}</td>
                          <td className="px-4 py-3"><StatusBadge status={discrepancy.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {auditDetail.discrepancies.length > 0 && (
                <Link className="mt-5 inline-flex min-h-10 items-center font-semibold text-brand underline decoration-brand/25 underline-offset-4 hover:decoration-brand" to="/discrepancies">
                  Review all discrepancies <span className="ml-2" aria-hidden="true">→</span>
                </Link>
              )}
            </section>
          ) : (
            <div className="pt-7">
              <EmptyState
                title="Ready to audit"
                description="Run an audit to compare reported royalties against expected earnings using the configured demo rates."
              />
            </div>
          )}
        </>
      ) : (
        <EmptyState title="Statement not found" description="This statement is not available to your account." />
      )}
    </div>
  )
}

export default StatementDetailPage