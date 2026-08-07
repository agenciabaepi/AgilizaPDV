import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { BannerStudioDocument } from '@/core/types/banner-document.types'
import { isBannerStudioDocument } from '@/core/types/banner-document.types'
import { importBannerStudioDocument } from '@/features/editor/services/project-persistence.service'
import { animationPlaybackService } from '@/features/editor/services/animation-playback.service'
import { canvasEngine } from '@/features/editor/services/canvas.engine'
import { slideHasCanvasObjects } from '@/features/editor/services/snapshot.helpers'
import { expandStudioFromTransfer } from '@/features/editor/services/studio-transfer.helpers'
import { useAnimationStore } from '@/features/editor/stores/animation.store'
import { useEditorStore } from '@/features/editor/stores/editor.store'

export type BannerPlayerInitMessage = {
  type: 'banner-player:init'
  studio?: BannerStudioDocument | null
  imagem?: string | null
  autoplay?: boolean
  loop?: boolean
}

type BannerPlayerReadyMessage = {
  type: 'banner-player:ready'
}

type BannerPlayerLoadedMessage = {
  type: 'banner-player:loaded'
}

type BannerPlayerErrorMessage = {
  type: 'banner-player:error'
}

function postToParent(data: unknown): void {
  window.parent.postMessage(data, '*')
}

function isParentMessage(event: MessageEvent): boolean {
  return event.source === window.parent
}

function hasRestorableStudio(studio: BannerStudioDocument | null | undefined): studio is BannerStudioDocument {
  if (!studio || !isBannerStudioDocument(studio)) return false
  return studio.slides.some((slide) => slideHasCanvasObjects(slide))
}

export function usePlayerBridge() {
  const editor = useEditorStore()
  const animation = useAnimationStore()
  const pendingInit = ref<BannerPlayerInitMessage | null>(null)
  const shouldLoop = ref(true)
  const isPlaying = ref(false)
  let unbindButtons: (() => void) | null = null
  let stopLoop = false
  let initApplied = false
  let initInFlight = false
  let initQueue: Promise<void> = Promise.resolve()

  function notifyReady(): void {
    postToParent({ type: 'banner-player:ready' } satisfies BannerPlayerReadyMessage)
  }

  async function playSlide(slideId: string): Promise<void> {
    await animation.switchSlide(slideId)
    const slide = animation.activeSlide
    if (!slide) return

    animationPlaybackService.captureRestStatesFromCanvas()
    canvasEngine.setPlaybackMode(true)
    unbindButtons?.()
    unbindButtons = canvasEngine.bindPlaybackButtonClicks()

    await new Promise<void>((resolve) => {
      animationPlaybackService.play(
        0,
        slide.duration,
        slide.animations,
        () => {},
        () => {
          animationPlaybackService.restoreRestStates()
          canvasEngine.setPlaybackMode(true)
          unbindButtons?.()
          unbindButtons = canvasEngine.bindPlaybackButtonClicks()
          resolve()
        },
      )
    })
  }

  async function runPlaybackLoop(): Promise<void> {
    if (isPlaying.value) return
    isPlaying.value = true
    stopLoop = false

    while (!stopLoop) {
      for (const slide of animation.slides) {
        if (stopLoop) break
        await playSlide(slide.id)
      }
      if (!shouldLoop.value) break
    }

    isPlaying.value = false
  }

  async function applyInit(data: BannerPlayerInitMessage): Promise<boolean> {
    if (initApplied || initInFlight) {
      postToParent({ type: 'banner-player:loaded' } satisfies BannerPlayerLoadedMessage)
      return true
    }

    initInFlight = true
    shouldLoop.value = data.loop !== false

    if (!hasRestorableStudio(data.studio)) {
      initInFlight = false
      return false
    }

    try {
      const studio = expandStudioFromTransfer(data.studio, data.imagem)
      await importBannerStudioDocument(studio, {
        stripLegacyCover: true,
        stripPreviewDuplicates: data.imagem,
        playback: true,
      })
      unbindButtons?.()
      canvasEngine.setPlaybackMode(true)
      unbindButtons = canvasEngine.bindPlaybackButtonClicks()
      editor.fitToCover()

      if (data.autoplay !== false) {
        void runPlaybackLoop()
      }

      postToParent({ type: 'banner-player:loaded' } satisfies BannerPlayerLoadedMessage)
      initApplied = true
      return true
    } catch (error) {
      console.error('Falha ao iniciar banner player:', error)
      postToParent({ type: 'banner-player:error' } satisfies BannerPlayerErrorMessage)
      return false
    } finally {
      initInFlight = false
    }
  }

  function processPendingInit(): void {
    initQueue = initQueue.then(async () => {
      if (!editor.isReady || !pendingInit.value || initApplied) return
      const data = pendingInit.value
      const ok = await applyInit(data)
      if (ok) {
        pendingInit.value = null
      }
    }).catch((error) => {
      console.error('Falha ao processar init do player:', error)
    })
  }

  watch(
    () => editor.isReady,
    (ready) => {
      if (!ready) return
      processPendingInit()
      notifyReady()
    },
    { immediate: true },
  )

  onMounted(() => {
    window.addEventListener('message', (event) => {
      if (!isParentMessage(event)) return
      const data = event.data as BannerPlayerInitMessage | undefined
      if (!data || typeof data !== 'object' || data.type !== 'banner-player:init') return

      pendingInit.value = data
      processPendingInit()
    })
  })

  onUnmounted(() => {
    stopLoop = true
    animation.stop()
    animationPlaybackService.exitPreview()
    unbindButtons?.()
    unbindButtons = null
  })

  return { isPlaying }
}
