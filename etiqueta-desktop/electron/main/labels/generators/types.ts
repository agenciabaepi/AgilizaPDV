import type { LabelLayout } from '../types'

export type GeneratedPrintPayload = {
  mimeType: 'application/octet-stream'
  language: 'PPLA' | 'PPLB' | 'PPLZ'
  raw: Buffer
  previewText: string
}

export interface CommandGenerator {
  generate(layout: LabelLayout): GeneratedPrintPayload
}
