<script setup lang="ts">
import { ref } from 'vue'
import type { EditorTool } from '@/core/types/banner.types'
import type { IconName } from '@/shared/components/icons/icon.types'
import { useEditorStore } from '@/features/editor/stores/editor.store'
import AppButton from '@/shared/components/ui/AppButton.vue'
import AppIcon from '@/shared/components/icons/AppIcon.vue'

const editor = useEditorStore()
const fileInputRef = ref<HTMLInputElement | null>(null)

interface ToolItem {
  id: EditorTool
  label: string
  icon: IconName
  action?: () => void
}

const tools: ToolItem[] = [
  { id: 'select', label: 'Selecionar', icon: 'select' },
  { id: 'text', label: 'Texto', icon: 'text', action: () => editor.addText() },
  { id: 'image', label: 'Imagem', icon: 'image' },
  { id: 'button', label: 'Botão', icon: 'button', action: () => editor.addButton() },
  { id: 'rect', label: 'Retângulo', icon: 'rect', action: () => editor.addShape('rect') },
  { id: 'circle', label: 'Círculo', icon: 'circle', action: () => editor.addShape('circle') },
]

function handleToolClick(tool: ToolItem): void {
  editor.setActiveTool(tool.id)

  if (tool.id === 'image') {
    fileInputRef.value?.click()
    return
  }

  tool.action?.()
}

function onFileSelected(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  editor.addImageFromFile(file)
  input.value = ''
}
</script>

<template>
  <aside class="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-surface-800 bg-surface-900 py-3">
    <AppButton
      v-for="tool in tools"
      :key="tool.id"
      variant="ghost"
      size="sm"
      :active="editor.activeTool === tool.id"
      :title="tool.label"
      class="!h-11 !w-11 !px-0"
      @click="handleToolClick(tool)"
    >
      <AppIcon :name="tool.icon" :size="18" />
    </AppButton>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onFileSelected"
    />

    <div class="mt-auto flex flex-col gap-1">
      <AppButton
        variant="ghost"
        size="sm"
        title="Duplicar (Ctrl+D)"
        class="!h-11 !w-11 !px-0"
        :disabled="!editor.selectedObject"
        @click="editor.duplicateSelected()"
      >
        <AppIcon name="duplicate" :size="18" />
      </AppButton>
      <AppButton
        variant="danger"
        size="sm"
        title="Excluir (Delete)"
        class="!h-11 !w-11 !px-0"
        :disabled="!editor.selectedObject"
        @click="editor.deleteSelected()"
      >
        <AppIcon name="trash" :size="18" />
      </AppButton>
    </div>
  </aside>
</template>

<style scoped>
.border-surface-800 { border-color: var(--color-surface-800); }
.bg-surface-900 { background: var(--color-surface-900); }
</style>
