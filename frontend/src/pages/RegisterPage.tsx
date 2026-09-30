import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthField from '../components/AuthField'
import AuthLayout from '../layouts/AuthLayout'
import { useAuth } from '../hooks/useAuth'
import { getApiErrorMessage } from '../services/apiClient'
import { register } from '../services/royaltyguardApi'

function RegisterPage() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string
    email?: string
    password?: string
  }>({})
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const nextFieldErrors: typeof fieldErrors = {}
    if (!name.trim()) nextFieldErrors.name = 'Enter your name.'
    else if (name.trim().length > 100) nextFieldErrors.name = 'Name must be 100 characters or fewer.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextFieldErrors.email = 'Enter a valid email address.'
    }
    if (password.length < 8) nextFieldErrors.password = 'Password must be at least 8 characters.'

    if (new TextEncoder().encode(password).length > 72) {
      nextFieldErrors.password = 'Password must be no more than 72 UTF-8 bytes.'
    }

    setFieldErrors(nextFieldErrors)
    if (Object.keys(nextFieldErrors).length > 0) return

    setIsSubmitting(true)

    try {
      await register(name.trim(), email.trim(), password)
      setRegisteredEmail(email.trim())
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'We could not create your account. Please try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (registeredEmail) {
    return (
      <AuthLayout>
        <section className="page-enter" role="status">
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.2em] text-pine">Account created</p>
          <h2 className="mt-3 font-display text-4xl font-medium text-ink">You're on your way.</h2>
          <p className="mt-4 text-sm leading-6 text-muted">
            Your account is ready for <span className="font-semibold text-ink">{registeredEmail}</span>.
            Sign in to continue to your workspace.
          </p>
          <button
            className="mt-8 flex min-h-12 w-full items-center justify-center rounded-lg bg-pine px-4 text-sm font-semibold text-white transition-colors hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine"
            onClick={() => navigate('/login', { state: { email: registeredEmail }, replace: true })}
            type="button"
          >
            Continue to sign in
          </button>
          <p className="mt-7 text-center text-sm text-muted">
            Already have an account?{' '}
            <Link className="font-semibold text-pine underline decoration-pine/30 underline-offset-4 hover:decoration-pine" to="/login">
              Sign in
            </Link>
          </p>
        </section>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="page-enter">
        <p className="text-[0.66rem] font-bold uppercase tracking-[0.2em] text-pine">Get started</p>
        <h2 className="mt-3 font-display text-4xl font-medium text-ink">Create your account</h2>
        <p className="mt-3 text-sm leading-6 text-muted">Set up your royalty workspace.</p>

        <form className="mt-7 space-y-4" onSubmit={handleSubmit} noValidate>
          <AuthField
            id="register-name"
            label="Your name"
            type="text"
            name="name"
            autoComplete="name"
            placeholder="Name"
            maxLength={100}
            error={fieldErrors.name}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <AuthField
            id="register-email"
            label="Email address"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            maxLength={255}
            error={fieldErrors.email}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <AuthField
            id="register-password"
            label="Password"
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            minLength={8}
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
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
          <p className="text-center text-sm text-muted" aria-live="polite">
            {isSubmitting ? 'Setting up your workspace...' : ''}
          </p>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          Already registered?{' '}
          <Link className="font-semibold text-pine underline decoration-pine/30 underline-offset-4 hover:decoration-pine" to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

export default RegisterPage