<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue?: number
    min?: number
    max?: number
    step?: number
    unit?: string
  }>(),
  {
    min: 0,
    max: 100,
    step: 1,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

function onInput(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="flex items-center gap-3">
    <input
      type="range"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      class="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface-700 accent-accent-500"
      @input="onInput"
    />
    <span class="min-w-10 text-right text-xs tabular-nums text-zinc-400">
      {{ modelValue }}{{ unit }}
    </span>
  </div>
</template>

<style scoped>
.bg-surface-700 {
  background: var(--color-surface-700);
}
.accent-accent-500 {
  accent-color: var(--color-accent-500);
}
</style>
