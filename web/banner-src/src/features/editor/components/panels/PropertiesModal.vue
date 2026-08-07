<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { PropertiesTab } from '@/core/types/ui.types'
import { MODAL_MAX_HEIGHT, MODAL_WIDTH } from '@/core/types/ui.types'
import { inferLayerType } from '@/features/editor/services/layer.helpers'
import { LAYER_TYPE_LABELS } from '@/core/constants/editor.constants'
import { useEditorStore } from '@/features/editor/stores/editor.store'
import { useUiStore } from '@/features/editor/stores/ui.store'
import { useHistoryStore } from '@/features/editor/stores/history.store'
import PropertiesForm from '@/features/editor/components/panels/PropertiesForm.vue'
import ButtonPropertiesForm from '@/features/editor/components/panels/ButtonPropertiesForm.vue'
import AnimationPropertiesForm from '@/features/editor/components/panels/AnimationPropertiesForm.vue'
import AppIcon from '@/shared/components/icons/AppIcon.vue'
import FieldLabel from '@/shared/components/ui/FieldLabel.vue'
import AppInput from '@/shared/components/ui/AppInput.vue'
import AppSlider from '@/shared/components/ui/AppSlider.vue'

const editor = useEditorStore()
const ui = useUiStore()
const history = useHistoryStore()

const shadowColor = ref('#000000')
const shadowBlur = ref(0)
const shadowOffsetX = ref(0)
const shadowOffsetY = ref(0)

const layerType = computed(
  () => editor.selectedLayer?.type ?? inferLayerType(editor.selectedObject),
)

const modalTitle = computed(() => {
  const type = layerType.value
  if (type === 'text') return 'Configurações de texto'
  if (type === 'image') return 'Configurações de imagem'
  if (type === 'button') return 'Configurações de botão'
  if (type === 'shape') return 'Configurações de forma'
  return 'Propriedades'
})

const tabs = computed(() => {
  const base: { id: PropertiesTab; label: string }[] = [
    { id: 'content', label: layerType.value === 'text' ? 'Texto' : layerType.value === 'image' ? 'Imagem' : layerType.value === 'button' ? 'Botão' : 'Forma' },
    { id: 'style', label: 'Estilo' },
    { id: 'transform', label: 'Transformar' },
    { id: 'animation', label: 'Animação' },
  ]
  return base
})

const commonProps = computed(() => {
  const obj = editor.selectedObject
  if (!obj) return null
  return {
    opacity: Math.round((obj.opacity ?? 1) * 100),
    angle: Math.round(obj.angle ?? 0),
  }
})

const modalStyle = computed(() => ({
  left: `${ui.propertiesModalPosition.x}px`,
  top: `${ui.propertiesModalPosition.y}px`,
  width: `${MODAL_WIDTH}px`,
  maxHeight: `${MODAL_MAX_HEIGHT}px`,
}))

function updateCommon(key: string, value: unknown): void {
  if (key === 'opacity') {
    editor.updateSelectedObject({ opacity: Number(value) / 100 })
  } else if (key === 'angle') {
    editor.updateSelectedObject({ angle: Number(value) })
  }
  history.pushState()
}

function updateShadow(): void {
  editor.applyShadowToSelected({
    color: shadowColor.value,
    blur: shadowBlur.value,
    offsetX: shadowOffsetX.value,
    offsetY: shadowOffsetY.value,
  })
  history.pushState()
}

function close(): void {
  ui.closePropertiesModal()
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close()
}

watch(
  () => editor.selectedObject,
  (obj) => {
    if (!obj) {
      close()
      return
    }
    const shadow = obj.shadow
    shadowColor.value = shadow?.color ?? '#000000'
    shadowBlur.value = shadow?.blur ?? 0
    shadowOffsetX.value = shadow?.offsetX ?? 0
    shadowOffsetY.value = shadow?.offsetY ?? 0
  },
)

watch(
  () => editor.selectedObject,
  (obj) => {
    if (ui.propertiesModalOpen && !obj) close()
  },
)

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="ui.propertiesModalOpen && editor.selectedObject"
        class="properties-modal fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-surface-700 bg-surface-900 shadow-2xl shadow-black/60"
        :style="modalStyle"
        @click.stop
      >
        <!-- Header -->
        <header class="flex shrink-0 items-center justify-between border-b border-surface-800 px-4 py-3">
          <div>
            <h2 class="text-sm font-semibold text-zinc-100">{{ modalTitle }}</h2>
            <p v-if="editor.selectedLayer" class="text-xs text-zinc-500">
              {{ editor.selectedLayer.name }} · {{ LAYER_TYPE_LABELS[editor.selectedLayer.type] }}
            </p>
          </div>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-surface-800 hover:text-zinc-200"
            title="Fechar (Esc)"
            @click="close"
          >
            <AppIcon name="close" :size="16" />
          </button>
        </header>

        <!-- Tabs -->
        <nav class="flex shrink-0 gap-0 border-b border-surface-800 px-2">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="tab-btn"
            :class="{ 'tab-btn--active': ui.activePropertiesTab === tab.id }"
            @click="ui.setActiveTab(tab.id)"
          >
            {{ tab.label }}
          </button>
        </nav>

        <!-- Body -->
        <div class="scrollbar-thin flex-1 overflow-y-auto p-4">
          <PropertiesForm v-if="ui.activePropertiesTab === 'content' && layerType !== 'button'" />
          <ButtonPropertiesForm v-else-if="ui.activePropertiesTab === 'content' && layerType === 'button'" />

          <section v-else-if="ui.activePropertiesTab === 'style' && commonProps" class="space-y-4">
            <div>
              <FieldLabel>Opacidade</FieldLabel>
              <AppSlider
                :model-value="commonProps.opacity"
                :min="0"
                :max="100"
                unit="%"
                @update:model-value="updateCommon('opacity', $event)"
              />
            </div>

            <div class="border-t border-surface-800 pt-4">
              <h3 class="mb-3 text-xs font-semibold text-zinc-400 uppercase">Sombra</h3>
              <div class="space-y-3">
                <div>
                  <FieldLabel>Cor</FieldLabel>
                  <input
                    v-model="shadowColor"
                    type="color"
                    class="color-input w-full"
                    @change="updateShadow"
                  />
                </div>
                <div>
                  <FieldLabel>Desfoque</FieldLabel>
                  <AppSlider
                    v-model="shadowBlur"
                    :min="0"
                    :max="50"
                    @update:model-value="updateShadow"
                  />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Offset X</FieldLabel>
                    <AppInput
                      type="number"
                      :model-value="shadowOffsetX"
                      @update:model-value="shadowOffsetX = Number($event); updateShadow()"
                    />
                  </div>
                  <div>
                    <FieldLabel>Offset Y</FieldLabel>
                    <AppInput
                      type="number"
                      :model-value="shadowOffsetY"
                      @update:model-value="shadowOffsetY = Number($event); updateShadow()"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section v-else-if="ui.activePropertiesTab === 'transform' && commonProps" class="space-y-4">
            <div>
              <FieldLabel>Rotação</FieldLabel>
              <AppSlider
                :model-value="commonProps.angle"
                :min="-180"
                :max="180"
                unit="°"
                @update:model-value="updateCommon('angle', $event)"
              />
            </div>
            <p class="text-xs text-zinc-500">
              Arraste o elemento no canvas para mover. Use os cantos para redimensionar.
            </p>
          </section>

          <AnimationPropertiesForm v-else-if="ui.activePropertiesTab === 'animation'" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.border-surface-700 { border-color: var(--color-surface-700); }
.border-surface-800 { border-color: var(--color-surface-800); }
.bg-surface-900 { background: var(--color-surface-900); }
.bg-surface-800 { background: var(--color-surface-800); }
.color-input {
  height: 2.25rem;
  cursor: pointer;
  border-radius: 0.5rem;
  border: 1px solid var(--color-surface-700);
  background: transparent;
}
.tab-btn {
  padding: 0.625rem 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #71717a;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}
.tab-btn:hover { color: #d4d4d8; }
.tab-btn--active {
  color: var(--color-accent-400);
  border-bottom-color: var(--color-accent-500);
}
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
</style>
