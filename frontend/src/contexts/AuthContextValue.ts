import { createContext } from 'react'
import type { ApiUser } from '../services/apiClient'

export interface AuthContextValue {
  isAuthenticated: boolean
  user: ApiUser | null
  signIn: (token: string, user: ApiUser) => void
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)