import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/PageComponents'
import { getApiErrorMessage } from '../services/apiClient'
import { getDiscrepancies } from '../services/royaltyguardApi'
import type { DiscrepancyRecord } from '../services/royaltyguardApi'
import { formatDate, formatDecimal } from '../utils/formatters'

function differenceClass(value: string): string {
  return value.startsWith('-') ? 'text-muted' : 'font-semibold text-brand'
}

function DiscrepancyRow({ discrepancy }: { discrepancy: DiscrepancyRecord }) {
  return (
    <tr className="transition-colors hover:bg-canvas/60">
      <td className="px-4 py-4">
        <span className="block text-sm font-semibold text-ink">{discrepancy.trackName ?? `Royalty row ${discrepancy.royaltyRowId}`}</span>
        <span className="mt-1 block text-xs text-muted">{discrepancy.platform} · {discrepancy.statementPeriod}</span>
      </td>
      <td className="px-4 py-4 text-sm tabular-nums text-ink">{formatDecimal(discrepancy.expectedAmount)}</td>
      <td className="px-4 py-4 text-sm tabular-nums text-ink">{formatDecimal(discrepancy.actualAmount)}</td>
      <td className={`px-4 py-4 text-sm tabular-nums ${differenceClass(discrepancy.difference)}`}>{formatDecimal(discrepancy.difference)}</td>
      <td className="px-4 py-4 text-sm tabular-nums text-muted">{formatDecimal(discrepancy.threshold)}</td>
      <td className="px-4 py-4"><StatusBadge status={discrepancy.status} /></td>
      <td className="px-4 py-4 text-right"><Link className="font-semibold text-brand underline decoration-brand/25 underline-offset-4 hover:decoration-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" to={`/discrepancies/${discrepancy.id}`}>Review</Link></td>
    </tr>
  )
}

function DiscrepanciesPage() {
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyRecord[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    getDiscrepancies()
      .then((response) => {
        if (!active) return
        setDiscrepancies(response.data)
        setTotal(response.pagination.total)
      })
      .catch((requestError: unknown) => {
        if (active) setError(getApiErrorMessage(requestError, 'We could not load your discrepancies.'))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => { active = false }
  }, [reloadKey])

  return (
    <div className="page-enter mx-auto max-w-7xl">
      <PageHeader eyebrow="Exceptions" title="Discrepancies" description="Underpayment findings recorded by the backend audit engine, ready for evidence review." />
      {error ? (
        <ErrorState message={error} title="Discrepancies unavailable" onRetry={() => { setError(''); setIsLoading(true); setReloadKey((current) => current + 1) }} />
      ) : isLoading ? (
        <LoadingState label="Loading your discrepancies..." />
      ) : total === 0 ? (
        <EmptyState title="No discrepancies found" description="Run an audit to identify potential royalty leakage." action={<Link className="inline-flex min-h-11 items-center rounded-lg border border-brand px-4 text-sm font-semibold text-brand hover:bg-lavender focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" to="/statements">Browse statements</Link>} />
      ) : (
        <section className="pt-7" aria-label="Discrepancy records">
          <p className="mb-4 text-sm text-muted"><span className="font-semibold text-ink">{total}</span> {total === 1 ? 'finding' : 'findings'} from your audits</p>
          <div className="hidden overflow-x-auto rounded-lg border border-line bg-white lg:block">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <caption className="sr-only">Discrepancy findings</caption>
              <thead className="border-b border-line bg-canvas text-[0.66rem] font-bold uppercase tracking-[0.14em] text-muted"><tr><th className="px-4 py-4">Track / statement</th><th className="px-4 py-4">Expected</th><th className="px-4 py-4">Actual</th><th className="px-4 py-4">Difference</th><th className="px-4 py-4">Threshold</th><th className="px-4 py-4">Status</th><th className="px-4 py-4"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody className="divide-y divide-line">{discrepancies.map((discrepancy) => <DiscrepancyRow key={discrepancy.id} discrepancy={discrepancy} />)}</tbody>
            </table>
          </div>
          <ul className="divide-y divide-line border-y border-line lg:hidden">
            {discrepancies.map((discrepancy) => (
              <li className="py-5" key={discrepancy.id}>
                <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{discrepancy.trackName ?? `Royalty row ${discrepancy.royaltyRowId}`}</p><p className="mt-1 truncate text-xs text-muted">{discrepancy.platform} · {discrepancy.statementPeriod}</p></div><StatusBadge status={discrepancy.status} /></div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-4"><div><dt className="text-muted">Expected</dt><dd className="mt-1 font-medium tabular-nums text-ink">{formatDecimal(discrepancy.expectedAmount)}</dd></div><div><dt className="text-muted">Actual</dt><dd className="mt-1 font-medium tabular-nums text-ink">{formatDecimal(discrepancy.actualAmount)}</dd></div><div><dt className="text-muted">Difference</dt><dd className={`mt-1 tabular-nums ${differenceClass(discrepancy.difference)}`}>{formatDecimal(discrepancy.difference)}</dd></div><div><dt className="text-muted">Threshold</dt><dd className="mt-1 font-medium tabular-nums text-ink">{formatDecimal(discrepancy.threshold)}</dd></div></dl>
                <div className="mt-4 flex items-center justify-between"><span className="text-xs text-muted">{formatDate(discrepancy.createdAt)}</span><Link className="text-sm font-semibold text-brand underline underline-offset-4" to={`/discrepancies/${discrepancy.id}`}>Review finding</Link></div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export default DiscrepanciesPage
