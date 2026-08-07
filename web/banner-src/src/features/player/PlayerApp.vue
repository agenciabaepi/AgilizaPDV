<script setup lang="ts">
import PlayerLayout from '@/features/player/components/PlayerLayout.vue'
import { usePlayerBridge } from '@/features/player/composables/usePlayerBridge'

usePlayerBridge()
</script>

<template>
  <PlayerLayout />
</template>

<style>
html,
body,
#app {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}
</style>
