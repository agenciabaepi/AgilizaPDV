import type { LabelTemplate } from '../types'
import type { CommandGenerator } from './types'
import { PplaGenerator } from './ppla'
import { PplbGenerator } from './pplb'

export function getCommandGenerator(template: LabelTemplate): CommandGenerator {
  if (template.language === 'PPLA') return new PplaGenerator()
  if (template.language === 'PPLB') return new PplbGenerator()
  throw new Error(`Linguagem de impressora não suportada: ${template.language}`)
}
