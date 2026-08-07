import { CUSTOM_PROPS } from '@/core/constants/editor.constants'
import { STUDIO_IMAGE_PLACEHOLDER } from '@/features/editor/services/studio-transfer.helpers'
import { parseCanvasSnapshot, type CanvasSnapshotInput } from './snapshot.helpers'

const LEGACY_COVER_LAYER_NAMES = new Set(['Banner da loja', 'Imagem'])
const INTERACTIVE_LAYER_TYPES = new Set(['button', 'text'])

type SnapshotObject = {
  layerName?: string
  layerType?: string
  src?: string
  type?: string
}

function isInteractiveLayer(object: SnapshotObject): boolean {
  if (INTERACTIVE_LAYER_TYPES.has(object.layerType ?? '')) return true
  return object.type === 'Group' && object.layerType === 'button'
}

function isLegacyCoverImage(object: SnapshotObject): boolean {
  return (
    object.layerType === 'image' &&
    typeof object.layerName === 'string' &&
    LEGACY_COVER_LAYER_NAMES.has(object.layerName)
  )
}

function isPreviewDuplicateImage(object: SnapshotObject, previewImagem?: string | null): boolean {
  if (object.layerType !== 'image') return false
  const src = object.src
  if (!src) return false
  if (src === STUDIO_IMAGE_PLACEHOLDER) return true
  const preview = previewImagem?.trim()
  return !!preview && src === preview
}

/** Remove camada achatada gerada por fallback de imagem quando há outras camadas editáveis. */
export function stripLegacyCoverLayerFromSnapshot(
  snapshot: CanvasSnapshotInput,
): string | null {
  const parsed = parseCanvasSnapshot(snapshot)
  if (!parsed?.objects || parsed.objects.length < 2) {
    return null
  }

  const objects = parsed.objects as SnapshotObject[]
  const hasInteractive = objects.some(isInteractiveLayer)
  if (!hasInteractive) return null

  const legacyIndexes = objects
    .map((object, index) => ({ object, index }))
    .filter(({ object }) => isLegacyCoverImage(object))
    .map(({ index }) => index)

  if (legacyIndexes.length === 0) {
    return null
  }

  const filtered = parsed.objects.filter((_, index) => !legacyIndexes.includes(index))
  if (filtered.length === 0) {
    return null
  }

  return JSON.stringify({ ...parsed, objects: filtered })
}

/** Remove imagens que são a preview exportada duplicada (ex.: botão já embutido no JPEG). */
export function stripPreviewDuplicateImageLayers(
  snapshot: CanvasSnapshotInput,
  previewImagem?: string | null,
): string | null {
  const parsed = parseCanvasSnapshot(snapshot)
  if (!parsed?.objects || parsed.objects.length < 2) {
    return null
  }

  const objects = parsed.objects as SnapshotObject[]
  const hasInteractive = objects.some(isInteractiveLayer)
  if (!hasInteractive) return null

  const duplicateIndexes = objects
    .map((object, index) => ({ object, index }))
    .filter(({ object }) => isPreviewDuplicateImage(object, previewImagem))
    .map(({ index }) => index)

  if (duplicateIndexes.length === 0) {
    return null
  }

  const filtered = parsed.objects.filter((_, index) => !duplicateIndexes.includes(index))
  if (filtered.length === 0) {
    return null
  }

  return JSON.stringify({ ...parsed, objects: filtered })
}

export function applySerializedCustomProps(
  serialized: Record<string, unknown>,
  instance: { set: (values: Record<string, unknown>) => unknown },
): void {
  const patch: Record<string, unknown> = {}
  for (const prop of CUSTOM_PROPS) {
    if (serialized[prop] !== undefined) {
      patch[prop] = serialized[prop]
    }
  }
  if (Object.keys(patch).length > 0) {
    instance.set(patch)
  }
}
