<script setup lang="ts">
import { ref } from 'vue'
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

const settingsOpen = ref(false)
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden bg-surface-950">
    <TopToolbar />

    <div class="flex min-h-0 flex-1 flex-col">
      <div class="relative flex min-h-0 flex-1">
        <LeftToolbar />
        <div
          class="md:static md:z-auto md:flex md:shadow-none"
          :class="settingsOpen ? 'absolute inset-y-0 left-16 z-30 flex shadow-2xl' : 'hidden'"
        >
          <CanvasSettingsPanel />
        </div>
        <CanvasWorkspace />
        <button
          type="button"
          class="settings-toggle md:hidden"
          :aria-expanded="settingsOpen"
          @click="settingsOpen = !settingsOpen"
        >
          {{ settingsOpen ? 'Fechar' : 'Canvas' }}
        </button>
      </div>
      <div class="h-40 shrink-0 md:h-52">
        <AnimationTimelinePanel />
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-surface-950 { background: var(--color-surface-950); }
.settings-toggle {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 31;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-surface-700, #3f3f46);
  background: var(--color-surface-900, #18181b);
  color: #e4e4e7;
  font-size: 12px;
  font-weight: 600;
}
</style>
