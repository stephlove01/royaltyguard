import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import AuthField from '../components/AuthField'
import AuthLayout from '../layouts/AuthLayout'
import { useAuth } from '../hooks/useAuth'
import { getApiErrorMessage } from '../services/apiClient'
import { login } from '../services/royaltyguardApi'

interface LoginLocationState {
  email?: string
  from?: { pathname?: string }
}

function LoginPage() {
  const { isAuthenticated, signIn } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const locationState = location.state as LoginLocationState | null
  const [email, setEmail] = useState(locationState?.email ?? '')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const nextFieldErrors: typeof fieldErrors = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextFieldErrors.email = 'Enter a valid email address.'
    }
    if (!password) nextFieldErrors.password = 'Enter your password.'
    setFieldErrors(nextFieldErrors)
    if (Object.keys(nextFieldErrors).length > 0) return

    setIsSubmitting(true)

    try {
      const result = await login(email.trim(), password)
      signIn(result.token, result.user)
      navigate(locationState?.from?.pathname || '/dashboard', { replace: true })
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'We could not sign you in. Please try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <div className="page-enter">
        <p className="text-[0.66rem] font-bold uppercase tracking-[0.2em] text-pine">Welcome back</p>
        <h2 className="mt-3 font-display text-4xl font-medium text-ink">Sign in</h2>
        <p className="mt-3 text-sm leading-6 text-muted">Return to your royalty workspace.</p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
          <AuthField
            id="login-email"
            label="Email address"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={fieldErrors.email}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <AuthField
            id="login-password"
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            error={fieldErrors.password}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-5 text-red-900" role="alert">
              {error}
            </p>
          )}

          <button
            className="flex min-h-12 w-full items-center justify-center rounded-lg bg-pine px-4 text-sm font-semibold text-white transition-colors hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine disabled:cursor-wait disabled:opacity-65"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
          <p className="text-center text-sm text-muted" aria-live="polite">
            {isSubmitting ? 'Checking your account...' : ''}
          </p>
        </form>

        <p className="mt-7 text-center text-sm text-muted">
          New to RoyaltyGuard?{' '}
          <Link className="font-semibold text-pine underline decoration-pine/30 underline-offset-4 hover:decoration-pine" to="/register">
            Create an account
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

export default LoginPage