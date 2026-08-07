import { FabricObject, Group } from 'fabric'
import { CUSTOM_PROPS } from '@/core/constants/editor.constants'

let registered = false

/** Garante round-trip de layerId, buttonUrl etc. no loadFromJSON do Fabric 6. */
export function registerFabricCustomProperties(): void {
  if (registered) return
  registered = true

  const props = [...CUSTOM_PROPS]
  FabricObject.customProperties = props
  Group.customProperties = props
}
