import type { TimelineSlide } from '@/core/types/animation.types'

export type CanvasSnapshotPayload = {
  objects?: unknown[]
}

export type CanvasSnapshotInput = string | CanvasSnapshotPayload | null | undefined

export function parseCanvasSnapshot(snapshot: CanvasSnapshotInput): CanvasSnapshotPayload | null {
  if (!snapshot) return null

  if (typeof snapshot === 'object') {
    return snapshot
  }

  if (typeof snapshot !== 'string' || !snapshot.trim()) return null

  try {
    let parsed: unknown = JSON.parse(snapshot)
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed)
    }
    return parsed && typeof parsed === 'object' ? (parsed as CanvasSnapshotPayload) : null
  } catch {
    return null
  }
}

export function countCanvasSnapshotObjects(snapshot: CanvasSnapshotInput): number {
  const parsed = parseCanvasSnapshot(snapshot)
  return Array.isArray(parsed?.objects) ? parsed.objects.length : 0
}

export function slideHasCanvasObjects(slide: TimelineSlide | null | undefined): boolean {
  return countCanvasSnapshotObjects(slide?.canvasSnapshot ?? null) > 0
}

export function findSlideWithCanvasObjects(slides: TimelineSlide[]): TimelineSlide | null {
  return slides.find((slide) => slideHasCanvasObjects(slide)) ?? null
}

export function resolveImportSlide(
  slides: TimelineSlide[],
  activeSlideId: string,
): TimelineSlide | null {
  const active = slides.find((slide) => slide.id === activeSlideId) ?? null
  if (slideHasCanvasObjects(active)) return active
  return findSlideWithCanvasObjects(slides)
}

export function normalizeCanvasSnapshot(snapshot: CanvasSnapshotInput): string | null {
  const parsed = parseCanvasSnapshot(snapshot)
  if (!parsed) return null
  return JSON.stringify(parsed)
}
