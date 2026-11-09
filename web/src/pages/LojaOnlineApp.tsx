import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import { ToastProvider } from '../components/ui'
import {
  LojaOnlineStoreProvider,
  LojaOnlineStoreShell,
  useLojaOnlineStore,
  type LojaOnlineMode,
} from '../hooks/useLojaOnlineStore'
import { resolveLojaOnlineLogoHeader } from '../lib/loja-online'
import {
  applyLojaOnlineBrandBoot,
  peekLojaOnlineBrand,
  rememberLojaOnlineBrand,
} from '../lib/loja-online-brand-boot'
import { LojaOnlineCartProvider } from '../hooks/useLojaOnlineCart'
import { LojaOnlineClienteAuthProvider } from '../hooks/useLojaOnlineClienteAuth'
import { LojaOnlineLayout } from '../components/loja-online/LojaOnlineLayout'
import { LojaOnlineTracker } from '../components/loja-online/LojaOnlineTracker'
import { LojaOnlineHome } from './loja-online/LojaOnlineHome'
import { useLojaOnlineScrollRestoration } from '../hooks/useLojaOnlineScrollRestoration'

const LojaOnlineProdutoPage = lazy(() =>
  import('./loja-online/LojaOnlineProdutoPage').then((m) => ({ default: m.LojaOnlineProdutoPage }))
)
const LojaOnlineCarrinhoPage = lazy(() =>
  import('./loja-online/LojaOnlineCarrinhoPage').then((m) => ({ default: m.LojaOnlineCarrinhoPage }))
)
const LojaOnlineCheckoutPage = lazy(() =>
  import('./loja-online/LojaOnlineCheckoutPage').then((m) => ({ default: m.LojaOnlineCheckoutPage }))
)
const LojaOnlineClienteLoginPage = lazy(() =>
  import('./loja-online/LojaOnlineClienteLoginPage').then((m) => ({
    default: m.LojaOnlineClienteLoginPage,
  }))
)
const LojaOnlineClienteCadastroPage = lazy(() =>
  import('./loja-online/LojaOnlineClienteCadastroPage').then((m) => ({
    default: m.LojaOnlineClienteCadastroPage,
  }))
)
const LojaOnlineContaPage = lazy(() =>
  import('./loja-online/LojaOnlineContaPage').then((m) => ({ default: m.LojaOnlineContaPage }))
)
const LojaOnlinePagarPedidoPage = lazy(() =>
  import('./loja-online/LojaOnlinePagarPedidoPage').then((m) => ({
    default: m.LojaOnlinePagarPedidoPage,
  }))
)
const LojaOnlineBuscaPage = lazy(() =>
  import('./loja-online/LojaOnlineBuscaPage').then((m) => ({ default: m.LojaOnlineBuscaPage }))
)
const LojaOnlineLegalPage = lazy(() =>
  import('./loja-online/LojaOnlineLegalPage').then((m) => ({ default: m.LojaOnlineLegalPage }))
)
const LojaOnlineColecaoPage = lazy(() =>
  import('./loja-online/LojaOnlineColecaoPage').then((m) => ({ default: m.LojaOnlineColecaoPage }))
)
const LojaOnlinePedidoDetailPage = lazy(() =>
  import('./loja-online/LojaOnlinePedidoDetailPage').then((m) => ({
    default: m.LojaOnlinePedidoDetailPage,
  }))
)
const CapaCustomEditorPage = lazy(() => import('../capa-custom/CapaCustomEditorPage'))

function PageFallback() {
  return <p className="loja-catalogo-empty">Carregando…</p>
}

/** Mantém título/favicon da loja na aba enquanto a store carrega (ou em navegação interna). */
function LojaOnlineBrandBoot() {
  const { slug, store, titulo } = useLojaOnlineStore()
  useEffect(() => {
    if (store) {
      rememberLojaOnlineBrand(store, { slug })
      const next = peekLojaOnlineBrand({ slug })
      if (next) applyLojaOnlineBrandBoot(next)
      else {
        applyLojaOnlineBrandBoot({
          title: store.loja_online_seo_titulo?.trim() || titulo,
          icon: resolveLojaOnlineLogoHeader(store),
        })
      }
      return
    }
    const cached = peekLojaOnlineBrand({ slug })
    if (cached) applyLojaOnlineBrandBoot(cached)
  }, [store, slug, titulo])
  return null
}

function LojaOnlineRoutes() {
  useLojaOnlineScrollRestoration()
  return (
    <LojaOnlineStoreShell>
      <LojaOnlineBrandBoot />
      <LojaOnlineCartProvider>
        <LojaOnlineClienteAuthProvider>
          <Suspense fallback={<PageFallback />}>
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
                <Route path="colecao/:colecaoSlug" element={<LojaOnlineColecaoPage />} />
                <Route path="conta/pedido/:pedidoId" element={<LojaOnlinePedidoDetailPage />} />
                <Route path="conta/pedido/:pedidoId/pagar" element={<LojaOnlinePagarPedidoPage />} />
              </Route>
              <Route
                path="personalizar/:produtoId"
                element={
                  <>
                    <LojaOnlineTracker />
                    <Suspense fallback={<p className="loja-catalogo-empty">Abrindo o editor…</p>}>
                      <CapaCustomEditorPage />
                    </Suspense>
                  </>
                }
              />
            </Routes>
          </Suspense>
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
  hostname,
  mode = 'subdomain',
}: {
  slug?: string
  hostname?: string
  mode?: LojaOnlineMode
}) {
  const inner = (
    <ToastProvider>
      <LojaOnlineStoreProvider slug={slug} hostname={hostname} mode={mode}>
        <LojaOnlineRoutes />
      </LojaOnlineStoreProvider>
    </ToastProvider>
  )

  if (mode === 'subdomain') {
    return <BrowserRouter>{inner}</BrowserRouter>
  }
  return inner
}
