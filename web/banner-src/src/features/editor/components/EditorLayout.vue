<script setup lang="ts">
import TopToolbar from '@/features/editor/components/toolbar/TopToolbar.vue'
import LeftToolbar from '@/features/editor/components/toolbar/LeftToolbar.vue'
import CanvasWorkspace from '@/features/editor/components/canvas/CanvasWorkspace.vue'
import CanvasSettingsPanel from '@/features/editor/components/panels/CanvasSettingsPanel.vue'
import AnimationTimelinePanel from '@/features/editor/components/timeline/AnimationTimelinePanel.vue'
import { useKeyboardShortcuts } from '@/features/editor/composables/useKeyboardShortcuts'
import { useCanvasSync } from '@/features/editor/composables/useCanvasSync'
import { useAnimationSync } from '@/features/editor/composables/useAnimationSync'

useKeyboardShortcuts()
useCanvasSync()
useAnimationSync()
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden bg-surface-950">
    <TopToolbar />

    <div class="flex min-h-0 flex-1 flex-col">
      <div class="flex min-h-0 flex-1">
        <LeftToolbar />
        <CanvasSettingsPanel />
        <CanvasWorkspace />
      </div>
      <div class="h-52 shrink-0">
        <AnimationTimelinePanel />
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-surface-950 { background: var(--color-surface-950); }
</style>
