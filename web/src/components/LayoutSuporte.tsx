import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Settings, LogOut, Store, Factory, Users, PanelLeftClose, PanelLeftOpen, Menu, X, User } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useMediaQuery'
import logoAgiliza from '../assets/logo-white.svg'

const suporteItems = [
  { path: '/configuracoes', label: 'Configurações', icon: <Settings size={20} strokeWidth={1.75} /> },
  { path: '/configuracoes/empresas', label: 'Empresas', icon: <Users size={20} strokeWidth={1.75} /> },
  { path: '/configuracoes/nova-empresa', label: 'Nova empresa', icon: <Factory size={20} strokeWidth={1.75} /> },
  { path: '/configuracoes/loja', label: 'Configurar Loja', icon: <Store size={20} strokeWidth={1.75} /> },
]

function getPageTitle(pathname: string): string {
  return suporteItems.find((item) => item.path === pathname)?.label ?? 'Suporte'
}

export function LayoutSuporte({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    if (typeof window.electronAPI?.app?.getVersion !== 'function') return
    window.electronAPI.app.getVersion().then(setAppVersion).catch(() => setAppVersion(null))
  }, [])

  useEffect(() => {
    if (!profileMenuOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (!profileMenuRef.current?.contains(e.target as Node)) setProfileMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [profileMenuOpen])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!isMobile) setMobileNavOpen(false)
  }, [isMobile])

  useEffect(() => {
    if (isMobile && mobileNavOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobile, mobileNavOpen])

  const pageTitle = getPageTitle(location.pathname)

  const layoutClassName = [
    'app-layout',
    'app-layout-sidebar',
    sidebarExpanded && !isMobile ? 'app-layout-sidebar--expanded' : 'app-layout-sidebar--collapsed',
    isMobile ? 'app-layout-sidebar--mobile' : '',
    isMobile && mobileNavOpen ? 'app-layout-sidebar--nav-open' : '',
    isMobile ? 'app-layout-sidebar--bottom-nav' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={layoutClassName}>
      {isMobile && mobileNavOpen && (
        <button
          type="button"
          className="app-sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <Link to="/configuracoes" className="app-sidebar-logo" title="Agiliza PDV" onClick={() => setMobileNavOpen(false)}>
            <img src={logoAgiliza} alt="Agiliza" className="app-sidebar-logo-image" />
          </Link>
          {isMobile ? (
            <button type="button" className="app-sidebar-close" onClick={() => setMobileNavOpen(false)} aria-label="Fechar menu">
              <X size={20} strokeWidth={1.75} />
            </button>
          ) : (
            appVersion && sidebarExpanded && (
              <span className="app-sidebar-version">v{appVersion}</span>
            )
          )}
        </div>

        <nav className="app-sidebar-nav" aria-label="Menu suporte">
          {suporteItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`app-sidebar-item ${isActive ? 'app-sidebar-item--active' : ''}`}
                onClick={() => setMobileNavOpen(false)}
              >
                <span className="app-sidebar-item-icon">{item.icon}</span>
                {(isMobile || sidebarExpanded) && (
                  <span className="app-sidebar-item-label">{item.label}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {!isMobile && (
          <div className="app-sidebar-footer">
            <button
              type="button"
              className="app-sidebar-toggle"
              onClick={() => setSidebarExpanded((v) => !v)}
              title={sidebarExpanded ? 'Recolher menu' : 'Expandir menu'}
            >
              {sidebarExpanded ? <PanelLeftClose size={18} strokeWidth={1.75} /> : <PanelLeftOpen size={18} strokeWidth={1.75} />}
              {sidebarExpanded && <span>Recolher menu</span>}
            </button>
          </div>
        )}
      </aside>

      <div className="app-shell">
        <header className="app-header">
          <div className="app-header-left">
            {isMobile && (
              <button
                type="button"
                className="app-header-menu-btn"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu size={22} strokeWidth={1.75} />
              </button>
            )}
            {isMobile && <h1 className="app-header-title">{pageTitle}</h1>}
          </div>
          <div className="app-header-right">
            <div className="app-header-profile" ref={profileMenuRef}>
              <button
                type="button"
                className="app-header-profile-btn"
                onClick={() => setProfileMenuOpen((open) => !open)}
                aria-label="Menu do usuário"
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
              >
                <User size={20} strokeWidth={1.75} />
              </button>
              {profileMenuOpen && (
                <div className="app-header-profile-menu" role="menu">
                  <button
                    type="button"
                    className="app-header-profile-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false)
                      navigate('/configuracoes')
                    }}
                  >
                    <Settings size={16} strokeWidth={1.75} />
                    Configurações
                  </button>
                  <div className="app-header-profile-menu-divider" aria-hidden="true" />
                  <button
                    type="button"
                    className="app-header-profile-menu-item app-header-profile-menu-item--danger"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false)
                      void handleLogout()
                    }}
                  >
                    <LogOut size={16} strokeWidth={1.75} />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className={`app-main ${isMobile ? 'app-main--bottom-nav' : ''}`}>
          <div className="page-content">{children}</div>
        </main>

        {isMobile && (
          <nav className="app-bottom-nav" aria-label="Navegação suporte">
            {suporteItems.slice(0, 3).map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`app-bottom-nav-item ${isActive ? 'app-bottom-nav-item--active' : ''}`}
                >
                  <span className="app-bottom-nav-item-icon">{item.icon}</span>
                  <span className="app-bottom-nav-item-label">{item.label}</span>
                </Link>
              )
            })}
            <button
              type="button"
              className={`app-bottom-nav-item ${mobileNavOpen ? 'app-bottom-nav-item--active' : ''}`}
              onClick={() => setMobileNavOpen(true)}
              aria-label="Menu"
            >
              <span className="app-bottom-nav-item-icon"><Menu size={22} strokeWidth={1.75} /></span>
              <span className="app-bottom-nav-item-label">Menu</span>
            </button>
          </nav>
        )}
      </div>
    </div>
  )
}
