import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/PageComponents'
import { getApiErrorMessage } from '../services/apiClient'
import { getAudit } from '../services/royaltyguardApi'
import type { AuditDetail } from '../services/royaltyguardApi'
import { formatDate, formatDecimal } from '../utils/formatters'

function AuditDetailPage() {
  const { id } = useParams()
  const auditId = Number(id)
  const validId = Boolean(id && /^\d+$/.test(id) && Number.isSafeInteger(auditId) && auditId > 0)
  const [auditDetail, setAuditDetail] = useState<AuditDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!validId) return
    let active = true

    getAudit(auditId)
      .then((result) => {
        if (active) setAuditDetail(result)
      })
      .catch((requestError: unknown) => {
        if (active) setError(getApiErrorMessage(requestError, 'We could not load this audit.'))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [auditId, validId, reloadKey])

  if (!validId) {
    return (
      <div className="mx-auto max-w-7xl">
        <EmptyState title="Audit not found" description="The audit ID in this address is not valid." />
      </div>
    )
  }

  return (
    <div className="page-enter mx-auto max-w-7xl">
      <Link
        className="mb-6 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-brand underline decoration-brand/25 underline-offset-4 hover:decoration-brand focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        to="/audits"
      >
        <span aria-hidden="true">←</span> Back to audits
      </Link>

      {error ? (
        <ErrorState
          message={error}
          title={error.toLowerCase().includes('not found') ? 'Audit not found' : 'Audit unavailable'}
          onRetry={() => {
            setError('')
            setIsLoading(true)
            setAuditDetail(null)
            setReloadKey((current) => current + 1)
          }}
        />
      ) : isLoading ? (
        <LoadingState label="Loading audit evidence..." />
      ) : auditDetail ? (
        <>
          <PageHeader
            eyebrow={`${auditDetail.statement.platform} · ${auditDetail.statement.statementPeriod}`}
            title={`Audit #${auditDetail.audit.id}`}
            description={`Statement #${auditDetail.statement.id} · Run ${formatDate(auditDetail.audit.createdAt)}`}
            action={<StatusBadge status={auditDetail.audit.status} />}
          />

          <div className="flex flex-wrap gap-3 border-b border-line py-5">
            <Link
              className="inline-flex min-h-10 items-center rounded-lg border border-line px-3 text-sm font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              to={`/statements/${auditDetail.statement.id}`}
            >
              View statement
            </Link>
            <Link
              className="inline-flex min-h-10 items-center rounded-lg border border-line px-3 text-sm font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              to="/discrepancies"
            >
              View discrepancies
            </Link>
          </div>

          <section className="grid grid-cols-2 gap-3 py-6 sm:grid-cols-4" aria-label="Audit totals">
            {[
              { label: 'Expected payout', value: auditDetail.audit.totalExpected },
              { label: 'Actual payout', value: auditDetail.audit.totalActual },
              { label: 'Difference', value: auditDetail.audit.totalDifference },
              { label: 'Discrepancies', value: String(auditDetail.discrepancies.length) },
            ].map((item) => (
              <div className="min-h-28 rounded-lg border border-line bg-white p-4" key={item.label}>
                <p className="text-xs font-semibold text-muted">{item.label}</p>
                <p className="mt-5 font-display text-2xl font-medium tabular-nums text-ink">
                  {item.label === 'Discrepancies' ? item.value : formatDecimal(item.value)}
                </p>
              </div>
            ))}
          </section>

          {auditDetail.discrepancies.length === 0 ? (
            <EmptyState
              title="No discrepancies recorded"
              description="This audit did not return any discrepancy rows. The totals above are the values recorded by the backend."
            />
          ) : (
            <section className="pt-4" aria-labelledby="audit-discrepancies-heading">
              <div className="border-b border-line pb-4">
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-muted">Calculation evidence</p>
                <h2 id="audit-discrepancies-heading" className="mt-1 font-display text-2xl font-medium text-ink">
                  Discrepancies
                </h2>
              </div>
              <div className="mt-5 overflow-x-auto rounded-lg border border-line bg-white">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead className="border-b border-line bg-canvas text-[0.66rem] font-bold uppercase tracking-[0.14em] text-muted">
                    <tr><th className="px-4 py-3">Track</th><th className="px-4 py-3">Plays</th><th className="px-4 py-3">Territory</th><th className="px-4 py-3">Expected</th><th className="px-4 py-3">Actual</th><th className="px-4 py-3">Difference</th><th className="px-4 py-3">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {auditDetail.discrepancies.map((discrepancy) => (
                      <tr key={discrepancy.id}>
                        <td className="px-4 py-3 text-sm font-medium text-ink">{discrepancy.trackName ?? `Royalty row ${discrepancy.royaltyRowId}`}</td>
                        <td className="px-4 py-3 text-sm tabular-nums text-muted">{discrepancy.plays ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-muted">{discrepancy.territory ?? '—'}</td>
                        <td className="px-4 py-3 text-sm tabular-nums text-ink">{formatDecimal(discrepancy.expectedAmount)}</td>
                        <td className="px-4 py-3 text-sm tabular-nums text-ink">{formatDecimal(discrepancy.actualAmount)}</td>
                        <td className="px-4 py-3 text-sm font-semibold tabular-nums text-brand">{formatDecimal(discrepancy.difference)}</td>
                        <td className="px-4 py-3"><StatusBadge status={discrepancy.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      ) : (
        <EmptyState title="Audit not found" description="This audit is not available to your account." />
      )}
    </div>
  )
}

export default AuditDetailPage