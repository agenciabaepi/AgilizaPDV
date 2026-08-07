import type { ReactNode } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'

type DashboardKpiCardProps = {
  label: string
  value: string
  hint?: string
  icon: ReactNode
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  trend?: { value: string; up?: boolean }
}

const VARIANT_CLASS: Record<NonNullable<DashboardKpiCardProps['variant']>, string> = {
  primary: 'dashboard-kpi--primary',
  success: 'dashboard-kpi--success',
  warning: 'dashboard-kpi--warning',
  danger: 'dashboard-kpi--danger',
  info: 'dashboard-kpi--info',
  neutral: 'dashboard-kpi--neutral',
}

export function DashboardKpiCard({
  label,
  value,
  hint,
  icon,
  variant = 'primary',
  trend,
}: DashboardKpiCardProps) {
  return (
    <div className={`dashboard-kpi ${VARIANT_CLASS[variant]}`}>
      <div className="dashboard-kpi__icon">{icon}</div>
      <div className="dashboard-kpi__body">
        <span className="dashboard-kpi__label">{label}</span>
        <span className="dashboard-kpi__value">{value}</span>
        {hint && <span className="dashboard-kpi__hint">{hint}</span>}
        {trend && (
          <span className={`dashboard-kpi__trend ${trend.up ? 'dashboard-kpi__trend--up' : 'dashboard-kpi__trend--down'}`}>
            {trend.up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {trend.value}
          </span>
        )}
      </div>
    </div>
  )
}
