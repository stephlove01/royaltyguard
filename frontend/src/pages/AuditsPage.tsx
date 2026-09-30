import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/PageComponents'
import { getApiErrorMessage } from '../services/apiClient'
import { getAudits, getStatements } from '../services/royaltyguardApi'
import type { AuditOverview, StatementOverview } from '../services/royaltyguardApi'
import { formatDate, formatDecimal } from '../utils/formatters'

const pageSize = 20

function AuditsPage() {
  const [audits, setAudits] = useState<AuditOverview[]>([])
  const [statements, setStatements] = useState<StatementOverview[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    Promise.all([getAudits(page, pageSize), getStatements()])
      .then(([auditResponse, statementRecords]) => {
        if (!active) return
        setAudits(auditResponse.data)
        setTotal(auditResponse.pagination.total)
        setStatements(statementRecords)
      })
      .catch((requestError: unknown) => {
        if (!active) return
        setError(getApiErrorMessage(requestError, 'We could not load your audits.'))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [page, reloadKey])

  const statementsById = new Map(statements.map((statement) => [statement.id, statement]))
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="page-enter mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Review history"
        title="Audits"
        description="Deterministic comparisons of reported payouts against configured demo royalty rates."
      />

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
        <LoadingState label="Loading your audits..." />
      ) : total === 0 ? (
        <EmptyState
          title="No audits yet"
          description="Choose a statement and run an audit to compare actual payouts with expected earnings."
          action={
            <Link
              className="inline-flex min-h-11 items-center rounded-lg border border-brand px-4 text-sm font-semibold text-brand transition-colors hover:bg-lavender focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              to="/statements"
            >
              Browse statements
            </Link>
          }
        />
      ) : (
        <section className="pt-7" aria-label="Audit records">
          <p className="mb-4 text-sm text-muted">
            <span className="font-semibold text-ink">{total}</span> {total === 1 ? 'audit' : 'audits'}
          </p>

          <div className="hidden overflow-x-auto rounded-lg border border-line bg-white lg:block">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead className="border-b border-line bg-canvas text-[0.66rem] font-bold uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th className="px-4 py-4">Statement</th>
                  <th className="px-4 py-4">Period</th>
                  <th className="px-4 py-4">Expected</th>
                  <th className="px-4 py-4">Actual</th>
                  <th className="px-4 py-4">Difference</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Date</th>
                  <th className="px-4 py-4"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {audits.map((audit) => {
                  const statement = statementsById.get(audit.statementId)
                  return (
                    <tr className="transition-colors hover:bg-canvas/60" key={audit.id}>
                      <td className="px-4 py-4">
                        <span className="block text-sm font-semibold text-ink">{statement?.platform ?? 'Statement'}</span>
                        <Link className="mt-1 inline-block max-w-48 truncate text-xs text-brand underline decoration-brand/20 underline-offset-4 hover:decoration-brand" to={`/statements/${audit.statementId}`}>
                          {statement?.fileName ?? `Statement #${audit.statementId}`}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-sm text-ink">{statement?.statementPeriod ?? '—'}</td>
                      <td className="px-4 py-4 text-sm tabular-nums text-ink">{formatDecimal(audit.totalExpected)}</td>
                      <td className="px-4 py-4 text-sm tabular-nums text-ink">{formatDecimal(audit.totalActual)}</td>
                      <td className={`px-4 py-4 text-sm font-semibold tabular-nums ${audit.totalDifference.startsWith('-') ? 'text-muted' : 'text-brand'}`}>
                        {formatDecimal(audit.totalDifference)}
                        <span className="sr-only"> expected minus actual</span>
                      </td>
                      <td className="px-4 py-4"><StatusBadge status={audit.status} /></td>
                      <td className="px-4 py-4 text-sm text-muted">{formatDate(audit.createdAt)}</td>
                      <td className="px-4 py-4 text-right">
                        <Link className="font-semibold text-brand underline decoration-brand/25 underline-offset-4 hover:decoration-brand focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" to={`/audits/${audit.id}`}>
                          View audit
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-line border-y border-line lg:hidden">
            {audits.map((audit) => {
              const statement = statementsById.get(audit.statementId)
              return (
                <li className="py-5" key={audit.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{statement?.platform ?? 'Statement'}</p>
                      <Link className="mt-1 block truncate text-sm text-brand underline decoration-brand/20 underline-offset-4" to={`/statements/${audit.statementId}`}>
                        {statement?.fileName ?? `Statement #${audit.statementId}`}
                      </Link>
                    </div>
                    <StatusBadge status={audit.status} />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-4">
                    <div><dt className="text-muted">Period</dt><dd className="mt-1 font-medium text-ink">{statement?.statementPeriod ?? '—'}</dd></div>
                    <div><dt className="text-muted">Expected</dt><dd className="mt-1 font-medium tabular-nums text-ink">{formatDecimal(audit.totalExpected)}</dd></div>
                    <div><dt className="text-muted">Actual</dt><dd className="mt-1 font-medium tabular-nums text-ink">{formatDecimal(audit.totalActual)}</dd></div>
                    <div><dt className="text-muted">Difference</dt><dd className="mt-1 font-semibold tabular-nums text-brand">{formatDecimal(audit.totalDifference)}</dd></div>
                  </dl>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted">{formatDate(audit.createdAt)}</span>
                    <Link className="text-sm font-semibold text-brand underline decoration-brand/25 underline-offset-4" to={`/audits/${audit.id}`}>View audit</Link>
                  </div>
                </li>
              )
            })}
          </ul>

          {pageCount > 1 && (
            <nav aria-label="Audit pagination" className="flex items-center justify-between border-t border-line py-4">
              <p className="text-xs text-muted">Page {page} of {pageCount}</p>
              <div className="flex gap-2">
                <button
                  className="min-h-10 rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:border-brand/40 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
                  disabled={page === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  type="button"
                >Previous</button>
                <button
                  className="min-h-10 rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:border-brand/40 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
                  disabled={page >= pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  type="button"
                >Next</button>
              </div>
            </nav>
          )}
        </section>
      )}
    </div>
  )
}

export default AuditsPage