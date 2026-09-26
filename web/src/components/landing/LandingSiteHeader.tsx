import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import logoAgiliza from '../../assets/logo-blue.svg'
import logoAgilizaWhite from '../../assets/logo-white.svg'
import { SiteLink } from './SiteLink'
import { handleLandingSectionClick, queueLandingScroll } from '../../lib/landing-scroll'
import { isCleanUrlNavigation } from '../../lib/public-legal'
import { useLandingNav } from '../../hooks/useLandingNav'

type LandingSiteHeaderProps = {
  onHero?: boolean
}

function LandingNavSectionLink({ sectionId, children }: { sectionId: string; children: ReactNode }) {
  const { pathname } = useLocation()
  const isHome = pathname === '/' || pathname === ''

  if (isHome) {
    return (
      <a
        href={`#${sectionId}`}
        className="landing-nav-link"
        onClick={(event) => handleLandingSectionClick(event, sectionId)}
      >
        {children}
      </a>
    )
  }

  if (isCleanUrlNavigation()) {
    return (
      <a href="/#/" className="landing-nav-link" onClick={() => queueLandingScroll(sectionId)}>
        {children}
      </a>
    )
  }

  return (
    <Link to="/" className="landing-nav-link" onClick={() => queueLandingScroll(sectionId)}>
      {children}
    </Link>
  )
}

export function LandingSiteHeader({ onHero = false }: LandingSiteHeaderProps) {
  const { navSolid } = useLandingNav()
  const transparent = onHero && !navSolid

  return (
    <header
      className={`landing-section landing-section--nav${navSolid ? ' landing-section--nav--solid' : onHero ? ' landing-section--nav--on-hero' : ' landing-section--nav--solid'}`}
    >
      <div className="landing-inner landing-nav">
        <SiteLink to="/" className="landing-nav-brand" aria-label="Agiliza PDV — início">
          <img
            src={transparent ? logoAgilizaWhite : logoAgiliza}
            alt="Agiliza PDV"
            className="landing-logo"
            width={148}
            height={62}
          />
        </SiteLink>
        <div className="landing-nav-end">
          <nav className="landing-nav-links" aria-label="Navegação principal">
            <LandingNavSectionLink sectionId="planos">Planos</LandingNavSectionLink>
            <SiteLink to="/quem-somos" className="landing-nav-link">
              Quem somos
            </SiteLink>
            <SiteLink to="/contato" className="landing-nav-link">
              Contato
            </SiteLink>
            <LandingNavSectionLink sectionId="faq">FAQ</LandingNavSectionLink>
          </nav>
          <div className="landing-nav-ctas">
            <SiteLink to="/login" className="btn btn--outline btn--md landing-nav-cta">
              <span className="landing-nav-cta-short">Entrar</span>
              <span className="landing-nav-cta-full">Entrar no sistema</span>
            </SiteLink>
            <SiteLink to="/cadastro" className="btn btn--primary btn--md landing-nav-cta landing-nav-cta--signup">
              Criar conta
            </SiteLink>
          </div>
        </div>
      </div>
    </header>
  )
}

export function LandingSectionLink({
  sectionId,
  className,
  children,
}: {
  sectionId: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <a
      href={`#${sectionId}`}
      className={className}
      onClick={(event) => handleLandingSectionClick(event, sectionId)}
    >
      {children}
    </a>
  )
}
