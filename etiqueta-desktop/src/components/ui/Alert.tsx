import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'error' | 'success' | 'warning' | 'info'

export function Alert({
  variant = 'info',
  children,
  className,
  style
}: {
  variant?: Variant
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  const icons = {
    error: AlertCircle,
    success: CheckCircle,
    warning: AlertTriangle,
    info: Info
  }
  const Icon = icons[variant]
  return (
    <div role="alert" className={cn('alert', `alert--${variant}`, className)} style={style}>
      <Icon className="alert-icon" />
      <div>{children}</div>
    </div>
  )
}
