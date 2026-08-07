<script setup lang="ts">
import { computed } from 'vue'
import type { IconName } from './icon.types'

const props = withDefaults(
  defineProps<{
    name: IconName
    size?: number
    strokeWidth?: number
  }>(),
  {
    size: 16,
    strokeWidth: 1.75,
  },
)

const icons: Record<IconName, string> = {
  select: 'M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z',
  text: 'M4 7V4h16v3M9 20h6M12 4v16',
  type: 'M4 7V4h16v3M9 20h6M12 4v16',
  image: 'M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 15l-5-5L5 21',
  rect: 'M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z',
  circle: 'M12 12m-9 0a9 9 0 1118 0a9 9 0 01-18 0',
  duplicate: 'M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2v-2M14 4H6a2 2 0 00-2 2v14',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 100-6 3 3 0 000 6z',
  'eye-off': 'M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22',
  trash: 'M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h16M10 11v6M14 11v6',
  'more-vertical': 'M12 5v.01M12 12v.01M12 19v.01',
  cut: 'M6 6l12 12M6 18L18 6M3 6h.01M21 6h.01M3 18h.01M21 18h.01',
  copy: 'M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2v-2M14 4H6a2 2 0 00-2 2v14',
  clipboard: 'M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2M9 2h6v4H9V2z',
  'bring-front': 'M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M8 21H5a2 2 0 01-2-2v-3M16 21h3a2 2 0 002-2v-3M12 8v8M8 12h8',
  'bring-forward': 'M12 19V5M5 12l7-7 7 7',
  'send-back': 'M12 5v14M5 12l7 7 7-7',
  'send-backward': 'M12 5v14M19 12l-7 7-7-7',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  edit: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  undo: 'M3 7v6h6M3 13a9 9 0 109-9',
  redo: 'M21 7v6h-6M21 13a9 9 0 11-9-9',
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  'zoom-in': 'M11 11m-8 0a8 8 0 1016 0a8 8 0 10-16 0M11 8v6M8 11h6M21 21l-4.35-4.35',
  'zoom-out': 'M11 11m-8 0a8 8 0 1016 0a8 8 0 10-16 0M8 11h6M21 21l-4.35-4.35',
  'fit-screen': 'M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M8 21H5a2 2 0 01-2-2v-3M16 21h3a2 2 0 002-2v-3',
  'align-left': 'M4 6h16M4 12h10M4 18h14',
  'align-center': 'M4 6h16M7 12h10M5 18h14',
  'align-right': 'M4 6h16M10 12h10M6 18h14',
  replace: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  close: 'M18 6L6 18M6 6l12 12',
  play: 'M6 4l14 7-14 7V4z',
  pause: 'M6 4h4v16H6V4M14 4h4v16h-4V4',
  stop: 'M5 5h14v14H5V5z',
  button: 'M4 8h16M4 8v8a2 2 0 002 2h12a2 2 0 002-2V8M4 8l2-4h12l2 4',
  link: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
}

const path = computed(() => icons[props.name])
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="props.strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="path" />
  </svg>
</template>
