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

function instantScrollTo(el: HTMLElement, left: number) {
  const snap = el.style.scrollSnapType
  const behavior = el.style.scrollBehavior
  el.style.scrollSnapType = 'none'
  el.style.scrollBehavior = 'auto'
  el.scrollTo({ left, behavior: 'auto' })
  el.style.scrollSnapType = snap
  el.style.scrollBehavior = behavior
}

function getTrackSizes(el: HTMLDivElement) {
  const firstCard = el.querySelector<HTMLElement>('.loja-galaxy-card')
  const gap = parseFloat(getComputedStyle(el).gap) || 14
  const cardW = firstCard?.offsetWidth ?? 220
  const scrollStep = cardW + gap
  return { cardW, gap, scrollStep }
}

function getLoopOffset(scrollLeft: number, setWidth: number) {
  if (setWidth <= 0) return 0
  return ((scrollLeft % setWidth) + setWidth) % setWidth
}

function readMetrics(el: HTMLDivElement, itemCount: number, loop: boolean): CarouselMetrics {
  const { scrollStep } = getTrackSizes(el)
  const visible = Math.max(1, Math.floor((el.clientWidth + (parseFloat(getComputedStyle(el).gap) || 14)) / scrollStep))
  const pageCount =
    itemCount <= 1 ? 1 : loop ? itemCount : Math.max(1, Math.ceil((itemCount - visible) / visible) + 1)
  const setWidth = itemCount * scrollStep

  let activePage = 0
  if (itemCount > 1 && scrollStep > 0) {
    const offset = loop ? getLoopOffset(el.scrollLeft, setWidth) : el.scrollLeft
    activePage = Math.min(pageCount - 1, Math.max(0, Math.round(offset / scrollStep) % Math.max(1, itemCount)))
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
  const indexRef = useRef(0)
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
    const next = readMetrics(el, produtos.length, loop)
    indexRef.current = next.activePage
    setMetrics(next)
  }, [produtos.length, loop])

  const wrapToMiddleSet = useCallback(() => {
    const el = trackRef.current
    if (!el || !loop || jumpingRef.current) return false

    const { setWidth } = readMetrics(el, produtos.length, true)
    if (setWidth <= 0) return false

    let left = el.scrollLeft
    if (left >= setWidth * 2) left -= setWidth
    else if (left < setWidth) left += setWidth
    else return false

    jumpingRef.current = true
    instantScrollTo(el, left)
    requestAnimationFrame(() => {
      jumpingRef.current = false
      refresh()
    })
    return true
  }, [loop, produtos.length, refresh])

  const scrollToIndex = useCallback(
    (index: number, smooth: boolean) => {
      const el = trackRef.current
      if (!el) return
      const { setWidth, scrollStep } = readMetrics(el, produtos.length, loop)
      if (scrollStep <= 0) return
      const bounded = ((index % produtos.length) + produtos.length) % produtos.length
      indexRef.current = bounded
      const left = loop ? setWidth + bounded * scrollStep : bounded * scrollStep
      if (smooth) el.scrollTo({ left, behavior: 'smooth' })
      else instantScrollTo(el, left)
    },
    [loop, produtos.length]
  )

  useLayoutEffect(() => {
    scrollToIndex(0, false)
    const id = requestAnimationFrame(() => {
      scrollToIndex(indexRef.current, false)
      refresh()
    })
    return () => cancelAnimationFrame(id)
  }, [slides, scrollToIndex, refresh])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return

    let settleTimer: number | undefined
    const onScroll = () => {
      if (jumpingRef.current) return
      refresh()
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(() => {
        wrapToMiddleSet()
      }, 140)
    }

    const onScrollEnd = () => {
      window.clearTimeout(settleTimer)
      wrapToMiddleSet()
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('scrollend', onScrollEnd)
    const ro = new ResizeObserver(() => {
      scrollToIndex(indexRef.current, false)
      refresh()
    })
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('scrollend', onScrollEnd)
      ro.disconnect()
      window.clearTimeout(settleTimer)
    }
  }, [refresh, scrollToIndex, wrapToMiddleSet])

  const pauseAutoplay = useCallback((durationMs = AUTOPLAY_PAUSE_AFTER_INTERACTION_MS) => {
    pausedRef.current = true
    window.clearTimeout(pauseTimerRef.current)
    pauseTimerRef.current = window.setTimeout(() => {
      pausedRef.current = false
    }, durationMs)
  }, [])

  const scrollByStep = useCallback(
    (dir: -1 | 1) => {
      const el = trackRef.current
      if (!el) return
      const wrapped = wrapToMiddleSet()
      const run = () => {
        const { scrollStep } = getTrackSizes(el)
        el.scrollBy({ left: dir * scrollStep, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
      }
      if (wrapped) requestAnimationFrame(run)
      else run()
    },
    [wrapToMiddleSet]
  )

  useEffect(() => {
    if (!loop || prefersReducedMotion()) return

    const tick = () => {
      if (pausedRef.current || document.hidden || jumpingRef.current) return
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
    if (produtos.length <= 1) return
    const current = indexRef.current
    if (loop) {
      let delta = page - current
      const half = produtos.length / 2
      if (delta > half) delta -= produtos.length
      if (delta < -half) delta += produtos.length
      if (delta === 0) return
      const el = trackRef.current
      if (!el) return
      wrapToMiddleSet()
      const { scrollStep } = getTrackSizes(el)
      el.scrollBy({ left: delta * scrollStep, behavior: 'smooth' })
      return
    }
    scrollToIndex(page, true)
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
