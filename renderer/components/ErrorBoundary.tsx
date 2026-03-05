import React from 'react'

type State = { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
            background: '#f7f7f7',
            color: '#333',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <h1 style={{ color: '#ea1d2c', marginBottom: 16 }}>Algo deu errado</h1>
          <pre
            style={{
              background: '#fff',
              padding: 16,
              borderRadius: 8,
              overflow: 'auto',
              maxWidth: '100%',
              fontSize: 12,
              border: '1px solid #e5e5e5',
            }}
          >
            {this.state.error.message}
          </pre>
          <p style={{ marginTop: 16, fontSize: 14, color: '#717171' }}>
            Abra o DevTools (Ctrl+Shift+I ou Cmd+Option+I) para mais detalhes.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
