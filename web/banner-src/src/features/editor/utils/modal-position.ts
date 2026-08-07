import type { FabricObject } from 'fabric'
import {
  FLOATING_UI,
  MODAL_MAX_HEIGHT,
  MODAL_WIDTH,
  clamp,
  fitsInSafeArea,
  getObjectScreenRect,
  getSafeArea,
  rectsOverlap,
} from './floating-position'
import type { ModalPosition } from '@/core/types/ui.types'

export function computeModalPosition(
  object: FabricObject,
  frameElement: HTMLElement,
  zoom: number,
): ModalPosition {
  const rect = getObjectScreenRect(object, frameElement, zoom)
  const safe = getSafeArea(frameElement)

  const candidates = [
    { x: rect.right + FLOATING_UI.GAP, y: rect.top, label: 'right' },
    { x: rect.left - MODAL_WIDTH - FLOATING_UI.GAP, y: rect.top, label: 'left' },
    {
      x: rect.centerX - MODAL_WIDTH / 2,
      y: rect.bottom + FLOATING_UI.GAP,
      label: 'below',
    },
    {
      x: rect.centerX - MODAL_WIDTH / 2,
      y: rect.top - MODAL_MAX_HEIGHT - FLOATING_UI.GAP,
      label: 'above',
    },
  ]

  let best: ModalPosition = {
    x: clamp(rect.right + FLOATING_UI.GAP, safe.left, safe.right - MODAL_WIDTH),
    y: clamp(rect.top, safe.top, safe.bottom - MODAL_MAX_HEIGHT),
  }
  let bestScore = -Infinity

  for (const candidate of candidates) {
    const modalBox = {
      left: candidate.x,
      top: candidate.y,
      right: candidate.x + MODAL_WIDTH,
      bottom: candidate.y + MODAL_MAX_HEIGHT,
    }

    let score = 0

    if (!rectsOverlap(modalBox, rect, FLOATING_UI.GAP)) score += 100
    if (fitsInSafeArea(candidate.x, candidate.y, MODAL_WIDTH, MODAL_MAX_HEIGHT, safe)) {
      score += 80
    } else {
      score -= 50
    }

    const visibleWidth =
      Math.min(modalBox.right, safe.right) - Math.max(modalBox.left, safe.left)
    const visibleHeight =
      Math.min(modalBox.bottom, safe.bottom) - Math.max(modalBox.top, safe.top)
    score += (visibleWidth * visibleHeight) / (MODAL_WIDTH * MODAL_MAX_HEIGHT)

    if (candidate.label === 'right') score += 5

    if (score > bestScore) {
      bestScore = score
      best = { x: candidate.x, y: candidate.y }
    }
  }

  best.x = clamp(best.x, safe.left, safe.right - MODAL_WIDTH)
  best.y = clamp(best.y, safe.top, safe.bottom - MODAL_MAX_HEIGHT)

  if (rectsOverlap(
    {
      left: best.x,
      top: best.y,
      right: best.x + MODAL_WIDTH,
      bottom: best.y + MODAL_MAX_HEIGHT,
    },
    rect,
    FLOATING_UI.GAP / 2,
  )) {
    best = {
      x: clamp(safe.left + 8, safe.left, safe.right - MODAL_WIDTH),
      y: clamp(safe.top + 8, safe.top, safe.bottom - MODAL_MAX_HEIGHT),
    }
  }

  return best
}

export function computeCenteredModalPosition(): ModalPosition {
  const safe = getSafeArea()
  const x = clamp(
    (window.innerWidth - MODAL_WIDTH) / 2,
    safe.left,
    safe.right - MODAL_WIDTH,
  )
  const y = clamp(
    (window.innerHeight - MODAL_MAX_HEIGHT) / 2,
    safe.top,
    safe.bottom - MODAL_MAX_HEIGHT,
  )
  return { x, y }
}

export { MODAL_WIDTH, MODAL_MAX_HEIGHT }
