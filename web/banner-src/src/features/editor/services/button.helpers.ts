import { Group, IText, Rect, type FabricObject } from 'fabric'
import type { ButtonLayerConfig, ButtonTarget } from '@/core/types/banner.types'
import { FONT_FAMILIES } from '@/core/constants/editor.constants'
import { generateId } from '@/core/utils/helpers'
import { setLayerData } from './layer.helpers'

export const BUTTON_DEFAULTS: ButtonLayerConfig = {
  label: 'Clique aqui',
  url: 'https://',
  target: '_blank',
  bgColor: '#6366f1',
  textColor: '#ffffff',
  fontSize: 16,
  radius: 8,
}

const BUTTON_SIZE = { width: 200, height: 48 }

export function isButtonObject(obj: FabricObject | null | undefined): obj is Group {
  return !!obj && obj.get('layerType') === 'button'
}

function getFabricParent(obj: FabricObject): FabricObject | null {
  const candidate = obj as FabricObject & { group?: FabricObject; parent?: FabricObject }
  return candidate.group ?? candidate.parent ?? null
}

/** Agrupa seleção de filhos (label/fundo) no botão pai para propriedades e camadas. */
export function resolvePropertiesTarget(
  obj: FabricObject | null | undefined,
): FabricObject | null {
  if (!obj) return null

  let current: FabricObject | null = obj
  while (current) {
    if (isButtonObject(current)) return current
    current = getFabricParent(current)
  }

  return obj
}

export function getButtonParts(group: Group): { bg: Rect; label: IText } | null {
  const items = group.getObjects()
  const bg = items.find((item) => item instanceof Rect) as Rect | undefined
  const label = items.find((item) => item instanceof IText) as IText | undefined
  if (!bg || !label) return null
  return { bg, label }
}

export function createButtonGroup(
  left: number,
  top: number,
  config: Partial<ButtonLayerConfig> = {},
): Group {
  const cfg = { ...BUTTON_DEFAULTS, ...config }

  const bg = new Rect({
    width: BUTTON_SIZE.width,
    height: BUTTON_SIZE.height,
    rx: cfg.radius,
    ry: cfg.radius,
    fill: cfg.bgColor,
    originX: 'center',
    originY: 'center',
  })

  const label = new IText(cfg.label, {
    fontSize: cfg.fontSize,
    fill: cfg.textColor,
    fontFamily: FONT_FAMILIES[0],
    fontWeight: '600',
    originX: 'center',
    originY: 'center',
    editable: false,
    textAlign: 'center',
  })

  const group = new Group([bg, label], {
    left,
    top,
    originX: 'center',
    originY: 'center',
    subTargetCheck: true,
    interactive: true,
  })

  setLayerData(group, {
    layerId: generateId(),
    layerName: 'Botão',
    layerType: 'button',
  })

  group.set({
    buttonUrl: cfg.url,
    buttonTarget: cfg.target,
  })

  return group
}

export function getButtonConfig(group: Group): ButtonLayerConfig {
  const parts = getButtonParts(group)

  return {
    label: parts?.label.text ?? BUTTON_DEFAULTS.label,
    url: (group.get('buttonUrl') as string) ?? BUTTON_DEFAULTS.url,
    target: (group.get('buttonTarget') as ButtonTarget) ?? BUTTON_DEFAULTS.target,
    bgColor: (parts?.bg.fill as string) ?? BUTTON_DEFAULTS.bgColor,
    textColor: (parts?.label.fill as string) ?? BUTTON_DEFAULTS.textColor,
    fontSize: parts?.label.fontSize ?? BUTTON_DEFAULTS.fontSize,
    radius: parts?.bg.rx ?? BUTTON_DEFAULTS.radius,
  }
}

export function applyButtonConfig(
  group: Group,
  config: Partial<ButtonLayerConfig>,
): void {
  const parts = getButtonParts(group)
  if (!parts) return

  if (config.label !== undefined) {
    parts.label.text = config.label
  }
  if (config.bgColor !== undefined) {
    parts.bg.set('fill', config.bgColor)
  }
  if (config.textColor !== undefined) {
    parts.label.set('fill', config.textColor)
  }
  if (config.fontSize !== undefined) {
    parts.label.set('fontSize', config.fontSize)
  }
  if (config.radius !== undefined) {
    parts.bg.set({ rx: config.radius, ry: config.radius })
  }
  if (config.url !== undefined) {
    group.set('buttonUrl', config.url)
  }
  if (config.target !== undefined) {
    group.set('buttonTarget', config.target)
  }

  group.setCoords()
}


export function normalizeInteractiveButtons(objects: FabricObject[]): void {
  for (const obj of objects) {
    if (!isButtonObject(obj)) continue
    normalizeButtonGroupLayout(obj)
    obj.set({
      interactive: true,
      subTargetCheck: true,
    })
  }
}

/** Recentraliza label/fundo após loadFromJSON (evita texto solto acima do retângulo). */
export function normalizeButtonGroupLayout(group: Group): void {
  const parts = getButtonParts(group)
  if (!parts) return

  const { bg, label } = parts
  bg.set({
    left: 0,
    top: 0,
    originX: 'center',
    originY: 'center',
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false,
  })
  label.set({
    left: 0,
    top: 0,
    originX: 'center',
    originY: 'center',
    textAlign: 'center',
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false,
  })

  group.setCoords()
}

export function applyPlaybackObjectFlags(objects: FabricObject[]): void {
  for (const obj of objects) {
    const isButton = isButtonObject(obj)
    obj.set({
      selectable: false,
      evented: isButton,
      hoverCursor: isButton ? 'pointer' : 'default',
      hasControls: false,
      hasBorders: false,
      borderColor: 'transparent',
      cornerColor: 'transparent',
      lockMovementX: true,
      lockMovementY: true,
    })

    if (isButton) {
      normalizeButtonGroupLayout(obj)
      obj.set({ interactive: true, subTargetCheck: true })
    }
  }
}

export function normalizeButtonUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed || trimmed === 'https://') return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function openButtonLink(group: Group): void {
  const url = normalizeButtonUrl(getButtonConfig(group).url)
  if (!url) return

  const target = getButtonConfig(group).target

  if (window.parent !== window) {
    window.parent.postMessage(
      { type: 'banner-player:navigate', url, target },
      '*',
    )
    return
  }

  window.open(url, target, target === '_blank' ? 'noopener,noreferrer' : undefined)
}

export type FabricLayerType = 'text' | 'image' | 'shape' | 'button'
