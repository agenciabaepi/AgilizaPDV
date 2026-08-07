import { Navigate } from 'react-router-dom'
import { useSaasAuth } from '../hooks/useSaasAuth'

export function SaasProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSaasAuth()

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Carregando…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/saas/login" replace />
  }

  return <>{children}</>
}
