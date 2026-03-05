import { Link, useNavigate } from 'react-router-dom'
import { Settings, LogOut } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

/**
 * Layout para usuário suporte: menu superior igual ao do app (logo + aba Configurações + usuário + Sair).
 */
export function LayoutSuporte({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const nome = session && 'nome' in session ? String(session.nome) : 'Suporte'

  return (
    <div className="app-layout app-layout-topmenu">
      <header className="app-topbar">
        <Link to="/configuracoes" className="app-topbar-logo">
          <span className="app-topbar-logo-icon">A</span>
          <span>Agiliza PDV — Suporte</span>
        </Link>

        <nav className="app-topbar-tabs">
          <Link
            to="/configuracoes"
            className="app-topbar-tab app-topbar-tab--active"
          >
            <Settings size={18} />
            <span>Configurações</span>
          </Link>
        </nav>

        <div className="app-topbar-right">
          <span className="app-topbar-user">{nome}</span>
          <span className="app-topbar-role">suporte</span>
          <button
            type="button"
            className="app-topbar-sair"
            onClick={handleLogout}
            title="Sair"
          >
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="page-content">{children}</div>
      </main>
    </div>
  )
}
