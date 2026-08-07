<script setup lang="ts">
import { computed } from 'vue'
import type { ButtonTarget } from '@/core/types/banner.types'
import { useEditorStore } from '@/features/editor/stores/editor.store'
import { useHistoryStore } from '@/features/editor/stores/history.store'
import {
  getButtonConfig,
  isButtonObject,
  openButtonLink,
  resolvePropertiesTarget,
} from '@/features/editor/services/button.helpers'
import { startTextEditing } from '@/features/editor/services/text-editing.service'
import FieldLabel from '@/shared/components/ui/FieldLabel.vue'
import AppInput from '@/shared/components/ui/AppInput.vue'
import AppSlider from '@/shared/components/ui/AppSlider.vue'
import AppIcon from '@/shared/components/icons/AppIcon.vue'

const editor = useEditorStore()
const history = useHistoryStore()

const buttonGroup = computed(() => {
  const obj = resolvePropertiesTarget(editor.selectedObject)
  return isButtonObject(obj) ? obj : null
})

const config = computed(() => {
  if (!buttonGroup.value) return null
  return getButtonConfig(buttonGroup.value)
})

function update(patch: Parameters<typeof editor.updateButton>[1]): void {
  const layerId = editor.selectedLayerId
  if (!layerId) return
  editor.updateButton(layerId, patch)
  history.pushState()
}

function testLink(): void {
  if (!buttonGroup.value) return
  openButtonLink(buttonGroup.value)
}

function editLabelOnCanvas(): void {
  if (!buttonGroup.value) return
  startTextEditing(buttonGroup.value)
}
</script>

<template>
  <div v-if="!config" class="py-6 text-center text-sm text-zinc-500">
    Selecione um botão para editar
  </div>

  <div v-else class="space-y-4">
    <section class="space-y-3">
      <div>
        <FieldLabel>Texto do botão</FieldLabel>
        <AppInput
          :model-value="config.label"
          placeholder="Clique aqui"
          @update:model-value="update({ label: String($event) })"
        />
      </div>

      <button type="button" class="link-btn flex items-center gap-1.5" @click="editLabelOnCanvas">
        <AppIcon name="edit" :size="14" />
        Editar diretamente no canvas
      </button>
    </section>

    <section class="space-y-3 rounded-xl border border-surface-700 bg-surface-850 p-3">
      <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        <AppIcon name="link" :size="14" />
        Link
      </div>

      <div>
        <FieldLabel>URL</FieldLabel>
        <AppInput
          :model-value="config.url"
          placeholder="https://seusite.com"
          @update:model-value="update({ url: String($event) })"
        />
      </div>

      <label class="flex items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          class="checkbox-field"
          :checked="config.target === '_blank'"
          @change="update({ target: ($event.target as HTMLInputElement).checked ? '_blank' : '_self' as ButtonTarget })"
        />
        Abrir em nova aba
      </label>

      <button type="button" class="test-link-btn" @click="testLink">
        <AppIcon name="link" :size="14" />
        Testar link
      </button>
    </section>

    <section class="space-y-3">
      <FieldLabel>Aparência</FieldLabel>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Cor de fundo</FieldLabel>
          <input
            type="color"
            :value="config.bgColor"
            class="color-input w-full"
            @input="update({ bgColor: ($event.target as HTMLInputElement).value })"
          />
        </div>
        <div>
          <FieldLabel>Cor do texto</FieldLabel>
          <input
            type="color"
            :value="config.textColor"
            class="color-input w-full"
            @input="update({ textColor: ($event.target as HTMLInputElement).value })"
          />
        </div>
      </div>

      <div>
        <FieldLabel>Tamanho da fonte</FieldLabel>
        <AppSlider
          :model-value="config.fontSize"
          :min="10"
          :max="48"
          unit="px"
          @update:model-value="update({ fontSize: Number($event) })"
        />
      </div>

      <div>
        <FieldLabel>Arredondamento</FieldLabel>
        <AppSlider
          :model-value="config.radius"
          :min="0"
          :max="40"
          unit="px"
          @update:model-value="update({ radius: Number($event) })"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.border-surface-700 { border-color: var(--color-surface-700); }
.bg-surface-850 { background: var(--color-surface-850); }
.color-input {
  height: 2.25rem;
  cursor: pointer;
  border-radius: 0.5rem;
  border: 1px solid var(--color-surface-700);
  background: transparent;
}
.link-btn {
  font-size: 0.75rem;
  color: var(--color-accent-400);
  transition: color 0.15s;
}
.link-btn:hover { color: var(--color-accent-500); }
.checkbox-field {
  height: 1rem;
  width: 1rem;
  accent-color: var(--color-accent-500);
}
.test-link-btn {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-surface-700);
  padding: 0.5rem;
  font-size: 0.8125rem;
  color: #d4d4d8;
  transition: background 0.12s;
}
.test-link-btn:hover {
  background: var(--color-surface-800);
}
</style>
