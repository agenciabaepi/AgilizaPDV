import type { Canvas } from 'fabric'
import { IText, type FabricObject, type Group } from 'fabric'
import { useEditorStore } from '@/features/editor/stores/editor.store'
import { getObjectScreenRect } from '@/features/editor/utils/floating-position'
import { getButtonParts, isButtonObject } from './button.helpers'

type EditableText = IText & {
  hiddenTextarea?: HTMLTextAreaElement
  selected?: boolean
  updateTextareaPosition?: () => void
}

let activeCleanup: (() => void) | null = null
let activeEditing: { text: EditableText; objectForRect: FabricObject } | null = null

function getCanvasFrameElement(): HTMLElement | null {
  return document.querySelector('.canvas-frame')
}

function resolveEditableText(target: FabricObject | null | undefined): EditableText | null {
  if (!target) return null
  if (target instanceof IText) return target as EditableText

  if (isButtonObject(target)) {
    return (getButtonParts(target)?.label as EditableText | undefined) ?? null
  }

  return null
}

function styleHiddenTextarea(
  text: EditableText,
  objectForRect: FabricObject,
  frameElement: HTMLElement,
  zoom: number,
): void {
  const textarea = text.hiddenTextarea
  if (!textarea) return

  const rect = getObjectScreenRect(objectForRect, frameElement, zoom)
  const fontSize = (text.fontSize ?? 16) * zoom

  textarea.style.position = 'fixed'
  textarea.style.left = `${rect.left}px`
  textarea.style.top = `${rect.top}px`
  textarea.style.width = `${Math.max(rect.width, 48)}px`
  textarea.style.height = `${Math.max(rect.height, fontSize * 1.4)}px`
  textarea.style.fontSize = `${fontSize}px`
  textarea.style.lineHeight = '1.2'
  textarea.style.transform = 'none'
  textarea.style.opacity = '1'
  textarea.style.zIndex = '99999'
  textarea.style.color = typeof text.fill === 'string' ? text.fill : '#ffffff'
  textarea.style.background = 'transparent'
  textarea.style.border = 'none'
  textarea.style.outline = 'none'
  textarea.style.resize = 'none'
  textarea.style.overflow = 'hidden'
  textarea.style.padding = '0'
  textarea.style.margin = '0'
  textarea.style.textAlign = text.textAlign ?? 'center'
  textarea.style.fontFamily = text.fontFamily ?? 'sans-serif'
  textarea.style.fontWeight = String(text.fontWeight ?? 'normal')
  textarea.style.letterSpacing = `${(text.charSpacing ?? 0) * zoom}px`
}

function prepareButtonGroup(group: Group): EditableText | null {
  const label = getButtonParts(group)?.label as EditableText | undefined
  if (!label) return null

  group.set({
    interactive: true,
    subTargetCheck: true,
  })

  return label
}

function clearActiveTextEditingPatch(): void {
  activeCleanup?.()
  activeCleanup = null
  activeEditing = null
}

function findActiveTextEditing(): { text: EditableText; objectForRect: FabricObject } | null {
  if (activeEditing?.text.isEditing) {
    return activeEditing
  }

  const selected = useEditorStore().selectedObject
  const fromSelection = resolveEditableText(selected)
  if (fromSelection?.isEditing && selected) {
    return {
      text: fromSelection,
      objectForRect: isButtonObject(selected)
        ? (getButtonParts(selected)?.label ?? selected)
        : fromSelection,
    }
  }

  return null
}

export function syncActiveTextEditingPosition(frameElement?: HTMLElement | null): void {
  const active = findActiveTextEditing()
  if (!active) return

  const frame = frameElement ?? getCanvasFrameElement()
  if (!frame) return

  styleHiddenTextarea(
    active.text,
    active.objectForRect,
    frame,
    useEditorStore().viewport.zoom,
  )
  ;(active.text.canvas as Canvas | undefined)?.requestRenderAll()
}

export function startTextEditing(
  target: FabricObject,
  frameElement?: HTMLElement | null,
): boolean {
  clearActiveTextEditingPatch()

  let text: EditableText | null = null
  let objectForRect: FabricObject = target

  if (isButtonObject(target)) {
    text = prepareButtonGroup(target)
    objectForRect = getButtonParts(target)?.label ?? target
  } else if (target instanceof IText) {
    text = target as EditableText
  }

  if (!text) return false

  const canvas = text.canvas as Canvas | undefined
  if (!canvas) return false

  const frame = frameElement ?? getCanvasFrameElement()
  if (!frame) return false

  const editor = useEditorStore()
  const zoom = editor.viewport.zoom

  canvas.discardActiveObject()
  canvas.setActiveObject(target)
  text.selected = true
  text.editable = true
  canvas.textEditingManager.register(text)
  canvas.calcOffset()
  text.enterEditing()
  text.selectAll()

  const originalUpdate = text.updateTextareaPosition?.bind(text)
  text.updateTextareaPosition = () => {
    styleHiddenTextarea(text!, objectForRect, frame, zoom)
  }

  styleHiddenTextarea(text, objectForRect, frame, zoom)
  text.hiddenTextarea?.focus()

  activeEditing = { text, objectForRect }

  const onEditingExited = () => {
    activeEditing = null
    if (originalUpdate) {
      text!.updateTextareaPosition = originalUpdate
    }
    canvas.off('text:editing:exited', onEditingExited)
    if (activeCleanup) {
      activeCleanup()
      activeCleanup = null
    }
  }

  canvas.on('text:editing:exited', onEditingExited)
  activeCleanup = () => {
    canvas.off('text:editing:exited', onEditingExited)
    if (originalUpdate) {
      text!.updateTextareaPosition = originalUpdate
    }
  }

  canvas.requestRenderAll()
  return true
}
