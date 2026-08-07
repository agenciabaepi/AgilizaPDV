<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    disabled?: boolean
    active?: boolean
    title?: string
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    disabled: false,
    active: false,
  },
)

const variantClasses: Record<string, string> = {
  primary: 'bg-accent-600 text-white hover:bg-accent-500 border-transparent',
  secondary: 'bg-surface-800 text-zinc-200 hover:bg-surface-700 border-surface-700',
  ghost: 'bg-transparent text-zinc-400 hover:bg-surface-800 hover:text-zinc-200 border-transparent',
  danger: 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20',
}

const sizeClasses: Record<string, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3 text-sm gap-2',
  lg: 'h-10 px-4 text-sm gap-2',
}
</script>

<template>
  <button
    type="button"
    :title="title"
    :disabled="disabled"
    class="inline-flex items-center justify-center rounded-lg border font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40"
    :class="[
      variantClasses[variant],
      sizeClasses[size],
      active && 'ring-1 ring-accent-500/50 border-accent-500/50 text-accent-400',
    ]"
  >
    <slot />
  </button>
</template>

<style scoped>
.bg-accent-600 { background: var(--color-accent-600); }
.bg-accent-500 { background: var(--color-accent-500); }
.bg-surface-800 { background: var(--color-surface-800); }
.bg-surface-700 { background: var(--color-surface-700); }
.border-surface-700 { border-color: var(--color-surface-700); }
.text-accent-400 { color: var(--color-accent-400); }
.border-accent-500\/50 { border-color: color-mix(in srgb, var(--color-accent-500) 50%, transparent); }
.ring-accent-500\/50 { --tw-ring-color: color-mix(in srgb, var(--color-accent-500) 50%, transparent); }
</style>
