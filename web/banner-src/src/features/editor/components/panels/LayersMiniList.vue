<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '@/features/editor/stores/editor.store'
import { useHistoryStore } from '@/features/editor/stores/history.store'
import AppIcon from '@/shared/components/icons/AppIcon.vue'
import type { IconName } from '@/shared/components/icons/icon.types'
import type { LayerType } from '@/core/types/banner.types'

const editor = useEditorStore()
const history = useHistoryStore()

const sortedLayers = computed(() => [...editor.layers].reverse())

const layerIcons: Record<LayerType, IconName> = {
  text: 'type',
  image: 'image',
  shape: 'rect',
  button: 'button',
  background: 'rect',
}

function selectLayer(layerId: string): void {
  editor.selectLayer(layerId)
}

function toggleVisibility(layerId: string, event: MouseEvent): void {
  event.stopPropagation()
  editor.toggleLayerVisibility(layerId)
  history.pushState()
}
</script>

<template>
  <section class="space-y-2">
    <div class="flex items-center justify-between">
      <p class="text-xs font-medium text-zinc-400">Camadas</p>
      <span class="text-xs text-zinc-600">{{ editor.layers.length }}</span>
    </div>

    <div v-if="sortedLayers.length === 0" class="rounded-lg border border-dashed border-surface-700 px-3 py-4 text-center text-xs text-zinc-600">
      Nenhum elemento
    </div>

    <ul v-else class="max-h-48 space-y-0.5 overflow-y-auto">
      <li
        v-for="layer in sortedLayers"
        :key="layer.id"
        class="layer-row"
        :class="{
          'layer-row--selected': editor.selectedLayerId === layer.id,
          'layer-row--hidden': !layer.visible,
        }"
        @click="selectLayer(layer.id)"
      >
        <AppIcon :name="layerIcons[layer.type]" :size="13" class="shrink-0 text-zinc-500" />
        <span class="layer-row__name">{{ layer.name }}</span>
        <button
          type="button"
          class="layer-row__eye"
          :title="layer.visible ? 'Ocultar' : 'Mostrar'"
          @click="toggleVisibility(layer.id, $event)"
        >
          <AppIcon :name="layer.visible ? 'eye' : 'eye-off'" :size="13" />
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.border-surface-700 { border-color: var(--color-surface-700); }

.layer-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 0.375rem;
  padding: 0.375rem 0.5rem;
  cursor: pointer;
  transition: background 0.12s;
}
.layer-row:hover {
  background: var(--color-surface-800);
}
.layer-row--selected {
  background: rgba(109, 40, 217, 0.15);
}
.layer-row--hidden {
  opacity: 0.5;
}
.layer-row__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  color: #d4d4d8;
}
.layer-row__eye {
  display: flex;
  shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  padding: 0.125rem;
  color: #71717a;
  transition: color 0.12s, background 0.12s;
}
.layer-row__eye:hover {
  background: var(--color-surface-700);
  color: #d4d4d8;
}
</style>
