import {
  Canvas,
  Circle,
  FabricImage,
  FabricObject,
  Group,
  IText,
  Rect,
  Shadow,
  type TDataUrlOptions,
  type TMat2D,
} from 'fabric'
import type { BannerDimensions, ButtonLayerConfig, ShapeKind } from '@/core/types/banner.types'
import {
  DEFAULT_BACKGROUND,
  FONT_FAMILIES,
} from '@/core/constants/editor.constants'
import { generateId } from '@/core/utils/helpers'
import { applySerializedCustomProps } from './snapshot-import.helpers'
import { getSerializationProps, setLayerData } from './layer.helpers'
import {
  createButtonGroup,
  applyButtonConfig,
  normalizeInteractiveButtons,
  isButtonObject,
  openButtonLink,
  resolvePropertiesTarget,
  applyPlaybackObjectFlags,
  type FabricLayerType,
} from './button.helpers'
import {
  canvasGuidesService,
  DEFAULT_GUIDE_SETTINGS,
} from './canvas-guides.service'
import {
  attachCanvasGridOverlay,
  type CanvasGridOverlayHandle,
} from './canvas-grid-overlay'
import type { GuideSettings } from '@/core/types/banner.types'

export type CanvasChangeHandler = () => void

export class CanvasEngine {
  private canvas: Canvas | null = null
  private changeHandler: CanvasChangeHandler | null = null
  private clipboard: FabricObject | null = null
  private guideSettings: GuideSettings = { ...DEFAULT_GUIDE_SETTINGS }
  private gridOverlay: CanvasGridOverlayHandle | null = null
  private exportBackgroundColor = DEFAULT_BACKGROUND
  private playbackModeActive = false
  private unbindPlaybackSelectionGuard: (() => void) | null = null

  init(
    element: HTMLCanvasElement,
    dimensions: BannerDimensions,
    backgroundColor = DEFAULT_BACKGROUND,
  ): Canvas {
    this.dispose()

    this.exportBackgroundColor = backgroundColor

    this.canvas = new Canvas(element, {
      width: dimensions.width,
      height: dimensions.height,
      backgroundColor: 'transparent',
      preserveObjectStacking: true,
      selection: true,
      fireRightClick: true,
      stopContextMenu: true,
    })
    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0])

    this.bindEvents()
    this.gridOverlay = attachCanvasGridOverlay(this.canvas)
    this.gridOverlay.update(this.guideSettings)
    canvasGuidesService.init(this.canvas, this.guideSettings)

    return this.canvas
  }

  setGuideSettings(settings: GuideSettings): void {
    this.guideSettings = { ...settings }
    this.gridOverlay?.update(this.guideSettings)
    canvasGuidesService.updateSettings(this.guideSettings)
  }

  getGuideSettings(): GuideSettings {
    return { ...this.guideSettings }
  }

  setChangeHandler(handler: CanvasChangeHandler): void {
    this.changeHandler = handler
  }

  getCanvas(): Canvas | null {
    return this.canvas
  }

  resize(dimensions: BannerDimensions, backgroundColor: string): void {
    if (!this.canvas) return

    this.exportBackgroundColor = backgroundColor
    this.canvas.setDimensions(dimensions)
    this.canvas.requestRenderAll()
    canvasGuidesService.updateDimensions()
    this.notifyChange()
  }

  setBackgroundColor(color: string): void {
    if (!this.canvas) return

    this.exportBackgroundColor = color
    this.canvas.requestRenderAll()
    this.notifyChange()
  }

  addText(content = 'Seu texto aqui'): IText | null {
    if (!this.canvas) return null

    const id = generateId()
    const text = new IText(content, {
      left: this.canvas.width! / 2,
      top: this.canvas.height! / 2,
      originX: 'center',
      originY: 'center',
      fontFamily: FONT_FAMILIES[0],
      fontSize: 48,
      fill: '#1a1a1a',
      fontWeight: '700',
      editable: false,
    })

    setLayerData(text, {
      layerId: id,
      layerName: 'Texto',
      layerType: 'text',
    })

    this.canvas.add(text)
    this.canvas.setActiveObject(text)
    this.canvas.requestRenderAll()
    this.notifyChange()

    return text
  }

  async addCoverImage(source: string, name = 'Banner'): Promise<FabricImage | null> {
    if (!this.canvas) return null

    const id = generateId()
    const img = await FabricImage.fromURL(source, { crossOrigin: 'anonymous' })
    const canvasWidth = this.canvas.width ?? 1
    const canvasHeight = this.canvas.height ?? 1
    const imgWidth = img.width ?? 1
    const imgHeight = img.height ?? 1
    const scale = Math.max(canvasWidth / imgWidth, canvasHeight / imgHeight)

    img.set({
      left: canvasWidth / 2,
      top: canvasHeight / 2,
      originX: 'center',
      originY: 'center',
      scaleX: scale,
      scaleY: scale,
    })

    setLayerData(img, {
      layerId: id,
      layerName: name,
      layerType: 'image',
    })

    this.canvas.add(img)
    this.canvas.sendObjectToBack(img)
    this.canvas.requestRenderAll()
    this.notifyChange()

    return img
  }

  async addImage(source: string, name = 'Imagem'): Promise<FabricImage | null> {
    if (!this.canvas) return null

    const id = generateId()
    const img = await FabricImage.fromURL(source, { crossOrigin: 'anonymous' })

    const maxWidth = this.canvas.width! * 0.6
    const maxHeight = this.canvas.height! * 0.6
    const scale = Math.min(maxWidth / (img.width ?? 1), maxHeight / (img.height ?? 1), 1)

    img.set({
      left: this.canvas.width! / 2,
      top: this.canvas.height! / 2,
      originX: 'center',
      originY: 'center',
      scaleX: scale,
      scaleY: scale,
    })

    setLayerData(img, {
      layerId: id,
      layerName: name,
      layerType: 'image',
    })

    this.canvas.add(img)
    this.canvas.setActiveObject(img)
    this.canvas.requestRenderAll()
    this.notifyChange()

    return img
  }

  addShape(kind: ShapeKind): FabricObject | null {
    if (!this.canvas) return null

    const id = generateId()
    const common = {
      left: this.canvas.width! / 2,
      top: this.canvas.height! / 2,
      originX: 'center' as const,
      originY: 'center' as const,
      fill: '#6366f1',
      opacity: 1,
    }

    let shape: FabricObject

    if (kind === 'circle') {
      shape = new Circle({
        ...common,
        radius: 80,
      })
    } else {
      shape = new Rect({
        ...common,
        width: 200,
        height: 120,
        rx: 8,
        ry: 8,
      })
    }

    setLayerData(shape, {
      layerId: id,
      layerName: kind === 'circle' ? 'Círculo' : 'Retângulo',
      layerType: 'shape',
    })

    this.canvas.add(shape)
    this.canvas.setActiveObject(shape)
    this.canvas.requestRenderAll()
    this.notifyChange()

    return shape
  }

  addButton(): Group | null {
    if (!this.canvas) return null

    const button = createButtonGroup(
      this.canvas.width! / 2,
      this.canvas.height! / 2,
    )

    this.canvas.add(button)
    this.canvas.setActiveObject(button)
    this.canvas.requestRenderAll()
    this.notifyChange()

    return button
  }

  updateButton(layerId: string, config: Partial<ButtonLayerConfig>): void {
    const obj = this.getObjectByLayerId(layerId)
    if (!obj || obj.get('layerType') !== 'button') return

    applyButtonConfig(obj as Group, config)
    this.canvas?.requestRenderAll()
    this.notifyChange()
  }

  deleteSelected(): void {
    if (!this.canvas) return

    const active = this.canvas.getActiveObjects()
    const deletable = active.filter((obj) => {
      const type = obj.get('layerType')
      return type !== 'background'
    })

    if (deletable.length === 0) return

    deletable.forEach((obj) => this.canvas!.remove(obj))
    this.canvas.discardActiveObject()
    this.canvas.requestRenderAll()
    this.notifyChange()
  }

  duplicateSelected(): void {
    if (!this.canvas) return

    const active = this.canvas.getActiveObject()
    if (!active || active.get('layerType') === 'background') return

    active.clone().then((cloned) => {
      if (!this.canvas || !cloned) return

      const id = generateId()
      const name = (active.get('layerName') as string) ?? 'Camada'

      cloned.set({
        left: (cloned.left ?? 0) + 20,
        top: (cloned.top ?? 0) + 20,
      })

      setLayerData(cloned, {
        layerId: id,
        layerName: `${name} (cópia)`,
        layerType: active.get('layerType') as FabricLayerType,
      })

      this.canvas.add(cloned)
      this.canvas.setActiveObject(cloned)
      this.canvas.requestRenderAll()
      this.notifyChange()
    })
  }

  async copySelected(): Promise<void> {
    const active = this.getActiveObject()
    if (!active || this.isBackgroundObject(active)) return
    this.clipboard = await active.clone()
  }

  async cutSelected(): Promise<void> {
    await this.copySelected()
    this.deleteSelected()
  }

  async pasteClipboard(): Promise<void> {
    if (!this.clipboard || !this.canvas) return

    const cloned = await this.clipboard.clone()
    const id = generateId()
    const name = (this.clipboard.get('layerName') as string) ?? 'Camada'
    const layerType = this.clipboard.get('layerType') as FabricLayerType

    cloned.set({
      left: (cloned.left ?? 0) + 20,
      top: (cloned.top ?? 0) + 20,
    })

    setLayerData(cloned, {
      layerId: id,
      layerName: `${name} (cópia)`,
      layerType,
    })

    this.canvas.add(cloned)
    this.canvas.setActiveObject(cloned)
    this.canvas.requestRenderAll()
    this.notifyChange()
  }

  selectByLayerId(layerId: string): void {
    if (!this.canvas) return

    const target = this.getObjects().find((obj) => obj.get('layerId') === layerId)
    if (!target || this.isBackgroundObject(target)) return

    this.canvas.setActiveObject(target)
    this.canvas.requestRenderAll()
  }

  toggleLayerVisibility(layerId: string, visible: boolean): void {
    const obj = this.getObjects().find((o) => o.get('layerId') === layerId)
    if (!obj || !this.canvas) return

    const wasActive = this.canvas.getActiveObject()?.get('layerId') === layerId

    obj.set('visible', visible)

    if (wasActive) {
      this.canvas.setActiveObject(obj)
    }

    this.canvas.requestRenderAll()
    this.notifyChange()
  }

  getObjectByLayerId(layerId: string): FabricObject | null {
    return this.getObjects().find((o) => o.get('layerId') === layerId) ?? null
  }

  setInteractionEnabled(enabled: boolean): void {
    if (!this.canvas) return

    this.canvas.selection = enabled && !this.playbackModeActive
    this.canvas.skipTargetFind = !enabled && !this.playbackModeActive

    if (!enabled) {
      this.canvas.discardActiveObject()
    }

    this.canvas.requestRenderAll()
  }

  isPlaybackModeActive(): boolean {
    return this.playbackModeActive
  }

  setPlaybackMode(enabled: boolean): void {
    if (!this.canvas) return

    this.playbackModeActive = enabled
    this.canvas.selection = false
    this.canvas.skipTargetFind = false
    this.canvas.discardActiveObject()
    this.canvas.defaultCursor = 'default'

    applyPlaybackObjectFlags(this.getObjects())

    if (enabled) {
      this.bindPlaybackSelectionGuard()
    } else {
      this.unbindPlaybackSelectionGuard?.()
      this.unbindPlaybackSelectionGuard = null
      this.setInteractionEnabled(true)
    }

    this.canvas.requestRenderAll()
  }

  private bindPlaybackSelectionGuard(): void {
    if (!this.canvas) return

    this.unbindPlaybackSelectionGuard?.()

    const discardSelection = (): void => {
      if (!this.playbackModeActive || !this.canvas) return
      this.canvas.discardActiveObject()
      this.canvas.requestRenderAll()
    }

    this.canvas.on('selection:created', discardSelection)
    this.canvas.on('selection:updated', discardSelection)

    this.unbindPlaybackSelectionGuard = () => {
      this.canvas?.off('selection:created', discardSelection)
      this.canvas?.off('selection:updated', discardSelection)
    }
  }

  bindPlaybackButtonClicks(): () => void {
    if (!this.canvas) return () => {}

    const handleClick = (event: { target?: FabricObject }) => {
      this.canvas?.discardActiveObject()

      const button = resolvePropertiesTarget(event.target ?? null)
      if (button && isButtonObject(button)) {
        openButtonLink(button)
      }
    }

    this.canvas.on('mouse:up', handleClick)
    return () => {
      this.canvas?.off('mouse:up', handleClick)
    }
  }

  toggleLayerLock(layerId: string, locked: boolean): void {
    const obj = this.getObjects().find((o) => o.get('layerId') === layerId)
    if (!obj || !this.canvas) return

    obj.set({
      selectable: !locked,
      evented: !locked,
      hasControls: !locked,
    })
    this.canvas.requestRenderAll()
    this.notifyChange()
  }

  reorderLayer(layerId: string, direction: 'up' | 'down' | 'front' | 'back'): void {
    if (!this.canvas) return

    const obj = this.getObjects().find((o) => o.get('layerId') === layerId)
    if (!obj || obj.get('layerType') === 'background') return

    switch (direction) {
      case 'up':
        this.canvas.bringObjectForward(obj)
        break
      case 'down':
        this.canvas.sendObjectBackwards(obj)
        break
      case 'front':
        this.canvas.bringObjectToFront(obj)
        break
      case 'back':
        this.canvas.sendObjectToBack(obj)
        break
    }

    this.canvas.requestRenderAll()
    this.notifyChange()
  }

  renameLayer(layerId: string, name: string): void {
    const obj = this.getObjects().find((o) => o.get('layerId') === layerId)
    if (!obj) return

    obj.set('layerName', name)
    this.notifyChange()
  }

  applyShadow(
    object: FabricObject,
    options: {
      color: string
      blur: number
      offsetX: number
      offsetY: number
    },
  ): void {
    if (!this.canvas) return

    const hasShadow = options.blur > 0 || options.offsetX !== 0 || options.offsetY !== 0

    object.set(
      'shadow',
      hasShadow
        ? new Shadow({
            color: options.color,
            blur: options.blur,
            offsetX: options.offsetX,
            offsetY: options.offsetY,
          })
        : null,
    )

    this.canvas.requestRenderAll()
    this.notifyChange()
  }

  getObjects(): FabricObject[] {
    return this.canvas?.getObjects() ?? []
  }

  getActiveObject(): FabricObject | null {
    return this.canvas?.getActiveObject() ?? null
  }

  serialize(): string {
    if (!this.canvas) return '{}'

    try {
      this.ensureViewportTransform()
      return JSON.stringify(this.canvas.toObject(getSerializationProps()))
    } catch (error) {
      console.error('Falha ao serializar canvas:', error)
      return JSON.stringify({ version: '6.0.0', objects: [] })
    }
  }

  async loadFromJSON(json: string): Promise<void> {
    if (!this.canvas) return

    const payload = JSON.parse(json) as Record<string, unknown>
    await this.canvas.loadFromJSON(payload, (serialized, instance) => {
      if (!(instance instanceof FabricObject)) return
      applySerializedCustomProps(serialized as Record<string, unknown>, instance)
      if (instance instanceof FabricImage) {
        instance.set({ crossOrigin: 'anonymous' })
      }
    })
    this.removeBackgroundObjects()
    normalizeInteractiveButtons(this.getObjects())
    this.canvas.requestRenderAll()
    this.notifyChange()
  }

  async clearObjects(): Promise<void> {
    if (!this.canvas) return

    this.canvas.discardActiveObject()
    for (const obj of [...this.getObjects()]) {
      this.canvas.remove(obj)
    }
    this.canvas.requestRenderAll()
    this.notifyChange()
  }

  exportToDataURL(options: Partial<TDataUrlOptions> = {}): string {
    if (!this.canvas) return ''

    const width = this.canvas.getWidth() ?? 0
    const height = this.canvas.getHeight() ?? 0
    if (!width || !height) return ''

    this.ensureViewportTransform()

    this.canvas.cancelRequestedRender()
    this.canvas.discardActiveObject()

    const multiplier = options.multiplier ?? 1
    const format = options.format ?? 'png'
    const quality = options.quality ?? 0.92

    const output = document.createElement('canvas')
    output.width = Math.max(1, Math.round(width * multiplier))
    output.height = Math.max(1, Math.round(height * multiplier))

    const ctx = output.getContext('2d')
    if (!ctx) return ''

    const previousBackground = this.canvas.backgroundColor
    const previousWidth = this.canvas.width
    const previousHeight = this.canvas.height
    const previousRetina = this.canvas.enableRetinaScaling
    const previousVp: TMat2D = this.canvas.viewportTransform
      ? ([...this.canvas.viewportTransform] as TMat2D)
      : [1, 0, 0, 1, 0, 0]

    this.canvas.backgroundColor = this.exportBackgroundColor ?? '#ffffff'
    this.canvas.enableRetinaScaling = false
    this.canvas.viewportTransform = [multiplier, 0, 0, multiplier, 0, 0]
    this.canvas.width = output.width
    this.canvas.height = output.height
    this.canvas.calcViewportBoundaries()

    try {
      this.canvas.renderCanvas(ctx, this.canvas.getObjects())
      if (format === 'jpeg') {
        return output.toDataURL('image/jpeg', quality)
      }
      return output.toDataURL(`image/${format}`)
    } finally {
      this.canvas.backgroundColor = previousBackground
      this.canvas.enableRetinaScaling = previousRetina
      this.canvas.viewportTransform = previousVp
      this.canvas.width = previousWidth
      this.canvas.height = previousHeight
      this.canvas.calcViewportBoundaries()
      this.canvas.requestRenderAll()
    }
  }

  private ensureViewportTransform(): void {
    if (!this.canvas) return
    const vp = this.canvas.viewportTransform
    if (!vp || vp.length < 6) {
      this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
    }
  }

  dispose(): void {
    this.gridOverlay?.dispose()
    this.gridOverlay = null
    canvasGuidesService.dispose()
    if (this.canvas) {
      this.canvas.dispose()
      this.canvas = null
    }
  }

  private isBackgroundObject(obj: FabricObject): boolean {
    return obj.get('layerType') === 'background'
  }

  private removeBackgroundObjects(): void {
    if (!this.canvas) return

    for (const obj of [...this.getObjects()]) {
      if (!this.isBackgroundObject(obj)) continue

      const fill = obj.fill
      if (typeof fill === 'string') {
        this.exportBackgroundColor = fill
      }

      this.canvas.remove(obj)
    }
  }

  private guardBackgroundSelection(selected?: FabricObject[]): void {
    if (!this.canvas) return

    const targets = selected ?? []
    const active = this.canvas.getActiveObject()
    const all = active ? [...targets, active] : targets

    if (all.some((obj) => this.isBackgroundObject(obj))) {
      this.canvas.discardActiveObject()
      this.canvas.requestRenderAll()
    }
  }

  private bindEvents(): void {
    if (!this.canvas) return

    const changeEvents = ['object:modified', 'object:added', 'object:removed'] as const

    changeEvents.forEach((event) => {
      this.canvas!.on(event, () => this.notifyChange())
    })

    this.canvas.on('selection:created', (event) => {
      this.guardBackgroundSelection(event.selected)
    })

    this.canvas.on('selection:updated', (event) => {
      this.guardBackgroundSelection(event.selected)
    })
  }

  private notifyChange(): void {
    this.changeHandler?.()
  }
}

export const canvasEngine = new CanvasEngine()
