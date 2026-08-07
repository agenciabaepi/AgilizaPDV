import type { MouseEvent } from 'react'

const LANDING_SCROLL_KEY = 'landing-scroll-target'

export function queueLandingScroll(sectionId: string) {
  sessionStorage.setItem(LANDING_SCROLL_KEY, sectionId)
}

export function consumeLandingScroll(): string | null {
  const target = sessionStorage.getItem(LANDING_SCROLL_KEY)
  if (target) sessionStorage.removeItem(LANDING_SCROLL_KEY)
  return target
}

function getScrollContainer(): HTMLElement {
  const root = document.getElementById('root')
  if (root && root.scrollHeight > root.clientHeight + 1) return root
  return document.documentElement
}

export function scrollToLandingSection(sectionId: string) {
  const el = document.getElementById(sectionId)
  if (!el) return false

  const nav = document.querySelector<HTMLElement>('.landing-section--nav')
  const navH = nav?.offsetHeight ?? 84
  const container = getScrollContainer()
  const containerTop =
    container === document.documentElement ? window.scrollY : container.scrollTop

  const elTop = el.getBoundingClientRect().top
  const top = Math.max(0, containerTop + elTop - navH - 12)

  container.scrollTo({ top, behavior: 'smooth' })
  return true
}

export function handleLandingSectionClick(
  event: MouseEvent<HTMLAnchorElement>,
  sectionId: string
) {
  event.preventDefault()
  scrollToLandingSection(sectionId)
}
