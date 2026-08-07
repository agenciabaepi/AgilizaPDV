import type { ReactNode } from 'react'
import logoAgiliza from '../assets/logo.svg'

type AuthLayoutProps = {
  subtitle?: ReactNode
  wide?: boolean
  children: ReactNode
}

export function AuthLayout({ subtitle, wide, children }: AuthLayoutProps) {
  return (
    <div className="login-page">
      <div className={`login-card login-card--simple${wide ? ' login-card--wide' : ''}`}>
        <div className="login-card-inner">
          <div className="login-logo-box">
            <img src={logoAgiliza} alt="Agiliza" className="login-logo-image" />
          </div>
          {subtitle && (
            <p className="login-card-subtitle" style={{ marginTop: 'var(--space-4)' }}>
              {subtitle}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}
