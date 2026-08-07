import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function LojaOnlineProductGallery({
  imagens,
  alt,
}: {
  imagens: string[]
  alt: string
}) {
  const [active, setActive] = useState(0)
  if (imagens.length === 0) return null

  const current = imagens[active] ?? imagens[0]
  const hasMultiple = imagens.length > 1

  const goPrev = () => {
    setActive((i) => (i <= 0 ? imagens.length - 1 : i - 1))
  }

  const goNext = () => {
    setActive((i) => (i >= imagens.length - 1 ? 0 : i + 1))
  }

  return (
    <div className="loja-store-produto-gallery">
      <div className="loja-store-produto-gallery-main">
        <img src={current} alt={alt} loading="lazy" decoding="async" />
        {hasMultiple && (
          <>
            <button
              type="button"
              className="loja-store-produto-gallery-nav loja-store-produto-gallery-nav--prev"
              onClick={goPrev}
              aria-label="Imagem anterior"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              className="loja-store-produto-gallery-nav loja-store-produto-gallery-nav--next"
              onClick={goNext}
              aria-label="Próxima imagem"
            >
              <ChevronRight size={22} />
            </button>
            <span className="loja-store-produto-gallery-counter" aria-live="polite">
              {active + 1} / {imagens.length}
            </span>
          </>
        )}
      </div>

      {hasMultiple && (
        <>
          <div className="loja-store-produto-gallery-thumbs" role="tablist" aria-label="Imagens do produto">
            {imagens.map((src, i) => (
              <button
                key={src + i}
                type="button"
                role="tab"
                aria-selected={i === active}
                className={i === active ? 'is-active' : ''}
                onClick={() => setActive(i)}
                aria-label={`Imagem ${i + 1} de ${imagens.length}`}
              >
                <img src={src} alt="" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>

          <div className="loja-store-produto-gallery-all" aria-label="Todas as imagens do produto">
            <p className="loja-store-produto-gallery-all-title">Todas as imagens</p>
            <div className="loja-store-produto-gallery-all-grid">
              {imagens.map((src, i) => (
                <button
                  key={`all-${src}-${i}`}
                  type="button"
                  className={`loja-store-produto-gallery-all-item${i === active ? ' is-active' : ''}`}
                  onClick={() => setActive(i)}
                  aria-label={`Ver imagem ${i + 1}`}
                >
                  <img src={src} alt="" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
