import { useState, useEffect, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Users,
  Truck,
  Wallet,
  ShoppingCart,
  LogOut,
  Home,
  ClipboardList,
  ArrowRightLeft,
  Receipt,
  Wifi,
  WifiOff,
  Tag,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

type TabId = 'inicio' | 'cadastro' | 'movimentacao' | 'pdv'

const tabs: { id: TabId; label: string; icon: React.ReactNode; path?: string }[] = [
  { id: 'inicio', label: 'Início', icon: <Home size={18} /> },
  { id: 'cadastro', label: 'Cadastro', icon: <ClipboardList size={18} /> },
  { id: 'movimentacao', label: 'Movimentação', icon: <ArrowRightLeft size={18} /> },
  { id: 'pdv', label: 'PDV', icon: <ShoppingCart size={18} />, path: '/pdv' },
]

const ribbonItems: Record<Exclude<TabId, 'pdv'>, { path: string; label: string; icon: React.ReactNode }[]> = {
  inicio: [
    { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={24} /> },
  ],
  cadastro: [
    { path: '/produtos', label: 'Produto', icon: <Package size={24} /> },
    { path: '/categorias', label: 'Categoria', icon: <Tag size={24} /> },
    { path: '/clientes', label: 'Cliente', icon: <Users size={24} /> },
    { path: '/fornecedores', label: 'Fornecedor', icon: <Truck size={24} /> },
  ],
  movimentacao: [
    { path: '/estoque', label: 'Estoque', icon: <Warehouse size={24} /> },
    { path: '/caixa', label: 'Caixa', icon: <Wallet size={24} /> },
    { path: '/vendas', label: 'Vendas', icon: <Receipt size={24} /> },
  ],
}

function getTabFromPath(pathname: string): TabId {
  if (pathname === '/pdv') return 'pdv'
  if (pathname === '/dashboard') return 'inicio'
  if (['/produtos', '/categorias', '/clientes', '/fornecedores'].includes(pathname)) return 'cadastro'
  if (['/estoque', '/caixa', '/vendas'].includes(pathname)) return 'movimentacao'
  return 'inicio'
}

const ONLINE_CHECK_INTERVAL = 5000

export function Layout({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const nome = session?.nome?.trim() ?? ''
  const role = session?.role?.trim() ?? ''
  const showRole = role.length > 0 && role.toLowerCase() !== nome.toLowerCase()
  const currentTab = getTabFromPath(location.pathname)
  const [openTab, setOpenTab] = useState<TabId | null>(currentTab)
  const [online, setOnline] = useState<boolean | null>(null)
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'success' | 'error' | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
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

  const checkOnline = useCallback(() => {
    if (typeof window.electronAPI?.sync?.checkOnline !== 'function') return
    // Só aceita resultado "online" se a rede do sistema ainda estiver ok (evita mostrar Online após desligar WiFi)
    window.electronAPI.sync.checkOnline().then((result) => {
      setOnline(navigator.onLine ? result : false)
    })
  }, [])

  useEffect(() => {
    setOpenTab(currentTab)
  }, [currentTab])

  // Rede desligada: mostrar Offline na hora; ao voltar, rechecar Supabase
  useEffect(() => {
    if (!navigator.onLine) setOnline(false)
    const onOffline = () => setOnline(false)
    const onOnline = () => checkOnline()
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [checkOnline])

  // Verificação periódica ao Supabase (complementa o evento do sistema)
  useEffect(() => {
    checkOnline()
    const t = setInterval(checkOnline, ONLINE_CHECK_INTERVAL)
    return () => clearInterval(t)
  }, [checkOnline])

  // Buscar versão do app (mostrada no topo)
  useEffect(() => {
    if (typeof window.electronAPI?.app?.getVersion !== 'function') return
    window.electronAPI.app.getVersion().then(setAppVersion).catch(() => setAppVersion(null))
  }, [])
  useEffect(() => {
    if (typeof window.electronAPI?.app?.getInstallMode !== 'function') return
    window.electronAPI.app.getInstallMode().then(setInstallMode).catch(() => setInstallMode('unknown'))
  }, [])

  // Escuta eventos de sincronização automática enviados pelo processo principal
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.sync?.onAutoSyncStatusChange) return
    const unsub = window.electronAPI.sync.onAutoSyncStatusChange(({ status, message }) => {
      setSyncStatus(status)
      const msg =
        typeof message === 'string'
          ? message
          : message != null && typeof message === 'object' && 'message' in message && typeof (message as { message: unknown }).message === 'string'
            ? (message as { message: string }).message
            : message != null ? String(message) : ''
      setSyncMessage(msg === '[object Object]' ? 'Erro ao sincronizar.' : msg)
    })
    return () => {
      unsub?.()
    }
  }, [])

  // Tempo real: quando o Supabase for alterado (ex.: painel web), o app recebe aqui e dispara evento para as telas atualizarem
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.sync?.onSyncDataUpdated) return
    const unsub = window.electronAPI.sync.onSyncDataUpdated(() => {
      window.dispatchEvent(new CustomEvent('agiliza:syncDataUpdated'))
    })
    return () => {
      unsub?.()
    }
  }, [])

  const activeTab = openTab ?? currentTab
  const isPdvPage = location.pathname === '/pdv'
  const ribbon = activeTab === 'pdv' ? [] : ribbonItems[activeTab]

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-layout app-layout-topmenu">
      {/* Barra superior: logo + abas + usuário e Sair */}
      <header className="app-topbar">
        <Link to="/dashboard" className="app-topbar-logo">
          <span className="app-topbar-logo-icon">A</span>
          <span>
            Agiliza PDV
            {appVersion && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-muted)',
                }}
              >
                v{appVersion}
              </span>
            )}
          </span>
        </Link>

        <nav className="app-topbar-tabs">
          {tabs.map((tab) =>
            tab.path ? (
              <Link
                key={tab.id}
                to={tab.path}
                className={`app-topbar-tab ${currentTab === tab.id ? 'app-topbar-tab--active' : ''}`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </Link>
            ) : (
              <button
                key={tab.id}
                type="button"
                className={`app-topbar-tab ${currentTab === tab.id ? 'app-topbar-tab--active' : ''}`}
                onClick={() => setOpenTab(openTab === tab.id ? null : tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            )
          )}
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
          {online !== null && (
            <>
              <span
                title={online ? 'Conectado ao Supabase' : 'Sem conexão com o Supabase'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 'var(--text-xs)',
                  color: online ? 'var(--color-success, #22c55e)' : 'var(--color-text-muted)',
                  marginRight: syncStatus === 'syncing' ? 4 : 8
                }}
              >
                {online ? <Wifi size={14} /> : <WifiOff size={14} />}
                {online ? 'Online' : 'Offline'}
              </span>
              {syncStatus === 'syncing' && (
                <span
                  className="app-topbar-sync-status"
                  title="Sincronizando alterações com o Supabase"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-muted)',
                    marginRight: 12
                  }}
                >
                  <RefreshCw size={14} className="app-topbar-sync-icon" />
                  Sincronizando…
                </span>
              )}
              {syncStatus && syncStatus !== 'syncing' && syncMessage && (
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    color:
                      syncStatus === 'success'
                        ? 'var(--color-success, #22c55e)'
                        : 'var(--color-error, #ef4444)',
                    marginRight: 12
                  }}
                >
                  {syncMessage}
                </span>
              )}
            </>
          )}
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

      {/* Ribbon: submenu (visível quando uma aba está expandida; no PDV permite voltar às outras páginas) */}
      {ribbon.length > 0 && (
        <div className="app-ribbon">
          {ribbon.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`app-ribbon-btn ${location.pathname === item.path ? 'app-ribbon-btn--active' : ''}`}
            >
              <span className="app-ribbon-icon">{item.icon}</span>
              <span className="app-ribbon-label">{item.label}</span>
            </Link>
          ))}
        </div>
      )}

      <main className={`app-main ${ribbon.length ? 'app-main--with-ribbon' : ''} ${isPdvPage ? 'app-main--pdv' : ''}`}>
        <div className="page-content">{children}</div>
      </main>
    </div>
  )
}
