import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle, AlertCircle, Info } from 'lucide-react'
import { cn } from '../../lib/cn'

export type ToastVariant = 'success' | 'error' | 'info'

type ToastItem = {
  id: string
  variant: ToastVariant
  message: string
}

type ToastContextValue = {
  toasts: ToastItem[]
  addToast: (variant: ToastVariant, message: string) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((variant: ToastVariant, message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts((prev) => [...prev, { id, variant, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn('toast', `toast--${t.variant}`)}
            role="status"
          >
            {t.variant === 'success' && <CheckCircle size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />}
            {t.variant === 'error' && <AlertCircle size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />}
            {t.variant === 'info' && <Info size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
