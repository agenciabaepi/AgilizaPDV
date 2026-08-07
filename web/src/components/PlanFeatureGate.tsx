import { Navigate, useLocation } from 'react-router-dom'
import { useSubscription } from '../hooks/useSubscription'
import { useAuth } from '../hooks/useAuth'

const NOTAS_FISCAIS_PATHS = ['/nfce', '/nfe', '/nfe/criar', '/configuracoes-loja/notas-fiscais']

function requiresNotasFiscais(pathname: string): boolean {
  return NOTAS_FISCAIS_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function requiresLojaOnline(pathname: string): boolean {
  return pathname === '/loja-online' || pathname.startsWith('/loja-online/')
}

export function PlanFeatureGate({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const { loading, status } = useSubscription()
  const location = useLocation()

  const isSuporte = session != null && 'suporte' in session && session.suporte
  if (isSuporte) return <>{children}</>

  if (loading) return <>{children}</>

  const pathname = location.pathname

  if (status && !status.notasFiscais && requiresNotasFiscais(pathname)) {
    return <Navigate to="/assinatura" replace state={{ upgrade: 'notasFiscais', from: location }} />
  }

  if (status && !status.lojaOnline && requiresLojaOnline(pathname)) {
    return <Navigate to="/assinatura" replace state={{ upgrade: 'lojaOnline', from: location }} />
  }

  return <>{children}</>
}
