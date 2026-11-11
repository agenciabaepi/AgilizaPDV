import { LoginPage } from './pages/LoginPage'
import { EtiquetasPage } from './pages/EtiquetasPage'
import { useAuth } from './hooks/useAuth'

export function App() {
  const { session, loading, login, logout } = useAuth()

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-loading">Carregando...</div>
      </div>
    )
  }

  if (!session) {
    return <LoginPage login={login} onSuccess={() => undefined} />
  }

  return <EtiquetasPage session={session} onLogout={logout} />
}
