import type { LojaOnlineBannerTamanho } from './loja-online-types'

export const BANNER_STUDIO_DOCUMENT_VERSION = 1 as const

export type BannerStudioLayerAnimation = {
  layerId: string
  preset: 'none' | 'fade' | 'slide' | 'zoom'
  delay: number
  duration: number
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
  direction: 'left' | 'right' | 'top' | 'bottom'
  enabled: boolean
}

export type BannerStudioTimelineSlide = {
  id: string
  name: string
  duration: number
  animations: Record<string, BannerStudioLayerAnimation>
  canvasSnapshot: string | null
}

export type BannerStudioProject = {
  id: string
  name: string
  dimensions: { width: number; height: number }
  backgroundColor: string
  createdAt: string
  updatedAt: string
}

export type BannerStudioGuideSettings = {
  showGrid: boolean
  gridSize: number
  snapToGrid: boolean
  showGuides: boolean
  snapToCenter: boolean
}

export type BannerStudioDocument = {
  version: typeof BANNER_STUDIO_DOCUMENT_VERSION
  tamanho: LojaOnlineBannerTamanho
  project: BannerStudioProject
  guideSettings: BannerStudioGuideSettings
  slides: BannerStudioTimelineSlide[]
  activeSlideId: string
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
    doc.slides.length > 0 &&
    typeof doc.activeSlideId === 'string'
  )
}

function countCanvasSnapshotObjects(snapshot: unknown): number {
  if (!snapshot) return 0

  if (typeof snapshot === 'object') {
    const objects = (snapshot as { objects?: unknown[] }).objects
    return Array.isArray(objects) ? objects.length : 0
  }

  if (typeof snapshot !== 'string' || !snapshot.trim()) return 0

  try {
    let parsed: unknown = JSON.parse(snapshot)
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed)
    }
    const objects = (parsed as { objects?: unknown[] } | null)?.objects
    return Array.isArray(objects) ? objects.length : 0
  } catch {
    return 0
  }
}

export function hasRestorableBannerStudio(
  value: unknown,
): value is BannerStudioDocument {
  if (!isBannerStudioDocument(value)) return false
  return value.slides.some((slide) => countCanvasSnapshotObjects(slide.canvasSnapshot) > 0)
}

export function formatBannerDimensions(doc?: BannerStudioDocument | null): string | null {
  if (!doc?.project?.dimensions) return null
  const { width, height } = doc.project.dimensions
  if (!width || !height) return null
  return `${width} × ${height} px`
}

export const LOJA_ONLINE_BANNERS_JSON_MAX_MB = 32
export const LOJA_ONLINE_BANNERS_JSON_MAX_BYTES = LOJA_ONLINE_BANNERS_JSON_MAX_MB * 1024 * 1024

export function formatBannerJsonLimitLabel(): string {
  return `${LOJA_ONLINE_BANNERS_JSON_MAX_MB} MB`
}

export function estimateBannerJsonBytes(banners: unknown[]): number {
  try {
    return new TextEncoder().encode(JSON.stringify(banners)).length
  } catch {
    return Number.POSITIVE_INFINITY
  }
}
