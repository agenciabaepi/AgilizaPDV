import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { HISTORY_LIMIT } from '@/core/constants/editor.constants'
import { canvasEngine } from '@/features/editor/services/canvas.engine'

export const useHistoryStore = defineStore('history', () => {
  const undoStack = ref<string[]>([])
  const redoStack = ref<string[]>([])
  const isRestoring = ref(false)

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  function pushState(): void {
    if (isRestoring.value) return

    const snapshot = canvasEngine.serialize()
    const last = undoStack.value[undoStack.value.length - 1]

    if (last === snapshot) return

    undoStack.value.push(snapshot)

    if (undoStack.value.length > HISTORY_LIMIT) {
      undoStack.value.shift()
    }

    redoStack.value = []
  }

  async function undo(): Promise<void> {
    if (!canUndo.value) return

    isRestoring.value = true
    try {
      const current = canvasEngine.serialize()
      redoStack.value.push(current)

      const previous = undoStack.value.pop()!
      await canvasEngine.loadFromJSON(previous)
    } finally {
      isRestoring.value = false
    }
  }

  async function redo(): Promise<void> {
    if (!canRedo.value) return

    isRestoring.value = true
    try {
      const current = canvasEngine.serialize()
      undoStack.value.push(current)

      const next = redoStack.value.pop()!
      await canvasEngine.loadFromJSON(next)
    } finally {
      isRestoring.value = false
    }
  }

  function clear(): void {
    undoStack.value = []
    redoStack.value = []
  }

  function reset(): void {
    clear()
  }

  return {
    canUndo,
    canRedo,
    pushState,
    undo,
    redo,
    clear,
    reset,
  }
})
