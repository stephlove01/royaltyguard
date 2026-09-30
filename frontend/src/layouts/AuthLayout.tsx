import { Link } from 'react-router-dom'

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas md:grid md:grid-cols-[minmax(0,1.05fr)_minmax(430px,0.95fr)]">
      <aside className="relative flex min-h-[300px] flex-col overflow-hidden bg-brand-deep px-6 py-7 text-white sm:px-10 sm:py-9 md:min-h-screen md:px-12 md:py-12 lg:px-16">
        <Link to="/login" className="flex w-fit items-center gap-3" aria-label="RoyaltyGuard">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-accent font-mono text-sm font-bold text-brand-deep">
            RG
          </span>
          <span>
            <span className="block max-w-[245px] font-display text-lg font-semibold leading-5">
              RoyaltyGuard
            </span>
            <span className="mt-1 block max-w-[245px] text-[0.68rem] leading-4 text-white/65">
              — Independent Musician Royalty Leakage Detective
            </span>
          </span>
        </Link>

        <div className="relative z-10 my-auto max-w-xl py-12 md:py-20">
          <p className="mb-5 flex items-center gap-3 text-[0.66rem] font-bold uppercase tracking-[0.2em] text-brand-accent">
            <span className="h-px w-8 bg-brand-accent/70" />
            Royalty oversight
          </p>
          <h1 className="max-w-lg font-display text-4xl font-medium leading-[1.08] sm:text-5xl lg:text-6xl">
            The books behind every beat.
          </h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-white/65 sm:text-base">
            Keep statements, audit evidence, and follow-through in one considered place.
          </p>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/15 pt-4 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/45">
          <span>Statements</span>
          <span aria-hidden="true" className="mx-3 h-px flex-1 bg-white/15" />
          <span>Evidence</span>
          <span aria-hidden="true" className="mx-3 h-px flex-1 bg-white/15" />
          <span>Resolution</span>
        </div>

      </aside>

      <main className="flex min-h-[520px] items-center justify-center px-6 py-12 sm:px-10 md:min-h-screen md:px-12 lg:px-16">
        <div className="w-full max-w-[420px]">{children}</div>
      </main>
    </div>
  )
}

export default AuthLayout