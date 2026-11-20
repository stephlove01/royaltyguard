import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/PageComponents'
import { getApiErrorMessage } from '../services/apiClient'
import { getDispute } from '../services/royaltyguardApi'
import type { DisputeRecord } from '../services/royaltyguardApi'
import { formatDate, formatDecimal } from '../utils/formatters'

function deliveryDescription(status: string, sendAttemptedAt?: string | null): string {
  switch (status.toLowerCase()) {
    case 'sent': return 'Delivered to Gmail and recorded with a message receipt.'
    case 'sending': return 'Automatic delivery is in progress.'
    case 'send_failed': return 'Automatic delivery failed before a message was accepted. This dispute will not be automatically retried; check the n8n execution before taking further action.'
    case 'send_uncertain': return 'Delivery could not be confirmed. This dispute is locked to prevent a duplicate email.'
    case 'draft': return sendAttemptedAt
      ? 'A delivery attempt was recorded, but no Gmail message ID is available. Automatic resend is blocked; check the n8n execution before taking further action.'
      : 'No delivery attempt or Gmail message ID is recorded. Confirm dispute eligibility and delivery configuration before taking further action.'
    default: return `Delivery status: ${status}.`
  }
}

function DisputeDetailPage() {
  const { id } = useParams()
  const disputeId = Number(id)
  const validId = Boolean(id && /^\d+$/.test(id) && Number.isSafeInteger(disputeId) && disputeId > 0)
  const [dispute, setDispute] = useState<DisputeRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!validId) return
    let active = true
    getDispute(disputeId)
      .then((record) => { if (active) setDispute(record) })
      .catch((requestError: unknown) => { if (active) setError(getApiErrorMessage(requestError, 'We could not load this dispute.')) })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [disputeId, validId, reloadKey])

  if (!validId) return <div className="mx-auto max-w-7xl"><EmptyState title="Dispute not found" description="The dispute ID in this address is not valid." action={<Link className="font-semibold text-brand underline underline-offset-4" to="/disputes">Back to disputes</Link>} /></div>

  return <div className="page-enter mx-auto max-w-7xl">
    <Link className="mb-6 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-brand underline underline-offset-4" to="/disputes"><span aria-hidden="true">←</span> Back to disputes</Link>
    {error ? <ErrorState title="Dispute unavailable" message={error} onRetry={() => { setError(''); setIsLoading(true); setDispute(null); setReloadKey((current) => current + 1) }} /> : isLoading ? <LoadingState label="Loading dispute..." /> : dispute ? <>
      <PageHeader eyebrow="Automated delivery" title={dispute.subject} description={`Created ${formatDate(dispute.createdAt)} for discrepancy #${dispute.discrepancyId}.`} action={<StatusBadge status={dispute.status} />} />
      <section className="grid gap-4 border-b border-line py-6 sm:grid-cols-2 lg:grid-cols-4" aria-label="Dispute metadata">
        <div><p className="text-xs font-semibold text-muted">Recipient</p><p className="mt-2 break-all text-sm font-semibold text-ink">{dispute.recipient}</p></div>
        <div><p className="text-xs font-semibold text-muted">Sent</p><p className="mt-2 text-sm font-semibold text-ink">{dispute.sentAt ? formatDate(dispute.sentAt) : 'Not sent'}</p></div>
        <div><p className="text-xs font-semibold text-muted">Gmail message ID</p><p className="mt-2 break-all text-sm font-semibold text-ink">{dispute.providerMessageId ?? 'Not recorded'}</p></div>
        <div><p className="text-xs font-semibold text-muted">Follow-up</p><p className="mt-2 text-sm font-semibold text-ink">{dispute.followUpAt ? formatDate(dispute.followUpAt) : 'Not scheduled'}</p></div>
      </section>
      <section className="border-b border-line py-7" aria-labelledby="message-heading">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-muted">Dispute message</p>
        <h2 id="message-heading" className="mt-1 font-display text-2xl font-medium text-ink">Sent automatically when eligible</h2>
        <p className="mt-3 max-w-3xl border-l-2 border-brand bg-lavender px-4 py-3 text-sm leading-6 text-brand-deep" role="status">{deliveryDescription(dispute.status, dispute.sendAttemptedAt)}</p>
        <div className="mt-5 max-w-3xl whitespace-pre-wrap border-l-2 border-brand bg-white px-4 py-4 text-sm leading-7 text-ink">{dispute.body}</div>
      </section>
      <section className="py-7" aria-labelledby="linked-evidence-heading"><div className="flex items-end justify-between gap-4 border-b border-line pb-4"><div><p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-muted">Supporting context</p><h2 id="linked-evidence-heading" className="mt-1 font-display text-2xl font-medium text-ink">Linked discrepancy</h2></div><Link className="text-sm font-semibold text-brand underline underline-offset-4" to={`/discrepancies/${dispute.discrepancyId}`}>View discrepancy</Link></div><dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm"><div><dt className="text-muted">Expected</dt><dd className="mt-1 font-semibold tabular-nums text-ink">{dispute.expectedAmount ? formatDecimal(dispute.expectedAmount) : 'Not returned'}</dd></div><div><dt className="text-muted">Actual</dt><dd className="mt-1 font-semibold tabular-nums text-ink">{dispute.actualAmount ? formatDecimal(dispute.actualAmount) : 'Not returned'}</dd></div><div><dt className="text-muted">Difference</dt><dd className="mt-1 font-semibold tabular-nums text-brand">{dispute.difference ? formatDecimal(dispute.difference) : 'Not returned'}</dd></div><div><dt className="text-muted">Statement</dt><dd className="mt-1 font-semibold text-ink">{dispute.platform ?? 'Not returned'}{dispute.statementPeriod ? ` · ${dispute.statementPeriod}` : ''}</dd></div></dl></section>
    </> : <EmptyState title="Dispute not found" description="This dispute is not available to your account." />}
  </div>
}

export default DisputeDetailPage
