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
      className="update-toast"
    >
      <div className="update-toast-title">
        Uma versão mais nova do Agiliza PDV está disponível!
      </div>
      <div className="update-toast-message">
        Atualização disponível ({version}). Clique abaixo para reiniciar e instalar agora.
      </div>
      <div className="update-toast-actions">
        <button type="button" onClick={handleDismiss} className="update-toast-btn update-toast-btn--secondary">
          Depois
        </button>
        <button type="button" onClick={handleInstall} className="update-toast-btn update-toast-btn--primary">
          Reiniciar e instalar
        </button>
      </div>
    </div>
  )
}
