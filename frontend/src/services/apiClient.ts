const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(
  /\/+$/,
  '',
)

const TOKEN_KEY = 'royaltyguard.auth.token'
const USER_KEY = 'royaltyguard.auth.user'

export interface ApiUser {
  id: number
  name: string
  email: string
}

interface ApiErrorBody {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
  data?: unknown
}

export class ApiError extends Error {
  status: number
  code?: string
  details?: unknown
  data?: unknown

  constructor(message: string, status: number, code?: string, details?: unknown, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.data = data
  }
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback

  const detailText = Array.isArray(error.details)
    ? error.details.filter((detail): detail is string => typeof detail === 'string').join('. ')
    : ''

  return detailText ? `${error.message}: ${detailText}` : error.message
}

export function getToken(): string | null {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY)
}

export function getStoredUser(): ApiUser | null {
  if (typeof window === 'undefined') return null

  try {
    const value = window.localStorage.getItem(USER_KEY)
    return value ? (JSON.parse(value) as ApiUser) : null
  } catch {
    return null
  }
}

export function setStoredUser(user: ApiUser): void {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearStoredUser(): void {
  window.localStorage.removeItem(USER_KEY)
}

export function clearStoredAuth(): void {
  clearToken()
  clearStoredUser()
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const hasFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData

  if (options.body !== undefined && !hasFormDataBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  let response: Response

  try {
    response = await fetch(url, { ...options, headers })
  } catch {
    throw new ApiError('Unable to reach RoyaltyGuard. Check that the API is running.', 0, 'NETWORK_ERROR')
  }

  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearStoredAuth()
      window.dispatchEvent(new Event('royaltyguard:unauthorized'))
    }

    const errorBody = payload as ApiErrorBody | null
    throw new ApiError(
      errorBody?.error?.message || `The request failed (${response.status}).`,
      response.status,
      errorBody?.error?.code,
      errorBody?.error?.details,
      errorBody?.data,
    )
  }

  return payload as T
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' })
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'PUT', body: JSON.stringify(body) })
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
}