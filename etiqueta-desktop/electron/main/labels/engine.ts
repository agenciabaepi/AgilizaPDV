import { buildLabelLayout } from './layout-engine'
import { getLabelTemplateById } from './templates'
import type { LabelJobItem } from './types'
import { getCommandGenerator } from './generators'
import { buildLabelPreview } from './preview'

export function buildLabelArtifacts(templateId: string, items: LabelJobItem[]) {
  const template = getLabelTemplateById(templateId)
  if (!template) throw new Error('Modelo de etiqueta não encontrado.')

  const layout = buildLabelLayout(template, items)
  const generator = getCommandGenerator(template)
  const payload = generator.generate(layout)
  const preview = buildLabelPreview(layout)

  return {
    template,
    layout,
    payload,
    preview
  }
}
