import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { LojaOnlineProduto } from '../../lib/loja-online-types'
import {
  LojaOnlineProductCard,
  type LojaOnlineProdutoAvaliacaoResumo,
} from './LojaOnlineProductCard'

type SlideItem = { produto: LojaOnlineProduto; slideKey: string }

type CarouselMetrics = {
  pageCount: number
  activePage: number
  scrollStep: number
  setWidth: number
}

const AUTOPLAY_INTERVAL_MS = 4500
const AUTOPLAY_PAUSE_AFTER_INTERACTION_MS = 8000

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function getTrackSizes(el: HTMLDivElement) {
  const firstCard = el.querySelector<HTMLElement>('.loja-galaxy-card')
  const gap = parseFloat(getComputedStyle(el).gap) || 14
  const cardW = firstCard?.offsetWidth ?? 220
  const scrollStep = cardW + gap
  return { cardW, gap, scrollStep }
}

function readMetrics(el: HTMLDivElement, itemCount: number, loop: boolean): CarouselMetrics {
  const { scrollStep } = getTrackSizes(el)
  const visible = Math.max(1, Math.floor((el.clientWidth + parseFloat(getComputedStyle(el).gap) || 14) / scrollStep))
  const pageCount =
    itemCount <= 1 ? 1 : loop ? itemCount : Math.max(1, Math.ceil((itemCount - visible) / visible) + 1)
  const setWidth = itemCount * scrollStep

  let activePage = 0
  if (itemCount > 1) {
    const relative = loop ? el.scrollLeft - setWidth : el.scrollLeft
    const maxRelative = loop ? setWidth - el.clientWidth : Math.max(0, el.scrollWidth - el.clientWidth)
    if (maxRelative > 2) {
      activePage = Math.min(
        pageCount - 1,
        Math.max(0, Math.round((relative / maxRelative) * (pageCount - 1)))
      )
    }
  }

  return { pageCount, activePage, scrollStep, setWidth }
}

export function LojaOnlineFeaturedCarousel({
  produtos,
  avaliacoes,
}: {
  produtos: LojaOnlineProduto[]
  avaliacoes: Map<string, LojaOnlineProdutoAvaliacaoResumo>
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)
  const jumpingRef = useRef(false)
  const pausedRef = useRef(false)
  const pauseTimerRef = useRef<number | undefined>(undefined)
  const loop = produtos.length > 1

  const slides = useMemo<SlideItem[]>(() => {
    if (!loop) return produtos.map((p) => ({ produto: p, slideKey: p.id }))
    const triple = [...produtos, ...produtos, ...produtos]
    return triple.map((p, i) => ({ produto: p, slideKey: `${p.id}-${i}` }))
  }, [produtos, loop])

  const [metrics, setMetrics] = useState<CarouselMetrics>({
    pageCount: 1,
    activePage: 0,
    scrollStep: 240,
    setWidth: 0,
  })

  const refresh = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setMetrics(readMetrics(el, produtos.length, loop))
  }, [produtos.length, loop])

  const normalizeInfiniteScroll = useCallback(() => {
    const el = trackRef.current
    if (!el || !loop || jumpingRef.current) return

    const { setWidth } = readMetrics(el, produtos.length, true)
    if (setWidth <= 0) return

    const jump = (delta: number) => {
      jumpingRef.current = true
      el.style.scrollSnapType = 'none'
      el.scrollLeft += delta
      requestAnimationFrame(() => {
        el.style.scrollSnapType = ''
        jumpingRef.current = false
        refresh()
      })
    }

    if (el.scrollLeft < setWidth * 0.35) {
      jump(setWidth)
    } else if (el.scrollLeft > setWidth * 2.05) {
      jump(-setWidth)
    }
  }, [loop, produtos.length, refresh])

  const scrollToMiddleSet = useCallback(() => {
    const el = trackRef.current
    if (!el || !loop) return
    const { setWidth } = readMetrics(el, produtos.length, true)
    if (setWidth <= 0) return
    jumpingRef.current = true
    el.style.scrollBehavior = 'auto'
    el.scrollLeft = setWidth
    el.style.scrollBehavior = ''
    jumpingRef.current = false
    refresh()
  }, [loop, produtos.length, refresh])

  useLayoutEffect(() => {
    scrollToMiddleSet()
    const id = requestAnimationFrame(() => {
      scrollToMiddleSet()
      refresh()
    })
    const t = window.setTimeout(() => {
      scrollToMiddleSet()
      refresh()
    }, 150)
    return () => {
      cancelAnimationFrame(id)
      window.clearTimeout(t)
    }
  }, [slides, scrollToMiddleSet, refresh])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return

    let scrollEndTimer: number | undefined
    const onScroll = () => {
      if (!jumpingRef.current) refresh()
      window.clearTimeout(scrollEndTimer)
      scrollEndTimer = window.setTimeout(normalizeInfiniteScroll, 80)
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(() => {
      scrollToMiddleSet()
      refresh()
    })
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
      window.clearTimeout(scrollEndTimer)
    }
  }, [normalizeInfiniteScroll, refresh, scrollToMiddleSet])

  const pauseAutoplay = useCallback((durationMs = AUTOPLAY_PAUSE_AFTER_INTERACTION_MS) => {
    pausedRef.current = true
    window.clearTimeout(pauseTimerRef.current)
    pauseTimerRef.current = window.setTimeout(() => {
      pausedRef.current = false
    }, durationMs)
  }, [])

  const scrollByStep = useCallback((dir: -1 | 1) => {
    const el = trackRef.current
    if (!el) return
    const { scrollStep } = getTrackSizes(el)
    el.scrollBy({ left: dir * scrollStep, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (!loop || prefersReducedMotion()) return

    const tick = () => {
      if (pausedRef.current || document.hidden) return
      scrollByStep(1)
    }

    const id = window.setInterval(tick, AUTOPLAY_INTERVAL_MS)
    const onVisibility = () => {
      if (!document.hidden) pauseAutoplay(AUTOPLAY_INTERVAL_MS)
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(id)
      window.clearTimeout(pauseTimerRef.current)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [loop, scrollByStep, pauseAutoplay, produtos.length])

  const scrollByPage = (dir: -1 | 1) => {
    pauseAutoplay()
    scrollByStep(dir)
  }

  const goToPage = (page: number) => {
    pauseAutoplay()
    const el = trackRef.current
    if (!el || produtos.length <= 1) return
    const { setWidth, scrollStep } = readMetrics(el, produtos.length, loop)
    if (loop) {
      const visible = Math.max(1, Math.floor(el.clientWidth / scrollStep))
      const maxOffset = Math.max(0, produtos.length - visible)
      const offset = Math.round((page / Math.max(1, metrics.pageCount - 1)) * maxOffset)
      el.scrollTo({ left: setWidth + offset * scrollStep, behavior: 'smooth' })
      return
    }
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth)
    const target = metrics.pageCount <= 1 ? 0 : (maxScroll / (metrics.pageCount - 1)) * page
    el.scrollTo({ left: target, behavior: 'smooth' })
  }

  if (produtos.length === 0) return null

  const showControls = produtos.length > 1

  return (
    <section className="loja-store-featured" aria-label="Produtos em destaque">
      <div className="loja-store-featured-inner">
        <h2 className="loja-store-featured-title">Destaques da semana</h2>

        <div
          ref={sliderRef}
          className="loja-store-featured-slider"
          onMouseEnter={() => {
            pausedRef.current = true
          }}
          onMouseLeave={() => {
            pausedRef.current = false
          }}
          onTouchStart={() => pauseAutoplay()}
          onFocusCapture={() => {
            pausedRef.current = true
          }}
          onBlurCapture={(e) => {
            const next = e.relatedTarget
            if (!sliderRef.current?.contains(next instanceof Node ? next : null)) {
              pausedRef.current = false
            }
          }}
        >
          {showControls && (
            <button
              type="button"
              className="loja-store-featured-nav loja-store-featured-nav--prev"
              onClick={() => scrollByPage(-1)}
              aria-label="Produtos anteriores"
            >
              <ChevronLeft size={24} strokeWidth={2} />
            </button>
          )}

          <div ref={trackRef} className="loja-store-featured-track">
            {slides.map(({ produto, slideKey }) => (
              <LojaOnlineProductCard
                key={slideKey}
                produto={produto}
                avaliacao={avaliacoes.get(produto.id)}
                onMediaLoad={refresh}
                variant="carousel"
              />
            ))}
          </div>

          {showControls && (
            <button
              type="button"
              className="loja-store-featured-nav loja-store-featured-nav--next"
              onClick={() => scrollByPage(1)}
              aria-label="Próximos produtos"
            >
              <ChevronRight size={24} strokeWidth={2} />
            </button>
          )}
        </div>

        {showControls && (
          <div className="loja-store-featured-dots" role="tablist" aria-label="Páginas do carrossel">
            {Array.from({ length: metrics.pageCount }, (_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === metrics.activePage}
                aria-label={`Página ${i + 1}`}
                className={i === metrics.activePage ? 'is-active' : ''}
                onClick={() => goToPage(i)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
