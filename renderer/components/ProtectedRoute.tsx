import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{
        padding: 48,
        textAlign: 'center',
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        minHeight: '100vh',
      }}>
        Carregando...
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
