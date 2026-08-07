import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { LayerAnimation, TimelineSlide } from '@/core/types/animation.types'
import {
  DEFAULT_ANIMATION_DURATION,
  DEFAULT_SLIDE_DURATION,
} from '@/core/constants/animation.constants'
import { generateId } from '@/core/utils/helpers'
import { canvasEngine } from '@/features/editor/services/canvas.engine'
import { animationPlaybackService } from '@/features/editor/services/animation-playback.service'
import { useEditorStore } from '@/features/editor/stores/editor.store'

function createDefaultAnimation(layerId: string): LayerAnimation {
  return {
    layerId,
    preset: 'none',
    delay: 0,
    duration: DEFAULT_ANIMATION_DURATION,
    easing: 'easeOut',
    direction: 'left',
    enabled: true,
  }
}

function createSlide(name: string, index: number): TimelineSlide {
  return {
    id: generateId(),
    name: name || `Slide ${index}`,
    duration: DEFAULT_SLIDE_DURATION,
    animations: {},
    canvasSnapshot: null,
  }
}

export const useAnimationStore = defineStore('animation', () => {
  const slides = ref<TimelineSlide[]>([createSlide('Slide 1', 1)])
  const activeSlideId = ref(slides.value[0].id)
  const currentTime = ref(0)
  const isPlaying = ref(false)
  const isScrubbing = ref(false)
  const timelineZoom = ref(1)

  const activeSlide = computed(() =>
    slides.value.find((slide) => slide.id === activeSlideId.value) ?? null,
  )

  const duration = computed(() => activeSlide.value?.duration ?? DEFAULT_SLIDE_DURATION)

  const layerAnimations = computed(() => activeSlide.value?.animations ?? {})

  const formattedCurrentTime = computed(() => formatMs(currentTime.value))
  const formattedDuration = computed(() => formatMs(duration.value))

  function formatMs(ms: number): string {
    const totalSeconds = ms / 1000
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`
  }

  function syncTracksFromLayers(): void {
    const slide = activeSlide.value
    if (!slide) return

    const editor = useEditorStore()
    const layerIds = editor.layers.map((layer) => layer.id)

    for (const layerId of layerIds) {
      if (!slide.animations[layerId]) {
        slide.animations[layerId] = createDefaultAnimation(layerId)
      }
    }

    for (const layerId of Object.keys(slide.animations)) {
      if (!layerIds.includes(layerId)) {
        delete slide.animations[layerId]
      }
    }
  }

  function getLayerAnimation(layerId: string): LayerAnimation {
    const slide = activeSlide.value
    if (!slide) return createDefaultAnimation(layerId)

    if (!slide.animations[layerId]) {
      slide.animations[layerId] = createDefaultAnimation(layerId)
    }

    return slide.animations[layerId]
  }

  function updateLayerAnimation(
    layerId: string,
    patch: Partial<Omit<LayerAnimation, 'layerId'>>,
  ): void {
    const slide = activeSlide.value
    if (!slide) return

    const current = getLayerAnimation(layerId)
    slide.animations[layerId] = { ...current, ...patch }
    animationPlaybackService.ensureRestStates()

    if (isPlaying.value || isScrubbing.value) {
      seek(currentTime.value)
    }
  }

  function ensureDesignMode(force = false): void {
    if (!force && (isPlaying.value || isScrubbing.value)) return
    isScrubbing.value = false
    animationPlaybackService.restoreDesignMode()
  }

  function forceDesignMode(): void {
    isPlaying.value = false
    isScrubbing.value = false
    animationPlaybackService.restoreDesignMode()
  }

  function beginScrub(): void {
    isScrubbing.value = true
    animationPlaybackService.ensureRestStates()
  }

  function endScrub(): void {
    isScrubbing.value = false
    if (!isPlaying.value) {
      ensureDesignMode()
    }
  }

  function setSlideDuration(value: number): void {
    const slide = activeSlide.value
    if (!slide) return
    slide.duration = Math.max(1000, Math.min(value, 30000))
  }

  function seek(timeMs: number): void {
    const slide = activeSlide.value
    if (!slide) return

    currentTime.value = Math.min(Math.max(timeMs, 0), slide.duration)

    if (isPlaying.value || isScrubbing.value) {
      animationPlaybackService.seek(currentTime.value, slide.animations, slide.duration)
      return
    }

    ensureDesignMode()
  }

  function play(): void {
    const slide = activeSlide.value
    if (!slide || isPlaying.value) return

    isPlaying.value = true
    animationPlaybackService.ensureRestStates()

    if (currentTime.value >= slide.duration) {
      currentTime.value = 0
    }

    animationPlaybackService.play(
      currentTime.value,
      slide.duration,
      slide.animations,
      (time) => {
        currentTime.value = time
      },
      () => {
        isPlaying.value = false
        ensureDesignMode()
      },
    )
  }

  function pause(): void {
    if (!isPlaying.value) return
    isPlaying.value = false
    animationPlaybackService.pause()
    ensureDesignMode()
  }

  function stop(): void {
    isPlaying.value = false
    isScrubbing.value = false
    animationPlaybackService.stop()
    currentTime.value = 0
  }

  function togglePlay(): void {
    if (isPlaying.value) {
      pause()
    } else {
      play()
    }
  }

  async function flushCurrentSlideSnapshot(): Promise<void> {
    const slide = activeSlide.value
    if (!slide) return
    slide.canvasSnapshot = canvasEngine.serialize()
  }

  function importState(nextSlides: TimelineSlide[], nextActiveSlideId: string): void {
    stop()
    slides.value = structuredClone(nextSlides)
    activeSlideId.value = nextActiveSlideId
    currentTime.value = 0
  }

  async function saveCurrentSlideSnapshot(): Promise<void> {
    const slide = activeSlide.value
    if (!slide) return
    slide.canvasSnapshot = canvasEngine.serialize()
  }

  async function switchSlide(slideId: string): Promise<void> {
    if (slideId === activeSlideId.value) return

    stop()
    await saveCurrentSlideSnapshot()

    const target = slides.value.find((slide) => slide.id === slideId)
    if (!target) return

    activeSlideId.value = slideId
    currentTime.value = 0

    if (target.canvasSnapshot) {
      await canvasEngine.loadFromJSON(target.canvasSnapshot)
      useEditorStore().syncSelection()
    }

    syncTracksFromLayers()
  }

  async function addSlide(): Promise<void> {
    await saveCurrentSlideSnapshot()

    const slide = createSlide(`Slide ${slides.value.length + 1}`, slides.value.length + 1)
    slide.canvasSnapshot = canvasEngine.serialize()
    slides.value.push(slide)
    await switchSlide(slide.id)
  }

  async function duplicateSlide(slideId: string): Promise<void> {
    const source = slides.value.find((slide) => slide.id === slideId)
    if (!source) return

    await saveCurrentSlideSnapshot()

    const copy: TimelineSlide = {
      id: generateId(),
      name: `${source.name} (cópia)`,
      duration: source.duration,
      animations: structuredClone(source.animations),
      canvasSnapshot: source.canvasSnapshot ?? canvasEngine.serialize(),
    }

    slides.value.push(copy)
    await switchSlide(copy.id)
  }

  function removeSlide(slideId: string): void {
    if (slides.value.length <= 1) return

    const index = slides.value.findIndex((slide) => slide.id === slideId)
    if (index === -1) return

    slides.value.splice(index, 1)

    if (activeSlideId.value === slideId) {
      const next = slides.value[Math.max(0, index - 1)]
      void switchSlide(next.id)
    }
  }

  function selectLayerFromTimeline(layerId: string): void {
    useEditorStore().selectLayer(layerId)
  }

  return {
    slides,
    activeSlideId,
    activeSlide,
    currentTime,
    isPlaying,
    isScrubbing,
    timelineZoom,
    duration,
    layerAnimations,
    formattedCurrentTime,
    formattedDuration,
    syncTracksFromLayers,
    getLayerAnimation,
    updateLayerAnimation,
    setSlideDuration,
    seek,
    play,
    pause,
    stop,
    togglePlay,
    ensureDesignMode,
    forceDesignMode,
    beginScrub,
    endScrub,
    switchSlide,
    addSlide,
    duplicateSlide,
    removeSlide,
    selectLayerFromTimeline,
    flushCurrentSlideSnapshot,
    importState,
  }
})
