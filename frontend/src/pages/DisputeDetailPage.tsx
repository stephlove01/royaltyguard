import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/PageComponents'
import { ApiError, getApiErrorMessage } from '../services/apiClient'
import { getDispute, sendDispute } from '../services/royaltyguardApi'
import type { DisputeRecord } from '../services/royaltyguardApi'
import { formatDate, formatDecimal } from '../utils/formatters'

function sendErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 503) return 'Sending is not configured yet. The dispute remains a draft.'
    if (error.status === 409) return 'This dispute is no longer a draft and cannot be sent again.'
    if (error.status === 404) return 'This dispute is no longer available to your account.'
    if (error.status === 401) return 'Your session has expired. Please sign in again.'
  }
  return getApiErrorMessage(error, 'The dispute could not be sent. It remains a draft.')
}

function DisputeDetailPage() {
  const { id } = useParams()
  const disputeId = Number(id)
  const validId = Boolean(id && /^\d+$/.test(id) && Number.isSafeInteger(disputeId) && disputeId > 0)
  const [dispute, setDispute] = useState<DisputeRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [sendError, setSendError] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)
  const [isSending, setIsSending] = useState(false)
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

  async function handleSend() {
    setSendError('')
    setIsSending(true)
    try {
      const updated = await sendDispute(disputeId)
      setDispute(updated)
      setIsConfirming(false)
    } catch (requestError) {
      setSendError(sendErrorMessage(requestError))
      setIsConfirming(false)
      if (requestError instanceof ApiError && requestError.status === 409) setReloadKey((current) => current + 1)
    } finally { setIsSending(false) }
  }

  if (!validId) return <div className="mx-auto max-w-7xl"><EmptyState title="Dispute not found" description="The dispute ID in this address is not valid." action={<Link className="font-semibold text-brand underline underline-offset-4" to="/disputes">Back to disputes</Link>} /></div>

  return <div className="page-enter mx-auto max-w-7xl"><Link className="mb-6 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-brand underline decoration-brand/25 underline-offset-4 hover:decoration-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" to="/disputes"><span aria-hidden="true">←</span> Back to disputes</Link>{error ? <ErrorState title={error.toLowerCase().includes('not found') ? 'Dispute not found' : 'Dispute unavailable'} message={error} onRetry={() => { setError(''); setIsLoading(true); setDispute(null); setReloadKey((current) => current + 1) }} /> : isLoading ? <LoadingState label="Loading dispute review..." /> : dispute ? <><PageHeader eyebrow="Resolution review" title={dispute.subject} description={`Created ${formatDate(dispute.createdAt)} for discrepancy #${dispute.discrepancyId}.`} action={<StatusBadge status={dispute.status} />} /><section className="grid gap-4 border-b border-line py-6 sm:grid-cols-2 lg:grid-cols-4" aria-label="Dispute metadata"><div><p className="text-xs font-semibold text-muted">Recipient</p><p className="mt-2 break-all text-sm font-semibold text-ink">{dispute.recipient}</p></div><div><p className="text-xs font-semibold text-muted">Created</p><p className="mt-2 text-sm font-semibold text-ink">{formatDate(dispute.createdAt)}</p></div><div><p className="text-xs font-semibold text-muted">Sent</p><p className="mt-2 text-sm font-semibold text-ink">{dispute.sentAt ? formatDate(dispute.sentAt) : 'Not sent'}</p></div><div><p className="text-xs font-semibold text-muted">Follow-up</p><p className="mt-2 text-sm font-semibold text-ink">{dispute.followUpAt ? formatDate(dispute.followUpAt) : 'Not scheduled'}</p></div></section><section className="border-b border-line py-7" aria-labelledby="message-heading"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-muted">Draft message</p><h2 id="message-heading" className="mt-1 font-display text-2xl font-medium text-ink">Review before sending</h2></div>{dispute.status.toLowerCase() === 'draft' && <button className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => { setSendError(''); setIsConfirming(true) }} type="button">Send dispute</button>}</div><div className="mt-5 max-w-3xl whitespace-pre-wrap border-l-2 border-brand bg-white px-4 py-4 text-sm leading-7 text-ink">{dispute.body}</div>{isConfirming && <div className="mt-5 max-w-3xl border border-brand/25 bg-lavender px-4 py-4" role="alertdialog" aria-labelledby="send-confirmation-heading"><h3 id="send-confirmation-heading" className="text-sm font-semibold text-brand-deep">Send this dispute to the royalty department?</h3><p className="mt-1 text-sm leading-6 text-brand-deep/80">This will ask the configured delivery service to send the reviewed draft. You can’t undo a successful send.</p><div className="mt-4 flex flex-wrap gap-3"><button className="min-h-10 rounded-lg bg-brand px-3 text-sm font-semibold text-white hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60" disabled={isSending} onClick={() => { void handleSend() }} type="button">{isSending ? 'Sending...' : 'Confirm send'}</button><button className="min-h-10 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink hover:border-brand/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" disabled={isSending} onClick={() => setIsConfirming(false)} type="button">Keep as draft</button></div></div>}{sendError && <p className="mt-5 max-w-3xl border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900" role="alert">{sendError}</p>}</section><section className="py-7" aria-labelledby="linked-evidence-heading"><div className="flex items-end justify-between gap-4 border-b border-line pb-4"><div><p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-muted">Supporting context</p><h2 id="linked-evidence-heading" className="mt-1 font-display text-2xl font-medium text-ink">Linked discrepancy</h2></div><Link className="text-sm font-semibold text-brand underline underline-offset-4" to={`/discrepancies/${dispute.discrepancyId}`}>View discrepancy</Link></div><dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm"><div><dt className="text-muted">Expected</dt><dd className="mt-1 font-semibold tabular-nums text-ink">{dispute.expectedAmount ? formatDecimal(dispute.expectedAmount) : 'Not returned'}</dd></div><div><dt className="text-muted">Actual</dt><dd className="mt-1 font-semibold tabular-nums text-ink">{dispute.actualAmount ? formatDecimal(dispute.actualAmount) : 'Not returned'}</dd></div><div><dt className="text-muted">Difference</dt><dd className="mt-1 font-semibold tabular-nums text-brand">{dispute.difference ? formatDecimal(dispute.difference) : 'Not returned'}</dd></div><div><dt className="text-muted">Statement</dt><dd className="mt-1 font-semibold text-ink">{dispute.platform ?? 'Not returned'}{dispute.statementPeriod ? ` · ${dispute.statementPeriod}` : ''}</dd></div></dl></section></> : <EmptyState title="Dispute not found" description="This dispute is not available to your account." />}</div>
}

export default DisputeDetailPage
