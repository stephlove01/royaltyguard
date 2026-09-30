import type { InputHTMLAttributes } from 'react'

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

function AuthField({ label, error, id, className, ...inputProps }: AuthFieldProps) {
  const errorId = id ? `${id}-error` : undefined

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        {...inputProps}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`min-h-12 w-full rounded-lg border bg-white px-3.5 text-sm text-ink outline-none transition placeholder:text-muted/70 focus-visible:border-pine focus-visible:ring-3 focus-visible:ring-pine/15 ${
          error ? 'border-red-700' : 'border-line'
        } ${className ?? ''}`}
      />
      {error && (
        <p id={errorId} className="text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  )
}

export default AuthField