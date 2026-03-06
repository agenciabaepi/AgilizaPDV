import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Settings, LogOut } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

/**
 * Layout para usuário suporte: menu superior igual ao do app (logo + aba Configurações + usuário + Sair).
 */
export function LayoutSuporte({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [installMode, setInstallMode] = useState<'server' | 'terminal' | 'unknown'>('unknown')
  const modeLabel = installMode === 'server' ? 'Servidor' : installMode === 'terminal' ? 'Terminal' : 'Nao identificado'
  const modeColor = installMode === 'server' ? '#065f46' : installMode === 'terminal' ? '#1d4ed8' : '#6b7280'
  const modeBackground =
    installMode === 'server'
      ? 'rgba(16, 185, 129, 0.15)'
      : installMode === 'terminal'
        ? 'rgba(59, 130, 246, 0.15)'
        : 'rgba(107, 114, 128, 0.15)'

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    if (typeof window.electronAPI?.app?.getVersion !== 'function') return
    window.electronAPI.app.getVersion().then(setAppVersion).catch(() => setAppVersion(null))
  }, [])
  useEffect(() => {
    if (typeof window.electronAPI?.app?.getInstallMode !== 'function') return
    window.electronAPI.app.getInstallMode().then(setInstallMode).catch(() => setInstallMode('unknown'))
  }, [])

  const nome = session && 'nome' in session ? String(session.nome) : 'Suporte'
  const role = 'suporte'
  const showRole = role.toLowerCase() !== nome.toLowerCase()

  return (
    <div className="app-layout app-layout-topmenu">
      <header className="app-topbar">
        <Link to="/configuracoes" className="app-topbar-logo">
          <span className="app-topbar-logo-icon">A</span>
          <span>Agiliza PDV — Suporte</span>
          {appVersion && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-muted)',
              }}
            >
              v{appVersion}
            </span>
          )}
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
          <span
            title={installMode === 'unknown' ? 'Modo nao identificado neste ambiente' : `Este computador esta no modo ${modeLabel}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: 'var(--text-xs)',
              marginRight: 8,
              color: modeColor,
              background: modeBackground
            }}
          >
            {modeLabel}
          </span>
          <span className="app-topbar-user">{nome}</span>
          {showRole && <span className="app-topbar-role">{role}</span>}
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
