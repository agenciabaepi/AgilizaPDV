import { Navigate, useLocation } from 'react-router-dom'
import { useSubscription } from '../hooks/useSubscription'
import { useAuth } from '../hooks/useAuth'

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const { loading, bloqueado } = useSubscription()
  const location = useLocation()

  const isSuporte = session != null && 'suporte' in session && session.suporte
  if (isSuporte) return <>{children}</>

  if (!loading && bloqueado && location.pathname !== '/assinatura') {
    return <Navigate to="/assinatura" replace state={{ from: location }} />
  }

  return <>{children}</>
}
