import type { FabricObject } from 'fabric'
import { Circle, FabricImage, IText, Rect } from 'fabric'
import type { LayerMeta, LayerType } from '@/core/types/banner.types'
import { CUSTOM_PROPS } from '@/core/constants/editor.constants'
import { isButtonObject, resolvePropertiesTarget } from './button.helpers'

export interface FabricLayerData {
  layerId: string
  layerName: string
  layerType: LayerType
}

export function setLayerData(
  object: FabricObject,
  data: FabricLayerData,
): void {
  object.set({
    layerId: data.layerId,
    layerName: data.layerName,
    layerType: data.layerType,
  })
}

export function getLayerData(object: FabricObject): FabricLayerData | null {
  const layerId = object.get('layerId') as string | undefined
  const layerName = object.get('layerName') as string | undefined
  const layerType = object.get('layerType') as LayerType | undefined

  if (!layerId || !layerName || !layerType) {
    return null
  }

  return { layerId, layerName, layerType }
}

export function fabricObjectToLayerMeta(object: FabricObject): LayerMeta | null {
  const target = resolvePropertiesTarget(object) ?? object
  const data = getLayerData(target)
  if (!data) return null

  return {
    id: data.layerId,
    name: data.layerName,
    type: data.layerType,
    visible: target.visible ?? true,
    locked: !target.selectable,
  }
}

export function inferLayerType(object: FabricObject | null | undefined): LayerType | null {
  const target = resolvePropertiesTarget(object)
  if (!target) return null

  const fromMeta = getLayerData(target)?.layerType
  if (fromMeta) return fromMeta

  if (isButtonObject(target)) return 'button'
  if (target instanceof IText) return 'text'
  if (target instanceof FabricImage) return 'image'
  if (target instanceof Rect || target instanceof Circle) return 'shape'

  return null
}

export function getSerializationProps(): string[] {
  return [...CUSTOM_PROPS]
}
