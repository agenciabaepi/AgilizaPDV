import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchLojaOnlineCategoriasVitrine } from '../../lib/loja-online-api'
import {
  parseLojaOnlineCategoriasCarrossel,
  parseLojaOnlineCategoriasCarrosselIds,
} from '../../lib/loja-online'
import type { LojaOnlineCategoria } from '../../lib/loja-online-types'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { LojaOnlineCategoriaCard } from './LojaOnlineCategoriaCard'

type SlideItem = { categoria: LojaOnlineCategoria; slideKey: string }

type CarouselMetrics = {
  pageCount: number
  activePage: number
  scrollStep: number
  setWidth: number
}

function isStoreHomeVitrine(pathname: string, search: string, categoriaId: string | null): boolean {
  if (search.trim() || categoriaId) return false
  if (pathname === '/') return true
  const segments = pathname.split('/').filter(Boolean)
  return segments.length === 2 && segments[0] === 'loja'
}

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
  const firstCard = el.querySelector<HTMLElement>('.loja-joog-cat-card')
  const gap = parseFloat(getComputedStyle(el).columnGap || getComputedStyle(el).gap) || 12
  const cardW = firstCard?.offsetWidth ?? 110
  const scrollStep = cardW + gap
  return { cardW, gap, scrollStep }
}

function getLoopOffset(scrollLeft: number, setWidth: number) {
  if (setWidth <= 0) return 0
  return ((scrollLeft % setWidth) + setWidth) % setWidth
}

function readMetrics(el: HTMLDivElement, itemCount: number, loop: boolean): CarouselMetrics {
  const { scrollStep } = getTrackSizes(el)
  const pageCount = itemCount <= 1 ? 1 : itemCount
  const setWidth = itemCount * scrollStep

  let activePage = 0
  if (itemCount > 1 && scrollStep > 0) {
    const offset = loop ? getLoopOffset(el.scrollLeft, setWidth) : el.scrollLeft
    activePage = Math.min(pageCount - 1, Math.max(0, Math.round(offset / scrollStep) % Math.max(1, itemCount)))
  }

  return { pageCount, activePage, scrollStep, setWidth }
}

export function LojaOnlineCategoriasSection({ search }: { search: string }) {
  const { store } = useLojaOnlineStore()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const categoriaId = searchParams.get('categoria')
  const [categorias, setCategorias] = useState<LojaOnlineCategoria[]>([])
  const [loaded, setLoaded] = useState(false)

  const trackRef = useRef<HTMLDivElement>(null)
  const jumpingRef = useRef(false)
  const indexRef = useRef(0)

  const show = isStoreHomeVitrine(pathname, search, categoriaId)
  const loop = categorias.length > 1

  const slides = useMemo<SlideItem[]>(() => {
    if (!loop) return categorias.map((c) => ({ categoria: c, slideKey: c.id }))
    const triple = [...categorias, ...categorias, ...categorias]
    return triple.map((c, i) => ({ categoria: c, slideKey: `${c.id}-${i}` }))
  }, [categorias, loop])

  const [metrics, setMetrics] = useState<CarouselMetrics>({
    pageCount: 1,
    activePage: 0,
    scrollStep: 120,
    setWidth: 0,
  })

  const carrosselModo = parseLojaOnlineCategoriasCarrossel(store?.loja_online_categorias_carrossel)
  const carrosselIds = useMemo(
    () => parseLojaOnlineCategoriasCarrosselIds(store?.loja_online_categorias_carrossel_ids),
    [store?.loja_online_categorias_carrossel_ids]
  )
  const carrosselIdsKey = carrosselIds.join(',')

  useEffect(() => {
    if (!show || !store?.empresa_id) {
      setCategorias([])
      setLoaded(false)
      return
    }
    let cancelled = false
    setLoaded(false)
    fetchLojaOnlineCategoriasVitrine(store.empresa_id, carrosselModo, carrosselIds)
      .then((list) => {
        if (!cancelled) setCategorias(list)
      })
      .catch(() => {
        if (!cancelled) setCategorias([])
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [show, store?.empresa_id, carrosselModo, carrosselIdsKey])

  const refresh = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const next = readMetrics(el, categorias.length, loop)
    indexRef.current = next.activePage
    setMetrics(next)
  }, [categorias.length, loop])

  const wrapToMiddleSet = useCallback(() => {
    const el = trackRef.current
    if (!el || !loop || jumpingRef.current) return false

    const { setWidth } = readMetrics(el, categorias.length, true)
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
  }, [loop, categorias.length, refresh])

  const scrollToIndex = useCallback(
    (index: number, smooth: boolean) => {
      const el = trackRef.current
      if (!el) return
      const { setWidth, scrollStep } = readMetrics(el, categorias.length, loop)
      if (scrollStep <= 0) return
      const bounded = ((index % categorias.length) + categorias.length) % categorias.length
      indexRef.current = bounded
      const left = loop ? setWidth + bounded * scrollStep : bounded * scrollStep
      if (smooth) el.scrollTo({ left, behavior: 'smooth' })
      else instantScrollTo(el, left)
    },
    [loop, categorias.length]
  )

  useLayoutEffect(() => {
    if (categorias.length === 0) return
    scrollToIndex(0, false)
    const id = requestAnimationFrame(() => {
      scrollToIndex(indexRef.current, false)
      refresh()
    })
    return () => cancelAnimationFrame(id)
  }, [slides, scrollToIndex, refresh, categorias.length])

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
  }, [refresh, scrollToIndex, wrapToMiddleSet, categorias.length])

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

  const goToPage = (page: number) => {
    if (categorias.length <= 1) return
    const current = indexRef.current
    if (loop) {
      let delta = page - current
      const half = categorias.length / 2
      if (delta > half) delta -= categorias.length
      if (delta < -half) delta += categorias.length
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

  if (!show || !loaded || categorias.length === 0) return null

  const titulo =
    store?.loja_online_categorias_titulo?.trim() || 'Explore nossas categorias'
  const showControls = categorias.length > 1

  return (
    <section className="loja-joog-cats" aria-labelledby="loja-joog-cats-title">
      <div className="loja-joog-cats-inner">
        <h2 id="loja-joog-cats-title" className="loja-joog-cats-title">
          {titulo}
        </h2>

        <div className="loja-joog-cats-slider">
          {showControls && (
            <button
              type="button"
              className="loja-joog-cats-nav loja-joog-cats-nav--prev"
              onClick={() => scrollByStep(-1)}
              aria-label="Categorias anteriores"
            >
              <ChevronLeft size={22} strokeWidth={2} />
            </button>
          )}

          <div
            ref={trackRef}
            className={`loja-joog-cats-track${categorias.length === 1 ? ' loja-joog-cats-track--single' : ''}`}
          >
            {slides.map(({ categoria, slideKey }) => (
              <LojaOnlineCategoriaCard key={slideKey} categoria={categoria} />
            ))}
          </div>

          {showControls && (
            <button
              type="button"
              className="loja-joog-cats-nav loja-joog-cats-nav--next"
              onClick={() => scrollByStep(1)}
              aria-label="Próximas categorias"
            >
              <ChevronRight size={22} strokeWidth={2} />
            </button>
          )}
        </div>

        {showControls && (
          <div className="loja-joog-cats-dots" role="tablist" aria-label="Páginas das categorias">
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
