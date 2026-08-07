import { useEffect, useState } from 'react'
import type { LojaOnlineBanner, LojaOnlineBannerTamanho } from '../../lib/loja-online-types'
import { hasRestorableBannerStudio } from '../../lib/loja-online-banner-studio'
import { LojaOnlineBannerPlayer } from './LojaOnlineBannerPlayer'

export function LojaOnlineBannerCarousel({
  banners,
  tamanho = 'medio',
}: {
  banners: LojaOnlineBanner[]
  tamanho?: LojaOnlineBannerTamanho
}) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (banners.length <= 1) return
    const t = setInterval(() => setIndex((i) => (i + 1) % banners.length), 5000)
    return () => clearInterval(t)
  }, [banners.length])

  if (banners.length === 0) return null

  const current = banners[index]
  const isInteractive = hasRestorableBannerStudio(current.studio)

  const content = isInteractive ? (
    <LojaOnlineBannerPlayer banner={current} tamanho={tamanho} />
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
    <section className={`loja-store-carousel loja-store-carousel--${tamanho}`} aria-label="Banners da loja">
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
