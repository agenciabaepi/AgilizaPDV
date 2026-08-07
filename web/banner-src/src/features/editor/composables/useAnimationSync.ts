import { watch, onUnmounted } from 'vue'
import { useEditorStore } from '@/features/editor/stores/editor.store'
import { useAnimationStore } from '@/features/editor/stores/animation.store'
import { animationPlaybackService } from '@/features/editor/services/animation-playback.service'
import { canvasEngine } from '@/features/editor/services/canvas.engine'

export function useAnimationSync(): void {
  const editor = useEditorStore()
  const animation = useAnimationStore()

  let modifiedCleanup: (() => void) | null = null

  watch(
    () => editor.isReady,
    (ready) => {
      if (!ready) return
      animation.syncTracksFromLayers()
      animationPlaybackService.captureRestStatesFromCanvas()

      modifiedCleanup?.()
      const canvas = canvasEngine.getCanvas()
      if (!canvas) return

      const shouldSkipRestCapture = () =>
        animation.isPlaying ||
        animation.isScrubbing ||
        animationPlaybackService.isInPreview()

      const onModified = () => {
        if (shouldSkipRestCapture()) return
        animationPlaybackService.commitEditsToRestStates()
      }

      const onObjectAdded = () => {
        if (shouldSkipRestCapture()) return
        animationPlaybackService.commitEditsToRestStates()
      }

      canvas.on('object:modified', onModified)
      canvas.on('object:added', onObjectAdded)
      modifiedCleanup = () => {
        canvas.off('object:modified', onModified)
        canvas.off('object:added', onObjectAdded)
      }
    },
    { immediate: true },
  )

  watch(
    () => editor.layers.map((layer) => layer.id).join(','),
    () => {
      animation.syncTracksFromLayers()
      if (
        !animation.isPlaying &&
        !animation.isScrubbing &&
        !animationPlaybackService.isInPreview()
      ) {
        animationPlaybackService.commitEditsToRestStates()
      }
    },
  )

  onUnmounted(() => {
    modifiedCleanup?.()
    animation.stop()
  })
}
