import { Navigate, useLocation } from 'react-router-dom'
import { useOnboarding } from '../hooks/useOnboarding'
import { useAuth } from '../hooks/useAuth'

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const { loading, completo } = useOnboarding()
  const location = useLocation()

  const isSuporte = session != null && 'suporte' in session && session.suporte
  if (isSuporte) return <>{children}</>

  if (!loading && completo && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />
  }

  if (!loading && !completo && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace state={{ from: location }} />
  }

  return <>{children}</>
}
