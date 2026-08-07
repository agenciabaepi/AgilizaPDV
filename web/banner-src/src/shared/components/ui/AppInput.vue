<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue?: string | number
    type?: string
    placeholder?: string
    min?: number
    max?: number
    step?: number
    disabled?: boolean
  }>(),
  {
    type: 'text',
    disabled: false,
  },
)

defineEmits<{
  'update:modelValue': [value: string | number]
}>()
</script>

<template>
  <input
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    class="w-full rounded-lg border border-surface-700 bg-surface-850 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 disabled:cursor-not-allowed disabled:opacity-50"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>

<style scoped>
.border-surface-700 {
  border-color: var(--color-surface-700);
}
.bg-surface-850 {
  background: var(--color-surface-850);
}
.focus\:border-accent-500:focus {
  border-color: var(--color-accent-500);
}
.focus\:ring-accent-500\/30:focus {
  --tw-ring-color: color-mix(in srgb, var(--color-accent-500) 30%, transparent);
}
</style>
