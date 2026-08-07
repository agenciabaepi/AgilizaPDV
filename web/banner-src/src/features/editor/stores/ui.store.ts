import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ModalPosition, PropertiesTab } from '@/core/types/ui.types'

export const useUiStore = defineStore('ui', () => {
  const propertiesModalOpen = ref(false)
  const propertiesModalPosition = ref<ModalPosition>({ x: 0, y: 0 })
  const activePropertiesTab = ref<PropertiesTab>('content')
  const contextMenuOpen = ref(false)

  function openPropertiesModal(position: ModalPosition, tab: PropertiesTab = 'content'): void {
    contextMenuOpen.value = false
    propertiesModalPosition.value = position
    activePropertiesTab.value = tab
    propertiesModalOpen.value = true
  }

  function closePropertiesModal(): void {
    propertiesModalOpen.value = false
  }

  function toggleContextMenu(): void {
    contextMenuOpen.value = !contextMenuOpen.value
  }

  function closeContextMenu(): void {
    contextMenuOpen.value = false
  }

  function setActiveTab(tab: PropertiesTab): void {
    activePropertiesTab.value = tab
  }

  return {
    propertiesModalOpen,
    propertiesModalPosition,
    activePropertiesTab,
    contextMenuOpen,
    openPropertiesModal,
    closePropertiesModal,
    toggleContextMenu,
    closeContextMenu,
    setActiveTab,
  }
})
