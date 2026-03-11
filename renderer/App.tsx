import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { EmpresaThemeProvider } from './hooks/useEmpresaTheme'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ClienteOnly } from './components/ClienteOnly'
import { SuporteOnly } from './components/SuporteOnly'
import { ToastProvider } from './components/ui'
import { UpdateToast } from './components/UpdateToast'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Produtos } from './pages/Produtos'
import { Categorias } from './pages/Categorias'
import { Estoque } from './pages/Estoque'
import { Clientes } from './pages/Clientes'
import { Fornecedores } from './pages/Fornecedores'
import { Caixa } from './pages/Caixa'
import { Pdv } from './pages/Pdv'
import { Vendas } from './pages/Vendas'
import { FluxoCaixa } from './pages/FluxoCaixa'
import { ContasPagar } from './pages/ContasPagar'
import { ContasReceber } from './pages/ContasReceber'
import { ConfiguracoesSistema } from './pages/ConfiguracoesSistema'
import { ConfigurarLoja } from './pages/ConfigurarLoja'
import { Etiquetas } from './pages/Etiquetas'
import { Usuarios } from './pages/Usuarios'

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <UpdateToast />
        <AuthProvider>
        <EmpresaThemeProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/configuracoes" element={<ProtectedRoute><SuporteOnly><ConfiguracoesSistema /></SuporteOnly></ProtectedRoute>} />
          <Route path="/configuracoes/loja" element={<ProtectedRoute><SuporteOnly><ConfigurarLoja /></SuporteOnly></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><ClienteOnly><Dashboard /></ClienteOnly></ProtectedRoute>} />
          <Route path="/produtos" element={<ProtectedRoute><ClienteOnly><Produtos /></ClienteOnly></ProtectedRoute>} />
          <Route path="/categorias" element={<ProtectedRoute><ClienteOnly><Categorias /></ClienteOnly></ProtectedRoute>} />
          <Route path="/estoque" element={<ProtectedRoute><ClienteOnly><Estoque /></ClienteOnly></ProtectedRoute>} />
          <Route path="/clientes" element={<ProtectedRoute><ClienteOnly><Clientes /></ClienteOnly></ProtectedRoute>} />
          <Route path="/fornecedores" element={<ProtectedRoute><ClienteOnly><Fornecedores /></ClienteOnly></ProtectedRoute>} />
          <Route path="/usuarios" element={<ProtectedRoute><ClienteOnly><Usuarios /></ClienteOnly></ProtectedRoute>} />
          <Route path="/etiquetas" element={<ProtectedRoute><ClienteOnly><Etiquetas /></ClienteOnly></ProtectedRoute>} />
          <Route path="/caixa" element={<ProtectedRoute><ClienteOnly><Caixa /></ClienteOnly></ProtectedRoute>} />
          <Route path="/pdv" element={<ProtectedRoute><ClienteOnly><Pdv /></ClienteOnly></ProtectedRoute>} />
          <Route path="/vendas" element={<ProtectedRoute><ClienteOnly><Vendas /></ClienteOnly></ProtectedRoute>} />
          <Route path="/financeiro/fluxo-caixa" element={<ProtectedRoute><ClienteOnly><FluxoCaixa /></ClienteOnly></ProtectedRoute>} />
          <Route path="/financeiro/contas-pagar" element={<ProtectedRoute><ClienteOnly><ContasPagar /></ClienteOnly></ProtectedRoute>} />
          <Route path="/financeiro/contas-receber" element={<ProtectedRoute><ClienteOnly><ContasReceber /></ClienteOnly></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </EmpresaThemeProvider>
      </AuthProvider>
      </ToastProvider>
    </HashRouter>
  )
}
