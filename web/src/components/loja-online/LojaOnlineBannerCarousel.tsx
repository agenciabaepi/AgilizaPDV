import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LojaOnlineBanner, LojaOnlineBannerTamanho } from '../../lib/loja-online-types'
import {
  isLojaOnlineBannerAdaptadoDoDesktop,
  resolveLojaOnlineBannerForViewport,
} from '../../lib/loja-online-types'
import { hasRestorableBannerStudio } from '../../lib/loja-online-banner-studio'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { LojaOnlineBannerPlayer } from './LojaOnlineBannerPlayer'

function BannerClickTarget({
  href,
  className,
}: {
  href: string
  className?: string
}) {
  const { link } = useLojaOnlineStore()
  const trimmed = href.trim()
  const isExternal = /^(https?:|mailto:|tel:)/i.test(trimmed)

  if (isExternal) {
    return (
      <a
        href={trimmed}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label="Abrir link do banner"
      />
    )
  }

  const path = trimmed.replace(/^\//, '')
  return <Link to={link(path)} className={className} aria-label="Abrir página do banner" />
}

export function LojaOnlineBannerCarousel({
  banners,
  tamanho = 'medio',
  tamanhoMobile = 'medio',
}: {
  banners: LojaOnlineBanner[]
  tamanho?: LojaOnlineBannerTamanho
  tamanhoMobile?: LojaOnlineBannerTamanho
}) {
  const [index, setIndex] = useState(0)
  const isMobile = useIsMobile()

  useEffect(() => {
    if (banners.length <= 1) return
    const t = setInterval(() => setIndex((i) => (i + 1) % banners.length), 5000)
    return () => clearInterval(t)
  }, [banners.length])

  if (banners.length === 0) return null

  const source = banners[index]
  const adaptadoDoDesktop = isLojaOnlineBannerAdaptadoDoDesktop(source, isMobile)
  const current = resolveLojaOnlineBannerForViewport(source, isMobile)
  const isInteractive = hasRestorableBannerStudio(current.studio)
  const bannerHref = current.link?.trim() || ''

  // Sem arte mobile: mantém proporção do computador para não cortar a mesma imagem.
  const viewportTamanho = adaptadoDoDesktop
    ? (current.tamanho ?? tamanho)
    : isMobile
      ? tamanhoMobile
      : tamanho
  const useMobileAspect = isMobile && !adaptadoDoDesktop

  const content = isInteractive ? (
    <LojaOnlineBannerPlayer
      banner={current}
      tamanho={viewportTamanho}
      variant={useMobileAspect ? 'mobile' : 'desktop'}
    />
  ) : (
    <img src={current.imagem} alt="" className="loja-store-carousel-img" />
  )

  return (
    <section
      className={`loja-store-carousel loja-store-carousel--${viewportTamanho}${useMobileAspect ? ' loja-store-carousel--mobile' : ''}${adaptadoDoDesktop ? ' loja-store-carousel--adaptado' : ''}${!isInteractive ? ' loja-store-carousel--static' : ''}${bannerHref ? ' loja-store-carousel--clicavel' : ''}`}
      aria-label="Banners da loja"
    >
      {content}
      {bannerHref ? <BannerClickTarget href={bannerHref} className="loja-store-carousel-hit" /> : null}
      {banners.length > 1 && (
        <div className="loja-store-carousel-dots">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              className={i === index ? 'is-active' : ''}
              onClick={() => setIndex(i)}
              aria-label={`Banner ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
