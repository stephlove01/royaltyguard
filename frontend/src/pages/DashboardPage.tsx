import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../services/apiClient'
import { getDashboardData } from '../services/royaltyguardApi'
import type { DashboardData } from '../services/royaltyguardApi'
import { useAuth } from '../hooks/useAuth'
import { EmptyState, ErrorState, LoadingState } from '../components/PageComponents'

const quickLinks = [
  { label: 'Statements', to: '/statements', note: 'Source documents' },
  { label: 'Audits', to: '/audits', note: 'Calculation history' },
  { label: 'Discrepancies', to: '/discrepancies', note: 'Review exceptions' },
  { label: 'Disputes', to: '/disputes', note: 'Track resolutions' },
]

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function DashboardPage() {
  const { user } = useAuth()
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    getDashboardData()
      .then((data) => {
        if (active) setDashboard(data)
      })
      .catch((requestError: unknown) => {
        if (!active) return
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : 'We could not load your dashboard. Please try again.',
        )
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [reloadKey])

  const stats = [
    { label: 'Statements', value: dashboard?.totalStatements, note: 'In your library' },
    { label: 'Audits completed', value: dashboard?.completedAudits, note: 'Completed reviews' },
    { label: 'Discrepancies', value: dashboard?.totalDiscrepancies, note: 'Recorded findings' },
    { label: 'Disputes', value: dashboard?.totalDisputes, note: 'Drafts and follow-up' },
  ]

  return (
    <div className="page-enter mx-auto max-w-7xl">
      <section className="flex flex-col justify-between gap-7 border-b border-line pb-8 sm:flex-row sm:items-end sm:pb-10">
        <div>
          <p className="mb-3 text-[0.66rem] font-bold uppercase tracking-[0.2em] text-brand">
            Workspace overview
          </p>
          <h1 className="font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">
            Royalty operations
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted sm:text-base">
            Statements, audit evidence, and dispute progress for your account.
            {user?.name ? ` Welcome, ${user.name}.` : ''}
          </p>
        </div>
        <Link
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          to="/statements"
        >
          <span aria-hidden="true" className="text-lg leading-none">+</span>
          Upload statement
        </Link>
      </section>

      <section aria-label="Account summary" className="grid grid-cols-2 gap-3 py-6 sm:gap-4 lg:grid-cols-4 lg:py-8">
        {stats.map((stat) => (
          <div key={stat.label} className="min-h-32 rounded-lg border border-line bg-white p-4 sm:p-5">
            <p className="text-xs font-semibold text-muted">{stat.label}</p>
            <p className="mt-5 font-display text-3xl font-medium tabular-nums text-ink" aria-live="polite">
              {isLoading ? '—' : (stat.value ?? 0).toLocaleString()}
            </p>
            <p className="mt-2 text-xs text-muted">{stat.note}</p>
          </div>
        ))}
      </section>

      {error && (
        <ErrorState
          title="Dashboard unavailable"
          message={error}
          onRetry={() => {
            setError('')
            setIsLoading(true)
            setReloadKey((current) => current + 1)
          }}
        />
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(250px,0.8fr)] lg:gap-14">
        <section aria-labelledby="recent-activity-heading">
          <div className="flex items-end justify-between border-b border-line pb-4">
            <div>
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-muted">Latest</p>
              <h2 id="recent-activity-heading" className="mt-1 font-display text-2xl font-medium text-ink">
                Recent activity
              </h2>
            </div>
            <span className="pb-1 text-xs text-muted">Latest 5 records</span>
          </div>

          {isLoading ? (
            <LoadingState label="Loading account activity..." />
          ) : dashboard?.recentActivity.length ? (
            <ul className="divide-y divide-line">
              {dashboard.recentActivity.map((activity) => (
                <li key={activity.id} className="flex items-center gap-4 py-4 sm:gap-6">
                  <span
                    aria-hidden="true"
                    className={`grid size-9 shrink-0 place-items-center rounded-lg border font-mono text-[0.65rem] font-bold ${
                      activity.kind === 'audit'
                        ? 'border-brand/20 bg-lavender text-brand'
                        : 'border-line bg-white text-muted'
                    }`}
                  >
                    {activity.kind === 'audit' ? 'AU' : 'ST'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{activity.title}</p>
                    <p className="mt-1 truncate text-xs text-muted">{activity.detail}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium capitalize text-ink">{activity.status}</p>
                    <p className="mt-1 text-[0.68rem] text-muted">{formatDate(activity.occurredAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No activity yet"
              description="Your recent statements and completed audits will appear here when they are available."
            />
          )}
        </section>

        <nav aria-label="Quick navigation">
          <div className="border-b border-line pb-4">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-muted">Workspace</p>
            <h2 className="mt-1 font-display text-2xl font-medium text-ink">Quick access</h2>
          </div>
          <ul className="divide-y divide-line">
            {quickLinks.map((link, index) => (
              <li key={link.to}>
                <Link className="group flex items-center justify-between gap-3 py-4" to={link.to}>
                  <span>
                    <span className="block text-sm font-semibold text-ink group-hover:text-brand">{link.label}</span>
                    <span className="mt-1 block text-xs text-muted">{link.note}</span>
                  </span>
                  <span className="font-mono text-[0.65rem] text-muted" aria-hidden="true">
                    0{index + 1} <span className="ml-2 text-brand">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}

export default DashboardPage