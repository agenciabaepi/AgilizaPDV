import type { LabelTemplate } from '../types'
import { ARGOX_OS214_40x25_2COL } from './argox-os214-40x25-2col'
import { ARGOX_OS214_40x25_2COL_PPLA } from './argox-os214-40x25-2col-ppla'

const templates: LabelTemplate[] = [ARGOX_OS214_40x25_2COL_PPLA, ARGOX_OS214_40x25_2COL]

export function listLabelTemplates(): LabelTemplate[] {
  return templates
}

export function getLabelTemplateById(templateId: string): LabelTemplate | null {
  return templates.find((t) => t.id === templateId) ?? null
}

/** Preferência PPLA — a maioria das filas Windows/macOS Argox OS-214 Plus vem como PPLA. */
export const DEFAULT_LABEL_TEMPLATE_ID = ARGOX_OS214_40x25_2COL_PPLA.id
