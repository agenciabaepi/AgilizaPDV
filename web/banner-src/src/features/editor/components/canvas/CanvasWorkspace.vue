<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import type { FabricObject } from 'fabric'
import { IText } from 'fabric'
import { useEditorStore } from '@/features/editor/stores/editor.store'
import { isButtonObject } from '@/features/editor/services/button.helpers'
import { startTextEditing, syncActiveTextEditingPosition } from '@/features/editor/services/text-editing.service'
import { useUiStore } from '@/features/editor/stores/ui.store'
import { canvasEngine } from '@/features/editor/services/canvas.engine'
import { computeModalPosition } from '@/features/editor/utils/modal-position'
import PropertiesModal from '@/features/editor/components/panels/PropertiesModal.vue'
import SelectionToolbar from '@/features/editor/components/toolbar/SelectionToolbar.vue'

const editor = useEditorStore()
const ui = useUiStore()
const workspaceRef = ref<HTMLElement | null>(null)
const canvasFrameRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const canvasStyle = computed(() => ({
  transform: `translate(${editor.viewport.panX}px, ${editor.viewport.panY}px) scale(${editor.viewport.zoom})`,
  transformOrigin: '0 0',
}))

const frameStyle = computed(() => ({
  width: `${editor.project.dimensions.width}px`,
  height: `${editor.project.dimensions.height}px`,
  backgroundColor: editor.project.backgroundColor,
}))

let resizeObserver: ResizeObserver | null = null
let dblClickCleanup: (() => void) | null = null

function openPropertiesForObject(object: FabricObject): void {
  if (!canvasFrameRef.value) return
  if (object.get('layerType') === 'background') return

  if (object instanceof IText && object.isEditing) {
    object.exitEditing()
  }

  if (isButtonObject(object)) {
    const parts = object.getObjects().find((o) => o instanceof IText)
    if (parts instanceof IText && parts.isEditing) {
      parts.exitEditing()
    }
  }

  editor.syncSelection()
  const canvas = canvasEngine.getCanvas()
  canvas?.setActiveObject(object)
  canvas?.requestRenderAll()

  const position = computeModalPosition(object, canvasFrameRef.value, editor.viewport.zoom)
  ui.openPropertiesModal(position)
}

function bindDoubleClick(): void {
  dblClickCleanup?.()

  const canvas = canvasEngine.getCanvas()
  if (!canvas) return

  const onDoubleClick = (event: { target?: FabricObject; subTargets?: FabricObject[] }) => {
    const subTarget = event.subTargets?.[0]
    const target = event.target

    if (target && isButtonObject(target)) {
      if (subTarget instanceof IText) {
        startTextEditing(target, canvasFrameRef.value)
      } else {
        openPropertiesForObject(target)
      }
      return
    }

    if (!target) return
    openPropertiesForObject(target)
  }

  canvas.on('mouse:dblclick', onDoubleClick)
  dblClickCleanup = () => canvas.off('mouse:dblclick', onDoubleClick)
}

function onWorkspaceClick(event: MouseEvent): void {
  const target = event.target as HTMLElement
  if (target.closest('.properties-modal')) return
  if (target.closest('.selection-toolbar')) return
  if (target.closest('canvas') || target.closest('.canvas-frame')) {
    if (ui.propertiesModalOpen) ui.closePropertiesModal()
    return
  }
  if (ui.propertiesModalOpen) ui.closePropertiesModal()
}

onMounted(() => {
  if (!canvasRef.value) return
  editor.initCanvas(canvasRef.value)

  if (workspaceRef.value) {
    resizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      editor.setWorkspaceSize(width, height)
    })
    resizeObserver.observe(workspaceRef.value)
    workspaceRef.value.addEventListener('mousedown', onWorkspaceClick)
  }
})

watch(
  () => editor.isReady,
  (ready) => {
    if (ready) bindDoubleClick()
  },
  { immediate: true },
)

onUnmounted(() => {
  resizeObserver?.disconnect()
  dblClickCleanup?.()
  workspaceRef.value?.removeEventListener('mousedown', onWorkspaceClick)
  editor.disposeCanvas()
})

watch(
  () => [editor.viewport.zoom, editor.viewport.panX, editor.viewport.panY],
  () => syncActiveTextEditingPosition(canvasFrameRef.value),
)

watch(
  () => editor.project.dimensions,
  () => editor.fitToScreen(),
  { deep: true },
)

defineExpose({ openPropertiesForObject })

</script>

<template>
  <div
    ref="workspaceRef"
    class="relative flex-1 overflow-hidden bg-surface-950"
    style="background-image: radial-gradient(circle, #2a2a36 1px, transparent 1px); background-size: 20px 20px;"
  >
    <div class="absolute inset-0 flex items-start justify-start overflow-auto p-6">
      <div
        ref="canvasFrameRef"
        class="canvas-frame relative shadow-2xl shadow-black/50 ring-1 ring-white/10"
        :style="canvasStyle"
      >
        <div
          class="relative overflow-hidden"
          :style="frameStyle"
        >
          <canvas ref="canvasRef" />
        </div>

        <div class="pointer-events-none absolute -bottom-7 left-0 text-xs text-zinc-500">
          {{ editor.project.dimensions.width }} × {{ editor.project.dimensions.height }} px
        </div>
      </div>
    </div>

    <div
      v-if="!editor.selectedObject && !ui.propertiesModalOpen"
      class="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-surface-800/90 px-4 py-2 text-xs text-zinc-500 backdrop-blur-sm"
    >
      Clique para selecionar · Duplo clique para propriedades
    </div>

    <SelectionToolbar :frame-element="canvasFrameRef" />
    <PropertiesModal />
  </div>
</template>

<style scoped>
.bg-surface-950 {
  background-color: var(--color-surface-950);
}
.bg-surface-800\/90 {
  background: color-mix(in srgb, var(--color-surface-800) 90%, transparent);
}
</style>
