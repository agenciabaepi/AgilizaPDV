<script setup lang="ts">
import { ref } from 'vue'
import { useEditorStore } from '@/features/editor/stores/editor.store'
import { useHistoryStore } from '@/features/editor/stores/history.store'
import { useEmbedBridge } from '@/features/editor/composables/useEmbedBridge'
import AppButton from '@/shared/components/ui/AppButton.vue'
import AppIcon from '@/shared/components/icons/AppIcon.vue'

const editor = useEditorStore()
const history = useHistoryStore()
const { isEmbed, sendToParent, notifyError } = useEmbedBridge()

const projectName = ref(editor.project.name)
const isSending = ref(false)
const sendFeedback = ref<string | null>(null)

function onNameBlur(): void {
  editor.setProjectName(projectName.value.trim() || 'Banner sem título')
}

async function handleUndo(): Promise<void> {
  await history.undo()
  editor.syncSelection()
}

async function handleRedo(): Promise<void> {
  await history.redo()
  editor.syncSelection()
}

async function handleExport(): Promise<void> {
  await editor.exportBanner()
}

async function handleSendToParent(): Promise<void> {
  isSending.value = true
  sendFeedback.value = null
  try {
    await sendToParent()
    sendFeedback.value = 'Enviado para a loja!'
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao enviar banner'
    sendFeedback.value = message
    notifyError(message)
  } finally {
    isSending.value = false
  }
}
</script>

<template>
  <header class="flex h-14 shrink-0 items-center gap-3 border-b border-surface-800 bg-surface-900 px-4">
    <div class="flex items-center gap-2">
      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-600 text-sm font-bold text-white">
        B
      </div>
      <div>
        <p class="text-xs font-semibold text-zinc-100">Banner Studio</p>
        <input
          v-model="projectName"
          type="text"
          class="w-44 bg-transparent text-xs text-zinc-500 outline-none focus:text-zinc-300"
          @blur="onNameBlur"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
      </div>
    </div>

    <div class="mx-4 h-6 w-px bg-surface-700" />

    <div class="flex items-center gap-1">
      <AppButton
        size="sm"
        variant="ghost"
        title="Desfazer (Ctrl+Z)"
        :disabled="!history.canUndo"
        @click="handleUndo"
      >
        <AppIcon name="undo" :size="16" />
      </AppButton>
      <AppButton
        size="sm"
        variant="ghost"
        title="Refazer (Ctrl+Shift+Z)"
        :disabled="!history.canRedo"
        @click="handleRedo"
      >
        <AppIcon name="redo" :size="16" />
      </AppButton>
    </div>

    <div class="mx-4 h-6 w-px bg-surface-700" />

    <div class="flex items-center gap-1">
      <AppButton size="sm" variant="ghost" title="Diminuir zoom" @click="editor.zoomOut()">
        <AppIcon name="zoom-out" :size="16" />
      </AppButton>
      <span class="min-w-12 text-center text-xs tabular-nums text-zinc-400">
        {{ editor.zoomPercent }}%
      </span>
      <AppButton size="sm" variant="ghost" title="Aumentar zoom" @click="editor.zoomIn()">
        <AppIcon name="zoom-in" :size="16" />
      </AppButton>
      <AppButton size="sm" variant="ghost" title="Ajustar à tela" @click="editor.fitToScreen()">
        <AppIcon name="fit-screen" :size="16" />
      </AppButton>
    </div>

    <div class="flex-1" />

    <p v-if="sendFeedback" class="max-w-md text-xs text-zinc-400" :title="sendFeedback">
      {{ sendFeedback }}
    </p>

    <AppButton
      v-if="isEmbed"
      variant="primary"
      :disabled="editor.isExporting || isSending"
      class="gap-2"
      @click="handleSendToParent"
    >
      {{ isSending ? 'Enviando...' : 'Usar na loja' }}
    </AppButton>
    <AppButton
      v-else
      variant="primary"
      :disabled="editor.isExporting"
      class="gap-2"
      @click="handleExport"
    >
      <AppIcon name="download" :size="15" />
      {{ editor.isExporting ? 'Exportando...' : 'Exportar PNG' }}
    </AppButton>
  </header>
</template>

<style scoped>
.border-surface-800 { border-color: var(--color-surface-800); }
.bg-surface-900 { background: var(--color-surface-900); }
.bg-surface-700 { background: var(--color-surface-700); }
.bg-accent-600 { background: var(--color-accent-600); }
</style>
