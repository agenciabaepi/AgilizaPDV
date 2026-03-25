import { useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'
import { cn } from '../../lib/cn'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  /** Conteúdo opcional abaixo do título (ex.: resumo no PDV) */
  headerExtra?: React.ReactNode
  footer?: React.ReactNode
  showCloseButton?: boolean
  className?: string
  /** 'default' = estreito; 'wide' = conteúdo médio; 'large' = formulários de cadastro; 'checkout' = finalizar venda PDV */
  size?: 'default' | 'wide' | 'large' | 'checkout'
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  headerExtra,
  footer,
  showCloseButton = true,
  className,
  size = 'default',
}: DialogProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="dialog-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        className={cn(
          'dialog-panel',
          size === 'wide' && 'dialog-panel--wide',
          size === 'large' && 'dialog-panel--large',
          size === 'checkout' && 'dialog-panel--checkout',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cn('dialog-header', headerExtra && 'dialog-header--with-extra')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0 }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexShrink: 0,
            }}
          >
            <h2 id="dialog-title" style={{ margin: 0 }}>
              {title}
            </h2>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="btn btn--ghost btn--sm"
                style={{ padding: 8, flexShrink: 0 }}
              >
                <X size={20} />
              </button>
            )}
          </div>
          {headerExtra ? <div className="dialog-header-extra">{headerExtra}</div> : null}
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </div>
  )
}

/** Confirmação simples: título, mensagem, botões Confirmar / Cancelar */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'primary',
  loading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'primary' | 'danger'
  loading?: boolean
}) {
  const handleConfirm = async () => {
    await onConfirm()
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={handleConfirm} disabled={loading}>
            {loading ? 'Aguarde...' : confirmLabel}
          </Button>
        </>
      }
    >
      <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>{message}</p>
    </Dialog>
  )
}
