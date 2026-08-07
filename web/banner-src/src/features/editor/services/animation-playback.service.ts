import type { FabricObject } from 'fabric'
import type { ElementState, LayerAnimation } from '@/core/types/animation.types'
import { getAnimatedState } from '@/features/editor/services/animation-interpolation'
import { canvasEngine } from '@/features/editor/services/canvas.engine'

export class AnimationPlaybackService {
  private rafId: number | null = null
  private lastTimestamp = 0
  private restStates = new Map<string, ElementState>()
  private isPreviewing = false
  private onTick: ((time: number) => void) | null = null

  readObjectState(obj: FabricObject): ElementState {
    return {
      left: obj.left ?? 0,
      top: obj.top ?? 0,
      scaleX: obj.scaleX ?? 1,
      scaleY: obj.scaleY ?? 1,
      angle: obj.angle ?? 0,
      opacity: obj.opacity ?? 1,
    }
  }

  /** Read current canvas positions into rest states — never moves objects */
  captureRestStatesFromCanvas(): void {
    for (const obj of canvasEngine.getObjects()) {
      const layerId = obj.get('layerId') as string | undefined
      if (!layerId || obj.get('layerType') === 'background') continue
      this.restStates.set(layerId, this.readObjectState(obj))
    }

    this.isPreviewing = false
  }

  restoreRestStates(): void {
    if (this.restStates.size > 0) {
      for (const [layerId, state] of this.restStates) {
        this.applyState(layerId, state)
      }
    }

    for (const obj of canvasEngine.getObjects()) {
      if (obj.get('layerType') === 'background') continue

      const layerId = obj.get('layerId') as string | undefined
      if (layerId && this.restStates.has(layerId)) continue

      if (!obj.visible || (obj.opacity ?? 1) < 0.01) {
        obj.set({ visible: true, opacity: 1 })
        obj.setCoords()
      }
    }

    canvasEngine.getCanvas()?.requestRenderAll()
    this.isPreviewing = false
  }

  exitPreview(): void {
    if (!this.isPreviewing) return

    this.stopLoop()
    this.restoreRestStates()
    this.onTick = null
  }

  /** After user edits the canvas, save new positions without reverting them */
  commitEditsToRestStates(): void {
    if (this.isPreviewing) return
    this.captureRestStatesFromCanvas()
  }

  /** Leave preview/scrub and show the design-time appearance of all layers */
  restoreDesignMode(): void {
    this.stopLoop()
    this.onTick = null

    if (this.restStates.size > 0) {
      this.restoreRestStates()
    } else {
      this.fixStrandedPreviewObjects()
    }

    this.isPreviewing = false
    canvasEngine.setInteractionEnabled(true)
  }

  private fixStrandedPreviewObjects(): void {
    for (const obj of canvasEngine.getObjects()) {
      if (obj.get('layerType') === 'background') continue
      if (!obj.visible) continue
      if ((obj.opacity ?? 1) < 0.01) {
        obj.set({ opacity: 1 })
        obj.setCoords()
      }
    }
    canvasEngine.getCanvas()?.requestRenderAll()
  }

  ensureRestStates(): void {
    if (this.restStates.size === 0) {
      this.captureRestStatesFromCanvas()
    }
  }

  applyState(layerId: string, state: ElementState): void {
    const obj = canvasEngine.getObjectByLayerId(layerId)
    if (!obj) return

    obj.set({
      left: state.left,
      top: state.top,
      scaleX: state.scaleX,
      scaleY: state.scaleY,
      angle: state.angle,
      opacity: state.opacity,
      visible: true,
    })
    obj.setCoords()
  }

  seek(
    timeMs: number,
    animations: Record<string, LayerAnimation>,
    duration: number,
  ): void {
    this.ensureRestStates()

    const clampedTime = Math.min(Math.max(timeMs, 0), duration)
    this.isPreviewing = true

    for (const [layerId, base] of this.restStates) {
      const animation = animations[layerId]
      if (!animation) {
        this.applyState(layerId, base)
        continue
      }

      const state = getAnimatedState(base, animation, clampedTime)
      this.applyState(layerId, state)
    }

    for (const obj of canvasEngine.getObjects()) {
      const layerId = obj.get('layerId') as string | undefined
      if (!layerId || obj.get('layerType') === 'background') continue
      if (this.restStates.has(layerId)) continue
      obj.set({ visible: true, opacity: obj.opacity ?? 1 })
      obj.setCoords()
    }

    canvasEngine.getCanvas()?.requestRenderAll()
    this.onTick?.(clampedTime)
  }

  play(
    startTimeMs: number,
    duration: number,
    animations: Record<string, LayerAnimation>,
    onTick: (time: number) => void,
    onFinish: () => void,
  ): void {
    this.stopLoop()

    if (this.isPreviewing) {
      this.restoreRestStates()
    }

    this.ensureRestStates()
    if (!canvasEngine.isPlaybackModeActive()) {
      canvasEngine.setInteractionEnabled(false)
    }

    this.onTick = onTick

    let currentTime = startTimeMs
    this.lastTimestamp = performance.now()

    const tick = (timestamp: number) => {
      const delta = timestamp - this.lastTimestamp
      this.lastTimestamp = timestamp
      currentTime = Math.min(currentTime + delta, duration)

      this.seek(currentTime, animations, duration)

      if (currentTime >= duration) {
        this.stopLoop()
        onFinish()
        return
      }

      this.rafId = requestAnimationFrame(tick)
    }

    this.seek(currentTime, animations, duration)
    this.rafId = requestAnimationFrame(tick)
  }

  pause(): void {
    this.stopLoop()
  }

  stop(): void {
    this.restoreDesignMode()
  }

  isInPreview(): boolean {
    return this.isPreviewing
  }

  isAnimating(): boolean {
    return this.rafId !== null
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }
}

export const animationPlaybackService = new AnimationPlaybackService()
