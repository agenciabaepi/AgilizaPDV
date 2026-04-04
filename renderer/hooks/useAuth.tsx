import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { AppSession } from '../vite-env'

type AuthContextValue = {
  session: AppSession | null
  loading: boolean
  login: (empresaCodigo: string, login: string, senha: string) => Promise<boolean>
  supportLogin: (login: string, senha: string) => Promise<boolean>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(null)
  const [loading, setLoading] = useState(false)

  const refreshSession = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined' || !window.electronAPI?.auth?.getSession) {
      setSession(null)
      return
    }
    try {
      const s = await window.electronAPI.auth.getSession()
      setSession(s)
    } catch {
      setSession(null)
    }
  }, [])

  useEffect(() => {
    refreshSession()
  }, [refreshSession])

  // Após sync (ex.: permissões alteradas em outro terminal ou no Supabase), recarrega sessão do banco.
  useEffect(() => {
    const onSync = () => {
      void refreshSession()
    }
    window.addEventListener('agiliza:syncDataUpdated', onSync)
    return () => window.removeEventListener('agiliza:syncDataUpdated', onSync)
  }, [refreshSession])

  const login = useCallback(
    async (empresaCodigo: string, login: string, senha: string) => {
      const user = await window.electronAPI.auth.login(empresaCodigo, login, senha)
      setSession(user)
      return !!user
    },
    []
  )

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
    <AuthContext.Provider value={{ session, loading, login, supportLogin, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
