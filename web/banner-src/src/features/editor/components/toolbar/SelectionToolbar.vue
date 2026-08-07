<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { IText } from 'fabric'
import { useEditorStore } from '@/features/editor/stores/editor.store'
import { isButtonObject } from '@/features/editor/services/button.helpers'
import { startTextEditing } from '@/features/editor/services/text-editing.service'
import { useUiStore } from '@/features/editor/stores/ui.store'
import { useHistoryStore } from '@/features/editor/stores/history.store'
import { canvasEngine } from '@/features/editor/services/canvas.engine'
import { computeToolbarPosition } from '@/features/editor/utils/toolbar-position'
import { computeModalPosition } from '@/features/editor/utils/modal-position'
import AppIcon from '@/shared/components/icons/AppIcon.vue'
import type { IconName } from '@/shared/components/icons/icon.types'

const props = defineProps<{
  frameElement: HTMLElement | null
}>()

const editor = useEditorStore()
const ui = useUiStore()
const history = useHistoryStore()

const position = ref({
  x: 0,
  top: 0,
  placement: 'above' as 'above' | 'below',
  menuPlacement: 'above' as 'above' | 'below',
})
const rootRef = ref<HTMLElement | null>(null)

const isVisible = computed(() => !!editor.selectedObject && !!props.frameElement)
const isText = computed(() => editor.selectedObject instanceof IText)
const isButton = computed(() => isButtonObject(editor.selectedObject))
const canEditLabel = computed(() => isText.value || isButton.value)
const isLayerVisible = computed(() => editor.selectedLayer?.visible ?? true)

const wrapperStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.top}px`,
  transform: 'translateX(-50%)',
}))

function updatePosition(): void {
  const obj = editor.selectedObject
  if (!obj || !props.frameElement) return
  position.value = computeToolbarPosition(obj, props.frameElement, editor.viewport.zoom, {
    menuOpen: ui.contextMenuOpen,
  })
}

function openProperties(): void {
  const obj = editor.selectedObject
  if (!obj || !props.frameElement) return
  ui.openPropertiesModal(computeModalPosition(obj, props.frameElement, editor.viewport.zoom))
}

function editTextOnCanvas(): void {
  const obj = editor.selectedObject
  if (!obj || !props.frameElement) return
  ui.closeContextMenu()

  if (isButtonObject(obj)) {
    startTextEditing(obj, props.frameElement)
    return
  }

  if (!(obj instanceof IText)) return
  startTextEditing(obj, props.frameElement)
}

function handleDuplicate(): void {
  editor.duplicateSelected()
  history.pushState()
  ui.closeContextMenu()
}

async function handleCut(): Promise<void> {
  await editor.cutSelected()
  history.pushState()
  ui.closeContextMenu()
}

async function handleCopy(): Promise<void> {
  await editor.copySelected()
  ui.closeContextMenu()
}

function handleDelete(): void {
  editor.deleteSelected()
  history.pushState()
  ui.closeContextMenu()
}

function handleToggleVisibility(): void {
  editor.toggleSelectedVisibility()
  history.pushState()
  ui.closeContextMenu()
}

function handleReorder(direction: 'up' | 'down' | 'front' | 'back'): void {
  editor.reorderSelected(direction)
  history.pushState()
  ui.closeContextMenu()
}

function toggleMenu(): void {
  ui.toggleContextMenu()
}

function onDocumentClick(event: MouseEvent): void {
  const target = event.target as HTMLElement
  if (rootRef.value?.contains(target)) return
  if (target.closest('.selection-toolbar')) return
  ui.closeContextMenu()
}

interface MenuItem {
  label: string
  icon: IconName
  shortcut?: string
  danger?: boolean
  action: () => void
}

const menuItems = computed((): MenuItem[] => [
  { label: 'Cortar', icon: 'cut', shortcut: '⌘X', action: handleCut },
  { label: 'Copiar', icon: 'copy', shortcut: '⌘C', action: handleCopy },
  { label: 'Duplicar', icon: 'clipboard', shortcut: '⌘D', action: handleDuplicate },
  { label: 'Deletar', icon: 'trash', shortcut: '⌫', danger: true, action: handleDelete },
])

const layerItems = computed((): MenuItem[] => [
  { label: 'Na frente de tudo', icon: 'bring-front', shortcut: '⌥⌘]', action: () => handleReorder('front') },
  { label: 'Para frente', icon: 'bring-forward', shortcut: '⌘]', action: () => handleReorder('up') },
  { label: 'Atrás de tudo', icon: 'send-back', shortcut: '⌥⌘[', action: () => handleReorder('back') },
  { label: 'Para trás', icon: 'send-backward', shortcut: '⌘[', action: () => handleReorder('down') },
])

watch(
  () => [editor.selectedObject, editor.viewport.zoom, editor.viewport.panX, editor.viewport.panY, ui.contextMenuOpen],
  () => updatePosition(),
  { deep: true },
)

watch(isVisible, (visible) => {
  if (!visible) ui.closeContextMenu()
  if (visible) updatePosition()
})

watch(
  () => editor.isReady,
  (ready) => {
    if (!ready) return
    const canvas = canvasEngine.getCanvas()
    if (!canvas) return

    const reposition = () => updatePosition()
    canvas.on('object:modified', reposition)
    canvas.on('object:moving', reposition)
    canvas.on('object:scaling', reposition)
    canvas.on('object:rotating', reposition)
  },
  { immediate: true },
)

onMounted(() => document.addEventListener('mousedown', onDocumentClick))
onUnmounted(() => document.removeEventListener('mousedown', onDocumentClick))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      ref="rootRef"
      class="selection-toolbar fixed z-40 flex flex-col items-stretch"
      :class="position.menuPlacement === 'above' ? 'flex-col-reverse' : 'flex-col'"
      :style="wrapperStyle"
    >
      <!-- Toolbar -->
      <div class="flex items-center gap-0.5 rounded-xl bg-white px-1.5 py-1 shadow-lg shadow-black/20 ring-1 ring-black/5">
        <button
          v-if="canEditLabel"
          type="button"
          class="toolbar-btn toolbar-btn--label"
          @mousedown.stop
          @click="editTextOnCanvas"
        >
          <AppIcon name="edit" :size="14" />
          Editar textos
        </button>
        <button
          v-else
          type="button"
          class="toolbar-btn toolbar-btn--label"
          @click="openProperties"
        >
          <AppIcon name="settings" :size="14" />
          Propriedades
        </button>

        <div class="mx-0.5 h-5 w-px bg-zinc-200" />

        <button type="button" class="toolbar-btn" title="Duplicar (⌘D)" @click="handleDuplicate">
          <AppIcon name="duplicate" :size="16" />
        </button>
        <button
          type="button"
          class="toolbar-btn"
          :title="isLayerVisible ? 'Ocultar' : 'Mostrar'"
          @click="handleToggleVisibility"
        >
          <AppIcon :name="isLayerVisible ? 'eye' : 'eye-off'" :size="16" />
        </button>
        <button type="button" class="toolbar-btn" title="Excluir (⌫)" @click="handleDelete">
          <AppIcon name="trash" :size="16" />
        </button>

        <div class="mx-0.5 h-5 w-px bg-zinc-200" />

        <button
          type="button"
          class="toolbar-btn"
          :class="{ 'toolbar-btn--active': ui.contextMenuOpen }"
          title="Mais opções"
          @click.stop="toggleMenu"
        >
          <AppIcon name="more-vertical" :size="16" />
        </button>
      </div>

      <!-- Menu abre para longe do elemento -->
      <Transition :name="position.menuPlacement === 'above' ? 'menu-rise' : 'menu-drop'">
        <div
          v-if="ui.contextMenuOpen"
          class="w-56 overflow-hidden rounded-xl bg-white py-1 shadow-xl shadow-black/20 ring-1 ring-black/5"
          :class="position.menuPlacement === 'above' ? 'mb-1.5 origin-bottom' : 'mt-1.5 origin-top'"
          @click.stop
        >
          <button
            v-for="item in menuItems"
            :key="item.label"
            type="button"
            class="menu-item"
            :class="{ 'menu-item--danger': item.danger }"
            @click="item.action"
          >
            <span class="menu-item__label">
              <AppIcon :name="item.icon" :size="15" />
              {{ item.label }}
            </span>
            <kbd v-if="item.shortcut">{{ item.shortcut }}</kbd>
          </button>

          <div class="my-1 h-px bg-zinc-100" />

          <button
            v-for="item in layerItems"
            :key="item.label"
            type="button"
            class="menu-item"
            @click="item.action"
          >
            <span class="menu-item__label">
              <AppIcon :name="item.icon" :size="15" />
              {{ item.label }}
            </span>
            <kbd v-if="item.shortcut">{{ item.shortcut }}</kbd>
          </button>

          <div class="my-1 h-px bg-zinc-100" />

          <button type="button" class="menu-item" @click="openProperties">
            <span class="menu-item__label">
              <AppIcon name="settings" :size="15" />
              Configurações
            </span>
          </button>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.toolbar-btn {
  display: flex;
  height: 2rem;
  min-width: 2rem;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  border-radius: 0.5rem;
  padding: 0 0.5rem;
  color: #52525b;
  transition: background 0.12s, color 0.12s;
}
.toolbar-btn:hover {
  background: #f4f4f5;
  color: #18181b;
}
.toolbar-btn--label {
  padding: 0 0.625rem;
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
}
.toolbar-btn--active {
  background: #ede9fe;
  color: #6d28d9;
}
.menu-item {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.875rem;
  font-size: 0.8125rem;
  color: #3f3f46;
  transition: background 0.12s;
}
.menu-item__label {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}
.menu-item:hover {
  background: #f4f4f5;
}
.menu-item--danger {
  color: #dc2626;
}
.menu-item--danger:hover {
  background: #fef2f2;
}
.menu-item kbd {
  font-size: 0.6875rem;
  color: #a1a1aa;
  font-family: inherit;
}
.menu-drop-enter-active,
.menu-drop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.menu-drop-enter-from,
.menu-drop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
.menu-rise-enter-active,
.menu-rise-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.menu-rise-enter-from,
.menu-rise-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}
</style>
