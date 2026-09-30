import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './AuthContextValue'
import {
  clearStoredAuth,
  getStoredUser,
  getToken,
  setStoredUser,
  setToken,
} from '../services/apiClient'
import type { ApiUser } from '../services/apiClient'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setAuthToken] = useState<string | null>(() => getToken())
  const [user, setUser] = useState<ApiUser | null>(() => getStoredUser())

  useEffect(() => {
    const handleUnauthorized = () => {
      setAuthToken(null)
      setUser(null)
    }

    window.addEventListener('royaltyguard:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('royaltyguard:unauthorized', handleUnauthorized)
  }, [])

  const signIn = (newToken: string, newUser: ApiUser) => {
    setToken(newToken)
    setStoredUser(newUser)
    setAuthToken(newToken)
    setUser(newUser)
  }

  const signOut = () => {
    clearStoredAuth()
    setAuthToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated: Boolean(token), user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
