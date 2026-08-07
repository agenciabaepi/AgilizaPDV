<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { TIMELINE_PX_PER_SECOND } from '@/core/constants/animation.constants'
import { LAYER_TYPE_LABELS } from '@/core/constants/editor.constants'
import { useEditorStore } from '@/features/editor/stores/editor.store'
import { useAnimationStore } from '@/features/editor/stores/animation.store'
import AppIcon from '@/shared/components/icons/AppIcon.vue'

const editor = useEditorStore()
const animation = useAnimationStore()

const tracksRef = ref<HTMLElement | null>(null)
const isDraggingPlayhead = ref(false)

const pxPerMs = computed(() => (TIMELINE_PX_PER_SECOND / 1000) * animation.timelineZoom)
const timelineWidth = computed(() => Math.max(animation.duration * pxPerMs.value, 400))
const playheadLeft = computed(() => animation.currentTime * pxPerMs.value)

const rulerMarks = computed(() => {
  const marks: number[] = []
  const step = animation.duration <= 5000 ? 500 : 1000
  for (let t = 0; t <= animation.duration; t += step) {
    marks.push(t)
  }
  return marks
})

const tracks = computed(() =>
  [...editor.layers].reverse().map((layer) => ({
    layer,
    anim: animation.getLayerAnimation(layer.id),
  })),
)

function formatMark(ms: number): string {
  return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`
}

function seekFromClientX(clientX: number): void {
  const el = tracksRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const x = clientX - rect.left + el.scrollLeft
  animation.seek(x / pxPerMs.value)
}

function onRulerClick(event: MouseEvent): void {
  animation.beginScrub()
  seekFromClientX(event.clientX)
  animation.endScrub()
}

function onPlayheadMouseDown(event: MouseEvent): void {
  event.preventDefault()
  isDraggingPlayhead.value = true
  animation.beginScrub()
}

function onDocumentMouseMove(event: MouseEvent): void {
  if (!isDraggingPlayhead.value) return
  seekFromClientX(event.clientX)
}

function onDocumentMouseUp(): void {
  if (isDraggingPlayhead.value) {
    animation.endScrub()
  }
  isDraggingPlayhead.value = false
}

function onTrackClick(layerId: string): void {
  animation.selectLayerFromTimeline(layerId)
}

function getBarStyle(anim: ReturnType<typeof animation.getLayerAnimation>): Record<string, string> {
  const left = anim.delay * pxPerMs.value
  const width = Math.max(anim.duration * pxPerMs.value, 4)
  const colors: Record<string, string> = {
    none: '#52525b',
    fade: '#8b5cf6',
    slide: '#6366f1',
    zoom: '#ec4899',
  }

  return {
    left: `${left}px`,
    width: `${width}px`,
    background: colors[anim.preset] ?? colors.none,
    opacity: anim.preset === 'none' ? '0.25' : '0.85',
  }
}

function openAnimationTab(layerId: string): void {
  animation.selectLayerFromTimeline(layerId)
  editor.syncSelection()
}

onMounted(() => {
  document.addEventListener('mousemove', onDocumentMouseMove)
  document.addEventListener('mouseup', onDocumentMouseUp)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onDocumentMouseMove)
  document.removeEventListener('mouseup', onDocumentMouseUp)
})

watch(
  () => editor.isReady,
  (ready) => {
    if (ready) animation.syncTracksFromLayers()
  },
  { immediate: true },
)
</script>

<template>
  <div class="timeline-panel flex h-full flex-col border-t border-surface-800 bg-surface-900">
    <!-- Transport + slides -->
    <div class="flex shrink-0 items-center gap-3 border-b border-surface-800 px-3 py-2">
      <div class="flex items-center gap-1">
        <button type="button" class="transport-btn" title="Parar" @click="animation.stop()">
          <AppIcon name="stop" :size="14" />
        </button>
        <button type="button" class="transport-btn transport-btn--primary" title="Play/Pause" @click="animation.togglePlay()">
          <AppIcon :name="animation.isPlaying ? 'pause' : 'play'" :size="14" />
        </button>
      </div>

      <span class="font-mono text-xs text-zinc-400">
        {{ animation.formattedCurrentTime }} / {{ animation.formattedDuration }}
      </span>

      <div class="mx-2 h-4 w-px bg-surface-700" />

      <div class="flex flex-1 items-center gap-1 overflow-x-auto">
        <button
          v-for="slide in animation.slides"
          :key="slide.id"
          type="button"
          class="slide-tab"
          :class="{ 'slide-tab--active': animation.activeSlideId === slide.id }"
          @click="animation.switchSlide(slide.id)"
        >
          {{ slide.name }}
        </button>
        <button type="button" class="slide-tab slide-tab--add" title="Novo slide" @click="animation.addSlide()">
          +
        </button>
      </div>

      <label class="flex items-center gap-2 text-xs text-zinc-500">
        Duração
        <input
          type="number"
          class="duration-input"
          :value="Math.round(animation.duration / 100) / 10"
          min="1"
          max="30"
          step="0.5"
          @change="animation.setSlideDuration(Number(($event.target as HTMLInputElement).value) * 1000)"
        />
        s
      </label>
    </div>

    <!-- Timeline body -->
    <div class="flex min-h-0 flex-1">
      <!-- Layer labels -->
      <div class="w-36 shrink-0 overflow-y-auto border-r border-surface-800 bg-surface-950">
        <div class="h-7 shrink-0 border-b border-surface-800" />
        <button
          v-for="{ layer } in tracks"
          :key="layer.id"
          type="button"
          class="track-label"
          :class="{ 'track-label--active': editor.selectedLayerId === layer.id }"
          @click="onTrackClick(layer.id)"
          @dblclick="openAnimationTab(layer.id)"
        >
          <span class="truncate">{{ layer.name }}</span>
          <span class="text-zinc-600">{{ LAYER_TYPE_LABELS[layer.type] }}</span>
        </button>
        <div v-if="tracks.length === 0" class="px-3 py-6 text-center text-xs text-zinc-600">
          Adicione elementos ao canvas
        </div>
      </div>

      <!-- Tracks area -->
      <div ref="tracksRef" class="timeline-scroll relative min-w-0 flex-1 overflow-auto">
        <!-- Ruler -->
        <div
          class="sticky top-0 z-20 h-7 cursor-pointer border-b border-surface-800 bg-surface-950"
          :style="{ width: `${timelineWidth}px` }"
          @click="onRulerClick"
        >
          <span
            v-for="mark in rulerMarks"
            :key="mark"
            class="ruler-mark"
            :style="{ left: `${mark * pxPerMs}px` }"
          >
            {{ formatMark(mark) }}
          </span>
        </div>

        <!-- Tracks -->
        <div :style="{ width: `${timelineWidth}px` }">
          <div
            v-for="{ layer, anim } in tracks"
            :key="layer.id"
            class="track-row"
            :class="{ 'track-row--active': editor.selectedLayerId === layer.id }"
            @click="onTrackClick(layer.id)"
          >
            <div
              v-if="anim.preset !== 'none'"
              class="anim-bar"
              :style="getBarStyle(anim)"
              :title="`${anim.preset} · ${anim.delay}ms + ${anim.duration}ms`"
            />
            <div
              v-else
              class="anim-bar anim-bar--empty"
              :style="{ left: '0px', width: '4px' }"
            />
          </div>
        </div>

        <!-- Playhead -->
        <div
          class="playhead"
          :style="{ left: `${playheadLeft}px` }"
          @mousedown="onPlayheadMouseDown"
        >
          <div class="playhead__head" />
          <div class="playhead__line" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.border-surface-800 { border-color: var(--color-surface-800); }
.border-surface-700 { border-color: var(--color-surface-700); }
.bg-surface-900 { background: var(--color-surface-900); }
.bg-surface-950 { background: var(--color-surface-950); }

.transport-btn {
  display: flex;
  height: 1.75rem;
  width: 1.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  color: #a1a1aa;
  transition: background 0.12s, color 0.12s;
}
.transport-btn:hover {
  background: var(--color-surface-800);
  color: #f4f4f5;
}
.transport-btn--primary {
  background: var(--color-accent-600);
  color: white;
}
.transport-btn--primary:hover {
  background: var(--color-accent-500);
  color: white;
}

.slide-tab {
  shrink: 0;
  border-radius: 0.375rem;
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  color: #71717a;
  transition: background 0.12s, color 0.12s;
}
.slide-tab:hover { background: var(--color-surface-800); color: #d4d4d8; }
.slide-tab--active {
  background: color-mix(in srgb, var(--color-accent-600) 20%, transparent);
  color: var(--color-accent-400);
}
.slide-tab--add {
  width: 1.5rem;
  padding: 0.25rem;
  font-size: 0.875rem;
}

.duration-input {
  width: 3rem;
  border-radius: 0.375rem;
  border: 1px solid var(--color-surface-700);
  background: var(--color-surface-850);
  padding: 0.125rem 0.375rem;
  font-size: 0.75rem;
  color: #e4e4e7;
  outline: none;
}

.track-label {
  display: flex;
  height: 36px;
  flex-direction: column;
  justify-content: center;
  border-bottom: 1px solid var(--color-surface-800);
  padding: 0 0.625rem;
  text-align: left;
  font-size: 0.6875rem;
  color: #a1a1aa;
  transition: background 0.12s;
}
.track-label:hover { background: var(--color-surface-800); }
.track-label--active {
  background: color-mix(in srgb, var(--color-accent-600) 12%, transparent);
  color: #e4e4e7;
}

.ruler-mark {
  position: absolute;
  top: 0;
  padding-top: 0.375rem;
  padding-left: 0.25rem;
  font-size: 0.625rem;
  color: #52525b;
  border-left: 1px solid var(--color-surface-800);
  height: 100%;
}

.track-row {
  position: relative;
  height: 36px;
  border-bottom: 1px solid var(--color-surface-800);
  background: var(--color-surface-900);
}
.track-row--active {
  background-color: color-mix(in srgb, var(--color-accent-600) 5%, transparent);
}

.anim-bar {
  position: absolute;
  top: 8px;
  height: 20px;
  border-radius: 4px;
  pointer-events: none;
}
.anim-bar--empty {
  background: #3f3f46;
  opacity: 0.4;
}

.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 30;
  width: 0;
  cursor: ew-resize;
  transform: translateX(-6px);
}
.playhead__head {
  position: absolute;
  top: 0;
  left: 3px;
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 8px solid #ef4444;
}
.playhead__line {
  position: absolute;
  top: 8px;
  bottom: 0;
  left: 8px;
  width: 2px;
  background: #ef4444;
  pointer-events: none;
}
</style>
