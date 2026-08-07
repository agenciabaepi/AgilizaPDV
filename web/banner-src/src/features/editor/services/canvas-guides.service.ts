import { Point, type Canvas, type FabricObject, type TEvent } from 'fabric'
import { AligningGuidelines } from 'fabric/extensions/aligning_guidelines'
import type { GuideSettings } from '@/core/types/banner.types'
import {
  CENTER_GUIDE_COLOR,
  CENTER_SNAP_MARGIN,
  DEFAULT_GRID_SIZE,
  GUIDE_COLOR,
  SNAP_MARGIN,
} from '@/core/constants/editor.constants'

export const DEFAULT_GUIDE_SETTINGS: GuideSettings = {
  showGrid: true,
  gridSize: DEFAULT_GRID_SIZE,
  snapToGrid: false,
  showGuides: true,
  snapToCenter: true,
}

export const PLAYBACK_GUIDE_SETTINGS: GuideSettings = {
  showGrid: false,
  gridSize: DEFAULT_GRID_SIZE,
  snapToGrid: false,
  showGuides: false,
  snapToCenter: false,
}

type MovingEvent = TEvent & { target: FabricObject }

export class CanvasGuidesService {
  private canvas: Canvas | null = null
  private aligningGuidelines: AligningGuidelines | null = null
  private settings: GuideSettings = { ...DEFAULT_GUIDE_SETTINGS }

  private isVerticalCenter = false
  private isHorizontalCenter = false

  private readonly onMoving = (event: MovingEvent) => this.handleMoving(event)
  private readonly onMouseUp = () => this.handleMouseUp()
  private readonly onBeforeRender = () => this.handleBeforeRender()
  private readonly onAfterRender = () => this.handleAfterRender()

  init(canvas: Canvas, settings: GuideSettings = DEFAULT_GUIDE_SETTINGS): void {
    this.dispose()
    this.canvas = canvas
    this.settings = { ...settings }

    canvas.on('object:moving', this.onMoving)
    canvas.on('mouse:up', this.onMouseUp)
    canvas.on('before:render', this.onBeforeRender)
    canvas.on('after:render', this.onAfterRender)

    this.syncAligningGuidelines()
  }

  updateSettings(settings: GuideSettings): void {
    this.settings = { ...settings }
    this.syncAligningGuidelines()
  }

  updateDimensions(): void {
    this.isVerticalCenter = false
    this.isHorizontalCenter = false
    this.canvas?.requestRenderAll()
  }

  dispose(): void {
    this.destroyAligningGuidelines()

    if (this.canvas) {
      this.canvas.off('object:moving', this.onMoving)
      this.canvas.off('mouse:up', this.onMouseUp)
      this.canvas.off('before:render', this.onBeforeRender)
      this.canvas.off('after:render', this.onAfterRender)
    }

    this.canvas = null
    this.isVerticalCenter = false
    this.isHorizontalCenter = false
  }

  private syncAligningGuidelines(): void {
    if (!this.canvas) return

    if (this.settings.showGuides) {
      if (!this.aligningGuidelines) {
        const guidelines = new AligningGuidelines(this.canvas, {
          margin: SNAP_MARGIN,
          color: GUIDE_COLOR,
          width: 1,
        })

        guidelines.getObjectsByTarget = (target) => {
          const objects = new Set<FabricObject>()
          if (!this.canvas) return objects

          for (const obj of this.canvas.getObjects()) {
            if (obj === target) continue
            if (obj.get('layerType') === 'background') continue
            if (!obj.visible) continue
            objects.add(obj)
          }

          return objects
        }

        this.aligningGuidelines = guidelines
      }
      return
    }

    this.destroyAligningGuidelines()
  }

  private destroyAligningGuidelines(): void {
    this.aligningGuidelines?.dispose()
    this.aligningGuidelines = null
  }

  private handleMoving(e: MovingEvent): void {
    const target = e.target
    if (!this.canvas || target.get('layerType') === 'background') return

    target.setCoords()

    if (this.settings.snapToCenter) {
      const centerSnap = this.snapToCanvasCenter(target)
      this.isVerticalCenter = centerSnap.vertical
      this.isHorizontalCenter = centerSnap.horizontal
    } else {
      this.isVerticalCenter = false
      this.isHorizontalCenter = false
    }

    if (
      this.settings.snapToGrid &&
      !this.isVerticalCenter &&
      !this.isHorizontalCenter
    ) {
      this.snapToGrid(target)
    }
  }

  private snapToCanvasCenter(target: FabricObject): {
    vertical: boolean
    horizontal: boolean
  } {
    if (!this.canvas) return { vertical: false, horizontal: false }

    const width = this.canvas.width ?? 0
    const height = this.canvas.height ?? 0
    const centerX = width / 2
    const centerY = height / 2
    const objectCenter = target.getCenterPoint()

    let vertical = false
    let horizontal = false
    let nextX = objectCenter.x
    let nextY = objectCenter.y

    if (Math.abs(objectCenter.x - centerX) <= CENTER_SNAP_MARGIN) {
      nextX = centerX
      vertical = true
    }

    if (Math.abs(objectCenter.y - centerY) <= CENTER_SNAP_MARGIN) {
      nextY = centerY
      horizontal = true
    }

    if (vertical || horizontal) {
      target.setPositionByOrigin(new Point(nextX, nextY), 'center', 'center')
      target.setCoords()
    }

    return { vertical, horizontal }
  }

  private snapToGrid(target: FabricObject): void {
    const gridSize = this.settings.gridSize
    if (gridSize <= 0) return

    const center = target.getCenterPoint()
    const snappedX = Math.round(center.x / gridSize) * gridSize
    const snappedY = Math.round(center.y / gridSize) * gridSize

    target.setPositionByOrigin(new Point(snappedX, snappedY), 'center', 'center')
    target.setCoords()
  }

  private handleMouseUp(): void {
    this.isVerticalCenter = false
    this.isHorizontalCenter = false
    this.canvas?.requestRenderAll()
  }

  private handleBeforeRender(): void {
    if (!this.canvas?.contextTop || !this.shouldDrawCenterGuides()) return
    this.canvas.clearContext(this.canvas.contextTop)
  }

  private handleAfterRender(): void {
    if (!this.shouldDrawCenterGuides()) return
    if (!this.isVerticalCenter && !this.isHorizontalCenter) return

    const ctx = this.canvas?.contextTop
    if (!ctx || !this.canvas) return

    const width = this.canvas.width ?? 0
    const height = this.canvas.height ?? 0

    ctx.save()
    ctx.strokeStyle = CENTER_GUIDE_COLOR
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])

    if (this.isVerticalCenter) {
      ctx.beginPath()
      ctx.moveTo(width / 2 + 0.5, 0)
      ctx.lineTo(width / 2 + 0.5, height)
      ctx.stroke()
    }

    if (this.isHorizontalCenter) {
      ctx.beginPath()
      ctx.moveTo(0, height / 2 + 0.5)
      ctx.lineTo(width, height / 2 + 0.5)
      ctx.stroke()
    }

    ctx.restore()
  }

  private shouldDrawCenterGuides(): boolean {
    return this.settings.snapToCenter || this.settings.showGuides
  }
}

export const canvasGuidesService = new CanvasGuidesService()
