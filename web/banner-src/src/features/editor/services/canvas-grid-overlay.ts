import type { Canvas } from 'fabric'
import type { GuideSettings } from '@/core/types/banner.types'

export interface CanvasGridOverlayHandle {
  update(settings: GuideSettings): void
  dispose(): void
}

function applyOverlayStyles(overlay: HTMLDivElement, settings: GuideSettings): void {
  const { showGrid, gridSize, showGuides } = settings

  if (!showGrid && !showGuides) {
    overlay.style.display = 'none'
    return
  }

  overlay.style.display = 'block'

  const layers: string[] = []
  const sizes: string[] = []

  if (showGrid) {
    layers.push(
      'linear-gradient(to right, rgba(99,102,241,0.2) 1px, transparent 1px)',
      'linear-gradient(to bottom, rgba(99,102,241,0.2) 1px, transparent 1px)',
    )
    const size = `${gridSize}px ${gridSize}px`
    sizes.push(size, size)
  }

  if (showGuides) {
    layers.push(
      'linear-gradient(to right, transparent calc(50% - 0.5px), rgba(236,72,153,0.5) calc(50% - 0.5px), rgba(236,72,153,0.5) calc(50% + 0.5px), transparent calc(50% + 0.5px))',
      'linear-gradient(to bottom, transparent calc(50% - 0.5px), rgba(236,72,153,0.5) calc(50% - 0.5px), rgba(236,72,153,0.5) calc(50% + 0.5px), transparent calc(50% + 0.5px))',
    )
    sizes.push('100% 100%', '100% 100%')
  }

  overlay.style.backgroundImage = layers.join(', ')
  overlay.style.backgroundSize = sizes.join(', ')
}

export function attachCanvasGridOverlay(canvas: Canvas): CanvasGridOverlayHandle {
  const wrapper = canvas.wrapperEl
  const upper = canvas.upperCanvasEl
  const overlay = document.createElement('div')
  overlay.className = 'canvas-grid-overlay'
  Object.assign(overlay.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '1',
  })

  wrapper.insertBefore(overlay, upper)

  return {
    update: (settings) => applyOverlayStyles(overlay, settings),
    dispose: () => overlay.remove(),
  }
}
