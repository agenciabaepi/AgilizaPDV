import { useState, useEffect, useRef } from 'react'
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
  HandCoins,
  ChartNoAxesCombined,
  Settings,
  FileCheck,
  Medal,
  ChevronRight,
  Store,
  Menu,
  X,
  ChevronDown,
  User,
  ClipboardList,
  ArrowRightLeft,
  Receipt,
  Tag,
  Landmark,
  CreditCard,
  Clock,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useSubscription } from '../hooks/useSubscription'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useEmpresaTheme } from '../hooks/useEmpresaTheme'
import { useLojaOnlinePedidosPendentes } from '../hooks/useLojaOnlinePedidosPendentes'
import { LojaOnlinePedidosNotificacao } from './LojaOnlinePedidosNotificacao'
import logoAgiliza from '../assets/logo-white.svg'
import type { ModuloId } from '../lib/modulos'
import { parseModulos } from '../lib/modulos'
import { getLojaOnlineAdminPageTitle } from '../lib/loja-online-admin-nav'

type TabId = 'inicio' | 'cadastro' | 'movimentacao' | 'financeiro' | 'pdv' | 'configuracoes' | 'loja-online'

const PATH_TO_MODULO: Record<string, ModuloId> = {
  '/configuracoes-loja': 'configuracoes',
  '/configuracoes-loja/notas-fiscais': 'configuracoes',
  '/assinatura': 'configuracoes',
  '/loja-online': 'loja_online',
  '/dashboard': 'dashboard',
  '/produtos': 'produtos',
  '/etiquetas': 'etiquetas',
  '/categorias': 'categorias',
  '/categorias/mapa': 'categorias',
  '/marcas': 'marcas',
  '/marcas/mapa': 'marcas',
  '/clientes': 'clientes',
  '/fornecedores': 'fornecedores',
  '/usuarios': 'usuarios',
  '/estoque': 'estoque',
  '/caixa': 'caixa',
  '/vendas': 'vendas',
  '/nfce': 'nfce',
  '/nfe': 'nfe',
  '/nfe/criar': 'nfe',
  '/financeiro/fluxo-caixa': 'fluxo_caixa',
  '/financeiro/contas-pagar': 'contas_pagar',
  '/financeiro/contas-receber': 'contas_receber',
  '/financeiro/cashback': 'cashback',
  '/financeiro/comissoes': 'comissoes',
  '/pdv': 'pdv',
}

const MODULO_TO_PATH: Record<ModuloId, string> = {
  dashboard: '/dashboard',
  produtos: '/produtos',
  etiquetas: '/etiquetas',
  categorias: '/categorias',
  marcas: '/marcas',
  clientes: '/clientes',
  fornecedores: '/fornecedores',
  usuarios: '/usuarios',
  estoque: '/estoque',
  caixa: '/caixa',
  vendas: '/vendas',
  nfce: '/nfce',
  nfe: '/nfe',
  fluxo_caixa: '/financeiro/fluxo-caixa',
  contas_pagar: '/financeiro/contas-pagar',
  contas_receber: '/financeiro/contas-receber',
  cashback: '/financeiro/cashback',
  comissoes: '/financeiro/comissoes',
  pdv: '/pdv',
  loja_online: '/loja-online',
  configuracoes: '/configuracoes-loja',
}

const MODULO_PRIORITY: ModuloId[] = [
  'dashboard',
  'pdv',
  'caixa',
  'vendas',
  'comissoes',
  'nfce',
  'nfe',
  'fluxo_caixa',
  'contas_pagar',
  'contas_receber',
  'cashback',
  'produtos',
  'estoque',
  'clientes',
  'fornecedores',
  'categorias',
  'marcas',
  'etiquetas',
  'usuarios',
  'loja_online',
  'configuracoes',
]

const tabs: { id: TabId; label: string; icon: React.ReactNode; path?: string; modulos: ModuloId[]; adminOnly?: boolean; shortcut?: string }[] = [
  { id: 'inicio', label: 'Início', icon: <Home size={20} strokeWidth={1.75} />, modulos: ['dashboard'], shortcut: 'F1' },
  { id: 'pdv', label: 'PDV', icon: <ShoppingCart size={20} strokeWidth={1.75} />, path: '/pdv', modulos: ['pdv'], shortcut: 'F2' },
  { id: 'cadastro', label: 'Cadastro', icon: <ClipboardList size={20} strokeWidth={1.75} />, modulos: ['produtos', 'etiquetas', 'categorias', 'marcas', 'clientes', 'fornecedores', 'usuarios'], shortcut: 'F3' },
  { id: 'movimentacao', label: 'Movimentação', icon: <ArrowRightLeft size={20} strokeWidth={1.75} />, modulos: ['estoque', 'caixa'], shortcut: 'F4' },
  { id: 'financeiro', label: 'Financeiro', icon: <Landmark size={20} strokeWidth={1.75} />, modulos: ['vendas', 'nfce', 'nfe', 'fluxo_caixa', 'contas_pagar', 'contas_receber', 'cashback', 'comissoes'], shortcut: 'F5' },
  { id: 'loja-online', label: 'Loja online', icon: <Store size={20} strokeWidth={1.75} />, path: '/loja-online', modulos: ['loja_online'], adminOnly: true },
  { id: 'configuracoes', label: 'Configurações', icon: <Settings size={20} strokeWidth={1.75} />, path: '/configuracoes-loja', modulos: ['configuracoes'], adminOnly: true, shortcut: 'F6' },
]

const ribbonItems: Record<Exclude<TabId, 'pdv'>, { path: string; label: string; icon: React.ReactNode; modulo: ModuloId; adminOnly?: boolean }[]> = {
  inicio: [
    { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} strokeWidth={1.75} />, modulo: 'dashboard' },
  ],
  configuracoes: [
    { path: '/configuracoes-loja', label: 'Dados da loja', icon: <Settings size={20} strokeWidth={1.75} />, modulo: 'configuracoes', adminOnly: true },
    { path: '/configuracoes-loja/notas-fiscais', label: 'Notas fiscais', icon: <FileCheck size={20} strokeWidth={1.75} />, modulo: 'configuracoes', adminOnly: true },
    { path: '/assinatura', label: 'Assinatura', icon: <CreditCard size={20} strokeWidth={1.75} />, modulo: 'configuracoes', adminOnly: true },
  ],
  'loja-online': [
    { path: '/loja-online/pedidos', label: 'Loja online', icon: <Store size={20} strokeWidth={1.75} />, modulo: 'loja_online', adminOnly: true },
  ],
  cadastro: [
    { path: '/produtos', label: 'Produto', icon: <Package size={20} strokeWidth={1.75} />, modulo: 'produtos' },
    { path: '/etiquetas', label: 'Etiquetas', icon: <Tag size={20} strokeWidth={1.75} />, modulo: 'etiquetas' },
    { path: '/categorias', label: 'Categoria', icon: <Tag size={20} strokeWidth={1.75} />, modulo: 'categorias' },
    { path: '/marcas', label: 'Marca', icon: <Medal size={20} strokeWidth={1.75} />, modulo: 'marcas' },
    { path: '/clientes', label: 'Cliente', icon: <Users size={20} strokeWidth={1.75} />, modulo: 'clientes' },
    { path: '/fornecedores', label: 'Fornecedor', icon: <Truck size={20} strokeWidth={1.75} />, modulo: 'fornecedores' },
    { path: '/usuarios', label: 'Usuários', icon: <Users size={20} strokeWidth={1.75} />, modulo: 'usuarios' },
  ],
  movimentacao: [
    { path: '/estoque', label: 'Estoque', icon: <Warehouse size={20} strokeWidth={1.75} />, modulo: 'estoque' },
    { path: '/caixa', label: 'Caixa', icon: <Wallet size={20} strokeWidth={1.75} />, modulo: 'caixa' },
  ],
  financeiro: [
    { path: '/vendas', label: 'Vendas', icon: <Receipt size={20} strokeWidth={1.75} />, modulo: 'vendas' },
    { path: '/nfce', label: 'NFC-e', icon: <FileCheck size={20} strokeWidth={1.75} />, modulo: 'nfce' },
    { path: '/nfe', label: 'NF-e', icon: <FileCheck size={20} strokeWidth={1.75} />, modulo: 'nfe' },
    { path: '/financeiro/fluxo-caixa', label: 'Fluxo de caixa', icon: <ChartNoAxesCombined size={20} strokeWidth={1.75} />, modulo: 'fluxo_caixa' },
    { path: '/financeiro/contas-pagar', label: 'Contas a pagar', icon: <Wallet size={20} strokeWidth={1.75} />, modulo: 'contas_pagar' },
    { path: '/financeiro/contas-receber', label: 'Contas a receber', icon: <HandCoins size={20} strokeWidth={1.75} />, modulo: 'contas_receber' },
    { path: '/financeiro/cashback', label: 'Cashback', icon: <Wallet size={20} strokeWidth={1.75} />, modulo: 'cashback', adminOnly: true },
    { path: '/financeiro/comissoes', label: 'Comissões', icon: <HandCoins size={20} strokeWidth={1.75} />, modulo: 'comissoes' },
  ],
}

function resolveModuloFromPath(pathname: string): ModuloId | undefined {
  if (PATH_TO_MODULO[pathname]) return PATH_TO_MODULO[pathname]
  if (pathname.startsWith('/loja-online')) return 'loja_online'
  if (pathname.startsWith('/configuracoes-loja') || pathname === '/assinatura') return 'configuracoes'
  return undefined
}

function getTabFromPath(pathname: string): TabId {
  if (pathname === '/pdv') return 'pdv'
  if (pathname === '/loja-online' || pathname.startsWith('/loja-online/')) return 'loja-online'
  if (pathname === '/configuracoes-loja' || pathname.startsWith('/configuracoes-loja/')) return 'configuracoes'
  if (pathname === '/assinatura') return 'configuracoes'
  if (pathname === '/dashboard') return 'inicio'
  if (pathname.startsWith('/categorias')) return 'cadastro'
  if (pathname.startsWith('/marcas')) return 'cadastro'
  if (['/produtos', '/etiquetas', '/clientes', '/fornecedores', '/usuarios'].includes(pathname)) return 'cadastro'
  if (['/estoque', '/caixa'].includes(pathname)) return 'movimentacao'
  if (['/vendas', '/nfce', '/nfe', '/nfe/criar', '/financeiro/fluxo-caixa', '/financeiro/contas-pagar', '/financeiro/contas-receber', '/financeiro/cashback', '/financeiro/comissoes'].includes(pathname))
    return 'financeiro'
  return 'inicio'
}

const TAB_SHORTCUTS: { key: string; tabId: TabId; path: string }[] = [
  { key: 'F1', tabId: 'inicio', path: '/dashboard' },
  { key: 'F2', tabId: 'pdv', path: '/pdv' },
  { key: 'F3', tabId: 'cadastro', path: '/produtos' },
  { key: 'F4', tabId: 'movimentacao', path: '/estoque' },
  { key: 'F5', tabId: 'financeiro', path: '/vendas' },
  { key: 'F6', tabId: 'configuracoes', path: '/configuracoes-loja' },
]

function isSubItemActive(pathname: string, itemPath: string): boolean {
  if (pathname === itemPath) return true
  if (itemPath === '/categorias' && pathname.startsWith('/categorias')) return true
  if (itemPath === '/marcas' && pathname.startsWith('/marcas')) return true
  return false
}

function getPageTitle(pathname: string): string {
  if (pathname === '/conta') return 'Minha conta'
  if (pathname === '/assinatura') return 'Assinatura'
  const lojaTitle = getLojaOnlineAdminPageTitle(pathname)
  if (lojaTitle) return lojaTitle
  for (const items of Object.values(ribbonItems)) {
    const match = items.find((item) => isSubItemActive(pathname, item.path))
    if (match) return match.label
  }
  const directTab = tabs.find((tab) => tab.path === pathname)
  if (directTab) return directTab.label
  const tab = tabs.find((t) => t.id === getTabFromPath(pathname))
  return tab?.label ?? 'Agiliza PDV'
}

const bottomNavDefs: { id: TabId | 'menu'; label: string; icon: React.ReactNode; path?: string; modulo?: ModuloId; action?: 'menu' }[] = [
  { id: 'inicio', label: 'Início', icon: <Home size={22} strokeWidth={1.75} />, path: '/dashboard', modulo: 'dashboard' },
  { id: 'pdv', label: 'PDV', icon: <ShoppingCart size={22} strokeWidth={1.75} />, path: '/pdv', modulo: 'pdv' },
  { id: 'financeiro', label: 'Vendas', icon: <Receipt size={22} strokeWidth={1.75} />, path: '/vendas', modulo: 'vendas' },
  { id: 'menu', label: 'Menu', icon: <Menu size={22} strokeWidth={1.75} />, action: 'menu' },
]

function planAllowsPath(
  path: string,
  features: { notasFiscais: boolean; lojaOnline: boolean }
): boolean {
  if (
    !features.notasFiscais &&
    ['/nfce', '/nfe', '/nfe/criar', '/configuracoes-loja/notas-fiscais'].includes(path)
  ) {
    return false
  }
  if (!features.lojaOnline && (path === '/loja-online' || path.startsWith('/loja-online/'))) {
    return false
  }
  return true
}

function formatTrialHeaderText(diasRestantes: number | null | undefined, trialFim: string | null): string {
  if (diasRestantes != null && diasRestantes >= 0) {
    return `Modo teste — ${diasRestantes} dia${diasRestantes === 1 ? '' : 's'} restante${diasRestantes === 1 ? '' : 's'}`
  }
  if (trialFim) {
    const d = new Date(trialFim)
    if (!Number.isNaN(d.getTime())) {
      return `Modo teste até ${d.toLocaleDateString('pt-BR')}`
    }
  }
  return 'Modo teste'
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth()
  const { status: subscriptionStatus } = useSubscription()
  const { config: empresaConfig, setEmpresaIdForTheme } = useEmpresaTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const empresaId = session && 'empresa_id' in session ? session.empresa_id : null
  const currentTab = getTabFromPath(location.pathname)
  const isMobile = useIsMobile()
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [mobileExpandedTab, setMobileExpandedTab] = useState<TabId | null>(null)
  const [flyoutTab, setFlyoutTab] = useState<TabId | null>(null)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const flyoutCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sidebarCollapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const pageTitle = getPageTitle(location.pathname)

  const userModulosJson = session && 'modulos_json' in session ? session.modulos_json : null
  const userModulos = userModulosJson != null && userModulosJson !== '' ? parseModulos(userModulosJson) : null
  const empresaModulos = empresaConfig ? parseModulos(empresaConfig.modulos_json) : null
  const modulos = userModulos ?? empresaModulos
  const moduloEnabled = (id: ModuloId) => id === 'dashboard' || !modulos || modulos[id] !== false
  const firstAllowedPath = (() => {
    for (const modulo of MODULO_PRIORITY) {
      if (moduloEnabled(modulo)) return MODULO_TO_PATH[modulo]
    }
    return '/dashboard'
  })()
  const lojaLogo = empresaConfig?.logo?.trim() || null
  const lojaNome = empresaConfig?.nome?.trim() || 'Minha loja'
  const lojaIniciais = lojaNome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || 'L'

  useEffect(() => {
    setEmpresaIdForTheme(empresaId)
  }, [empresaId, setEmpresaIdForTheme])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.sync?.onSyncDataUpdated) return
    const unsub = window.electronAPI.sync.onSyncDataUpdated(() => {
      window.dispatchEvent(new CustomEvent('agiliza:syncDataUpdated'))
    })
    return () => {
      unsub?.()
    }
  }, [])

  useEffect(() => {
    if (!profileMenuOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (!profileMenuRef.current?.contains(e.target as Node)) setProfileMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [profileMenuOpen])

  const isPdvPage = location.pathname === '/pdv'
  const isDashboardPage = location.pathname === '/dashboard'
  const showBottomNav = isMobile && !isPdvPage
  const isAdmin = session && 'role' in session && session.role?.toLowerCase() === 'admin'
  const isSuporte = session != null && 'suporte' in session && session.suporte
  const planFeatures = {
    notasFiscais: isSuporte || (subscriptionStatus?.notasFiscais ?? false),
    lojaOnline: isSuporte || (subscriptionStatus?.lojaOnline ?? false),
  }
  const showLojaOnlinePedidosAlert = !!isAdmin && planFeatures.lojaOnline
  const { count: pedidosNotificacao, pedidos: pedidosNotificacaoLista, pulse: pedidosPulse, dismiss: dismissPedidoNotificacao } =
    useLojaOnlinePedidosPendentes(empresaId, showLojaOnlinePedidosAlert)
  const canManageAssinatura =
    session &&
    'role' in session &&
    ['admin', 'gerente'].includes((session.role ?? '').toLowerCase())

  const showTrialBanner =
    !isSuporte &&
    subscriptionStatus?.status === 'trial' &&
    !subscriptionStatus.bloqueado
  const trialBannerText = showTrialBanner
    ? formatTrialHeaderText(subscriptionStatus?.diasRestantes, subscriptionStatus?.trialFim ?? null)
    : ''
  const trialBannerShort =
    subscriptionStatus?.diasRestantes != null && subscriptionStatus.diasRestantes >= 0
      ? `Teste · ${subscriptionStatus.diasRestantes}d`
      : 'Modo teste'

  useEffect(() => {
    setMobileNavOpen(false)
    setMobileExpandedTab(null)
  }, [location.pathname])

  useEffect(() => {
    if (!isMobile) {
      setMobileNavOpen(false)
      setMobileExpandedTab(null)
    }
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

  const getRibbonForTab = (tabId: TabId) => {
    if (tabId === 'pdv') return []
    const base = ribbonItems[tabId] ?? []
    return (modulos ? base.filter((item) => moduloEnabled(item.modulo)) : base)
      .filter((item) => planAllowsPath(item.path, planFeatures))
      .filter((item) => {
        if (item.path === '/assinatura') return canManageAssinatura
        return !item.adminOnly || isAdmin
      })
  }

  const visibleTabs = (modulos
    ? tabs.filter((tab) => tab.modulos.some((m) => moduloEnabled(m)))
    : tabs
  )
    .filter((tab) => tab.id !== 'loja-online' || planFeatures.lojaOnline)
    .filter((tab) => !tab.adminOnly || isAdmin)

  const flyoutItems = flyoutTab ? getRibbonForTab(flyoutTab) : []
  const showFlyout = flyoutTab !== null && flyoutItems.length > 0

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

  const currentModulo = resolveModuloFromPath(location.pathname)
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

  const openFlyout = (tabId: TabId) => {
    if (flyoutCloseTimer.current) {
      clearTimeout(flyoutCloseTimer.current)
      flyoutCloseTimer.current = null
    }
    const items = getRibbonForTab(tabId)
    if (items.length > 0) setFlyoutTab(tabId)
  }

  const scheduleCloseFlyout = () => {
    if (flyoutCloseTimer.current) clearTimeout(flyoutCloseTimer.current)
    flyoutCloseTimer.current = setTimeout(() => {
      setFlyoutTab(null)
      flyoutCloseTimer.current = null
    }, 120)
  }

  const cancelCloseFlyout = () => {
    if (flyoutCloseTimer.current) {
      clearTimeout(flyoutCloseTimer.current)
      flyoutCloseTimer.current = null
    }
  }

  const expandSidebar = () => {
    if (sidebarCollapseTimer.current) {
      clearTimeout(sidebarCollapseTimer.current)
      sidebarCollapseTimer.current = null
    }
    setSidebarExpanded(true)
  }

  const scheduleCollapseSidebar = () => {
    if (sidebarCollapseTimer.current) clearTimeout(sidebarCollapseTimer.current)
    sidebarCollapseTimer.current = setTimeout(() => {
      setSidebarExpanded(false)
      setFlyoutTab(null)
      sidebarCollapseTimer.current = null
    }, 360)
  }

  useEffect(() => {
    return () => {
      if (flyoutCloseTimer.current) clearTimeout(flyoutCloseTimer.current)
      if (sidebarCollapseTimer.current) clearTimeout(sidebarCollapseTimer.current)
    }
  }, [])

  const closeMobileNav = () => {
    setMobileNavOpen(false)
    setMobileExpandedTab(null)
  }

  const handleTabClick = (tab: (typeof tabs)[number]) => {
    const items = getRibbonForTab(tab.id)
    if (isMobile) {
      if (items.length > 1) {
        setMobileExpandedTab((prev) => (prev === tab.id ? null : tab.id))
        return
      }
      if (items.length === 1) {
        navigate(items[0].path)
        closeMobileNav()
        return
      }
      if (tab.path) {
        navigate(tab.path)
        closeMobileNav()
      }
      return
    }
    if (items.length >= 1) {
      navigate(items[0].path)
      return
    }
    if (tab.path) {
      navigate(tab.path)
    }
  }

  const bottomNavItems = bottomNavDefs.filter((item) => {
    if (item.action === 'menu') return true
    if (item.modulo && !moduloEnabled(item.modulo)) return false
    if (item.id === 'inicio') return visibleTabs.some((t) => t.id === 'inicio')
    if (item.id === 'pdv') return visibleTabs.some((t) => t.id === 'pdv')
    if (item.id === 'financeiro') return visibleTabs.some((t) => t.id === 'financeiro')
    return true
  })

  const layoutClassName = [
    'app-layout',
    'app-layout-sidebar',
    sidebarExpanded && !isMobile ? 'app-layout-sidebar--expanded' : 'app-layout-sidebar--collapsed',
    showFlyout && !isMobile ? 'app-layout-sidebar--flyout-open' : '',
    isMobile ? 'app-layout-sidebar--mobile' : '',
    isMobile && mobileNavOpen ? 'app-layout-sidebar--nav-open' : '',
    showBottomNav ? 'app-layout-sidebar--bottom-nav' : '',
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
          onClick={closeMobileNav}
        />
      )}

      <aside
        className="app-sidebar"
        onMouseEnter={isMobile ? undefined : expandSidebar}
        onMouseLeave={
          isMobile
            ? undefined
            : () => {
                scheduleCloseFlyout()
                scheduleCollapseSidebar()
              }
        }
      >
        {isMobile && (
          <div className="app-sidebar-brand">
            <span className="app-sidebar-brand-spacer" aria-hidden />
            <button type="button" className="app-sidebar-close" onClick={closeMobileNav} aria-label="Fechar menu">
              <X size={20} strokeWidth={1.75} />
            </button>
          </div>
        )}

        <nav className="app-sidebar-nav" aria-label="Menu principal">
          {visibleTabs.map((tab) => {
            const isActive = currentTab === tab.id
            const hasChildren = getRibbonForTab(tab.id).length > 0
            const title = tab.shortcut ? `${tab.label} (${tab.shortcut})` : tab.label

            const showLabels = isMobile || sidebarExpanded
            const subItems = getRibbonForTab(tab.id)
            const isSubExpanded = isMobile && mobileExpandedTab === tab.id

            if (tab.path && !hasChildren) {
              return (
                <Link
                  key={tab.id}
                  to={tab.id === 'loja-online' && pedidosNotificacao > 0 ? '/loja-online/pedidos' : tab.path}
                  className={`app-sidebar-item ${isActive ? 'app-sidebar-item--active' : ''} ${tab.id === 'pdv' ? 'app-sidebar-item--pdv' : ''}`}
                  title={title}
                  onClick={closeMobileNav}
                >
                  <span className="app-sidebar-item-icon">
                    {tab.icon}
                    {tab.id === 'loja-online' && pedidosNotificacao > 0 && (
                      <span className="app-sidebar-item-badge" aria-hidden>
                        {pedidosNotificacao > 99 ? '99+' : pedidosNotificacao}
                      </span>
                    )}
                  </span>
                  {showLabels && (
                    <>
                      <span className="app-sidebar-item-label">{tab.label}</span>
                      {tab.id === 'loja-online' && pedidosNotificacao > 0 && (
                        <span className="app-sidebar-item-count">{pedidosNotificacao}</span>
                      )}
                    </>
                  )}
                </Link>
              )
            }

            return (
              <div key={tab.id} className="app-sidebar-item-group">
                <button
                  type="button"
                  className={`app-sidebar-item ${isActive ? 'app-sidebar-item--active' : ''} ${flyoutTab === tab.id ? 'app-sidebar-item--flyout' : ''} ${isSubExpanded ? 'app-sidebar-item--expanded' : ''}`}
                  title={title}
                  onClick={() => handleTabClick(tab)}
                  onMouseEnter={!isMobile ? () => openFlyout(tab.id) : undefined}
                  onMouseLeave={!isMobile ? scheduleCloseFlyout : undefined}
                  aria-expanded={isMobile ? isSubExpanded : flyoutTab === tab.id}
                  aria-haspopup={hasChildren ? 'menu' : undefined}
                >
                  <span className="app-sidebar-item-icon">{tab.icon}</span>
                  {showLabels && (
                    <>
                      <span className="app-sidebar-item-label">{tab.label}</span>
                      {hasChildren && (
                        isMobile
                          ? <ChevronDown size={16} className={`app-sidebar-item-chevron ${isSubExpanded ? 'app-sidebar-item-chevron--open' : ''}`} />
                          : <ChevronRight size={16} className="app-sidebar-item-chevron" />
                      )}
                    </>
                  )}
                </button>
                {isMobile && isSubExpanded && subItems.length > 0 && (
                  <div className="app-sidebar-subnav" role="menu">
                    {subItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        role="menuitem"
                        className={`app-sidebar-subnav-item ${isSubItemActive(location.pathname, item.path) ? 'app-sidebar-subnav-item--active' : ''}`}
                        onClick={closeMobileNav}
                      >
                        <span className="app-sidebar-subnav-item-icon">{item.icon}</span>
                        <span className="app-sidebar-subnav-item-label">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-sidebar-system">
            <img src={logoAgiliza} alt="Agiliza PDV" className="app-sidebar-system-logo" />
          </div>
        </div>

        {showFlyout && flyoutTab && !isMobile && (
          <div
            className="app-sidebar-flyout"
            role="menu"
            aria-label={`Submenu ${tabs.find((t) => t.id === flyoutTab)?.label ?? ''}`}
            onMouseEnter={() => {
              cancelCloseFlyout()
              expandSidebar()
            }}
            onMouseLeave={scheduleCloseFlyout}
          >
            <div className="app-sidebar-flyout-header">
              {tabs.find((t) => t.id === flyoutTab)?.label}
            </div>
            <nav className="app-sidebar-flyout-nav">
              {flyoutItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  role="menuitem"
                  className={`app-sidebar-flyout-item ${isSubItemActive(location.pathname, item.path) ? 'app-sidebar-flyout-item--active' : ''}`}
                >
                  <span className="app-sidebar-flyout-item-icon">{item.icon}</span>
                  <span className="app-sidebar-flyout-item-label">{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}
      </aside>

      <div className="app-shell">
        <header className="app-header">
          <div className="app-header-left">
            {isMobile && !showBottomNav && (
              <button
                type="button"
                className="app-header-menu-btn"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu size={22} strokeWidth={1.75} />
              </button>
            )}
            <Link to={firstAllowedPath} className="app-header-brand" title={lojaNome}>
              {lojaLogo ? (
                <img src={lojaLogo} alt={lojaNome} className="app-header-brand-logo" />
              ) : (
                <>
                  <span className="app-header-brand-initials" aria-hidden>{lojaIniciais}</span>
                  <span className="app-header-brand-name">{lojaNome}</span>
                </>
              )}
            </Link>
            {isMobile && <h1 className="app-header-title">{pageTitle}</h1>}
          </div>
          <div className="app-header-center">
            {showTrialBanner && (
              canManageAssinatura ? (
                <Link to="/assinatura" className="app-header-trial" title={trialBannerText}>
                  <Clock size={15} strokeWidth={2} aria-hidden />
                  <span className="app-header-trial__text app-header-trial__text--full">{trialBannerText}</span>
                  <span className="app-header-trial__text app-header-trial__text--short">{trialBannerShort}</span>
                </Link>
              ) : (
                <div className="app-header-trial app-header-trial--static" title={trialBannerText}>
                  <Clock size={15} strokeWidth={2} aria-hidden />
                  <span className="app-header-trial__text app-header-trial__text--full">{trialBannerText}</span>
                  <span className="app-header-trial__text app-header-trial__text--short">{trialBannerShort}</span>
                </div>
              )
            )}
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
                      navigate('/conta')
                    }}
                  >
                    <Settings size={16} strokeWidth={1.75} />
                    Minha conta
                  </button>
                  {canManageAssinatura && (
                    <button
                      type="button"
                      className="app-header-profile-menu-item"
                      role="menuitem"
                      onClick={() => {
                        setProfileMenuOpen(false)
                        navigate('/assinatura')
                      }}
                    >
                      <CreditCard size={16} strokeWidth={1.75} />
                      Assinatura
                    </button>
                  )}
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

        <main
          className={`app-main ${isPdvPage ? 'app-main--pdv' : ''} ${isDashboardPage ? 'app-main--dashboard' : ''} ${showBottomNav ? 'app-main--bottom-nav' : ''}`}
        >
          <div className="page-content">{children}</div>
        </main>

        {showBottomNav && (
          <nav className="app-bottom-nav" aria-label="Navegação rápida">
            {bottomNavItems.map((item) => {
              if (item.action === 'menu') {
                const isMenuActive = mobileNavOpen
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`app-bottom-nav-item ${isMenuActive ? 'app-bottom-nav-item--active' : ''}`}
                    onClick={() => setMobileNavOpen(true)}
                    aria-label={item.label}
                  >
                    <span className="app-bottom-nav-item-icon">{item.icon}</span>
                    <span className="app-bottom-nav-item-label">{item.label}</span>
                  </button>
                )
              }
              const isActive = item.path ? isSubItemActive(location.pathname, item.path) || location.pathname === item.path : false
              return (
                <Link
                  key={item.id}
                  to={item.path!}
                  className={`app-bottom-nav-item ${isActive ? 'app-bottom-nav-item--active' : ''}`}
                  aria-label={item.label}
                >
                  <span className="app-bottom-nav-item-icon">{item.icon}</span>
                  <span className="app-bottom-nav-item-label">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        )}

        {showLojaOnlinePedidosAlert && (
          <LojaOnlinePedidosNotificacao
            pedidos={pedidosNotificacaoLista}
            pulse={pedidosPulse}
            onDismiss={dismissPedidoNotificacao}
          />
        )}
      </div>
    </div>
  )
}
