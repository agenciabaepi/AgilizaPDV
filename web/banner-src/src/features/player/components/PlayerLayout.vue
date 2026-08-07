<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useEditorStore } from '@/features/editor/stores/editor.store'

const editor = useEditorStore()
const workspaceRef = ref<HTMLElement | null>(null)
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

onMounted(() => {
  if (!canvasRef.value) return
  editor.initCanvas(canvasRef.value)

  if (workspaceRef.value) {
    resizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      editor.setWorkspaceSize(width, height)
      editor.fitToCover()
    })
    resizeObserver.observe(workspaceRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  editor.disposeCanvas()
})

watch(
  () => editor.project.dimensions,
  () => editor.fitToCover(),
  { deep: true },
)
</script>

<template>
  <div ref="workspaceRef" class="player-workspace">
    <div class="player-frame-wrap">
      <div class="player-frame" :style="canvasStyle">
        <div class="player-canvas-host" :style="frameStyle">
          <canvas ref="canvasRef" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.player-workspace {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
}
.player-frame-wrap {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 0;
}
.player-frame {
  position: relative;
}
.player-canvas-host {
  position: relative;
  overflow: hidden;
}
</style>
