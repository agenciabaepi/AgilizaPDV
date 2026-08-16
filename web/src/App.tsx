import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { SubscriptionProvider } from './hooks/useSubscription'
import { OnboardingProvider } from './hooks/useOnboarding'
import { OnboardingGate } from './components/OnboardingGate'
import { EmpresaThemeProvider } from './hooks/useEmpresaTheme'
import { ProtectedRoute } from './components/ProtectedRoute'
import { SubscriptionGate } from './components/SubscriptionGate'
import { PlanFeatureGate } from './components/PlanFeatureGate'
import { ClienteOnly } from './components/ClienteOnly'
import { SuporteOnly } from './components/SuporteOnly'
import { AdminOnly } from './components/AdminOnly'
import { ToastProvider } from './components/ui'
import { Login } from './pages/Login'
import { Cadastro } from './pages/Cadastro'
import { Dashboard } from './pages/Dashboard'
import { Produtos } from './pages/Produtos'
import { CategoriasLayout } from './pages/categorias/CategoriasLayout'
import { CategoriasArvore } from './pages/categorias/CategoriasArvore'
import { MapaProdutosCategoria } from './pages/categorias/MapaProdutosCategoria'
import { MarcasLayout } from './pages/marcas/MarcasLayout'
import { MarcasLista } from './pages/marcas/MarcasLista'
import { MapaMarcasProdutos } from './pages/marcas/MapaMarcasProdutos'
import { Estoque } from './pages/Estoque'
import { Clientes } from './pages/Clientes'
import { Fornecedores } from './pages/Fornecedores'
import { Caixa } from './pages/Caixa'
import { Pdv } from './pages/Pdv'
import { Vendas } from './pages/Vendas'
import { Nfce } from './pages/Nfce'
import { Nfe } from './pages/Nfe'
import { NfeCriar } from './pages/NfeCriar'
import { FluxoCaixa } from './pages/FluxoCaixa'
import { ContasPagar } from './pages/ContasPagar'
import { ContasReceber } from './pages/ContasReceber'
import { ConfiguracoesSistema } from './pages/ConfiguracoesSistema'
import { ConfigurarLoja } from './pages/ConfigurarLoja'
import { CriarEmpresaSuporte } from './pages/CriarEmpresaSuporte'
import { EmpresasSuporte } from './pages/EmpresasSuporte'
import { ConfiguracoesLoja } from './pages/ConfiguracoesLoja'
import { ConfiguracoesNotasFiscais } from './pages/ConfiguracoesNotasFiscais'
import { Etiquetas } from './pages/Etiquetas'
import { Usuarios } from './pages/Usuarios'
import { ConfiguracoesUsuario } from './pages/ConfiguracoesUsuario'
import { Cashback } from './pages/Cashback'
import { Comissoes } from './pages/Comissoes'
import { LandingPage } from './pages/LandingPage'
import { QuemSomosPage } from './pages/QuemSomosPage'
import { ContatoPage } from './pages/ContatoPage'
import { LojaOnlineConfig } from './pages/LojaOnlineConfig'
import { LojaOnlineAdminLayout } from './pages/loja-online-admin/LojaOnlineAdminLayout'
import { LojaOnlineApp, LojaOnlinePathWrapper } from './pages/LojaOnlineApp'
import { Assinatura } from './pages/Assinatura'
import { Onboarding } from './pages/Onboarding'
import { SaasAuthProvider } from './hooks/useSaasAuth'
import { SaasProtectedRoute } from './components/SaasProtectedRoute'
import { SaasLogin } from './pages/saas/SaasLogin'
import { SaasDashboard } from './pages/saas/SaasDashboard'
import { SaasEmpresaDetalhe } from './pages/saas/SaasEmpresaDetalhe'
import { SaasPlanos } from './pages/saas/SaasPlanos'
import { PlanosProvider } from './hooks/usePlanos'
import { getLojaSlugFromHostname, isLojaOnlineCustomDomainHost } from './lib/loja-online'

function TenantRoute({
  children,
  adminOnly,
}: {
  children: React.ReactNode
  adminOnly?: boolean
}) {
  const inner = adminOnly ? <AdminOnly>{children}</AdminOnly> : children
  return (
    <ProtectedRoute>
      <OnboardingGate>
        <SubscriptionGate>
          <PlanFeatureGate>
            <ClienteOnly>{inner}</ClienteOnly>
          </PlanFeatureGate>
        </SubscriptionGate>
      </OnboardingGate>
    </ProtectedRoute>
  )
}

function SaasApp() {
  return (
    <HashRouter>
      <ToastProvider>
        <PlanosProvider>
          <SaasAuthProvider>
            <Routes>
              <Route path="/saas/login" element={<SaasLogin />} />
              <Route
                path="/saas"
                element={
                  <SaasProtectedRoute>
                    <SaasDashboard />
                  </SaasProtectedRoute>
                }
              />
              <Route
                path="/saas/planos"
                element={
                  <SaasProtectedRoute>
                    <SaasPlanos />
                  </SaasProtectedRoute>
                }
              />
              <Route
                path="/saas/empresa/:id"
                element={
                  <SaasProtectedRoute>
                    <SaasEmpresaDetalhe />
                  </SaasProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/saas" replace />} />
            </Routes>
          </SaasAuthProvider>
        </PlanosProvider>
      </ToastProvider>
    </HashRouter>
  )
}

function AdminApp() {
  return (
    <HashRouter>
      <ToastProvider>
        <PlanosProvider>
          <AuthProvider>
          <OnboardingProvider>
          <SubscriptionProvider>
            <EmpresaThemeProvider>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/quem-somos" element={<QuemSomosPage />} />
              <Route path="/contato" element={<ContatoPage />} />
              <Route path="/loja/:slug/*" element={<LojaOnlinePathWrapper />} />
              <Route path="/login" element={<Login />} />
              <Route path="/cadastro" element={<Cadastro />} />
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <ClienteOnly>
                      <Onboarding />
                    </ClienteOnly>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/assinatura"
                element={
                  <ProtectedRoute>
                    <OnboardingGate>
                      <ClienteOnly>
                        <Assinatura />
                      </ClienteOnly>
                    </OnboardingGate>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configuracoes"
                element={
                  <ProtectedRoute>
                    <SuporteOnly>
                      <ConfiguracoesSistema />
                    </SuporteOnly>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configuracoes/empresas"
                element={
                  <ProtectedRoute>
                    <SuporteOnly>
                      <EmpresasSuporte />
                    </SuporteOnly>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configuracoes/nova-empresa"
                element={
                  <ProtectedRoute>
                    <SuporteOnly>
                      <CriarEmpresaSuporte />
                    </SuporteOnly>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configuracoes/loja"
                element={
                  <ProtectedRoute>
                    <SuporteOnly>
                      <ConfigurarLoja />
                    </SuporteOnly>
                  </ProtectedRoute>
                }
              />
              <Route path="/loja-online" element={<TenantRoute adminOnly><LojaOnlineAdminLayout /></TenantRoute>}>
                <Route index element={<Navigate to="pedidos" replace />} />
                <Route path=":section" element={<LojaOnlineConfig />} />
              </Route>
              <Route path="/configuracoes-loja" element={<TenantRoute adminOnly><ConfiguracoesLoja /></TenantRoute>} />
              <Route
                path="/configuracoes-loja/notas-fiscais"
                element={<TenantRoute adminOnly><ConfiguracoesNotasFiscais /></TenantRoute>}
              />
              <Route path="/dashboard" element={<TenantRoute><Dashboard /></TenantRoute>} />
              <Route path="/produtos" element={<TenantRoute><Produtos /></TenantRoute>} />
              <Route path="/categorias" element={<TenantRoute><CategoriasLayout /></TenantRoute>}>
                <Route index element={<CategoriasArvore />} />
                <Route path="mapa" element={<MapaProdutosCategoria />} />
              </Route>
              <Route path="/marcas" element={<TenantRoute><MarcasLayout /></TenantRoute>}>
                <Route index element={<MarcasLista />} />
                <Route path="mapa" element={<MapaMarcasProdutos />} />
              </Route>
              <Route path="/estoque" element={<TenantRoute><Estoque /></TenantRoute>} />
              <Route path="/clientes" element={<TenantRoute><Clientes /></TenantRoute>} />
              <Route path="/fornecedores" element={<TenantRoute><Fornecedores /></TenantRoute>} />
              <Route path="/usuarios" element={<TenantRoute><Usuarios /></TenantRoute>} />
              <Route path="/conta" element={<TenantRoute><ConfiguracoesUsuario /></TenantRoute>} />
              <Route path="/etiquetas" element={<TenantRoute><Etiquetas /></TenantRoute>} />
              <Route path="/caixa" element={<TenantRoute><Caixa /></TenantRoute>} />
              <Route path="/pdv" element={<TenantRoute><Pdv /></TenantRoute>} />
              <Route path="/vendas" element={<TenantRoute><Vendas /></TenantRoute>} />
              <Route path="/nfe" element={<TenantRoute><Nfe /></TenantRoute>} />
              <Route path="/nfe/criar" element={<TenantRoute><NfeCriar /></TenantRoute>} />
              <Route path="/nfce" element={<TenantRoute><Nfce /></TenantRoute>} />
              <Route path="/financeiro/fluxo-caixa" element={<TenantRoute><FluxoCaixa /></TenantRoute>} />
              <Route path="/financeiro/contas-pagar" element={<TenantRoute><ContasPagar /></TenantRoute>} />
              <Route path="/financeiro/contas-receber" element={<TenantRoute><ContasReceber /></TenantRoute>} />
              <Route path="/financeiro/cashback" element={<TenantRoute adminOnly><Cashback /></TenantRoute>} />
              <Route path="/financeiro/comissoes" element={<TenantRoute><Comissoes /></TenantRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </EmpresaThemeProvider>
          </SubscriptionProvider>
          </OnboardingProvider>
        </AuthProvider>
        </PlanosProvider>
      </ToastProvider>
    </HashRouter>
  )
}

export default function App() {
  const lojaSlug = getLojaSlugFromHostname()
  const customDomainHost =
    typeof window !== 'undefined' && isLojaOnlineCustomDomainHost(window.location.hostname)
      ? window.location.hostname
      : null
  const isSaasRoute =
    typeof window !== 'undefined' &&
    (window.location.hash.startsWith('#/saas') || window.location.pathname.startsWith('/saas'))

  if (lojaSlug) {
    return <LojaOnlineApp slug={lojaSlug} mode="subdomain" />
  }

  if (customDomainHost) {
    return <LojaOnlineApp hostname={customDomainHost} mode="subdomain" />
  }

  if (isSaasRoute) {
    return <SaasApp />
  }

  return <AdminApp />
}
