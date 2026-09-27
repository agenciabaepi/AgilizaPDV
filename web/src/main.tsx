import React from 'react'
import ReactDOM from 'react-dom/client'
import { webElectronAPI } from './lib/web-electron-api'
import {
  getLojaSlugFromHostname,
  isLojaOnlineCustomDomainHost,
} from './lib/loja-online'
import { isPublicLegalPath, normalizePublicPath } from './lib/public-legal'
import { isErroDeArquivoAntigo, recarregarAposDeploy } from './lib/reload-apos-deploy'

// Painel web: sempre usa a API Supabase (sem Electron)
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).electronAPI = webElectronAPI
}

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    if (recarregarAposDeploy()) event.preventDefault()
  })
}

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML =
    '<div style="padding:20px;font-family:sans-serif;">Erro: #root não encontrado.</div>'
} else {
  rootEl.innerHTML = ''
  const root = ReactDOM.createRoot(rootEl)
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

  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
  const lojaSlug = getLojaSlugFromHostname(hostname)
  const customDomain = isLojaOnlineCustomDomainHost(hostname) ? hostname : null
  const isStorefront = Boolean(lojaSlug || customDomain)
  const isLegalPublic =
    typeof window !== 'undefined' &&
    isPublicLegalPath(normalizePublicPath(window.location.pathname)) &&
    !window.location.hash.startsWith('#/')

  const boot = isStorefront
    ? Promise.all([
        import('./index.css'),
        import('./pages/LojaOnlineApp'),
        import('./components/ErrorBoundary'),
      ]).then(([, mod, { ErrorBoundary }]) => {
        const { LojaOnlineApp } = mod
        return {
          ErrorBoundary,
          node: (
            <LojaOnlineApp
              slug={lojaSlug ?? undefined}
              hostname={customDomain ?? undefined}
              mode="subdomain"
            />
          ),
        }
      })
    : isLegalPublic
      ? Promise.all([
          import('./index.css'),
          import('./App'),
          import('./components/ErrorBoundary'),
        ]).then(([, { default: App }, { ErrorBoundary }]) => ({
          ErrorBoundary,
          node: <App />,
        }))
      : Promise.all([
          import('./index.css'),
          import('./App'),
          import('./components/ErrorBoundary'),
        ]).then(([, { default: App }, { ErrorBoundary }]) => ({
          ErrorBoundary,
          node: <App />,
        }))

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
