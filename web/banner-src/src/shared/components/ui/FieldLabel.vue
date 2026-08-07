<script setup lang="ts">
defineProps<{
  label?: string
  htmlFor?: string
}>()
</script>

<template>
  <label
    :for="htmlFor"
    class="mb-1.5 block text-xs font-medium tracking-wide text-zinc-400 uppercase"
  >
    <slot>{{ label }}</slot>
  </label>
</template>
