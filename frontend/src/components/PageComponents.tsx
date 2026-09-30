import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col justify-between gap-6 border-b border-line pb-7 sm:flex-row sm:items-end sm:pb-8">
      <div>
        <p className="mb-3 text-[0.66rem] font-bold uppercase tracking-[0.2em] text-brand">
          {eyebrow}
        </p>
        <h1 className="font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">{description}</p>
      </div>
      {action}
    </header>
  )
}

const statusStyles: Record<string, string> = {
  completed: 'border-brand/15 bg-lavender text-brand-deep',
  processing: 'border-brand/20 bg-brand/5 text-brand',
  pending: 'border-line bg-canvas text-muted',
  failed: 'border-red-200 bg-red-50 text-red-900',
  open: 'border-amber-200 bg-amber-50 text-amber-900',
  resolved: 'border-brand/15 bg-lavender text-brand-deep',
  draft: 'border-line bg-canvas text-muted',
  sent: 'border-brand/15 bg-lavender text-brand-deep',
  sending: 'border-brand/20 bg-brand/5 text-brand',
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  const style = statusStyles[normalized] ?? 'border-line bg-white text-ink'
  const label = status.replace(/[_-]/g, ' ')

  return (
    <span
      aria-label={`Status: ${label}`}
      className={`inline-flex min-h-7 items-center gap-2 rounded-full border px-2.5 text-xs font-semibold capitalize ${style}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  )
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-40 items-center gap-3 border-b border-line py-8 text-sm text-muted" role="status">
      <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-brand/20 border-t-brand motion-reduce:animate-none" />
      {label}
    </div>
  )
}

export function ErrorState({
  title = 'Unable to load this page',
  message,
  onRetry,
}: {
  title?: string
  message: string
  onRetry: () => void
}) {
  return (
    <section className="my-7 border-l-2 border-red-700 bg-red-50 px-4 py-4" role="alert">
      <h2 className="text-sm font-semibold text-red-950">{title}</h2>
      <p className="mt-1 text-sm leading-5 text-red-900">{message}</p>
      <button
        className="mt-4 min-h-10 rounded-lg border border-red-300 px-3 text-sm font-semibold text-red-950 transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
        onClick={onRetry}
        type="button"
      >
        Try again
      </button>
    </section>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <section className="border-b border-line py-10 sm:py-12">
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-muted">Nothing here yet</p>
      <h2 className="mt-3 font-display text-2xl font-medium text-ink">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </section>
  )
}