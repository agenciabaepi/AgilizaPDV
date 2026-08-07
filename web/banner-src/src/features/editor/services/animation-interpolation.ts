import type {
  EasingType,
  ElementState,
  LayerAnimation,
} from '@/core/types/animation.types'
import { SLIDE_OFFSET_PX } from '@/core/constants/animation.constants'

export function applyEasing(t: number, easing: EasingType): number {
  const clamped = Math.min(Math.max(t, 0), 1)

  switch (easing) {
    case 'easeIn':
      return clamped * clamped
    case 'easeOut':
      return 1 - (1 - clamped) ** 2
    case 'easeInOut':
      return clamped < 0.5
        ? 2 * clamped * clamped
        : 1 - (-2 * clamped + 2) ** 2 / 2
    default:
      return clamped
  }
}

function getFromState(base: ElementState, animation: LayerAnimation): ElementState {
  switch (animation.preset) {
    case 'fade':
      return { ...base, opacity: 0 }
    case 'zoom':
      return {
        ...base,
        scaleX: base.scaleX * 0.3,
        scaleY: base.scaleY * 0.3,
        opacity: 0,
      }
    case 'slide': {
      const offset = SLIDE_OFFSET_PX
      switch (animation.direction) {
        case 'left':
          return { ...base, left: base.left - offset, opacity: 0 }
        case 'right':
          return { ...base, left: base.left + offset, opacity: 0 }
        case 'top':
          return { ...base, top: base.top - offset, opacity: 0 }
        case 'bottom':
          return { ...base, top: base.top + offset, opacity: 0 }
      }
    }
    default:
      return base
  }
}

function interpolateValue(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

export function interpolateState(from: ElementState, to: ElementState, t: number): ElementState {
  return {
    left: interpolateValue(from.left, to.left, t),
    top: interpolateValue(from.top, to.top, t),
    scaleX: interpolateValue(from.scaleX, to.scaleX, t),
    scaleY: interpolateValue(from.scaleY, to.scaleY, t),
    angle: interpolateValue(from.angle, to.angle, t),
    opacity: interpolateValue(from.opacity, to.opacity, t),
  }
}

export function getAnimatedState(
  base: ElementState,
  animation: LayerAnimation,
  timeMs: number,
): ElementState {
  if (animation.preset === 'none' || !animation.enabled) {
    return base
  }

  const localTime = timeMs - animation.delay

  if (localTime <= 0) {
    return getFromState(base, animation)
  }

  if (localTime >= animation.duration) {
    return base
  }

  const progress = applyEasing(localTime / animation.duration, animation.easing)
  const from = getFromState(base, animation)

  return interpolateState(from, base, progress)
}
