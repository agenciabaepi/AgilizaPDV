import type { AnimationPresetMeta, EasingType } from '@/core/types/animation.types'

export const DEFAULT_SLIDE_DURATION = 5000
export const DEFAULT_ANIMATION_DURATION = 800
export const MIN_ANIMATION_DURATION = 100
export const MAX_ANIMATION_DURATION = 5000
export const TIMELINE_PX_PER_SECOND = 80
export const TIMELINE_TRACK_HEIGHT = 36
export const SLIDE_OFFSET_PX = 120

export const ANIMATION_PRESETS: AnimationPresetMeta[] = [
  { id: 'none', label: 'Sem animação', description: 'Elemento estático' },
  { id: 'fade', label: 'Esmaecer', description: 'Aparece suavemente' },
  { id: 'slide', label: 'Deslizar', description: 'Entra deslizando' },
  { id: 'zoom', label: 'Ampliar', description: 'Cresce com fade' },
]

export const EASING_OPTIONS: { value: EasingType; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'easeIn', label: 'Ease In' },
  { value: 'easeOut', label: 'Ease Out' },
  { value: 'easeInOut', label: 'Ease In Out' },
]

export const SLIDE_DIRECTION_OPTIONS = [
  { value: 'left' as const, label: 'Esquerda' },
  { value: 'right' as const, label: 'Direita' },
  { value: 'top' as const, label: 'Cima' },
  { value: 'bottom' as const, label: 'Baixo' },
]
