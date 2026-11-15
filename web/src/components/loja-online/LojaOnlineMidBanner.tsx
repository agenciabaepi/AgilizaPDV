import { Link } from 'react-router-dom'
import type { LojaOnlineBanner } from '../../lib/loja-online-types'
import { resolveLojaOnlineBannerForViewport } from '../../lib/loja-online-types'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'

function BannerHit({ href }: { href: string }) {
  const { link } = useLojaOnlineStore()
  const trimmed = href.trim()
  if (!trimmed) return null
  const isExternal = /^(https?:|mailto:|tel:)/i.test(trimmed)
  if (isExternal) {
    return (
      <a
        href={trimmed}
        target="_blank"
        rel="noopener noreferrer"
        className="loja-home-mid-banner__hit"
        aria-label="Abrir link do banner"
      />
    )
  }
  return (
    <Link
      to={link(trimmed.replace(/^\//, ''))}
      className="loja-home-mid-banner__hit"
      aria-label="Abrir página do banner"
    />
  )
}

/** Banner estático full-bleed abaixo da prateleira “Conheça nossos produtos”. */
export function LojaOnlineMidBanner({ banner }: { banner: LojaOnlineBanner }) {
  const isMobile = useIsMobile()
  const current = resolveLojaOnlineBannerForViewport(banner, isMobile)
  const href = current.link?.trim() || ''

  return (
    <section
      className={`loja-home-mid-banner${href ? ' loja-home-mid-banner--clicavel' : ''}`}
      aria-label="Banner promocional"
    >
      <div className="loja-home-mid-banner__frame">
        <img
          src={current.imagem}
          alt=""
          className="loja-home-mid-banner__img"
          loading="lazy"
          decoding="async"
        />
        {href ? <BannerHit href={href} /> : null}
      </div>
    </section>
  )
}
