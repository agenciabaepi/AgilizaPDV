import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { isCleanUrlNavigation, isPublicLegalPath } from '../../lib/public-legal'

type SiteLinkProps = {
  to: string
  className?: string
  children: ReactNode
  'aria-label'?: string
}

/** Link interno do site. Nas páginas legais com URL limpa, o restante do site continua no hash. */
export function SiteLink({ to, className, children, 'aria-label': ariaLabel }: SiteLinkProps) {
  if (isCleanUrlNavigation() && !isPublicLegalPath(to)) {
    const href = to === '/' ? '/#/' : `/#${to}`
    return (
      <a href={href} className={className} aria-label={ariaLabel}>
        {children}
      </a>
    )
  }

  return (
    <Link to={to} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  )
}
