import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'
import { cn } from '../../lib/cn'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

type ToastItem = {
  id: string
  variant: ToastVariant
  message: string
}

type ToastContextValue = {
  toasts: ToastItem[]
  addToast: (variant: ToastVariant, message: string, durationMs?: number) => void
  removeToast: (id: string) => void
}

/** Mensagem legível para exibir em toast a partir de erro desconhecido (catch). */
export function errorMessageFromUnknown(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message
  if (typeof err === 'string' && err.trim()) return err
  return fallback
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

/** Atalhos para feedback de CRUD (salvar, excluir, etc.). */
export function useOperationToast() {
  const { addToast } = useToast()
  return useMemo(
    () => ({
      saved: (message = 'Alterações salvas com sucesso.') => addToast('success', message),
      created: (message = 'Cadastro realizado com sucesso.') => addToast('success', message),
      deleted: (message = 'Registro excluído com sucesso.') => addToast('success', message),
      info: (message: string) => addToast('info', message),
      warn: (message: string) => addToast('warning', message),
      error: (message: string) => addToast('error', message),
      failed: (err: unknown, fallback = 'Não foi possível concluir a operação.') =>
        addToast('error', errorMessageFromUnknown(err, fallback)),
    }),
    [addToast],
  )
}

const TOAST_ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
} as const

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((variant: ToastVariant, message: string, durationMs?: number) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const timeout = durationMs ?? (variant === 'error' ? 5500 : 4000)
    setToasts((prev) => [...prev.slice(-4), { id, variant, message }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, timeout)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => {
          const Icon = TOAST_ICONS[t.variant]
          return (
            <div
              key={t.id}
              className={cn('toast', `toast--${t.variant}`)}
              role="status"
            >
              <span className="toast-icon" aria-hidden>
                <Icon size={18} strokeWidth={2.2} />
              </span>
              <p className="toast-message">{t.message}</p>
              <button
                type="button"
                className="toast-close"
                onClick={() => removeToast(t.id)}
                aria-label="Fechar aviso"
              >
                <X size={16} strokeWidth={2.2} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
