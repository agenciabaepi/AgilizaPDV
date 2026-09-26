import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { SiteLink } from './SiteLink'
import { handleLandingSectionClick, queueLandingScroll } from '../../lib/landing-scroll'
import { isCleanUrlNavigation } from '../../lib/public-legal'

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

  if (isCleanUrlNavigation()) {
    return (
      <a href="/#/" className="landing-footer-link" onClick={() => queueLandingScroll(sectionId)}>
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
          <SiteLink to="/quem-somos" className="landing-footer-link">
            Quem somos
          </SiteLink>
          <SiteLink to="/contato" className="landing-footer-link">
            Contato
          </SiteLink>
          <LandingFooterSectionLink sectionId="faq">FAQ</LandingFooterSectionLink>
          <a href="/politica-privacidade" className="landing-footer-link">
            Privacidade
          </a>
          <a href="/termos-servico" className="landing-footer-link">
            Termos de serviço
          </a>
          <SiteLink to="/cadastro" className="landing-footer-link">
            Criar conta
          </SiteLink>
          <SiteLink to="/login" className="landing-footer-link">
            Acessar sistema
          </SiteLink>
        </div>
      </div>
    </footer>
  )
}
