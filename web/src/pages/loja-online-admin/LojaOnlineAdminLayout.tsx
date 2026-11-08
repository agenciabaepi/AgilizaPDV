import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, Store } from 'lucide-react'
import { Layout } from '../../components/Layout'
import { PageTitle } from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'
import { useEmpresaTheme } from '../../hooks/useEmpresaTheme'
import { useLojaOnlinePedidosPendentes } from '../../hooks/useLojaOnlinePedidosPendentes'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { isCapaPersonalizadaAtiva } from '../../lib/modulos'
import {
  LOJA_ONLINE_ADMIN_DEFAULT_SECTION,
  LOJA_ONLINE_ADMIN_NAV_GROUPS,
  getLojaOnlineAdminNavItem,
  resolveLojaOnlineAdminSection,
} from '../../lib/loja-online-admin-nav'

function LojaOnlineLegacyTabRedirect() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const legacyTab = searchParams.get('tab')
    if (!legacyTab) return
    const section = resolveLojaOnlineAdminSection(legacyTab)
    if (section) {
      navigate(`/loja-online/${section}${location.hash}`, { replace: true })
    }
  }, [searchParams, navigate, location.hash])

  return null
}

function isNavItemActive(pathname: string, itemPath: string): boolean {
  return pathname === itemPath
}

export function LojaOnlineAdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { config: empresaConfig } = useEmpresaTheme()
  const empresaId = session && 'empresa_id' in session ? session.empresa_id : null
  const isAdmin = session && 'role' in session && session.role?.toLowerCase() === 'admin'
  const { count: pedidosNotificacao } = useLojaOnlinePedidosPendentes(empresaId, !!isAdmin)
  const capaPersonalizadaAtiva = isCapaPersonalizadaAtiva(empresaId, empresaConfig?.modulos_json ?? null)

  const sectionMatch = location.pathname.match(/^\/loja-online\/([^/?#]+)/)
  const currentSection = resolveLojaOnlineAdminSection(sectionMatch?.[1])
  const pageTitle = currentSection ? getLojaOnlineAdminNavItem(currentSection).label : 'Loja online'
  const isMobile = useIsMobile()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const navGroups = useMemo(
    () =>
      LOJA_ONLINE_ADMIN_NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => item.id !== 'capas' || capaPersonalizadaAtiva),
      })).filter((group) => group.items.length > 0),
    [capaPersonalizadaAtiva]
  )

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (currentSection === 'capas' && !capaPersonalizadaAtiva) {
      navigate(`/loja-online/${LOJA_ONLINE_ADMIN_DEFAULT_SECTION}`, { replace: true })
    }
  }, [currentSection, capaPersonalizadaAtiva, navigate])

  const navCollapsed = isMobile && !mobileNavOpen

  return (
    <Layout>
      <LojaOnlineLegacyTabRedirect />
      <PageTitle title={pageTitle} subtitle="Pedidos, vitrine e configurações da loja online" />

      <div className="loja-admin-shell">
        <nav
          className={`loja-admin-sidebar${navCollapsed ? ' loja-admin-sidebar--collapsed' : ''}`}
          aria-label="Menu da loja online"
        >
          {isMobile ? (
            <button
              type="button"
              className="loja-admin-sidebar-head loja-admin-sidebar-head--toggle"
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-expanded={mobileNavOpen}
            >
              <Store size={20} strokeWidth={1.75} aria-hidden />
              <span className="loja-admin-sidebar-head-label">
                <span className="loja-admin-sidebar-head-caption">Loja online</span>
                {pageTitle}
              </span>
              {pedidosNotificacao > 0 && (
                <span className="loja-admin-sidebar-badge">
                  {pedidosNotificacao > 99 ? '99+' : pedidosNotificacao}
                </span>
              )}
              <ChevronDown
                size={18}
                className={`loja-admin-sidebar-head-chevron${mobileNavOpen ? ' is-open' : ''}`}
                aria-hidden
              />
            </button>
          ) : (
            <div className="loja-admin-sidebar-head">
              <Store size={20} strokeWidth={1.75} aria-hidden />
              <span>Loja online</span>
            </div>
          )}

          {!navCollapsed && navGroups.map((group) => (
            <div key={group.label} className="loja-admin-sidebar-group">
              <span className="loja-admin-sidebar-group-label">{group.label}</span>
              <ul className="loja-admin-sidebar-list">
                {group.items.map((item) => {
                  const active = isNavItemActive(location.pathname, item.path)
                  return (
                    <li key={item.id}>
                      <Link
                        to={item.path}
                        className={`loja-admin-sidebar-link${active ? ' is-active' : ''}`}
                        aria-current={active ? 'page' : undefined}
                      >
                        <span className="loja-admin-sidebar-link-icon">{item.icon}</span>
                        <span className="loja-admin-sidebar-link-label">{item.label}</span>
                        {item.id === 'pedidos' && pedidosNotificacao > 0 && (
                          <span className="loja-admin-sidebar-badge">
                            {pedidosNotificacao > 99 ? '99+' : pedidosNotificacao}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="loja-admin-main">
          <Outlet />
        </div>
      </div>
    </Layout>
  )
}
