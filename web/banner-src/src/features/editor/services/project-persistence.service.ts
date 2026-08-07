import { toRaw } from 'vue'
import type { BannerStudioDocument } from '@/core/types/banner-document.types'
import { BANNER_STUDIO_DOCUMENT_VERSION } from '@/core/types/banner-document.types'
import type { LojaOnlineBannerTamanhoId } from '@/core/types/banner-document.types'
import { clonePlain } from '@/features/editor/utils/embed-messaging'
import { canvasEngine } from '@/features/editor/services/canvas.engine'
import { FabricImage } from 'fabric'
import {
  countCanvasSnapshotObjects,
  normalizeCanvasSnapshot,
  resolveImportSlide,
  slideHasCanvasObjects,
} from '@/features/editor/services/snapshot.helpers'
import {
  stripLegacyCoverLayerFromSnapshot,
  stripPreviewDuplicateImageLayers,
} from '@/features/editor/services/snapshot-import.helpers'
import { PLAYBACK_GUIDE_SETTINGS } from '@/features/editor/services/canvas-guides.service'
import { useAnimationStore } from '@/features/editor/stores/animation.store'
import { useEditorStore } from '@/features/editor/stores/editor.store'
import { useHistoryStore } from '@/features/editor/stores/history.store'

async function waitForEditorReady(timeoutMs = 8000): Promise<void> {
  const editor = useEditorStore()
  if (editor.isReady) return

  const startedAt = Date.now()
  while (!editor.isReady && Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => window.setTimeout(resolve, 50))
  }

  if (!editor.isReady) {
    throw new Error('O canvas do Banner Studio não ficou pronto a tempo.')
  }
}

async function waitForCanvasImages(timeoutMs = 15000): Promise<void> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const images = canvasEngine.getObjects().filter((object) => object instanceof FabricImage)
    if (images.length === 0) return

    const pending = images.filter((image) => {
      const element = image.getElement() as HTMLImageElement | undefined
      return !element?.complete || element.naturalWidth === 0
    })

    if (pending.length === 0) return
    await new Promise((resolve) => window.setTimeout(resolve, 50))
  }
}

export async function exportBannerStudioDocument(
  tamanho: LojaOnlineBannerTamanhoId,
): Promise<BannerStudioDocument> {
  const editor = useEditorStore()
  const animation = useAnimationStore()

  try {
    animation.forceDesignMode()
    await animation.flushCurrentSlideSnapshot()
  } catch (error) {
    console.error('Falha ao sincronizar slide antes da exportação:', error)
  }

  const activeSlide = animation.activeSlide
  if (activeSlide && !slideHasCanvasObjects(activeSlide)) {
    activeSlide.canvasSnapshot = canvasEngine.serialize()
  }

  if (activeSlide && countCanvasSnapshotObjects(activeSlide.canvasSnapshot) === 0) {
    throw new Error('O banner não possui camadas para salvar. Adicione elementos antes de exportar.')
  }

  editor.project.updatedAt = new Date().toISOString()

  return {
    version: BANNER_STUDIO_DOCUMENT_VERSION,
    tamanho,
    project: clonePlain(toRaw(editor.project)),
    guideSettings: clonePlain(toRaw(editor.guideSettings)),
    slides: clonePlain(toRaw(animation.slides)),
    activeSlideId: toRaw(animation.activeSlideId),
  }
}

export type ImportBannerStudioOptions = {
  /** Remove camada achatada quando há botões/texto editáveis. */
  stripLegacyCover?: boolean
  /** Remove imagens iguais à preview exportada (evita botão duplicado na vitrine). */
  stripPreviewDuplicates?: string | null
  /** Modo vitrine: sem grid/guias e preenche o container. */
  playback?: boolean
}

export async function importBannerStudioDocument(
  doc: BannerStudioDocument,
  options: ImportBannerStudioOptions = {},
): Promise<void> {
  const editor = useEditorStore()
  const animation = useAnimationStore()
  const history = useHistoryStore()

  await waitForEditorReady()

  const importSlide = resolveImportSlide(doc.slides, doc.activeSlideId)
  if (!importSlide?.canvasSnapshot) {
    throw new Error('O projeto salvo não contém camadas editáveis para restaurar.')
  }

  let workingSnapshot = importSlide.canvasSnapshot
  if (options.stripLegacyCover === true) {
    workingSnapshot =
      stripLegacyCoverLayerFromSnapshot(workingSnapshot) ?? workingSnapshot
  }
  if (options.stripPreviewDuplicates) {
    workingSnapshot =
      stripPreviewDuplicateImageLayers(workingSnapshot, options.stripPreviewDuplicates) ??
      workingSnapshot
  }
  const snapshot = normalizeCanvasSnapshot(workingSnapshot)
  if (!snapshot) {
    throw new Error('O projeto salvo não contém camadas editáveis para restaurar.')
  }

  animation.stop()
  animation.importState(doc.slides, importSlide.id)

  const nextProject = clonePlain(doc.project)
  editor.setProjectName(nextProject.name)
  editor.setGuideSettings(options.playback ? PLAYBACK_GUIDE_SETTINGS : doc.guideSettings)
  editor.setBackgroundColor(nextProject.backgroundColor)
  editor.setCustomDimensions(nextProject.dimensions.width, nextProject.dimensions.height)
  editor.project.id = nextProject.id
  editor.project.createdAt = nextProject.createdAt
  editor.project.updatedAt = nextProject.updatedAt

  await editor.clearCanvas()
  await editor.loadCanvasSnapshot(snapshot)
  await waitForCanvasImages()

  const restoredObjects = canvasEngine.getObjects().filter(
    (object) => object.get('layerType') !== 'background',
  )
  if (restoredObjects.length === 0) {
    throw new Error('As camadas do banner não puderam ser restauradas.')
  }

  animation.syncTracksFromLayers()
  history.reset()
  if (options.playback) {
    editor.fitToCover()
  } else {
    editor.fitToScreen()
  }
  editor.syncSelection()
}
