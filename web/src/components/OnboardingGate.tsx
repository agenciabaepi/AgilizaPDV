import { Navigate, useLocation } from 'react-router-dom'
import { useOnboarding } from '../hooks/useOnboarding'
import { useAuth } from '../hooks/useAuth'
import { isSetupWizardPending } from '../lib/setup-wizard'

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const { loading, completo } = useOnboarding()
  const location = useLocation()

  const isSuporte = session != null && 'suporte' in session && session.suporte
  if (isSuporte) return <>{children}</>

  const empresaId = session != null && !('suporte' in session) ? session.empresa_id : null
  const setupPending = isSetupWizardPending(empresaId)
  const onOnboarding = location.pathname === '/onboarding'

  if (!loading && !completo && !onOnboarding) {
    return <Navigate to="/onboarding" replace state={{ from: location }} />
  }

  // Dados obrigatórios ok, mas pós-cadastro ainda pendente → manter no wizard
  if (!loading && completo && setupPending && !onOnboarding) {
    return <Navigate to="/onboarding" replace state={{ from: location }} />
  }

  return <>{children}</>
}
