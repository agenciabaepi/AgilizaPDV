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
  Landmark,
  HandCoins,
  ChartNoAxesCombined,
  Settings,
  FileCheck,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useEmpresaTheme } from '../hooks/useEmpresaTheme'
import logoAgiliza from '../../logoget.png'
import type { ModuloId } from '../vite-env'

type TabId = 'inicio' | 'cadastro' | 'movimentacao' | 'financeiro' | 'pdv' | 'configuracoes'

const PATH_TO_MODULO: Record<string, ModuloId> = {
  '/configuracoes-loja': 'dashboard',
  '/configuracoes-loja/notas-fiscais': 'dashboard',
  '/dashboard': 'dashboard',
  '/produtos': 'produtos',
  '/etiquetas': 'etiquetas',
  '/categorias': 'categorias',
  '/clientes': 'clientes',
  '/fornecedores': 'fornecedores',
  '/usuarios': 'usuarios',
  '/estoque': 'estoque',
  '/caixa': 'caixa',
  '/vendas': 'vendas',
  '/nfce': 'vendas',
  '/financeiro/fluxo-caixa': 'vendas',
  '/financeiro/contas-pagar': 'vendas',
  '/financeiro/contas-receber': 'vendas',
  '/pdv': 'pdv',
}

const MODULO_TO_PATH: Record<ModuloId, string> = {
  dashboard: '/dashboard',
  produtos: '/produtos',
  etiquetas: '/etiquetas',
  categorias: '/categorias',
  clientes: '/clientes',
  fornecedores: '/fornecedores',
  usuarios: '/usuarios',
  estoque: '/estoque',
  caixa: '/caixa',
  vendas: '/vendas',
  pdv: '/pdv',
}

const MODULO_PRIORITY: ModuloId[] = [
  'dashboard',
  'pdv',
  'caixa',
  'vendas',
  'produtos',
  'estoque',
  'clientes',
  'fornecedores',
  'categorias',
  'etiquetas',
  'usuarios',
]

const tabs: { id: TabId; label: string; icon: React.ReactNode; path?: string; modulos: ModuloId[]; adminOnly?: boolean; shortcut?: string }[] = [
  { id: 'inicio', label: 'Início', icon: <Home size={18} />, modulos: ['dashboard'], shortcut: 'F1' },
  { id: 'pdv', label: 'PDV', icon: <ShoppingCart size={18} />, path: '/pdv', modulos: ['pdv'], shortcut: 'F2' },
  { id: 'cadastro', label: 'Cadastro', icon: <ClipboardList size={18} />, modulos: ['produtos', 'etiquetas', 'categorias', 'clientes', 'fornecedores', 'usuarios'], shortcut: 'F3' },
  { id: 'movimentacao', label: 'Movimentação', icon: <ArrowRightLeft size={18} />, modulos: ['estoque', 'caixa'], shortcut: 'F4' },
  { id: 'financeiro', label: 'Financeiro', icon: <Landmark size={18} />, modulos: ['vendas'], shortcut: 'F5' },
  { id: 'configuracoes', label: 'Configurações', icon: <Settings size={18} />, path: '/configuracoes-loja', modulos: ['dashboard'], adminOnly: true, shortcut: 'F6' },
]

const ribbonItems: Record<Exclude<TabId, 'pdv'>, { path: string; label: string; icon: React.ReactNode; modulo: ModuloId; adminOnly?: boolean }[]> = {
  inicio: [
    { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={24} />, modulo: 'dashboard' },
  ],
  configuracoes: [
    { path: '/configuracoes-loja', label: 'Dados da loja', icon: <Settings size={24} />, modulo: 'dashboard', adminOnly: true },
    { path: '/configuracoes-loja/notas-fiscais', label: 'Notas fiscais', icon: <FileCheck size={24} />, modulo: 'dashboard', adminOnly: true },
  ],
  cadastro: [
    { path: '/produtos', label: 'Produto', icon: <Package size={24} />, modulo: 'produtos' },
    { path: '/etiquetas', label: 'Etiquetas', icon: <Tag size={24} />, modulo: 'etiquetas' },
    { path: '/categorias', label: 'Categoria', icon: <Tag size={24} />, modulo: 'categorias' },
    { path: '/clientes', label: 'Cliente', icon: <Users size={24} />, modulo: 'clientes' },
    { path: '/fornecedores', label: 'Fornecedor', icon: <Truck size={24} />, modulo: 'fornecedores' },
    { path: '/usuarios', label: 'Usuários', icon: <Users size={24} />, modulo: 'usuarios' },
  ],
  movimentacao: [
    { path: '/estoque', label: 'Estoque', icon: <Warehouse size={24} />, modulo: 'estoque' },
    { path: '/caixa', label: 'Caixa', icon: <Wallet size={24} />, modulo: 'caixa' },
  ],
  financeiro: [
    { path: '/vendas', label: 'Vendas', icon: <Receipt size={24} />, modulo: 'vendas' },
    { path: '/nfce', label: 'NFC-e', icon: <FileCheck size={24} />, modulo: 'vendas' },
    { path: '/financeiro/fluxo-caixa', label: 'Fluxo de caixa', icon: <ChartNoAxesCombined size={24} />, modulo: 'vendas' },
    { path: '/financeiro/contas-pagar', label: 'Contas a pagar', icon: <Wallet size={24} />, modulo: 'vendas' },
    { path: '/financeiro/contas-receber', label: 'Contas a receber', icon: <HandCoins size={24} />, modulo: 'vendas' },
  ],
}

function parseModulos(json: string | null): Record<ModuloId, boolean> {
  const defaults: Record<ModuloId, boolean> = {
    dashboard: true, produtos: true, etiquetas: true, categorias: true,
    clientes: true, fornecedores: true, usuarios: true, estoque: true, caixa: true,
    vendas: true, pdv: true,
  }
  if (!json?.trim()) return defaults
  try {
    const parsed = JSON.parse(json) as Record<string, boolean>
    return { ...defaults, ...parsed }
  } catch {
    return defaults
  }
}

function getTabFromPath(pathname: string): TabId {
  if (pathname === '/pdv') return 'pdv'
  if (pathname === '/configuracoes-loja' || pathname.startsWith('/configuracoes-loja/')) return 'configuracoes'
  if (pathname === '/dashboard') return 'inicio'
  if (['/produtos', '/etiquetas', '/categorias', '/clientes', '/fornecedores', '/usuarios'].includes(pathname)) return 'cadastro'
  if (['/estoque', '/caixa'].includes(pathname)) return 'movimentacao'
  if (['/vendas', '/nfce', '/financeiro/fluxo-caixa', '/financeiro/contas-pagar', '/financeiro/contas-receber'].includes(pathname)) return 'financeiro'
  return 'inicio'
}

const ONLINE_CHECK_INTERVAL = 5000

/** Atalhos F1-F6 para os menus. Ordem: Início, PDV, Cadastro, Movimentação, Financeiro, Configurações */
const TAB_SHORTCUTS: { key: string; tabId: TabId; path: string }[] = [
  { key: 'F1', tabId: 'inicio', path: '/dashboard' },
  { key: 'F2', tabId: 'pdv', path: '/pdv' },
  { key: 'F3', tabId: 'cadastro', path: '/produtos' },
  { key: 'F4', tabId: 'movimentacao', path: '/estoque' },
  { key: 'F5', tabId: 'financeiro', path: '/vendas' },
  { key: 'F6', tabId: 'configuracoes', path: '/configuracoes-loja' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth()
  const { config: empresaConfig, setEmpresaIdForTheme } = useEmpresaTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const empresaId = session && 'empresa_id' in session ? session.empresa_id : null
  const nome = session?.nome?.trim() ?? ''
  const role = session?.role?.trim() ?? ''
  const showRole = role.length > 0 && role.toLowerCase() !== nome.toLowerCase()
  const currentTab = getTabFromPath(location.pathname)
  const [openTab, setOpenTab] = useState<TabId | null>(currentTab)

  // Permissões: primeiro do usuário (modulos_json), senão da empresa
  const userModulosJson = session && 'modulos_json' in session ? session.modulos_json : null
  const userModulos = userModulosJson != null && userModulosJson !== '' ? parseModulos(userModulosJson) : null
  const empresaModulos = empresaConfig ? parseModulos(empresaConfig.modulos_json) : null
  const modulos = userModulos ?? empresaModulos
  // Dashboard é fixo para todos os usuários.
  const moduloEnabled = (id: ModuloId) => id === 'dashboard' || !modulos || modulos[id] !== false
  const firstAllowedPath = (() => {
    for (const modulo of MODULO_PRIORITY) {
      if (moduloEnabled(modulo)) return MODULO_TO_PATH[modulo]
    }
    return '/dashboard'
  })()
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

  useEffect(() => {
    setEmpresaIdForTheme(empresaId)
  }, [empresaId, setEmpresaIdForTheme])

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
  const isAdmin = session && 'role' in session && session.role?.toLowerCase() === 'admin'
  const ribbonBase = activeTab === 'pdv' ? [] : ribbonItems[activeTab] ?? []
  const ribbon = (modulos
    ? ribbonBase.filter((item) => moduloEnabled(item.modulo))
    : ribbonBase
  ).filter((item) => !item.adminOnly || isAdmin)

  const visibleTabs = (modulos
    ? tabs.filter((tab) => tab.modulos.some((m) => moduloEnabled(m)))
    : tabs
  ).filter((tab) => !tab.adminOnly || isAdmin)

  // Atalhos F1-F6 para abrir os menus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
        return
      }
      const shortcut = TAB_SHORTCUTS.find((s) => s.key === e.key)
      if (!shortcut) return
      const tabVisible = visibleTabs.some((t) => t.id === shortcut.tabId)
      if (!tabVisible) return
      e.preventDefault()
      navigate(shortcut.path)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, visibleTabs])

  const logoUrl = empresaConfig?.logo ?? logoAgiliza

  // Redirecionar se o usuário estiver em uma rota cujo módulo foi desativado
  const currentModulo = PATH_TO_MODULO[location.pathname]
  useEffect(() => {
    if (currentModulo && currentModulo !== 'dashboard' && modulos && modulos[currentModulo] === false) {
      if (location.pathname !== firstAllowedPath) {
        navigate(firstAllowedPath, { replace: true })
      }
    }
  }, [currentModulo, modulos, navigate, location.pathname, firstAllowedPath])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-layout app-layout-topmenu">
      {/* Barra superior: logo + abas + usuário e Sair */}
      <header className="app-topbar">
        <Link to={firstAllowedPath} className="app-topbar-logo">
          <span className="app-topbar-logo-icon">
            <img src={logoUrl} alt={empresaConfig?.nome ?? 'Agiliza'} className="app-topbar-logo-image" />
          </span>
        </Link>

        <nav className="app-topbar-tabs">
          {visibleTabs.map((tab) => {
            const title = tab.shortcut ? `${tab.label} (${tab.shortcut})` : tab.label
            return tab.path ? (
              <Link
                key={tab.id}
                to={tab.path}
                className={`app-topbar-tab ${tab.id === 'pdv' ? 'app-topbar-tab--pdv' : ''} ${tab.id === 'configuracoes' ? 'app-topbar-tab--config' : ''} ${
                  currentTab === tab.id ? 'app-topbar-tab--active' : ''
                }`}
                title={title}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.shortcut && <span className="app-topbar-tab-shortcut">{tab.shortcut}</span>}
              </Link>
            ) : (
              <button
                key={tab.id}
                type="button"
                className={`app-topbar-tab ${currentTab === tab.id ? 'app-topbar-tab--active' : ''}`}
                onClick={() => setOpenTab(openTab === tab.id ? null : tab.id)}
                title={title}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.shortcut && <span className="app-topbar-tab-shortcut">{tab.shortcut}</span>}
              </button>
            )
          })}
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
