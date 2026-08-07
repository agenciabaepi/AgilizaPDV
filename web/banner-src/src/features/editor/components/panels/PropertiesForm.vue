<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { IText, FabricImage } from 'fabric'
import { FONT_FAMILIES, FONT_WEIGHTS } from '@/core/constants/editor.constants'
import { useEditorStore } from '@/features/editor/stores/editor.store'
import { useHistoryStore } from '@/features/editor/stores/history.store'
import FieldLabel from '@/shared/components/ui/FieldLabel.vue'
import AppInput from '@/shared/components/ui/AppInput.vue'
import AppSlider from '@/shared/components/ui/AppSlider.vue'
import AppIcon from '@/shared/components/icons/AppIcon.vue'
import type { IconName } from '@/shared/components/icons/icon.types'
import { inferLayerType } from '@/features/editor/services/layer.helpers'
import { isButtonObject } from '@/features/editor/services/button.helpers'
import { startTextEditing } from '@/features/editor/services/text-editing.service'

const editor = useEditorStore()
const history = useHistoryStore()
const fileInputRef = ref<HTMLInputElement | null>(null)

const selected = computed(() => editor.selectedObject)
const layerType = computed(
  () => editor.selectedLayer?.type ?? inferLayerType(selected.value),
)
const isButton = computed(() => isButtonObject(selected.value))

const isText = computed(() => selected.value instanceof IText)
const isImage = computed(() => selected.value instanceof FabricImage)
const imagePreviewSrc = ref<string | null>(null)

function resolveImagePreview(img: FabricImage): string {
  const src = img.getSrc()
  if (src && (src.startsWith('data:') || /^https?:\/\//.test(src))) {
    return src
  }

  const element = img.getElement()
  if (
    element instanceof HTMLImageElement &&
    element.complete &&
    element.naturalWidth > 0
  ) {
    const maxSide = 960
    const { naturalWidth, naturalHeight } = element
    const scale = Math.min(1, maxSide / Math.max(naturalWidth, naturalHeight))
    const width = Math.round(naturalWidth * scale)
    const height = Math.round(naturalHeight * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(element, 0, 0, width, height)
      return canvas.toDataURL('image/jpeg', 0.95)
    }
  }

  return img.toDataURL({ format: 'jpeg', quality: 0.95, multiplier: 1 })
}

watch(
  () => {
    const obj = selected.value
    if (!(obj instanceof FabricImage)) return null
    return [obj, editor.selectedLayerId, editor.project.updatedAt] as const
  },
  (deps) => {
    if (!deps || !(deps[0] instanceof FabricImage)) {
      imagePreviewSrc.value = null
      return
    }
    imagePreviewSrc.value = resolveImagePreview(deps[0])
  },
  { immediate: true },
)

const textProps = computed(() => {
  const obj = selected.value
  if (!(obj instanceof IText)) return null
  return {
    text: obj.text ?? '',
    fill: (obj.fill as string) ?? '#000000',
    fontSize: obj.fontSize ?? 48,
    fontFamily: obj.fontFamily ?? FONT_FAMILIES[0],
    fontWeight: String(obj.fontWeight ?? '400'),
    textAlign: (obj.textAlign ?? 'left') as 'left' | 'center' | 'right',
    opacity: Math.round((obj.opacity ?? 1) * 100),
  }
})

const commonProps = computed(() => {
  const obj = selected.value
  if (!obj) return null

  return {
    opacity: Math.round((obj.opacity ?? 1) * 100),
    angle: Math.round(obj.angle ?? 0),
    fill: (obj.fill as string) ?? '#6366f1',
  }
})

function updateText(key: string, value: unknown): void {
  editor.updateSelectedObject({ [key]: value })
  history.pushState()
}

function updateCommon(key: string, value: unknown): void {
  if (key === 'opacity') {
    editor.updateSelectedObject({ opacity: Number(value) / 100 })
  } else if (key === 'angle') {
    editor.updateSelectedObject({ angle: Number(value) })
  } else if (key === 'fill') {
    editor.updateSelectedObject({ fill: value })
  }
  history.pushState()
}

function startCanvasTextEdit(): void {
  const obj = selected.value
  if (!(obj instanceof IText)) return
  startTextEditing(obj)
}

async function replaceImage(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !(selected.value instanceof FabricImage)) return

  const url = URL.createObjectURL(file)
  try {
    const img = selected.value
    await img.setSrc(url, { crossOrigin: 'anonymous' })
    editor.updateSelectedObject({})
    imagePreviewSrc.value = resolveImagePreview(img)
    history.pushState()
  } finally {
    URL.revokeObjectURL(url)
    input.value = ''
  }
}
</script>

<template>
  <div v-if="!selected" class="py-8 text-center text-sm text-zinc-500">
    Nenhum elemento selecionado
  </div>

  <div v-else class="space-y-4">
    <section v-if="isText && textProps" class="space-y-3">
        <div>
          <FieldLabel>Texto</FieldLabel>
          <textarea
            :value="textProps.text"
            rows="3"
            class="textarea-field"
            @input="updateText('text', ($event.target as HTMLTextAreaElement).value)"
          />
        </div>

        <button type="button" class="link-btn flex items-center gap-1.5" @click="startCanvasTextEdit">
          <AppIcon name="edit" :size="14" />
          Editar diretamente no canvas
        </button>

        <div>
          <FieldLabel>Cor</FieldLabel>
          <div class="flex items-center gap-2">
            <input
              type="color"
              :value="textProps.fill"
              class="color-input"
              @input="updateText('fill', ($event.target as HTMLInputElement).value)"
            />
            <AppInput
              :model-value="textProps.fill"
              @update:model-value="updateText('fill', $event)"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Fonte</FieldLabel>
          <select
            :value="textProps.fontFamily"
            class="select-field"
            @change="updateText('fontFamily', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="font in FONT_FAMILIES" :key="font" :value="font">{{ font }}</option>
          </select>
        </div>

        <div>
          <FieldLabel>Tamanho</FieldLabel>
          <AppSlider
            :model-value="textProps.fontSize"
            :min="8"
            :max="200"
            unit="px"
            @update:model-value="updateText('fontSize', $event)"
          />
        </div>

        <div>
          <FieldLabel>Peso</FieldLabel>
          <select
            :value="textProps.fontWeight"
            class="select-field"
            @change="updateText('fontWeight', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="w in FONT_WEIGHTS" :key="w.value" :value="w.value">{{ w.label }}</option>
          </select>
        </div>

        <div>
          <FieldLabel>Alinhamento</FieldLabel>
          <div class="flex gap-1">
            <button
              v-for="align in ([
                { id: 'left', icon: 'align-left' },
                { id: 'center', icon: 'align-center' },
                { id: 'right', icon: 'align-right' },
              ] as const)"
              :key="align.id"
              type="button"
              class="flex flex-1 items-center justify-center rounded-lg border py-1.5 transition-colors"
              :class="textProps.textAlign === align.id ? 'align-active' : 'align-inactive'"
              @click="updateText('textAlign', align.id)"
            >
              <AppIcon :name="align.icon as IconName" :size="15" />
            </button>
          </div>
        </div>
      </section>

      <section v-else-if="isImage" class="space-y-3">
        <div class="overflow-hidden rounded-xl border border-surface-700 bg-surface-850">
          <div class="flex aspect-video items-center justify-center overflow-hidden bg-surface-800">
            <img
              v-if="imagePreviewSrc"
              :src="imagePreviewSrc"
              :alt="editor.selectedLayer?.name ?? 'Preview'"
              class="h-full w-full object-contain"
            />
            <AppIcon
              v-else
              name="image"
              :size="32"
              :stroke-width="1.25"
              class="text-zinc-500"
            />
          </div>
          <button
            type="button"
            class="flex w-full items-center justify-center gap-2 border-t border-surface-700 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-surface-800"
            @click="fileInputRef?.click()"
          >
            <AppIcon name="replace" :size="15" />
            Trocar imagem
          </button>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            class="hidden"
            @change="replaceImage"
          />
        </div>
        <p class="text-xs text-zinc-500">
          Arraste os cantos no canvas para redimensionar a imagem.
        </p>
      </section>

      <section v-else-if="layerType === 'shape' && commonProps" class="space-y-3">
        <div>
          <FieldLabel>Cor de preenchimento</FieldLabel>
          <input
            type="color"
            :value="commonProps.fill"
            class="color-input w-full"
            @input="updateCommon('fill', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </section>

      <section v-else-if="isButton" class="py-4 text-center text-sm text-zinc-500">
        Use a aba <strong class="text-zinc-300">Botão</strong> para editar link, texto e cores.
      </section>

      <section v-else-if="commonProps" class="space-y-3">
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
      </section>
  </div>
</template>

<style scoped>
.border-surface-700 { border-color: var(--color-surface-700); }
.border-surface-800 { border-color: var(--color-surface-800); }
.bg-surface-850 { background: var(--color-surface-850); }
.bg-surface-800 { background: var(--color-surface-800); }
.select-field, .textarea-field {
  width: 100%;
  border-radius: 0.5rem;
  border: 1px solid var(--color-surface-700);
  background: var(--color-surface-850);
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: #f4f4f5;
  outline: none;
}
.select-field:focus, .textarea-field:focus { border-color: var(--color-accent-500); }
.textarea-field { resize: vertical; min-height: 72px; }
.color-input {
  height: 2.25rem;
  width: 3rem;
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
.align-active {
  border-color: var(--color-accent-500);
  background: color-mix(in srgb, var(--color-accent-600) 20%, transparent);
  color: var(--color-accent-400);
}
.align-inactive {
  border-color: var(--color-surface-700);
  color: #a1a1aa;
}
.align-inactive:hover { background: var(--color-surface-800); }
</style>
