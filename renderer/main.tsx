import React from 'react'
import ReactDOM from 'react-dom/client'

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML = '<div style="padding:20px;font-family:sans-serif;">Erro: #root não encontrado.</div>'
} else {
  rootEl.innerHTML = ''
  const root = ReactDOM.createRoot(rootEl)
  root.render(
    <div style={{
      padding: 40,
      background: '#f7f7f7',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <h1 style={{ color: '#ea1d2c' }}>Agiliza PDV</h1>
      <p>Carregando o app...</p>
    </div>
  )

  Promise.all([
    import('./index.css'),
    import('./App'),
    import('./components/ErrorBoundary'),
  ]).then(([, { default: App }, { ErrorBoundary }]) => {
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    )
  }).catch((e) => {
    const msg = e instanceof Error ? e.message : String(e)
    rootEl.innerHTML = `<div style="padding:24px;background:#fff;color:#c00;font-family:monospace;white-space:pre-wrap;">Erro ao carregar o app:\n${msg}</div>`
    console.error(e)
  })
}
