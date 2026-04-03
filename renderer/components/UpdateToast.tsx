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
    const unsub = window.electronAPI?.app?.onUpdateStatusChange?.((s) => {
      setState(s)
      if (s.phase === 'available' || s.phase === 'downloading' || s.phase === 'downloaded') {
        setDismissed(false)
      }
    })
    return () => {
      unsub?.()
    }
  }, [])

  const handleInstall = () => {
    window.electronAPI?.app?.installUpdateNow?.()
  }

  const handleDismiss = () => {
    setDismissed(true)
  }

  if (!state || dismissed) return null

  const { phase, message, version, percent } = state

  if (phase === 'idle' || phase === 'not-available') return null

  if (phase === 'checking') {
    return (
      <div role="status" aria-live="polite" className="update-toast update-toast--checking">
        <div className="update-toast-title">Atualizações</div>
        <div className="update-toast-message">{message ?? 'Verificando atualizações…'}</div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div role="alert" className="update-toast update-toast--error">
        <div className="update-toast-title">Não foi possível verificar atualização</div>
        <div className="update-toast-message">{message ?? 'Erro desconhecido.'}</div>
        <div className="update-toast-actions">
          <button type="button" onClick={handleDismiss} className="update-toast-btn update-toast-btn--secondary">
            Fechar
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'available') {
    return (
      <div role="status" aria-live="polite" className="update-toast">
        <div className="update-toast-title">Nova versão disponível</div>
        <div className="update-toast-message">
          {version ? `Versão ${version}` : 'Atualização'} — baixando em segundo plano…
        </div>
      </div>
    )
  }

  if (phase === 'downloading') {
    const p = percent != null ? `${Math.round(percent)}%` : ''
    return (
      <div role="status" aria-live="polite" className="update-toast">
        <div className="update-toast-title">Baixando atualização</div>
        <div className="update-toast-message">
          {message ?? 'Aguarde…'} {p}
        </div>
      </div>
    )
  }

  if (phase === 'downloaded') {
    return (
      <div role="alert" aria-live="polite" className="update-toast">
        <div className="update-toast-title">Atualização pronta</div>
        <div className="update-toast-message">
          {version ? `Versão ${version} ` : ''}
          {message ?? 'Reinicie o app para instalar.'}
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

  return null
}
