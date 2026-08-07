import { onMounted, ref, watch } from 'vue'
import type { BannerStudioDocument, LojaOnlineBannerTamanhoId } from '@/core/types/banner-document.types'
import { isBannerStudioDocument } from '@/core/types/banner-document.types'
import {
  exportBannerStudioDocument,
  importBannerStudioDocument,
} from '@/features/editor/services/project-persistence.service'
import { countCanvasSnapshotObjects, slideHasCanvasObjects } from '@/features/editor/services/snapshot.helpers'
import {
  compactStudioForTransfer,
  expandStudioFromTransfer,
  STUDIO_IMAGE_PLACEHOLDER,
} from '@/features/editor/services/studio-transfer.helpers'
import { useEditorStore } from '@/features/editor/stores/editor.store'
import { isParentMessage, postToParent } from '@/features/editor/utils/embed-messaging'

export type BannerStudioEmbedInitMessage = {
  type: 'banner-studio:init'
  tamanho?: LojaOnlineBannerTamanhoId
  width?: number
  height?: number
  imagem?: string
  studio?: BannerStudioDocument | null
}

export type BannerStudioEmbedInitImagemMessage = {
  type: 'banner-studio:init-imagem'
  imagem: string
}

export type BannerStudioEmbedExportMessage = {
  type: 'banner-studio:export'
  imagem: string
  studio: BannerStudioDocument
}

export type BannerStudioEmbedErrorMessage = {
  type: 'banner-studio:error'
  message: string
}

export type BannerStudioEmbedMessage =
  | BannerStudioEmbedInitMessage
  | BannerStudioEmbedExportMessage
  | BannerStudioEmbedErrorMessage
  | { type: 'banner-studio:ready' }
  | { type: 'banner-studio:loaded' }

function readEmbedParams(): {
  embed: boolean
  width: number | null
  height: number | null
  tamanho: LojaOnlineBannerTamanhoId | null
} {
  const params = new URLSearchParams(window.location.search)
  const width = params.get('width')
  const height = params.get('height')
  const tamanho = params.get('tamanho')
  return {
    embed: params.get('embed') === '1',
    width: width ? Number(width) : null,
    height: height ? Number(height) : null,
    tamanho:
      tamanho === 'pequeno' || tamanho === 'medio' || tamanho === 'grande' ? tamanho : null,
  }
}

export function useEmbedBridge() {
  const editor = useEditorStore()
  const isEmbed = ref(false)
  const embedTamanho = ref<LojaOnlineBannerTamanhoId>('medio')
  const pendingInit = ref<BannerStudioEmbedInitMessage | null>(null)
  const pendingImagem = ref<string | null>(null)
  let appliedInitSignature = ''
  let initInFlightSignature = ''
  let initQueue: Promise<void> = Promise.resolve()

  function notifyLoaded(): void {
    if (!isEmbed.value) return
    postToParent({ type: 'banner-studio:loaded' })
  }

  function enqueueInitWork(work: () => Promise<void>): void {
    initQueue = initQueue.then(work).catch((error) => {
      console.error('Falha ao processar init do embed:', error)
    })
  }

  function studioNeedsImagem(studio: BannerStudioDocument | null | undefined): boolean {
    if (!studio) return false
    return studio.slides.some((slide) => {
      const snapshot = slide.canvasSnapshot
      return typeof snapshot === 'string' && snapshot.includes(STUDIO_IMAGE_PLACEHOLDER)
    })
  }

  function mergePendingInit(): BannerStudioEmbedInitMessage | null {
    if (!pendingInit.value) return null
    return {
      ...pendingInit.value,
      imagem: pendingInit.value.imagem ?? pendingImagem.value ?? undefined,
    }
  }

  function initSignature(data: BannerStudioEmbedInitMessage): string {
    const snapshotCount = data.studio
      ? data.studio.slides.reduce(
          (max, slide) => Math.max(max, countCanvasSnapshotObjects(slide.canvasSnapshot)),
          0,
        )
      : 0

    return [
      data.tamanho ?? '',
      data.width ?? '',
      data.height ?? '',
      data.imagem ? data.imagem.length : 0,
      data.studio?.project?.updatedAt ?? '',
      snapshotCount,
      data.studio?.activeSlideId ?? '',
    ].join('|')
  }

  function notifyReady(): void {
    if (!isEmbed.value) return
    postToParent({ type: 'banner-studio:ready' })
  }

  function notifyError(message: string): void {
    postToParent({ type: 'banner-studio:error', message } satisfies BannerStudioEmbedErrorMessage)
  }

  function hasRestorableStudio(studio: BannerStudioEmbedInitMessage['studio']): studio is BannerStudioDocument {
    if (!studio || !isBannerStudioDocument(studio)) return false
    return studio.slides.some((slide) => slideHasCanvasObjects(slide))
  }

  async function loadLegacyImage(imagem?: string): Promise<boolean> {
    if (!imagem) return false
    await editor.clearCanvas()
    await editor.loadLegacyBannerImage(imagem)
    return true
  }

  async function applyInit(data: BannerStudioEmbedInitMessage): Promise<boolean> {
    if (appliedInitSignature) {
      notifyLoaded()
      return true
    }

    const signature = initSignature(data)
    if (signature === appliedInitSignature) {
      notifyLoaded()
      return true
    }
    if (initInFlightSignature === signature) return true

    initInFlightSignature = signature

    try {
      if (data.tamanho) {
        embedTamanho.value = data.tamanho
      }

      if (data.width && data.height && !hasRestorableStudio(data.studio)) {
        editor.setCustomDimensions(data.width, data.height)
      }

      if (hasRestorableStudio(data.studio)) {
        try {
          const studio = expandStudioFromTransfer(data.studio, data.imagem)
          await importBannerStudioDocument(studio, { stripLegacyCover: false })
          if (data.tamanho) embedTamanho.value = data.tamanho
          appliedInitSignature = signature
          notifyLoaded()
          return true
        } catch (error) {
          console.error('Falha ao importar projeto recebido no embed:', error)
          if (data.imagem && (await loadLegacyImage(data.imagem))) {
            notifyError(
              'Não foi possível restaurar todas as camadas. Carregamos a preview do banner — salve novamente após editar.',
            )
            appliedInitSignature = signature
            notifyLoaded()
            return true
          }
          notifyError(
            error instanceof Error
              ? error.message
              : 'Não foi possível restaurar as camadas do banner. Feche e abra o editor novamente.',
          )
          return false
        }
      }

      if (data.studio && isBannerStudioDocument(data.studio)) {
        if (await loadLegacyImage(data.imagem)) {
          notifyError(
            'O projeto salvo está incompleto. Carregamos a preview — recrie o banner e salve novamente.',
          )
          appliedInitSignature = signature
          notifyLoaded()
          return true
        }
        notifyError(
          'O projeto salvo está incompleto. Recrie o banner no Banner Studio e salve novamente.',
        )
        return false
      }

      if (data.imagem) {
        await loadLegacyImage(data.imagem)
        appliedInitSignature = signature
        notifyLoaded()
        return true
      }

      appliedInitSignature = signature
      notifyLoaded()
      return true
    } finally {
      if (initInFlightSignature === signature) {
        initInFlightSignature = ''
      }
    }
  }

  function processPendingInit(): void {
    enqueueInitWork(async () => {
      if (!editor.isReady) return
      const data = mergePendingInit()
      if (!data) return
      if (studioNeedsImagem(data.studio) && !data.imagem) return

      const ok = await applyInit(data)
      if (ok) {
        pendingInit.value = null
        pendingImagem.value = null
      }
    })
  }

  watch(
    () => editor.isReady,
    (ready) => {
      if (!ready || !isEmbed.value) return
      processPendingInit()
      notifyReady()
    },
    { immediate: true },
  )

  onMounted(() => {
    const params = readEmbedParams()
    isEmbed.value = params.embed
    if (params.tamanho) embedTamanho.value = params.tamanho

    if (!params.embed) return

    if (params.width && params.height && params.width > 0 && params.height > 0) {
      editor.project.dimensions = {
        width: params.width,
        height: params.height,
      }
    }

    window.addEventListener('message', (event) => {
      if (!isParentMessage(event)) return
      const data = event.data as
        | BannerStudioEmbedInitMessage
        | BannerStudioEmbedInitImagemMessage
        | undefined
      if (!data || typeof data !== 'object') return

      if (data.type === 'banner-studio:init-imagem') {
        pendingImagem.value = data.imagem
        processPendingInit()
        return
      }

      if (data.type !== 'banner-studio:init') return

      pendingInit.value = data
      processPendingInit()
    })
  })

  async function sendToParent(): Promise<void> {
    if (!editor.isReady) {
      throw new Error('O canvas ainda não está pronto. Aguarde um instante e tente novamente.')
    }

    let imagem = ''
    let studio: Awaited<ReturnType<typeof exportBannerStudioDocument>>

    try {
      studio = await exportBannerStudioDocument(embedTamanho.value)
    } catch (error) {
      throw new Error(
        `Falha ao salvar projeto: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      )
    }

    try {
      imagem = await editor.exportBannerDataUrl({
        format: 'jpeg',
        quality: 0.92,
        multiplier: 2,
      })
    } catch (error) {
      throw new Error(
        `Falha ao gerar imagem: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      )
    }

    if (!imagem) {
      throw new Error('Não foi possível gerar a imagem do banner.')
    }

    postToParent({
      type: 'banner-studio:export',
      imagem,
      studio: compactStudioForTransfer(studio),
    } satisfies BannerStudioEmbedExportMessage)
  }

  return { isEmbed, sendToParent, notifyError }
}
