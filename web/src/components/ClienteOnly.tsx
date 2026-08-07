import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/**
 * Só renderiza os filhos se a sessão for de cliente (não suporte). Caso contrário redireciona para configurações.
 */
export function ClienteOnly({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const isSuporte = session && 'suporte' in session && session.suporte
  if (isSuporte) return <Navigate to="/configuracoes" replace />
  return <>{children}</>
}
