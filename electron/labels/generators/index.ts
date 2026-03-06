import type { LabelTemplate } from '../types'
import type { CommandGenerator } from './types'
import { PplbGenerator } from './pplb'

export function getCommandGenerator(template: LabelTemplate): CommandGenerator {
  if (template.language === 'PPLB') return new PplbGenerator()
  throw new Error(`Linguagem de impressora não suportada no MVP: ${template.language}`)
}
