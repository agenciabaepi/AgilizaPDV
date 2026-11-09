import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  getLojaSlugFromHostname,
  isLojaOnlineCustomDomainHost,
} from './lib/loja-online'
import { applyLojaOnlineBrandBoot, peekLojaOnlineBrand } from './lib/loja-online-brand-boot'
import { startLojaOnlineStoreBoot } from './lib/loja-online-boot'
import { isErroDeArquivoAntigo, recarregarAposDeploy } from './lib/reload-apos-deploy'

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    if (recarregarAposDeploy()) event.preventDefault()
  })
}

function getLojaSlugFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  const fromHost = getLojaSlugFromHostname(window.location.hostname)
  if (fromHost) return fromHost
  const hash = window.location.hash || ''
  const hashMatch = hash.match(/^#\/loja\/([^/?#]+)/)
  if (hashMatch?.[1]) {
    try {
      return decodeURIComponent(hashMatch[1])
    } catch {
      return hashMatch[1]
    }
  }
  const path = window.location.pathname || ''
  const pathMatch = path.match(/^\/loja\/([^/?#]+)/)
  if (pathMatch?.[1]) {
    try {
      return decodeURIComponent(pathMatch[1])
    } catch {
      return pathMatch[1]
    }
  }
  return null
}

function paintLojaBootShell(
  el: HTMLElement,
  brand: ReturnType<typeof peekLojaOnlineBrand>,
  fallbackTitle: string
) {
  if (el.querySelector('#loja-boot-shell')) return
  const title = brand?.title || fallbackTitle
  const logo = brand?.icon
    ? `<img class="boot-logo" src="${brand.icon.replace(/"/g, '&quot;')}" alt="" />`
    : `<span class="boot-title">${title.replace(/</g, '&lt;')}</span>`
  const banner = brand?.banner
    ? `<div class="boot-banner"><img src="${brand.banner.replace(/"/g, '&quot;')}" alt="" fetchpriority="high" decoding="async" /></div>`
    : `<div class="boot-banner" aria-hidden="true"></div>`
  el.innerHTML =
    `<div id="loja-boot-shell" aria-busy="true" aria-label="Carregando a loja">` +
    `<div class="boot-header">${logo}</div>${banner}</div>`
}

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML =
    '<div style="padding:20px;font-family:sans-serif;">Erro: #root não encontrado.</div>'
} else {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
  const hostSlug = getLojaSlugFromHostname(hostname)
  const pathSlug = getLojaSlugFromLocation()
  const customDomain = isLojaOnlineCustomDomainHost(hostname) ? hostname : null
  const isStorefrontHost = Boolean(hostSlug || customDomain)
  const isLojaRoute = Boolean(isStorefrontHost || pathSlug)
  const brandSlug = hostSlug || pathSlug
  const storeBrand = isLojaRoute
    ? peekLojaOnlineBrand({ slug: brandSlug, hostname: customDomain })
    : null

  if (storeBrand) {
    applyLojaOnlineBrandBoot(storeBrand)
  } else if (isLojaRoute) {
    document.title = brandSlug || hostname || 'Loja online'
  }

  // Fetch da loja em paralelo com o download do React — não espera o chunk.
  if (isLojaRoute) {
    startLojaOnlineStoreBoot({ slug: brandSlug, hostname: customDomain })
    paintLojaBootShell(rootEl, storeBrand, brandSlug || hostname || 'Loja online')
  } else {
    rootEl.innerHTML = ''
  }

  const root = ReactDOM.createRoot(rootEl)

  if (!isLojaRoute) {
    root.render(
      <div
        style={{
          padding: 40,
          background: '#f7f7f7',
          minHeight: '100vh',
          fontFamily: "'Samsung Sharp Sans', 'Sora', sans-serif",
        }}
      >
        <h1 style={{ color: '#1d4ed8' }}>Agiliza PDV</h1>
        <p>Carregando…</p>
      </div>
    )
  }

  const bootStorefrontApp = () =>
    Promise.all([
      import('./index.css'),
      import('./pages/LojaOnlineApp'),
      import('./components/ErrorBoundary'),
    ]).then(([, mod, { ErrorBoundary }]) => {
      const { LojaOnlineApp } = mod
      return {
        ErrorBoundary,
        node: (
          <LojaOnlineApp
            slug={hostSlug ?? undefined}
            hostname={customDomain ?? undefined}
            mode="subdomain"
          />
        ),
      }
    })

  /** `/#/loja/:slug` sem carregar o painel admin inteiro. */
  const bootLojaPathApp = () =>
    Promise.all([
      import('./index.css'),
      import('./pages/LojaOnlineApp'),
      import('react-router-dom'),
      import('./components/ErrorBoundary'),
    ]).then(([, mod, rrd, { ErrorBoundary }]) => {
      const { HashRouter, Routes, Route, Navigate } = rrd
      const { LojaOnlinePathWrapper } = mod
      return {
        ErrorBoundary,
        node: (
          <HashRouter>
            <Routes>
              <Route path="/loja/:slug/*" element={<LojaOnlinePathWrapper />} />
              <Route path="*" element={<Navigate to={`/loja/${pathSlug}`} replace />} />
            </Routes>
          </HashRouter>
        ),
      }
    })

  const bootAdminApp = () =>
    Promise.all([
      import('./lib/web-electron-api'),
      import('./index.css'),
      import('./App'),
      import('./components/ErrorBoundary'),
    ]).then(([api, , { default: App }, { ErrorBoundary }]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).electronAPI = api.webElectronAPI
      return { ErrorBoundary, node: <App /> }
    })

  const boot = isStorefrontHost
    ? bootStorefrontApp()
    : pathSlug
      ? bootLojaPathApp()
      : bootAdminApp()

  boot
    .then(({ ErrorBoundary, node }) => {
      root.render(
        <React.StrictMode>
          <ErrorBoundary>{node}</ErrorBoundary>
        </React.StrictMode>
      )
    })
    .catch((e) => {
      if (isErroDeArquivoAntigo(e) && recarregarAposDeploy()) return
      const msg = e instanceof Error ? e.message : String(e)
      rootEl.innerHTML = `<div style="padding:24px;background:#fff;color:#c00;font-family:monospace;white-space:pre-wrap;">Erro ao carregar o app:\n${msg}</div>`
      console.error(e)
    })
}
