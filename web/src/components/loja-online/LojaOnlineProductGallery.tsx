import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import type { LojaOnlineMidia } from '../../lib/loja-online-types'

export function LojaOnlineProductGallery({
  midias,
  alt,
}: {
  midias: LojaOnlineMidia[]
  alt: string
}) {
  const [active, setActive] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    setActive(0)
  }, [midias])

  const safeActive = midias.length === 0 ? 0 : Math.min(active, midias.length - 1)
  const current = midias[safeActive]
  const hasMultiple = midias.length > 1

  useEffect(() => {
    const el = videoRef.current
    if (!el || !current || current.tipo !== 'video') return
    el.muted = true
    el.playsInline = true
    const play = () => {
      void el.play().catch(() => {
        /* autoplay bloqueado — usuário usa os controles */
      })
    }
    if (el.readyState >= 2) play()
    else el.addEventListener('loadeddata', play, { once: true })
    return () => {
      el.pause()
      el.removeEventListener('loadeddata', play)
    }
  }, [current?.tipo, current?.url, safeActive])

  if (midias.length === 0 || !current) return null

  const goPrev = () => {
    setActive((i) => (i <= 0 ? midias.length - 1 : i - 1))
  }

  const goNext = () => {
    setActive((i) => (i >= midias.length - 1 ? 0 : i + 1))
  }

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || !hasMultiple) return
    const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 48) return
    if (dx > 0) goPrev()
    else goNext()
  }

  return (
    <div className="loja-store-produto-gallery">
      <div
        className="loja-store-produto-gallery-main"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {current.tipo === 'video' ? (
          <video
            key={current.url}
            ref={videoRef}
            className="loja-store-produto-gallery-video"
            src={current.url}
            autoPlay
            muted
            loop
            playsInline
            controls
            preload="auto"
            controlsList="nodownload"
          >
            Seu navegador não reproduz este vídeo.
          </video>
        ) : (
          <img src={current.url} alt={alt} loading="eager" decoding="async" />
        )}
        {hasMultiple && (
          <>
            <button
              type="button"
              className="loja-store-produto-gallery-nav loja-store-produto-gallery-nav--prev"
              onClick={goPrev}
              aria-label="Mídia anterior"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              className="loja-store-produto-gallery-nav loja-store-produto-gallery-nav--next"
              onClick={goNext}
              aria-label="Próxima mídia"
            >
              <ChevronRight size={20} />
            </button>
            <span className="loja-store-produto-gallery-counter" aria-live="polite">
              {safeActive + 1}/{midias.length}
            </span>
          </>
        )}
      </div>

      {hasMultiple && (
        <div className="loja-store-produto-gallery-thumbs" role="tablist" aria-label="Mídias do produto">
          {midias.map((item, i) => (
            <button
              key={item.url + i}
              type="button"
              role="tab"
              aria-selected={i === safeActive}
              className={i === safeActive ? 'is-active' : ''}
              onClick={() => setActive(i)}
              aria-label={`${item.tipo === 'video' ? 'Vídeo' : 'Imagem'} ${i + 1} de ${midias.length}`}
            >
              {item.tipo === 'video' ? (
                <span className="loja-store-produto-gallery-thumb-video">
                  <video src={item.url} muted playsInline preload="metadata" />
                  <Play size={12} aria-hidden />
                </span>
              ) : (
                <img src={item.url} alt="" loading="lazy" decoding="async" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
