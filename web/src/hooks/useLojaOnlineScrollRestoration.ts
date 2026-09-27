import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

function readScrollY(root: HTMLElement | null) {
  return Math.max(window.scrollY || 0, root?.scrollTop || 0)
}

function scrollToY(root: HTMLElement | null, y: number) {
  if (root) root.scrollTop = y
  window.scrollTo(0, y)
}

/**
 * Quem rola a página é o #root (html/body têm altura fixa), então o navegador não volta ao topo
 * sozinho ao trocar de rota. Nova página abre no topo; voltar/avançar restaura a posição anterior.
 */
export function useLojaOnlineScrollRestoration() {
  const location = useLocation()
  const navType = useNavigationType()
  const positions = useRef(new Map<string, number>())
  const lastKey = useRef(location.key)
  const lastY = useRef(0)
  const paused = useRef(false)

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
    const root = document.getElementById('root')
    const onScroll = () => {
      if (!paused.current) lastY.current = readScrollY(root)
    }
    root?.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      root?.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  useLayoutEffect(() => {
    if (lastKey.current === location.key) return
    const root = document.getElementById('root')
    positions.current.set(lastKey.current, lastY.current)
    lastKey.current = location.key

    const alvo = navType === 'POP' ? (positions.current.get(location.key) ?? 0) : 0
    paused.current = true
    scrollToY(root, alvo)
    lastY.current = alvo

    // A página de destino pode ainda estar carregando; tenta de novo até ela ter altura suficiente.
    const fim = performance.now() + (alvo > 0 ? 2000 : 150)
    let raf = 0
    const tentar = () => {
      const chegou = Math.abs(readScrollY(root) - alvo) < 2
      if ((chegou && alvo === 0) || performance.now() > fim || (chegou && alvo > 0)) {
        paused.current = false
        lastY.current = readScrollY(root)
        return
      }
      scrollToY(root, alvo)
      raf = requestAnimationFrame(tentar)
    }
    raf = requestAnimationFrame(tentar)

    const desistir = () => {
      cancelAnimationFrame(raf)
      paused.current = false
    }
    root?.addEventListener('wheel', desistir, { passive: true, once: true })
    root?.addEventListener('touchstart', desistir, { passive: true, once: true })
    return () => {
      cancelAnimationFrame(raf)
      paused.current = false
      root?.removeEventListener('wheel', desistir)
      root?.removeEventListener('touchstart', desistir)
    }
  }, [location.key, navType])
}
