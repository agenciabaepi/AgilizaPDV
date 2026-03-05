import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/**
 * Só renderiza os filhos se a sessão for de suporte. Caso contrário redireciona para o dashboard.
 */
export function SuporteOnly({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const isSuporte = session && 'suporte' in session && session.suporte
  if (!isSuporte) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
