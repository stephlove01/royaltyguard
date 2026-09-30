import { NavLink, Outlet } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const workspaceLinks = [
  { label: 'Dashboard', to: '/dashboard', marker: '01' },
  { label: 'Statements', to: '/statements', marker: '02' },
  { label: 'Audits', to: '/audits', marker: '03' },
  { label: 'Discrepancies', to: '/discrepancies', marker: '04' },
  { label: 'Disputes', to: '/disputes', marker: '05' },
]

function Brand() {
  return (
    <NavLink className="group flex items-center gap-3" to="/dashboard" aria-label="RoyaltyGuard home">
      <span className="relative grid size-10 place-items-center overflow-hidden rounded-xl bg-signal text-sm font-black tracking-wide text-pine-deep">
        RG
        <span className="absolute bottom-0 left-0 h-1 w-full bg-white/35" />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-[1.28rem] font-semibold text-white">RoyaltyGuard</span>
        <span className="mt-1 block text-[0.62rem] font-semibold uppercase tracking-[0.17em] text-white/55">
          Royalty operations
        </span>
      </span>
    </NavLink>
  )
}

function WorkspaceNav({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav
      aria-label="Workspace"
      className={mobile ? 'flex min-w-max items-center gap-1 px-4 py-2' : 'space-y-1'}
    >
      {workspaceLinks.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            mobile
              ? `inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-signal text-pine-deep'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              : `group flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/12 text-white'
                    : 'text-white/65 hover:bg-white/8 hover:text-white'
                }`
          }
        >
          {!mobile && (
            <span className="w-5 font-mono text-[0.62rem] text-white/35">
              {link.marker}
            </span>
          )}
          <span>{link.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function AppShell() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  function handleSignOut() {
    signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto min-h-screen max-w-[1680px] lg:grid lg:grid-cols-[258px_minmax(0,1fr)]">
        <aside className="hidden min-h-screen flex-col bg-pine-deep px-5 py-6 text-white lg:flex">
          <Brand />
          <div className="mb-3 mt-12 px-3 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-white/40">
            Workspace
          </div>
          <WorkspaceNav />
          <div className="mt-auto border-t border-white/10 pt-5">
            <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-3">
              <span className="grid size-9 place-items-center rounded-lg border border-white/15 font-mono text-xs text-signal">
                RG
              </span>
              <span>
                <span className="block text-xs font-semibold text-white/90">Demo workspace</span>
                <span className="mt-1 block text-[0.68rem] text-white/45">Local environment</span>
              </span>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-col">
          <header className="flex min-h-[72px] items-center justify-between border-b border-line bg-white px-4 sm:px-7 lg:px-10">
            <div className="lg:hidden">
              <Brand />
            </div>
            <div className="hidden text-sm text-muted lg:block">
              <span className="font-medium text-ink">Royalty operations</span>
              <span className="mx-2 text-line">/</span>
              <span>Workspace</span>
            </div>
            <nav aria-label="Account" className="ml-auto flex items-center gap-2 sm:gap-4">
              <span className="hidden max-w-48 truncate text-sm font-medium text-muted sm:block">
                {user?.name || user?.email || 'Account'}
              </span>
              <button
                className="min-h-10 rounded-lg border border-line px-3 text-sm font-semibold text-ink transition-colors hover:border-pine/40 hover:text-pine focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine"
                onClick={handleSignOut}
                type="button"
              >
                Sign out
              </button>
            </nav>
          </header>

          <div className="overflow-x-auto border-b border-line bg-pine-deep lg:hidden">
            <WorkspaceNav mobile />
          </div>

          <main id="main-content" className="flex-1 px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
            <Outlet />
          </main>

          <footer className="flex min-h-12 items-center justify-between border-t border-line px-5 text-[0.68rem] text-muted sm:px-8 lg:px-12">
            <span>RoyaltyGuard</span>
            <span className="inline-flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-signal" />
              Demo environment
            </span>
          </footer>
        </div>
      </div>
    </div>
  )
}

export default AppShell