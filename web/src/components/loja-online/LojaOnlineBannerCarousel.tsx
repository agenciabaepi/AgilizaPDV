import { useEffect, useState } from 'react'
import type { LojaOnlineBanner, LojaOnlineBannerTamanho } from '../../lib/loja-online-types'
import {
  isLojaOnlineBannerAdaptadoDoDesktop,
  resolveLojaOnlineBannerForViewport,
} from '../../lib/loja-online-types'
import { hasRestorableBannerStudio } from '../../lib/loja-online-banner-studio'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { LojaOnlineBannerPlayer } from './LojaOnlineBannerPlayer'

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

  const wrappedContent =
    !isInteractive && current.link ? (
      <a href={current.link} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    ) : (
      content
    )

  return (
    <section
      className={`loja-store-carousel loja-store-carousel--${viewportTamanho}${useMobileAspect ? ' loja-store-carousel--mobile' : ''}${adaptadoDoDesktop ? ' loja-store-carousel--adaptado' : ''}`}
      aria-label="Banners da loja"
    >
      {wrappedContent}
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
