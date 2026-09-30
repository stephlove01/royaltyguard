import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/PageComponents'
import { getApiErrorMessage } from '../services/apiClient'
import { getDisputes } from '../services/royaltyguardApi'
import type { DisputeRecord } from '../services/royaltyguardApi'
import { formatDate } from '../utils/formatters'

function DisputesPage() {
  const [disputes, setDisputes] = useState<DisputeRecord[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    getDisputes()
      .then((response) => { if (active) { setDisputes(response.data); setTotal(response.pagination.total) } })
      .catch((requestError: unknown) => { if (active) setError(getApiErrorMessage(requestError, 'We could not load your disputes.')) })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [reloadKey])

  return (
    <div className="page-enter mx-auto max-w-7xl">
      <PageHeader eyebrow="Resolution" title="Disputes" description="Review drafted royalty requests and track what has been sent for resolution." />
      {error ? <ErrorState title="Disputes unavailable" message={error} onRetry={() => { setError(''); setIsLoading(true); setReloadKey((current) => current + 1) }} /> : isLoading ? <LoadingState label="Loading your disputes..." /> : total === 0 ? <EmptyState title="No disputes yet" description="Create a dispute from a royalty discrepancy when you're ready to request a review." action={<Link className="inline-flex min-h-11 items-center rounded-lg border border-brand px-4 text-sm font-semibold text-brand hover:bg-lavender focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" to="/discrepancies">Review discrepancies</Link>} /> : (
        <section className="pt-7" aria-label="Dispute records">
          <p className="mb-4 text-sm text-muted"><span className="font-semibold text-ink">{total}</span> {total === 1 ? 'dispute' : 'disputes'}</p>
          <div className="hidden overflow-x-auto rounded-lg border border-line bg-white lg:block"><table className="w-full min-w-[940px] border-collapse text-left"><caption className="sr-only">Dispute records</caption><thead className="border-b border-line bg-canvas text-[0.66rem] font-bold uppercase tracking-[0.14em] text-muted"><tr><th className="px-4 py-4">Subject</th><th className="px-4 py-4">Recipient</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Created</th><th className="px-4 py-4">Sent</th><th className="px-4 py-4">Follow-up</th><th className="px-4 py-4"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-line">{disputes.map((dispute) => <tr className="hover:bg-canvas/60" key={dispute.id}><td className="max-w-[280px] px-4 py-4"><Link className="block truncate text-sm font-semibold text-brand underline decoration-brand/25 underline-offset-4" to={`/disputes/${dispute.id}`}>{dispute.subject}</Link></td><td className="px-4 py-4 text-sm text-ink">{dispute.recipient}</td><td className="px-4 py-4"><StatusBadge status={dispute.status} /></td><td className="px-4 py-4 text-sm text-muted">{formatDate(dispute.createdAt)}</td><td className="px-4 py-4 text-sm text-muted">{dispute.sentAt ? formatDate(dispute.sentAt) : '—'}</td><td className="px-4 py-4 text-sm text-muted">{dispute.followUpAt ? formatDate(dispute.followUpAt) : '—'}</td><td className="px-4 py-4 text-right"><Link className="font-semibold text-brand underline underline-offset-4" to={`/disputes/${dispute.id}`}>Review</Link></td></tr>)}</tbody></table></div>
          <ul className="divide-y divide-line border-y border-line lg:hidden">{disputes.map((dispute) => <li className="py-5" key={dispute.id}><div className="flex items-start justify-between gap-4"><Link className="min-w-0 truncate text-sm font-semibold text-brand underline underline-offset-4" to={`/disputes/${dispute.id}`}>{dispute.subject}</Link><StatusBadge status={dispute.status} /></div><p className="mt-2 truncate text-xs text-muted">{dispute.recipient}</p><dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3"><div><dt className="text-muted">Created</dt><dd className="mt-1 font-medium text-ink">{formatDate(dispute.createdAt)}</dd></div><div><dt className="text-muted">Sent</dt><dd className="mt-1 font-medium text-ink">{dispute.sentAt ? formatDate(dispute.sentAt) : '—'}</dd></div><div><dt className="text-muted">Follow-up</dt><dd className="mt-1 font-medium text-ink">{dispute.followUpAt ? formatDate(dispute.followUpAt) : '—'}</dd></div></dl><Link className="mt-4 inline-block text-sm font-semibold text-brand underline underline-offset-4" to={`/disputes/${dispute.id}`}>Review dispute</Link></li>)}</ul>
        </section>
      )}
    </div>
  )
}

export default DisputesPage
