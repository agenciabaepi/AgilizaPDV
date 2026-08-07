import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './useAuth'
import { loadOnboardingStatus, type OnboardingStatus } from '../lib/onboarding'

type OnboardingContextValue = {
  loading: boolean
  status: OnboardingStatus | null
  completo: boolean
  refresh: () => Promise<void>
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<OnboardingStatus | null>(null)

  const isSuporte = session != null && 'suporte' in session && session.suporte
  const empresaId = session != null && !('suporte' in session) ? session.empresa_id : null
  const userId = session != null && !('suporte' in session) ? session.id : null
  const hasTenantSession = !!empresaId && !!userId && !isSuporte

  const refresh = useCallback(async () => {
    if (!hasTenantSession) {
      setStatus(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const next = await loadOnboardingStatus(empresaId!, userId!)
      setStatus(next)
    } catch {
      setStatus({
        completo: false,
        empresaCompleta: false,
        usuarioCompleto: false,
        camposEmpresaFaltando: ['Dados da empresa'],
        camposUsuarioFaltando: ['Dados do usuário'],
      })
    } finally {
      setLoading(false)
    }
  }, [empresaId, userId, hasTenantSession])

  useEffect(() => {
    if (!hasTenantSession) {
      setStatus(null)
      setLoading(false)
      return
    }
    setLoading(true)
    void refresh()
  }, [hasTenantSession, refresh])

  const checking = hasTenantSession && (loading || status === null)
  const completo = !hasTenantSession || isSuporte || (status?.completo ?? false)

  const value = useMemo(
    () => ({
      loading: checking,
      status,
      completo,
      refresh,
    }),
    [checking, status, completo, refresh]
  )

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext)
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider')
  return ctx
}
