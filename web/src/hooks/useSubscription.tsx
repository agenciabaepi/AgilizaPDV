import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './useAuth'
import { fetchAssinaturaStatus } from '../lib/assinatura-api'
import { loadAssinaturaStatus } from '../lib/assinatura-status'
import type { AssinaturaPublicStatus } from '../vite-env'

type SubscriptionContextValue = {
  loading: boolean
  status: AssinaturaPublicStatus | null
  bloqueado: boolean
  refresh: () => Promise<void>
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null)

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<AssinaturaPublicStatus | null>(null)

  const isSuporte = session != null && 'suporte' in session && session.suporte
  const empresaId = session != null && !('suporte' in session) ? session.empresa_id : null

  const refresh = useCallback(async () => {
    if (!empresaId || isSuporte) {
      setStatus(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const localStatus = await loadAssinaturaStatus(empresaId)
      setStatus(localStatus)
      setLoading(false)

      // Sincroniza com Asaas em segundo plano (produção / após deploy)
      const apiRes = await fetchAssinaturaStatus(empresaId)
      if (apiRes.ok && apiRes.status) {
        setStatus(apiRes.status)
      }
    } catch (err) {
      setStatus({
        status: 'trial',
        bloqueado: false,
        plano: 'basic',
        planoNome: 'Basic',
        valorMensal: 89.9,
        notasFiscais: false,
        lojaOnline: false,
        trialFim: null,
        periodoFim: null,
        diasRestantes: null,
        mensagem: err instanceof Error ? err.message : 'Erro ao verificar assinatura.',
      })
    } finally {
      setLoading(false)
    }
  }, [empresaId, isSuporte])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const bloqueado = useMemo(() => {
    if (isSuporte || !empresaId) return false
    return status?.bloqueado ?? false
  }, [isSuporte, empresaId, status])

  const value = useMemo(
    () => ({ loading, status, bloqueado, refresh }),
    [loading, status, bloqueado, refresh]
  )

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) {
    throw new Error('useSubscription deve ser usado dentro de SubscriptionProvider')
  }
  return ctx
}
