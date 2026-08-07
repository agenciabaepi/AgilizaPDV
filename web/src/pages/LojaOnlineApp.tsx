import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import { ToastProvider } from '../components/ui'
import { LojaOnlineStoreProvider, LojaOnlineStoreShell } from '../hooks/useLojaOnlineStore'
import { LojaOnlineCartProvider } from '../hooks/useLojaOnlineCart'
import { LojaOnlineClienteAuthProvider } from '../hooks/useLojaOnlineClienteAuth'
import { LojaOnlineLayout } from '../components/loja-online/LojaOnlineLayout'
import { LojaOnlineHome } from './loja-online/LojaOnlineHome'
import { LojaOnlineProdutoPage } from './loja-online/LojaOnlineProdutoPage'
import { LojaOnlineCarrinhoPage } from './loja-online/LojaOnlineCarrinhoPage'
import { LojaOnlineCheckoutPage } from './loja-online/LojaOnlineCheckoutPage'
import { LojaOnlineClienteLoginPage } from './loja-online/LojaOnlineClienteLoginPage'
import { LojaOnlineClienteCadastroPage } from './loja-online/LojaOnlineClienteCadastroPage'
import { LojaOnlineContaPage } from './loja-online/LojaOnlineContaPage'
import { LojaOnlinePagarPedidoPage } from './loja-online/LojaOnlinePagarPedidoPage'
import { LojaOnlineBuscaPage } from './loja-online/LojaOnlineBuscaPage'
import { LojaOnlineLegalPage } from './loja-online/LojaOnlineLegalPage'
import { LojaOnlinePedidoDetailPage } from './loja-online/LojaOnlinePedidoDetailPage'
import type { LojaOnlineMode } from '../hooks/useLojaOnlineStore'

function LojaOnlineRoutes() {
  return (
    <LojaOnlineStoreShell>
      <LojaOnlineCartProvider>
        <LojaOnlineClienteAuthProvider>
          <Routes>
            <Route element={<LojaOnlineLayout />}>
              <Route index element={<LojaOnlineHome />} />
              <Route path="produto/:produtoId" element={<LojaOnlineProdutoPage />} />
              <Route path="carrinho" element={<LojaOnlineCarrinhoPage />} />
              <Route path="checkout" element={<LojaOnlineCheckoutPage />} />
              <Route path="entrar" element={<LojaOnlineClienteLoginPage />} />
              <Route path="cadastro" element={<LojaOnlineClienteCadastroPage />} />
              <Route path="conta" element={<LojaOnlineContaPage />} />
              <Route path="busca" element={<LojaOnlineBuscaPage />} />
              <Route path="legal/:legalSlug" element={<LojaOnlineLegalPage />} />
              <Route path="conta/pedido/:pedidoId" element={<LojaOnlinePedidoDetailPage />} />
              <Route path="conta/pedido/:pedidoId/pagar" element={<LojaOnlinePagarPedidoPage />} />
            </Route>
          </Routes>
        </LojaOnlineClienteAuthProvider>
      </LojaOnlineCartProvider>
    </LojaOnlineStoreShell>
  )
}

export function LojaOnlinePathWrapper() {
  const { slug } = useParams<{ slug: string }>()
  if (!slug) return null
  return (
    <ToastProvider>
      <LojaOnlineStoreProvider slug={slug} mode="path">
        <LojaOnlineRoutes />
      </LojaOnlineStoreProvider>
    </ToastProvider>
  )
}

export function LojaOnlineApp({
  slug,
  mode = 'subdomain',
}: {
  slug: string
  mode?: LojaOnlineMode
}) {
  const inner = (
    <ToastProvider>
      <LojaOnlineStoreProvider slug={slug} mode={mode}>
        <LojaOnlineRoutes />
      </LojaOnlineStoreProvider>
    </ToastProvider>
  )

  if (mode === 'subdomain') {
    return <BrowserRouter>{inner}</BrowserRouter>
  }

  return inner
}
