import type { ReactNode } from 'react'
import { LandingSiteFooter } from './LandingSiteFooter'
import { LandingSiteHeader } from './LandingSiteHeader'

type LandingStaticPageProps = {
  eyebrow: string
  title: string
  lead?: string
  children: ReactNode
}

export function LandingStaticPage({ eyebrow, title, lead, children }: LandingStaticPageProps) {
  return (
    <div className="landing-page">
      <LandingSiteHeader />
      <main className="landing-section landing-section--static">
        <div className="landing-inner">
          <header className="landing-section-head">
            <span className="landing-eyebrow">{eyebrow}</span>
            <h1 className="landing-section-title">{title}</h1>
            {lead ? <p className="landing-section-lead">{lead}</p> : null}
          </header>
          <div className="landing-static-content">{children}</div>
        </div>
      </main>
      <LandingSiteFooter />
    </div>
  )
}
