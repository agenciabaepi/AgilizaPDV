import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import type { FabricObject } from 'fabric'
import type {
  BannerProject,
  CanvasViewport,
  EditorTool,
  ExportOptions,
  GuideSettings,
  LayerMeta,
  ButtonLayerConfig,
} from '@/core/types/banner.types'
import {
  BANNER_PRESETS,
  DEFAULT_BACKGROUND,
  DEFAULT_BANNER_HEIGHT,
  DEFAULT_BANNER_WIDTH,
  FIT_PADDING,
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
} from '@/core/constants/editor.constants'
import { DEFAULT_GUIDE_SETTINGS } from '@/features/editor/services/canvas-guides.service'
import { clamp, generateId, round } from '@/core/utils/helpers'
import { canvasEngine } from '@/features/editor/services/canvas.engine'
import { fabricObjectToLayerMeta, inferLayerType } from '@/features/editor/services/layer.helpers'
import { resolvePropertiesTarget } from '@/features/editor/services/button.helpers'
import { exportService } from '@/features/editor/services/export.service'
import { useAnimationStore } from '@/features/editor/stores/animation.store'
import { useHistoryStore } from '@/features/editor/stores/history.store'

export const useEditorStore = defineStore('editor', () => {
  const project = ref<BannerProject>({
    id: generateId(),
    name: 'Banner sem título',
    dimensions: { width: DEFAULT_BANNER_WIDTH, height: DEFAULT_BANNER_HEIGHT },
    backgroundColor: DEFAULT_BACKGROUND,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const activeTool = ref<EditorTool>('select')
  const selectedObject = shallowRef<FabricObject | null>(null)
  const selectedLayerId = ref<string | null>(null)
  const layers = ref<LayerMeta[]>([])
  const isReady = ref(false)
  const isExporting = ref(false)

  const viewport = ref<CanvasViewport>({
    zoom: 1,
    panX: 0,
    panY: 0,
  })

  const workspaceSize = ref({ width: 0, height: 0 })
  const guideSettings = ref<GuideSettings>({ ...DEFAULT_GUIDE_SETTINGS })

  const zoomPercent = computed(() => Math.round(viewport.value.zoom * 100))

  const selectedLayer = computed(() => {
    const target = selectedObject.value
    const layerId =
      selectedLayerId.value ??
      (target?.get('layerId') as string | undefined)

    if (layerId) {
      const fromList = layers.value.find((l) => l.id === layerId)
      if (fromList) return fromList
    }

    if (!target) return null

    const inferredType = inferLayerType(target)
    const data = target.get('layerId')
      ? {
          id: target.get('layerId') as string,
          name: (target.get('layerName') as string) ?? 'Elemento',
          type: inferredType ?? 'shape',
          visible: target.visible ?? true,
          locked: !target.selectable,
        }
      : null

    return data
  })

  function syncLayers(): void {
    const objects = canvasEngine.getObjects()
    layers.value = objects
      .map(fabricObjectToLayerMeta)
      .filter((l): l is LayerMeta => l !== null)
      .reverse()
  }

  function syncSelection(): void {
    const active = canvasEngine.getActiveObject()

    if (active) {
      const target = resolvePropertiesTarget(active) ?? active
      selectedObject.value = target
      selectedLayerId.value = (target.get('layerId') as string | undefined) ?? null
    } else {
      restoreHiddenSelection()
      return
    }

    syncLayers()
  }

  function restoreHiddenSelection(): void {
    if (selectedLayerId.value) {
      const pinned = canvasEngine.getObjectByLayerId(selectedLayerId.value)
      if (pinned && !pinned.visible) {
        selectedObject.value = pinned
        syncLayers()
        return
      }
    }

    selectedLayerId.value = null
    selectedObject.value = null
    syncLayers()
  }

  function handleSelectionCleared(): void {
    restoreHiddenSelection()
  }

  function onCanvasChange(): void {
    project.value.updatedAt = new Date().toISOString()
    syncLayers()
  }

  function setGuideSettings(partial: Partial<GuideSettings>): void {
    guideSettings.value = { ...guideSettings.value, ...partial }
    canvasEngine.setGuideSettings(guideSettings.value)
  }

  function initCanvas(element: HTMLCanvasElement): void {
    canvasEngine.setChangeHandler(onCanvasChange)
    canvasEngine.init(
      element,
      project.value.dimensions,
      project.value.backgroundColor,
    )
    canvasEngine.setGuideSettings(guideSettings.value)
    isReady.value = true
    syncLayers()
    useHistoryStore().pushState()
  }

  function disposeCanvas(): void {
    canvasEngine.dispose()
    isReady.value = false
    selectedObject.value = null
    layers.value = []
  }

  function setWorkspaceSize(width: number, height: number): void {
    workspaceSize.value = { width, height }
    fitToScreen()
  }

  function fitToScreen(): void {
    const { width: cw, height: ch } = project.value.dimensions
    const { width: ww, height: wh } = workspaceSize.value

    if (ww === 0 || wh === 0) return

    const scaleX = (ww - FIT_PADDING * 2) / cw
    const scaleY = (wh - FIT_PADDING * 2) / ch
    const zoom = clamp(Math.min(scaleX, scaleY), MIN_ZOOM, MAX_ZOOM)

    viewport.value = {
      zoom,
      panX: (ww - cw * zoom) / 2,
      panY: (wh - ch * zoom) / 2,
    }
  }

  function fitToCover(): void {
    const { width: cw, height: ch } = project.value.dimensions
    const { width: ww, height: wh } = workspaceSize.value

    if (ww === 0 || wh === 0) return

    const zoom = clamp(Math.max(ww / cw, wh / ch), MIN_ZOOM, MAX_ZOOM)

    viewport.value = {
      zoom,
      panX: (ww - cw * zoom) / 2,
      panY: (wh - ch * zoom) / 2,
    }
  }

  function setZoom(zoom: number): void {
    viewport.value.zoom = clamp(round(zoom), MIN_ZOOM, MAX_ZOOM)
  }

  function zoomIn(): void {
    setZoom(viewport.value.zoom + ZOOM_STEP)
  }

  function zoomOut(): void {
    setZoom(viewport.value.zoom - ZOOM_STEP)
  }

  function setActiveTool(tool: EditorTool): void {
    activeTool.value = tool
  }

  function setProjectName(name: string): void {
    project.value.name = name
    project.value.updatedAt = new Date().toISOString()
  }

  function setBackgroundColor(color: string): void {
    project.value.backgroundColor = color
    canvasEngine.setBackgroundColor(color)
  }

  function applyPreset(presetId: string): void {
    const preset = BANNER_PRESETS.find((p) => p.id === presetId)
    if (!preset) return

    project.value.dimensions = { width: preset.width, height: preset.height }
    canvasEngine.resize(project.value.dimensions, project.value.backgroundColor)
    fitToScreen()
  }

  function setCustomDimensions(width: number, height: number): void {
    project.value.dimensions = {
      width: clamp(width, 100, 5000),
      height: clamp(height, 100, 5000),
    }
    canvasEngine.resize(project.value.dimensions, project.value.backgroundColor)
    fitToScreen()
  }

  function addText(): void {
    canvasEngine.addText()
    syncSelection()
  }

  async function addImageFromFile(file: File): Promise<void> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler imagem'))
      reader.readAsDataURL(file)
    })

    try {
      await canvasEngine.addImage(dataUrl, file.name.replace(/\.[^.]+$/, ''))
      syncSelection()
    } catch (error) {
      console.error('Erro ao adicionar imagem:', error)
    }
  }

  function addShape(kind: 'rect' | 'circle'): void {
    canvasEngine.addShape(kind)
    syncSelection()
  }

  function addButton(): void {
    canvasEngine.addButton()
    syncSelection()
  }

  function updateButton(layerId: string, config: Partial<ButtonLayerConfig>): void {
    canvasEngine.updateButton(layerId, config)
    syncLayers()
  }

  function deleteSelected(): void {
    canvasEngine.deleteSelected()
    syncSelection()
  }

  function duplicateSelected(): void {
    canvasEngine.duplicateSelected()
    syncSelection()
  }

  async function copySelected(): Promise<void> {
    await canvasEngine.copySelected()
  }

  async function cutSelected(): Promise<void> {
    await canvasEngine.cutSelected()
    syncSelection()
  }

  async function pasteClipboard(): Promise<void> {
    await canvasEngine.pasteClipboard()
    syncSelection()
  }

  function toggleSelectedVisibility(): void {
    const layerId =
      selectedLayerId.value ??
      (selectedObject.value?.get('layerId') as string | undefined)

    if (!layerId) return

    const layer = layers.value.find((l) => l.id === layerId)
    if (!layer) return

    selectedLayerId.value = layerId
    const nextVisible = !layer.visible
    canvasEngine.toggleLayerVisibility(layerId, nextVisible)

    const obj = canvasEngine.getObjectByLayerId(layerId)
    if (obj) {
      selectedObject.value = obj
      if (nextVisible) {
        canvasEngine.selectByLayerId(layerId)
      }
    }

    syncLayers()
  }

  function reorderSelected(direction: 'up' | 'down' | 'front' | 'back'): void {
    const layer = selectedLayer.value
    if (!layer) return
    canvasEngine.reorderLayer(layer.id, direction)
    syncLayers()
  }

  function selectLayer(layerId: string): void {
    selectedLayerId.value = layerId
    canvasEngine.selectByLayerId(layerId)
    syncSelection()
  }

  function toggleLayerVisibility(layerId: string): void {
    const layer = layers.value.find((l) => l.id === layerId)
    if (!layer) return

    selectedLayerId.value = layerId
    const nextVisible = !layer.visible
    canvasEngine.toggleLayerVisibility(layerId, nextVisible)

    const obj = canvasEngine.getObjectByLayerId(layerId)
    if (obj) {
      selectedObject.value = obj
      if (nextVisible) {
        canvasEngine.selectByLayerId(layerId)
      }
    }

    syncLayers()
  }

  function toggleLayerLock(layerId: string): void {
    const layer = layers.value.find((l) => l.id === layerId)
    if (!layer) return
    canvasEngine.toggleLayerLock(layerId, !layer.locked)
    syncLayers()
  }

  function reorderLayer(layerId: string, direction: 'up' | 'down' | 'front' | 'back'): void {
    canvasEngine.reorderLayer(layerId, direction)
    syncLayers()
  }

  function renameLayer(layerId: string, name: string): void {
    canvasEngine.renameLayer(layerId, name)
    syncLayers()
  }

  function updateSelectedObject(props: Record<string, unknown>): void {
    const obj = canvasEngine.getActiveObject()
    const canvas = canvasEngine.getCanvas()
    if (!obj || !canvas) return

    obj.set(props)
    obj.setCoords()
    canvas.requestRenderAll()
    onCanvasChange()
  }

  function applyShadowToSelected(options: {
    color: string
    blur: number
    offsetX: number
    offsetY: number
  }): void {
    const obj = canvasEngine.getActiveObject()
    if (!obj) return
    canvasEngine.applyShadow(obj, options)
  }

  async function loadLegacyBannerImage(dataUrl: string): Promise<void> {
    await canvasEngine.addCoverImage(dataUrl, 'Imagem')
    syncSelection()
    useHistoryStore().pushState()
  }

  async function loadCanvasSnapshot(json: string): Promise<void> {
    await canvasEngine.loadFromJSON(json)
    syncLayers()
    useHistoryStore().pushState()
  }

  async function clearCanvas(): Promise<void> {
    await canvasEngine.clearObjects()
    syncSelection()
    useHistoryStore().pushState()
  }

  function prepareForExport(): void {
    selectedObject.value = null
    selectedLayerId.value = null
    const canvas = canvasEngine.getCanvas()
    canvas?.discardActiveObject()
    canvas?.requestRenderAll()
  }

  async function exportBannerDataUrl(options: Partial<ExportOptions> = {}): Promise<string> {
    const animation = useAnimationStore()
    isExporting.value = true
    try {
      animation.forceDesignMode()
      prepareForExport()
      return exportService.exportBannerDataUrl({
        format: options.format ?? 'png',
        quality: options.quality ?? 1,
        multiplier: options.multiplier ?? 2,
      })
    } finally {
      animation.forceDesignMode()
      prepareForExport()
      canvasEngine.getCanvas()?.requestRenderAll()
      isExporting.value = false
    }
  }

  async function exportBanner(options: Partial<ExportOptions> = {}): Promise<void> {
    const animation = useAnimationStore()
    isExporting.value = true
    try {
      animation.forceDesignMode()
      await exportService.exportBanner(project.value.name, {
        format: options.format ?? 'png',
        quality: options.quality ?? 1,
        multiplier: options.multiplier ?? 2,
      })
    } finally {
      animation.forceDesignMode()
      canvasEngine.getCanvas()?.requestRenderAll()
      isExporting.value = false
    }
  }

  return {
    project,
    activeTool,
    selectedObject,
    selectedLayerId,
    selectedLayer,
    layers,
    isReady,
    isExporting,
    viewport,
    workspaceSize,
    guideSettings,
    zoomPercent,
    bannerPresets: BANNER_PRESETS,
    initCanvas,
    disposeCanvas,
    setWorkspaceSize,
    fitToScreen,
    fitToCover,
    setZoom,
    zoomIn,
    zoomOut,
    setActiveTool,
    setProjectName,
    setBackgroundColor,
    applyPreset,
    setCustomDimensions,
    setGuideSettings,
    addText,
    addImageFromFile,
    addShape,
    addButton,
    updateButton,
    deleteSelected,
    duplicateSelected,
    copySelected,
    cutSelected,
    pasteClipboard,
    toggleSelectedVisibility,
    reorderSelected,
    selectLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    reorderLayer,
    renameLayer,
    updateSelectedObject,
    applyShadowToSelected,
    syncSelection,
    handleSelectionCleared,
    exportBanner,
    exportBannerDataUrl,
    loadCanvasSnapshot,
    clearCanvas,
    loadLegacyBannerImage,
  }
})
