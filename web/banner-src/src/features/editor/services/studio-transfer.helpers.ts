import type { BannerStudioDocument } from '@/core/types/banner-document.types'
import { parseCanvasSnapshot } from '@/features/editor/services/snapshot.helpers'

/** Marcador leve no lugar de data URLs grandes (evita duplicar JPEG no postMessage). */
export const STUDIO_IMAGE_PLACEHOLDER = '__LOJA_BANNER_IMAGEM__'

const INLINE_IMAGE_MAX_BYTES = 32_768

function isLargeInlineImage(src: unknown): src is string {
  return typeof src === 'string' && src.startsWith('data:') && src.length > INLINE_IMAGE_MAX_BYTES
}

type SnapshotRewriteContext = {
  src: string
  object: Record<string, unknown>
}

function rewriteSlideSnapshots(
  studio: BannerStudioDocument,
  rewrite: (ctx: SnapshotRewriteContext) => string | null,
): BannerStudioDocument {
  const doc = JSON.parse(JSON.stringify(studio)) as BannerStudioDocument

  for (const slide of doc.slides) {
    const parsed = parseCanvasSnapshot(slide.canvasSnapshot)
    if (!parsed?.objects?.length) continue

    let changed = false
    for (const object of parsed.objects) {
      const record = object as Record<string, unknown>
      const src = record.src
      if (typeof src !== 'string') continue

      const next = rewrite({ src, object: record })
      if (next && next !== src) {
        record.src = next
        changed = true
      }
    }

    if (changed) {
      slide.canvasSnapshot = JSON.stringify(parsed)
    }
  }

  return doc
}

/** Substitui data URLs grandes por placeholder antes de enviar ao iframe. */
export function compactStudioForTransfer(studio: BannerStudioDocument): BannerStudioDocument {
  const assetImages: Record<string, string> = {}
  const doc = JSON.parse(JSON.stringify(studio)) as BannerStudioDocument

  for (const slide of doc.slides) {
    const parsed = parseCanvasSnapshot(slide.canvasSnapshot)
    if (!parsed?.objects?.length) continue

    let changed = false
    for (const object of parsed.objects) {
      const record = object as Record<string, unknown>
      const src = record.src
      if (typeof src !== 'string' || !isLargeInlineImage(src)) continue

      const layerId = record.layerId
      if (typeof layerId === 'string' && layerId) {
        assetImages[layerId] = src
      }

      record.src = STUDIO_IMAGE_PLACEHOLDER
      changed = true
    }

    if (changed) {
      slide.canvasSnapshot = JSON.stringify(parsed)
    }
  }

  if (Object.keys(assetImages).length > 0) {
    doc.assetImages = {
      ...(studio.assetImages ?? {}),
      ...assetImages,
    }
  }

  return doc
}

/** Restaura imagens inline a partir de `assetImages` ou, em último caso, da preview (`imagem`). */
export function expandStudioFromTransfer(
  studio: BannerStudioDocument,
  imagem?: string | null,
): BannerStudioDocument {
  const assets = studio.assetImages ?? {}
  const fallbackImage = imagem?.trim() || null

  const doc = rewriteSlideSnapshots(studio, ({ src, object }) => {
    if (src !== STUDIO_IMAGE_PLACEHOLDER) return null

    const layerId = object.layerId
    if (typeof layerId === 'string' && assets[layerId]) {
      return assets[layerId]
    }

    return fallbackImage ?? src
  })

  delete doc.assetImages
  return doc
}

export function estimateStudioTransferBytes(studio: BannerStudioDocument): number {
  try {
    return new TextEncoder().encode(JSON.stringify(studio)).length
  } catch {
    return Number.POSITIVE_INFINITY
  }
}
