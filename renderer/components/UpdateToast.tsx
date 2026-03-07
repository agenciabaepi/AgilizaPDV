import { useState, useEffect } from 'react'

type UpdateState = {
  phase: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'
  message?: string
  version?: string
  percent?: number
}

export function UpdateToast() {
  const [state, setState] = useState<UpdateState | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const unsub = window.electronAPI?.app?.onUpdateStatusChange?.(setState)
    return () => {
      unsub?.()
    }
  }, [])

  const show = state?.phase === 'downloaded' && !dismissed
  const version = state?.version ?? ''

  const handleInstall = () => {
    window.electronAPI?.app?.installUpdateNow?.()
  }

  const handleDismiss = () => {
    setDismissed(true)
  }

  if (!show) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 16,
        left: 16,
        zIndex: 99999,
        maxWidth: 360,
        padding: '14px 16px',
        background: '#ea580c',
        color: '#fff',
        borderRadius: 10,
        boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 4 }}>
        Uma versão mais nova do Agiliza PDV está disponível!
      </div>
      <div style={{ fontSize: 'var(--text-xs)', opacity: 0.95, marginBottom: 10 }}>
        Atualização disponível ({version}). Clique abaixo para reiniciar e instalar agora.
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={handleDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 'var(--text-xs)',
            textDecoration: 'underline',
          }}
        >
          Depois
        </button>
        <button
          type="button"
          onClick={handleInstall}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            textDecoration: 'underline',
          }}
        >
          Reiniciar e instalar
        </button>
      </div>
    </div>
  )
}
