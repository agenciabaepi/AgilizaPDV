import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { readWebStoredSession } from '../lib/auth-session'
import type { AppSession, RegisterInput } from '../vite-env'

type AuthContextValue = {
  session: AppSession | null
  loading: boolean
  login: (email: string, senha: string) => Promise<boolean>
  register: (data: RegisterInput) => Promise<boolean>
  supportLogin: (login: string, senha: string) => Promise<boolean>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(() => readWebStoredSession())
  const [loading, setLoading] = useState(true)

  const refreshSession = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined' || !window.electronAPI?.auth?.getSession) {
      setSession(null)
      setLoading(false)
      return
    }
    try {
      const s = await window.electronAPI.auth.getSession()
      setSession(s)
    } catch {
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshSession()
  }, [refreshSession])

  useEffect(() => {
    const onSync = () => {
      void refreshSession()
    }
    window.addEventListener('agiliza:syncDataUpdated', onSync)
    return () => window.removeEventListener('agiliza:syncDataUpdated', onSync)
  }, [refreshSession])

  const login = useCallback(async (email: string, senha: string) => {
    const user = await window.electronAPI.auth.login(email, senha)
    setSession(user)
    return !!user
  }, [])

  const register = useCallback(async (data: RegisterInput) => {
    const user = await window.electronAPI.auth.register(data)
    setSession(user)
    return !!user
  }, [])

  const supportLogin = useCallback(async (login: string, senha: string) => {
    const user = await window.electronAPI.auth.supportLogin(login, senha)
    setSession(user)
    return !!user
  }, [])

  const logout = useCallback(async () => {
    await window.electronAPI.auth.logout()
    setSession(null)
  }, [])

  return (
    <AuthContext.Provider value={{ session, loading, login, register, supportLogin, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
