import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/**
 * Só renderiza os filhos se o usuário for admin. Caso contrário redireciona para o dashboard.
 */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const isAdmin = session && 'role' in session && session.role?.toLowerCase() === 'admin'
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
