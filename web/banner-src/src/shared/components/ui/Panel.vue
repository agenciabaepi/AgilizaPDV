<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <section class="flex h-full flex-col border-l border-surface-800 bg-surface-900">
    <header
      v-if="$slots.header"
      class="flex shrink-0 items-center justify-between border-b border-surface-800 px-4 py-3"
    >
      <slot name="header" />
    </header>
    <div class="scrollbar-thin flex-1 overflow-y-auto p-4">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.border-surface-800 { border-color: var(--color-surface-800); }
.bg-surface-900 { background: var(--color-surface-900); }
</style>
