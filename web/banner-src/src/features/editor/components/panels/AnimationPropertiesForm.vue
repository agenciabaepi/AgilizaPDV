<script setup lang="ts">
import { computed } from 'vue'
import type { AnimationPreset, EasingType, SlideDirection } from '@/core/types/animation.types'
import {
  ANIMATION_PRESETS,
  EASING_OPTIONS,
  MAX_ANIMATION_DURATION,
  MIN_ANIMATION_DURATION,
  SLIDE_DIRECTION_OPTIONS,
} from '@/core/constants/animation.constants'
import { useEditorStore } from '@/features/editor/stores/editor.store'
import { useAnimationStore } from '@/features/editor/stores/animation.store'
import FieldLabel from '@/shared/components/ui/FieldLabel.vue'
import AppSlider from '@/shared/components/ui/AppSlider.vue'

const editor = useEditorStore()
const animation = useAnimationStore()

const layerId = computed(() => editor.selectedLayerId)
const layerAnimation = computed(() => {
  if (!layerId.value) return null
  return animation.getLayerAnimation(layerId.value)
})

function update(patch: Parameters<typeof animation.updateLayerAnimation>[1]): void {
  if (!layerId.value) return
  animation.updateLayerAnimation(layerId.value, patch)
}

function setPreset(preset: AnimationPreset): void {
  update({ preset, enabled: preset !== 'none' })
}

function setDirection(direction: SlideDirection): void {
  update({ direction })
}
</script>

<template>
  <div v-if="!layerAnimation" class="py-6 text-center text-sm text-zinc-500">
    Selecione um elemento para animar
  </div>

  <div v-else class="space-y-5">
    <section class="space-y-2">
      <FieldLabel>Entrada</FieldLabel>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="preset in ANIMATION_PRESETS"
          :key="preset.id"
          type="button"
          class="preset-card"
          :class="{ 'preset-card--active': layerAnimation.preset === preset.id }"
          @click="setPreset(preset.id)"
        >
          <div class="preset-card__preview">
            <span
              class="preset-card__shape"
              :class="`preset-card__shape--${preset.id}`"
            />
          </div>
          <span class="preset-card__label">{{ preset.label }}</span>
        </button>
      </div>
    </section>

    <template v-if="layerAnimation.preset !== 'none'">
      <section class="space-y-3">
        <div>
          <FieldLabel>Atraso</FieldLabel>
          <AppSlider
            :model-value="layerAnimation.delay"
            :min="0"
            :max="4000"
            :step="50"
            unit="ms"
            @update:model-value="update({ delay: Number($event) })"
          />
        </div>

        <div>
          <FieldLabel>Duração</FieldLabel>
          <AppSlider
            :model-value="layerAnimation.duration"
            :min="MIN_ANIMATION_DURATION"
            :max="MAX_ANIMATION_DURATION"
            :step="50"
            unit="ms"
            @update:model-value="update({ duration: Number($event) })"
          />
        </div>

        <div>
          <FieldLabel>Curva</FieldLabel>
          <select
            class="select-field"
            :value="layerAnimation.easing"
            @change="update({ easing: ($event.target as HTMLSelectElement).value as EasingType })"
          >
            <option v-for="opt in EASING_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div v-if="layerAnimation.preset === 'slide'">
          <FieldLabel>Direção</FieldLabel>
          <div class="grid grid-cols-2 gap-1.5">
            <button
              v-for="dir in SLIDE_DIRECTION_OPTIONS"
              :key="dir.value"
              type="button"
              class="dir-btn"
              :class="{ 'dir-btn--active': layerAnimation.direction === dir.value }"
              @click="setDirection(dir.value)"
            >
              {{ dir.label }}
            </button>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
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
.preset-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  border-radius: 0.75rem;
  border: 1px solid var(--color-surface-700);
  background: var(--color-surface-850);
  padding: 0.625rem 0.5rem;
  transition: border-color 0.15s, background 0.15s;
}
.preset-card:hover {
  border-color: var(--color-surface-700);
  background: var(--color-surface-800);
}
.preset-card--active {
  border-color: var(--color-accent-500);
  background: color-mix(in srgb, var(--color-accent-600) 12%, var(--color-surface-850));
}
.preset-card__preview {
  display: flex;
  height: 2.5rem;
  width: 100%;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  background: #e4e4e7;
}
.preset-card__shape {
  display: block;
  height: 1.25rem;
  width: 2rem;
  border-radius: 0.25rem;
  background: #a1a1aa;
}
.preset-card__shape--none {
  opacity: 0.35;
  background: repeating-linear-gradient(
    45deg,
    #a1a1aa,
    #a1a1aa 2px,
    transparent 2px,
    transparent 6px
  );
}
.preset-card__shape--fade { opacity: 0.45; }
.preset-card__shape--slide {
  transform: translateX(-6px);
  box-shadow: 8px 0 0 #d4d4d8;
}
.preset-card__shape--zoom {
  transform: scale(0.65);
  box-shadow: 0 0 0 3px #d4d4d8;
}
.preset-card__label {
  font-size: 0.6875rem;
  font-weight: 500;
  color: #d4d4d8;
}
.dir-btn {
  border-radius: 0.5rem;
  border: 1px solid var(--color-surface-700);
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
  color: #a1a1aa;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.dir-btn:hover { background: var(--color-surface-800); color: #e4e4e7; }
.dir-btn--active {
  border-color: var(--color-accent-500);
  background: color-mix(in srgb, var(--color-accent-600) 15%, transparent);
  color: var(--color-accent-400);
}
</style>
