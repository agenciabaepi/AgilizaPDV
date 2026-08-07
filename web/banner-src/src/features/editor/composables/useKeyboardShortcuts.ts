import { onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '@/features/editor/stores/editor.store'
import { useHistoryStore } from '@/features/editor/stores/history.store'
import { useAnimationStore } from '@/features/editor/stores/animation.store'

export function useKeyboardShortcuts(): void {
  const editor = useEditorStore()
  const history = useHistoryStore()
  const animation = useAnimationStore()

  async function handleKeyDown(event: KeyboardEvent): Promise<void> {
    const target = event.target as HTMLElement
    const isEditing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

    if (isEditing) return

    const mod = event.metaKey || event.ctrlKey

    if (mod && event.key === 'z' && !event.shiftKey) {
      event.preventDefault()
      await history.undo()
      editor.syncSelection()
      return
    }

    if (mod && (event.key === 'Z' || (event.key === 'z' && event.shiftKey))) {
      event.preventDefault()
      await history.redo()
      editor.syncSelection()
      return
    }

    if (mod && event.key === 'd') {
      event.preventDefault()
      editor.duplicateSelected()
      history.pushState()
      return
    }

    if (mod && event.key === 'c') {
      event.preventDefault()
      await editor.copySelected()
      return
    }

    if (mod && event.key === 'x') {
      event.preventDefault()
      await editor.cutSelected()
      history.pushState()
      return
    }

    if (mod && event.key === 'v') {
      event.preventDefault()
      await editor.pasteClipboard()
      history.pushState()
      return
    }

    if (mod && event.key === ']' && event.altKey) {
      event.preventDefault()
      editor.reorderSelected('front')
      history.pushState()
      return
    }

    if (mod && event.key === ']' && !event.altKey) {
      event.preventDefault()
      editor.reorderSelected('up')
      history.pushState()
      return
    }

    if (mod && event.key === '[' && event.altKey) {
      event.preventDefault()
      editor.reorderSelected('back')
      history.pushState()
      return
    }

    if (mod && event.key === '[' && !event.altKey) {
      event.preventDefault()
      editor.reorderSelected('down')
      history.pushState()
      return
    }

    if (mod && event.key === 's') {
      event.preventDefault()
      await editor.exportBanner()
      return
    }

    if (event.key === ' ' && !mod) {
      event.preventDefault()
      animation.togglePlay()
      return
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      editor.deleteSelected()
      return
    }

    if (event.key === 't' && !mod) {
      editor.addText()
      return
    }

    if (mod && event.key === '0') {
      event.preventDefault()
      editor.fitToScreen()
      return
    }

    if (mod && (event.key === '=' || event.key === '+')) {
      event.preventDefault()
      editor.zoomIn()
      return
    }

    if (mod && event.key === '-') {
      event.preventDefault()
      editor.zoomOut()
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })
}
