import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'
import { cn } from '../../lib/cn'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
  wide?: boolean
}

export function Modal({ open, title, onClose, children, className, wide }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-root" role="presentation" onClick={onClose}>
      <div
        className={cn('modal-dialog', wide && 'modal-dialog--wide', className)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </Button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
