import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { CreditCard, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen, Menu, X, User } from 'lucide-react'
import { useSaasAuth } from '../hooks/useSaasAuth'
import { useIsMobile } from '../hooks/useMediaQuery'
import logoAgiliza from '../assets/logo-white.svg'

const navItems = [
  { path: '/saas', label: 'Dashboard', icon: <LayoutDashboard size={20} strokeWidth={1.75} /> },
  { path: '/saas/planos', label: 'Planos', icon: <CreditCard size={20} strokeWidth={1.75} /> },
]

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/saas/empresa')) return 'Detalhe da empresa'
  if (pathname.startsWith('/saas/planos')) return 'Planos e preços'
  return 'Gestão SaaS'
}

export function LayoutSaas({ children }: { children: React.ReactNode }) {
  const { session, logout } = useSaasAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  const handleLogout = () => {
    logout()
    navigate('/saas/login', { replace: true })
  }

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
          <Link to="/saas" className="app-sidebar-logo" title="Agiliza PDV SaaS" onClick={() => setMobileNavOpen(false)}>
            <img src={logoAgiliza} alt="Agiliza" className="app-sidebar-logo-image" />
          </Link>
          {isMobile ? (
            <button
              type="button"
              className="app-sidebar-close"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Fechar menu"
            >
              <X size={20} strokeWidth={1.75} />
            </button>
          ) : (
            sidebarExpanded && (
              <span className="app-sidebar-version">SaaS Admin</span>
            )
          )}
        </div>

        <nav className="app-sidebar-nav" aria-label="Menu SaaS">
          {navItems.map((item) => {
            const isActive =
              item.path === '/saas'
                ? location.pathname === '/saas'
                : location.pathname === item.path || location.pathname.startsWith(item.path + '/')
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
                  {session?.email && (
                    <div
                      className="app-header-profile-menu-item"
                      style={{ pointerEvents: 'none', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}
                    >
                      {session.email}
                    </div>
                  )}
                  <div className="app-header-profile-menu-divider" aria-hidden="true" />
                  <button
                    type="button"
                    className="app-header-profile-menu-item app-header-profile-menu-item--danger"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false)
                      handleLogout()
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

        <main className="app-main">
          <div className="page-content">{children}</div>
        </main>
      </div>
    </div>
  )
}
