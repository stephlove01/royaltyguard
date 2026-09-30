import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/PageComponents'
import { ApiError, getApiErrorMessage } from '../services/apiClient'
import { createDispute, getDiscrepancy } from '../services/royaltyguardApi'
import type { DiscrepancyRecord } from '../services/royaltyguardApi'
import { formatDate, formatDecimal } from '../utils/formatters'

function DiscrepancyDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const discrepancyId = Number(id)
  const validId = Boolean(id && /^\d+$/.test(id) && Number.isSafeInteger(discrepancyId) && discrepancyId > 0)
  const [discrepancy, setDiscrepancy] = useState<DiscrepancyRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [recipient, setRecipient] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [formError, setFormError] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (!validId) return
    let active = true
    getDiscrepancy(discrepancyId)
      .then((record) => { if (active) setDiscrepancy(record) })
      .catch((requestError: unknown) => { if (active) { setNotFound(requestError instanceof ApiError && requestError.status === 404); setError(getApiErrorMessage(requestError, 'We could not load this discrepancy.')) } })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [discrepancyId, validId, reloadKey])

  async function handleCreateDispute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!discrepancy) return
    setFormError('')
    setIsCreating(true)
    try {
      const dispute = await createDispute({ discrepancyId: discrepancy.id, recipient, subject, body })
      navigate(`/disputes/${dispute.id}`)
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError, 'The draft could not be created. Please check the form and try again.'))
    } finally { setIsCreating(false) }
  }

  if (!validId) return <div className="mx-auto max-w-7xl"><EmptyState title="Discrepancy not found" description="The discrepancy ID in this address is not valid." action={<Link className="font-semibold text-brand underline underline-offset-4" to="/discrepancies">Back to discrepancies</Link>} /></div>

  return (
    <div className="page-enter mx-auto max-w-7xl">
      <Link className="mb-6 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-brand underline decoration-brand/25 underline-offset-4 hover:decoration-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" to="/discrepancies"><span aria-hidden="true">←</span> Back to discrepancies</Link>
      {error ? <ErrorState title={notFound || error.toLowerCase().includes('not found') ? 'Discrepancy not found' : 'Discrepancy unavailable'} message={error} onRetry={() => { setError(''); setNotFound(false); setIsLoading(true); setDiscrepancy(null); setReloadKey((current) => current + 1) }} /> : isLoading ? <LoadingState label="Loading discrepancy evidence..." /> : discrepancy ? (
        <>
          <PageHeader eyebrow={`${discrepancy.platform} · ${discrepancy.statementPeriod}`} title={discrepancy.trackName ?? `Discrepancy #${discrepancy.id}`} description={`Finding recorded ${formatDate(discrepancy.createdAt)} from statement #${discrepancy.statementId}.`} action={<StatusBadge status={discrepancy.status} />} />
          <section className="grid grid-cols-2 gap-3 border-b border-line py-6 sm:grid-cols-3 lg:grid-cols-5" aria-label="Discrepancy financial evidence">
            {[['Expected amount', discrepancy.expectedAmount], ['Actual amount', discrepancy.actualAmount], ['Difference', discrepancy.difference], ['Threshold', discrepancy.threshold]].map(([label, value]) => <div className="min-h-24 rounded-lg border border-line bg-white p-4" key={label}><p className="text-xs font-semibold text-muted">{label}</p><p className={`mt-4 font-display text-xl font-medium tabular-nums ${label === 'Difference' && !value.startsWith('-') ? 'text-brand' : 'text-ink'}`}>{formatDecimal(value)}</p></div>)}
            <div className="min-h-24 rounded-lg border border-line bg-white p-4"><p className="text-xs font-semibold text-muted">Audit</p><Link className="mt-4 inline-block text-sm font-semibold text-brand underline underline-offset-4" to={`/audits/${discrepancy.auditId}`}>View audit #{discrepancy.auditId}</Link></div>
          </section>
          <section className="border-b border-line py-6" aria-labelledby="evidence-heading"><h2 id="evidence-heading" className="font-display text-2xl font-medium text-ink">Royalty row evidence</h2><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3"><div><dt className="text-muted">Eligible plays</dt><dd className="mt-1 font-semibold tabular-nums text-ink">{discrepancy.plays ?? 'Not returned'}</dd></div><div><dt className="text-muted">Territory</dt><dd className="mt-1 font-semibold text-ink">{discrepancy.territory ?? 'Not returned'}</dd></div><div><dt className="text-muted">Statement</dt><dd className="mt-1 font-semibold text-ink"><Link className="text-brand underline underline-offset-4" to={`/statements/${discrepancy.statementId}`}>{discrepancy.platform} · {discrepancy.statementPeriod}</Link></dd></div></dl></section>
          {discrepancy.status.toLowerCase() === 'open' && <section className="pt-7" aria-labelledby="dispute-heading"><div className="flex flex-col justify-between gap-4 border-b border-line pb-4 sm:flex-row sm:items-end"><div><p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-brand">Resolution</p><h2 id="dispute-heading" className="mt-1 font-display text-2xl font-medium text-ink">Request a royalty review</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Create a draft dispute from this evidence. You will review it before anything is sent.</p></div><button className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => setIsFormOpen((open) => !open)} type="button">{isFormOpen ? 'Close draft form' : 'Create dispute draft'}</button></div>
            {isFormOpen && <form className="mt-6 max-w-3xl space-y-4" onSubmit={handleCreateDispute}><div><label className="block text-sm font-semibold text-ink" htmlFor="recipient">Royalty department email</label><input className="mt-2 min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" id="recipient" onChange={(event) => setRecipient(event.target.value)} required type="email" value={recipient} /></div><div><label className="block text-sm font-semibold text-ink" htmlFor="subject">Subject</label><input className="mt-2 min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" id="subject" maxLength={255} onChange={(event) => setSubject(event.target.value)} required value={subject} /></div><div><label className="block text-sm font-semibold text-ink" htmlFor="body">Draft message</label><textarea className="mt-2 min-h-40 w-full rounded-lg border border-line bg-white px-3 py-3 text-sm leading-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" id="body" maxLength={20000} onChange={(event) => setBody(event.target.value)} required value={body} /></div>{formError && <p className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">{formError}</p>}<button className="min-h-11 rounded-lg border border-brand px-4 text-sm font-semibold text-brand hover:bg-lavender focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60" disabled={isCreating} type="submit">{isCreating ? 'Creating draft...' : 'Save draft for review'}</button></form>}
          </section>}
        </>
      ) : <EmptyState title="Discrepancy not found" description="This discrepancy is not available to your account." />}
    </div>
  )
}

export default DiscrepancyDetailPage
