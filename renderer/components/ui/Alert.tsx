import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '../../lib/cn'

export type AlertVariant = 'error' | 'success' | 'warning' | 'info'

export function Alert({
  variant = 'info',
  title,
  children,
  className,
  style,
}: {
  variant?: AlertVariant
  title?: string
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const icons = {
    error: AlertCircle,
    success: CheckCircle,
    warning: AlertTriangle,
    info: Info,
  }
  const Icon = icons[variant]
  return (
    <div role="alert" className={cn('alert', `alert--${variant}`, className)} style={style}>
      <Icon className="alert-icon" />
      <div>
        {title && <strong style={{ display: 'block', marginBottom: 4 }}>{title}</strong>}
        {children}
      </div>
    </div>
  )
}
