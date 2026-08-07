import type { FabricObject } from 'fabric'
import {
  FLOATING_UI,
  clamp,
  getObjectScreenRect,
  getSafeArea,
  type SafeArea,
} from './floating-position'

export type ToolbarPlacement = 'above' | 'below'
export type MenuPlacement = 'above' | 'below'

export interface ToolbarPosition {
  x: number
  top: number
  placement: ToolbarPlacement
  menuPlacement: MenuPlacement
}

interface ToolbarOptions {
  menuOpen?: boolean
}

function bundleHeight(menuOpen: boolean): number {
  return (
    FLOATING_UI.TOOLBAR_HEIGHT +
    FLOATING_UI.GAP +
    (menuOpen ? FLOATING_UI.MENU_HEIGHT : 0)
  )
}

function computeAboveTop(
  elementTop: number,
  menuOpen: boolean,
  menuPlacement: MenuPlacement,
): number {
  if (menuPlacement === 'above') {
    return elementTop - FLOATING_UI.GAP - bundleHeight(menuOpen)
  }
  return elementTop - FLOATING_UI.GAP - FLOATING_UI.TOOLBAR_HEIGHT
}

function computeBelowTop(elementBottom: number): number {
  return elementBottom + FLOATING_UI.GAP
}

function scoreToolbarCandidate(
  top: number,
  placement: ToolbarPlacement,
  menuPlacement: MenuPlacement,
  menuOpen: boolean,
  element: { top: number; bottom: number },
  safe: SafeArea,
): number {
  const height =
    menuPlacement === 'above' && menuOpen
      ? bundleHeight(true)
      : menuOpen
        ? FLOATING_UI.TOOLBAR_HEIGHT + FLOATING_UI.GAP + FLOATING_UI.MENU_HEIGHT
        : FLOATING_UI.TOOLBAR_HEIGHT

  const box = { top, bottom: top + height }

  let score = 0

  if (box.bottom <= element.top - FLOATING_UI.GAP) score += 100
  if (box.top >= element.bottom + FLOATING_UI.GAP) score += 100

  if (top < safe.top) score -= 200
  if (top + height > safe.bottom) score -= 200

  if (placement === 'above') score += 10
  if (menuPlacement === 'above' && placement === 'above') score += 20

  return score
}

export function computeToolbarPosition(
  object: FabricObject,
  frameElement: HTMLElement,
  zoom: number,
  options: ToolbarOptions = {},
): ToolbarPosition {
  const menuOpen = options.menuOpen ?? false
  const rect = getObjectScreenRect(object, frameElement, zoom)
  const safe = getSafeArea(frameElement)
  const frameRect = frameElement.getBoundingClientRect()

  const hMin = frameRect.left + FLOATING_UI.EDGE_PADDING
  const hMax = frameRect.right - FLOATING_UI.EDGE_PADDING

  const candidates: ToolbarPosition[] = [
    {
      placement: 'above',
      menuPlacement: 'above',
      top: computeAboveTop(rect.top, menuOpen, 'above'),
      x: rect.centerX,
    },
    {
      placement: 'above',
      menuPlacement: 'below',
      top: computeAboveTop(rect.top, menuOpen, 'below'),
      x: rect.centerX,
    },
    {
      placement: 'below',
      menuPlacement: 'below',
      top: computeBelowTop(rect.bottom),
      x: rect.centerX,
    },
    {
      placement: 'below',
      menuPlacement: 'above',
      top: computeBelowTop(rect.bottom),
      x: rect.centerX,
    },
  ]

  let best = candidates[0]
  let bestScore = -Infinity

  for (const candidate of candidates) {
    const score = scoreToolbarCandidate(
      candidate.top,
      candidate.placement,
      candidate.menuPlacement,
      menuOpen,
      rect,
      safe,
    )
    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }

  const height =
    best.menuPlacement === 'above' && menuOpen
      ? bundleHeight(true)
      : menuOpen
        ? FLOATING_UI.TOOLBAR_HEIGHT + FLOATING_UI.GAP + FLOATING_UI.MENU_HEIGHT
        : FLOATING_UI.TOOLBAR_HEIGHT

  const top = clamp(best.top, safe.top, safe.bottom - height)
  const x = clamp(best.x, hMin + 80, hMax - 80)

  return {
    x,
    top,
    placement: best.placement,
    menuPlacement: best.menuPlacement,
  }
}
