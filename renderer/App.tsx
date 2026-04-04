import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { EmpresaThemeProvider } from './hooks/useEmpresaTheme'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ClienteOnly } from './components/ClienteOnly'
import { SuporteOnly } from './components/SuporteOnly'
import { AdminOnly } from './components/AdminOnly'
import { ToastProvider } from './components/ui'
import { UpdateToast } from './components/UpdateToast'
import { Login } from './pages/Login'
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
import { ConfiguracoesTerminal } from './pages/ConfiguracoesTerminal'
import { Etiquetas } from './pages/Etiquetas'
import { Usuarios } from './pages/Usuarios'
import { Cashback } from './pages/Cashback'
import { InstallerPreview } from './pages/InstallerPreview'
import { LandingPage } from './pages/LandingPage'
import { isElectronShell } from './lib/is-electron-shell'

/** Landing de marketing só no site (navegador); no app desktop abre direto no login. */
function MarketingHome() {
  if (isElectronShell()) {
    return <Navigate to="/login" replace />
  }
  return <LandingPage />
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <UpdateToast />
        <AuthProvider>
        <EmpresaThemeProvider>
        <Routes>
          <Route path="/" element={<MarketingHome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/installer-preview" element={<InstallerPreview />} />
          <Route path="/configuracoes" element={<ProtectedRoute><SuporteOnly><ConfiguracoesSistema /></SuporteOnly></ProtectedRoute>} />
          <Route path="/configuracoes/empresas" element={<ProtectedRoute><SuporteOnly><EmpresasSuporte /></SuporteOnly></ProtectedRoute>} />
          <Route path="/configuracoes/nova-empresa" element={<ProtectedRoute><SuporteOnly><CriarEmpresaSuporte /></SuporteOnly></ProtectedRoute>} />
          <Route path="/configuracoes/loja" element={<ProtectedRoute><SuporteOnly><ConfigurarLoja /></SuporteOnly></ProtectedRoute>} />
          <Route path="/configuracoes-loja" element={<ProtectedRoute><ClienteOnly><AdminOnly><ConfiguracoesLoja /></AdminOnly></ClienteOnly></ProtectedRoute>} />
          <Route path="/configuracoes-loja/terminal" element={<ProtectedRoute><ClienteOnly><AdminOnly><ConfiguracoesTerminal /></AdminOnly></ClienteOnly></ProtectedRoute>} />
          <Route path="/configuracoes-loja/notas-fiscais" element={<ProtectedRoute><ClienteOnly><AdminOnly><ConfiguracoesNotasFiscais /></AdminOnly></ClienteOnly></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><ClienteOnly><Dashboard /></ClienteOnly></ProtectedRoute>} />
          <Route path="/produtos" element={<ProtectedRoute><ClienteOnly><Produtos /></ClienteOnly></ProtectedRoute>} />
          <Route path="/categorias" element={<ProtectedRoute><ClienteOnly><CategoriasLayout /></ClienteOnly></ProtectedRoute>}>
            <Route index element={<CategoriasArvore />} />
            <Route path="mapa" element={<MapaProdutosCategoria />} />
          </Route>
          <Route path="/marcas" element={<ProtectedRoute><ClienteOnly><MarcasLayout /></ClienteOnly></ProtectedRoute>}>
            <Route index element={<MarcasLista />} />
            <Route path="mapa" element={<MapaMarcasProdutos />} />
          </Route>
          <Route path="/estoque" element={<ProtectedRoute><ClienteOnly><Estoque /></ClienteOnly></ProtectedRoute>} />
          <Route path="/clientes" element={<ProtectedRoute><ClienteOnly><Clientes /></ClienteOnly></ProtectedRoute>} />
          <Route path="/fornecedores" element={<ProtectedRoute><ClienteOnly><Fornecedores /></ClienteOnly></ProtectedRoute>} />
          <Route path="/usuarios" element={<ProtectedRoute><ClienteOnly><Usuarios /></ClienteOnly></ProtectedRoute>} />
          <Route path="/etiquetas" element={<ProtectedRoute><ClienteOnly><Etiquetas /></ClienteOnly></ProtectedRoute>} />
          <Route path="/caixa" element={<ProtectedRoute><ClienteOnly><Caixa /></ClienteOnly></ProtectedRoute>} />
          <Route path="/pdv" element={<ProtectedRoute><ClienteOnly><Pdv /></ClienteOnly></ProtectedRoute>} />
          <Route path="/vendas" element={<ProtectedRoute><ClienteOnly><Vendas /></ClienteOnly></ProtectedRoute>} />
          <Route path="/nfe" element={<ProtectedRoute><ClienteOnly><Nfe /></ClienteOnly></ProtectedRoute>} />
          <Route path="/nfe/criar" element={<ProtectedRoute><ClienteOnly><NfeCriar /></ClienteOnly></ProtectedRoute>} />
          <Route path="/nfce" element={<ProtectedRoute><ClienteOnly><Nfce /></ClienteOnly></ProtectedRoute>} />
          <Route path="/financeiro/fluxo-caixa" element={<ProtectedRoute><ClienteOnly><FluxoCaixa /></ClienteOnly></ProtectedRoute>} />
          <Route path="/financeiro/contas-pagar" element={<ProtectedRoute><ClienteOnly><ContasPagar /></ClienteOnly></ProtectedRoute>} />
          <Route path="/financeiro/contas-receber" element={<ProtectedRoute><ClienteOnly><ContasReceber /></ClienteOnly></ProtectedRoute>} />
          <Route path="/financeiro/cashback" element={<ProtectedRoute><ClienteOnly><AdminOnly><Cashback /></AdminOnly></ClienteOnly></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </EmpresaThemeProvider>
      </AuthProvider>
      </ToastProvider>
    </HashRouter>
  )
}
