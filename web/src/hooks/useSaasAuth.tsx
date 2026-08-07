import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { readSaasSession, saveSaasSession, type SaasSession } from '../lib/saas-session'
import { saasLogin } from '../lib/saas-api'

type SaasAuthContextValue = {
  session: SaasSession | null
  loading: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

const SaasAuthContext = createContext<SaasAuthContextValue | null>(null)

export function SaasAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SaasSession | null>(() => readSaasSession())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setSession(readSaasSession())
    setLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await saasLogin(email, password)
    if (!res.ok || !res.token || !res.email) return false
    const next: SaasSession = { token: res.token, email: res.email }
    saveSaasSession(next)
    setSession(next)
    return true
  }, [])

  const logout = useCallback(() => {
    saveSaasSession(null)
    setSession(null)
  }, [])

  return (
    <SaasAuthContext.Provider value={{ session, loading, login, logout }}>
      {children}
    </SaasAuthContext.Provider>
  )
}

export function useSaasAuth() {
  const ctx = useContext(SaasAuthContext)
  if (!ctx) throw new Error('useSaasAuth deve ser usado dentro de SaasAuthProvider')
  return ctx
}
