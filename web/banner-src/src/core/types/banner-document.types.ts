import type { BannerProject, GuideSettings } from '@/core/types/banner.types'
import type { TimelineSlide } from '@/core/types/animation.types'

export const BANNER_STUDIO_DOCUMENT_VERSION = 1 as const

export type LojaOnlineBannerTamanhoId = 'pequeno' | 'medio' | 'grande'

export interface BannerStudioDocument {
  version: typeof BANNER_STUDIO_DOCUMENT_VERSION
  tamanho: LojaOnlineBannerTamanhoId
  project: BannerProject
  guideSettings: GuideSettings
  slides: TimelineSlide[]
  activeSlideId: string
  /** Mapa layerId → data URL original (usado só na transferência compacta). */
  assetImages?: Record<string, string>
}

export function isBannerStudioDocument(value: unknown): value is BannerStudioDocument {
  if (!value || typeof value !== 'object') return false
  const doc = value as BannerStudioDocument
  return (
    doc.version === BANNER_STUDIO_DOCUMENT_VERSION &&
    typeof doc.tamanho === 'string' &&
    !!doc.project &&
    typeof doc.project === 'object' &&
    Array.isArray(doc.slides) &&
    typeof doc.activeSlideId === 'string'
  )
}
