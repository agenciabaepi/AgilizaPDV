export type AnimationPreset = 'none' | 'fade' | 'slide' | 'zoom'

export type SlideDirection = 'left' | 'right' | 'top' | 'bottom'

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'

export interface ElementState {
  left: number
  top: number
  scaleX: number
  scaleY: number
  angle: number
  opacity: number
}

export interface LayerAnimation {
  layerId: string
  preset: AnimationPreset
  delay: number
  duration: number
  easing: EasingType
  direction: SlideDirection
  enabled: boolean
}

export interface TimelineSlide {
  id: string
  name: string
  duration: number
  animations: Record<string, LayerAnimation>
  canvasSnapshot: string | null
}

export interface AnimationPresetMeta {
  id: AnimationPreset
  label: string
  description: string
}
