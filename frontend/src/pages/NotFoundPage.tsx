import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <section className="page-enter max-w-2xl">
      <p className="text-[0.66rem] font-bold uppercase tracking-[0.2em] text-brand">404 - Not found</p>
      <h1 className="mt-4 font-display text-4xl font-semibold text-ink">This page isn't here.</h1>
      <Link
        className="mt-7 inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        to="/dashboard"
      >
        Back to dashboard
      </Link>
    </section>
  )
}

export default NotFoundPage