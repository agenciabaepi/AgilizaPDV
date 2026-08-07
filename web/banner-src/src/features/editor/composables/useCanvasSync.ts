import { watch, onUnmounted } from 'vue'
import { useEditorStore } from '@/features/editor/stores/editor.store'
import { useHistoryStore } from '@/features/editor/stores/history.store'
import { canvasEngine } from '@/features/editor/services/canvas.engine'

export function useCanvasSync(): void {
  const editor = useEditorStore()
  const history = useHistoryStore()

  let cleanup: (() => void) | null = null

  function bindCanvasEvents(): void {
    cleanup?.()

    const canvas = canvasEngine.getCanvas()
    if (!canvas) return

    const onSelection = () => editor.syncSelection()
    const onSelectionCleared = () => editor.handleSelectionCleared()
    const onModified = () => history.pushState()

    canvas.on('selection:created', onSelection)
    canvas.on('selection:updated', onSelection)
    canvas.on('selection:cleared', onSelectionCleared)
    canvas.on('object:modified', onModified)

    cleanup = () => {
      canvas.off('selection:created', onSelection)
      canvas.off('selection:updated', onSelection)
      canvas.off('selection:cleared', onSelectionCleared)
      canvas.off('object:modified', onModified)
    }
  }

  watch(
    () => editor.isReady,
    (ready) => {
      if (ready) bindCanvasEvents()
    },
    { immediate: true },
  )

  onUnmounted(() => cleanup?.())
}
