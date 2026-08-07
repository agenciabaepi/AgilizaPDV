import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { handleLandingSectionClick, queueLandingScroll } from '../../lib/landing-scroll'

function LandingFooterSectionLink({ sectionId, children }: { sectionId: string; children: ReactNode }) {
  const { pathname } = useLocation()
  const isHome = pathname === '/' || pathname === ''

  if (isHome) {
    return (
      <a
        href={`#${sectionId}`}
        className="landing-footer-link"
        onClick={(event) => handleLandingSectionClick(event, sectionId)}
      >
        {children}
      </a>
    )
  }

  return (
    <Link to="/" className="landing-footer-link" onClick={() => queueLandingScroll(sectionId)}>
      {children}
    </Link>
  )
}

export function LandingSiteFooter() {
  return (
    <footer className="landing-section landing-section--footer">
      <div className="landing-inner landing-footer-inner">
        <span className="landing-footer-brand">Agiliza PDV — sistema web para varejo</span>
        <div className="landing-footer-links">
          <LandingFooterSectionLink sectionId="planos">Planos</LandingFooterSectionLink>
          <Link to="/quem-somos" className="landing-footer-link">
            Quem somos
          </Link>
          <Link to="/contato" className="landing-footer-link">
            Contato
          </Link>
          <LandingFooterSectionLink sectionId="faq">FAQ</LandingFooterSectionLink>
          <Link to="/cadastro" className="landing-footer-link">
            Criar conta
          </Link>
          <Link to="/login" className="landing-footer-link">
            Acessar sistema
          </Link>
        </div>
      </div>
    </footer>
  )
}
