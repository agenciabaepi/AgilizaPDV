import type { FabricObject } from 'fabric'
import { MODAL_MAX_HEIGHT, MODAL_WIDTH } from '@/core/types/ui.types'

export const FLOATING_UI = {
  GAP: 10,
  TOP_SAFE: 56,
  TIMELINE_HEIGHT: 208,
  EDGE_PADDING: 16,
  TOOLBAR_HEIGHT: 40,
  MENU_HEIGHT: 300,
} as const

export interface ScreenRect {
  left: number
  top: number
  right: number
  bottom: number
  centerX: number
  centerY: number
  width: number
  height: number
}

export interface SafeArea {
  top: number
  bottom: number
  left: number
  right: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function getObjectScreenRect(
  object: FabricObject,
  frameElement: HTMLElement,
  zoom: number,
): ScreenRect {
  const bound = object.getBoundingRect()
  const frameRect = frameElement.getBoundingClientRect()

  const left = frameRect.left + bound.left * zoom
  const top = frameRect.top + bound.top * zoom
  const width = bound.width * zoom
  const height = bound.height * zoom

  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    centerX: left + width / 2,
    centerY: top + height / 2,
    width,
    height,
  }
}

export function getSafeArea(frameElement?: HTMLElement | null): SafeArea {
  const frameRect = frameElement?.getBoundingClientRect()
  const left = Math.max(
    FLOATING_UI.EDGE_PADDING,
    frameRect?.left ?? FLOATING_UI.EDGE_PADDING,
  )
  const right = Math.min(
    window.innerWidth - FLOATING_UI.EDGE_PADDING,
    frameRect?.right ?? window.innerWidth - FLOATING_UI.EDGE_PADDING,
  )

  return {
    top: FLOATING_UI.TOP_SAFE,
    bottom: window.innerHeight - FLOATING_UI.TIMELINE_HEIGHT - FLOATING_UI.EDGE_PADDING,
    left,
    right,
  }
}

export function rectsOverlap(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
  gap = 0,
): boolean {
  return !(
    a.right + gap <= b.left ||
    a.left - gap >= b.right ||
    a.bottom + gap <= b.top ||
    a.top - gap >= b.bottom
  )
}

export function fitsInSafeArea(
  left: number,
  top: number,
  width: number,
  height: number,
  safe: SafeArea,
): boolean {
  return (
    left >= safe.left &&
    top >= safe.top &&
    left + width <= safe.right &&
    top + height <= safe.bottom
  )
}

export { MODAL_WIDTH, MODAL_MAX_HEIGHT }
