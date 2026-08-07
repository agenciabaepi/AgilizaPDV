<script setup lang="ts">
import { ref, watch } from 'vue'
import { useEditorStore } from '@/features/editor/stores/editor.store'
import { useHistoryStore } from '@/features/editor/stores/history.store'
import FieldLabel from '@/shared/components/ui/FieldLabel.vue'
import AppInput from '@/shared/components/ui/AppInput.vue'
import Panel from '@/shared/components/ui/Panel.vue'
import LayersMiniList from '@/features/editor/components/panels/LayersMiniList.vue'
import { GRID_SIZE_OPTIONS } from '@/core/constants/editor.constants'

const editor = useEditorStore()
const history = useHistoryStore()

const customWidth = ref(editor.project.dimensions.width)
const customHeight = ref(editor.project.dimensions.height)

watch(
  () => editor.project.dimensions,
  (dims) => {
    customWidth.value = dims.width
    customHeight.value = dims.height
  },
  { deep: true },
)

function applyPreset(presetId: string): void {
  editor.applyPreset(presetId)
  history.pushState()
}

function applyCustomSize(): void {
  editor.setCustomDimensions(Number(customWidth.value), Number(customHeight.value))
  history.pushState()
}

function onBackgroundChange(color: string): void {
  editor.setBackgroundColor(color)
  history.pushState()
}

function toggleGuideSetting<K extends keyof typeof editor.guideSettings>(
  key: K,
  value: boolean,
): void {
  editor.setGuideSettings({ [key]: value })
}

function setGridSize(size: number): void {
  editor.setGuideSettings({ gridSize: size })
}
</script>

<template>
  <Panel class="w-56 shrink-0 border-l-0 border-r">
    <template #header>
      <h2 class="text-sm font-semibold text-zinc-200">Canvas</h2>
    </template>

    <div class="space-y-5">
      <section class="space-y-2">
        <FieldLabel>Presets</FieldLabel>
        <select
          class="select-field"
          @change="applyPreset(($event.target as HTMLSelectElement).value)"
        >
          <option value="" disabled selected>Escolher tamanho...</option>
          <optgroup
            v-for="category in ['social', 'display', 'custom'] as const"
            :key="category"
            :label="category === 'social' ? 'Redes Sociais' : category === 'display' ? 'Display Ads' : 'Personalizado'"
          >
            <option
              v-for="preset in editor.bannerPresets.filter(p => p.category === category)"
              :key="preset.id"
              :value="preset.id"
            >
              {{ preset.label }} ({{ preset.width }}×{{ preset.height }})
            </option>
          </optgroup>
        </select>
      </section>

      <section class="space-y-2">
        <FieldLabel>Tamanho personalizado</FieldLabel>
        <div class="grid grid-cols-2 gap-2">
          <AppInput
            v-model="customWidth"
            type="number"
            :min="100"
            :max="5000"
            placeholder="Largura"
          />
          <AppInput
            v-model="customHeight"
            type="number"
            :min="100"
            :max="5000"
            placeholder="Altura"
          />
        </div>
        <button
          type="button"
          class="w-full rounded-lg border border-surface-700 py-2 text-xs text-zinc-400 transition-colors hover:bg-surface-800 hover:text-zinc-200"
          @click="applyCustomSize"
        >
          Aplicar tamanho
        </button>
      </section>

      <section class="space-y-2">
        <FieldLabel>Cor de fundo</FieldLabel>
        <div class="flex items-center gap-2">
          <input
            type="color"
            :value="editor.project.backgroundColor"
            class="h-9 w-12 cursor-pointer rounded-lg border border-surface-700 bg-transparent"
            @input="onBackgroundChange(($event.target as HTMLInputElement).value)"
          />
          <AppInput
            :model-value="editor.project.backgroundColor"
            @update:model-value="onBackgroundChange(String($event))"
          />
        </div>
      </section>

      <LayersMiniList />

      <section class="space-y-3">
        <FieldLabel>Grid e guias</FieldLabel>

        <label class="toggle-row">
          <input
            type="checkbox"
            :checked="editor.guideSettings.showGrid"
            @change="toggleGuideSetting('showGrid', ($event.target as HTMLInputElement).checked)"
          />
          <span>Mostrar grid</span>
        </label>

        <div v-if="editor.guideSettings.showGrid" class="space-y-1.5">
          <FieldLabel>Tamanho do grid</FieldLabel>
          <select
            class="select-field"
            :value="editor.guideSettings.gridSize"
            @change="setGridSize(Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="size in GRID_SIZE_OPTIONS" :key="size" :value="size">
              {{ size }} px
            </option>
          </select>
        </div>

        <label class="toggle-row">
          <input
            type="checkbox"
            :checked="editor.guideSettings.snapToGrid"
            @change="toggleGuideSetting('snapToGrid', ($event.target as HTMLInputElement).checked)"
          />
          <span>Snap ao grid</span>
        </label>

        <label class="toggle-row">
          <input
            type="checkbox"
            :checked="editor.guideSettings.showGuides"
            @change="toggleGuideSetting('showGuides', ($event.target as HTMLInputElement).checked)"
          />
          <span>Guias de alinhamento</span>
        </label>

        <label class="toggle-row">
          <input
            type="checkbox"
            :checked="editor.guideSettings.snapToCenter"
            @change="toggleGuideSetting('snapToCenter', ($event.target as HTMLInputElement).checked)"
          />
          <span>Snap ao centro (H/V)</span>
        </label>

        <p class="text-xs leading-relaxed text-zinc-500">
          Arraste elementos para ver guias rosa no centro e roxas entre objetos alinhados.
        </p>
      </section>

      <section class="rounded-lg border border-surface-800 bg-surface-850 p-3">
        <p class="text-xs text-zinc-500">Atual</p>
        <p class="mt-1 text-sm font-medium text-zinc-200">
          {{ editor.project.dimensions.width }} × {{ editor.project.dimensions.height }} px
        </p>
      </section>
    </div>
  </Panel>
</template>

<style scoped>
.border-surface-700 { border-color: var(--color-surface-700); }
.border-surface-800 { border-color: var(--color-surface-800); }
.bg-surface-850 { background: var(--color-surface-850); }
.bg-surface-800 { background: var(--color-surface-800); }
.select-field {
  width: 100%;
  border-radius: 0.5rem;
  border: 1px solid var(--color-surface-700);
  background: var(--color-surface-850);
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: #f4f4f5;
  outline: none;
}
.toggle-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  cursor: pointer;
  font-size: 0.8125rem;
  color: #d4d4d8;
}
.toggle-row input {
  height: 1rem;
  width: 1rem;
  accent-color: var(--color-accent-500);
  cursor: pointer;
}
</style>
