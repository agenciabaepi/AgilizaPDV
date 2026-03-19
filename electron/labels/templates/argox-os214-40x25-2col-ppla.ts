import type { LabelTemplate } from '../types'

/** Mesmo layout físico do modelo PPLB, para impressora configurada em linguagem PPLA (ex.: driver Windows PPLA). */
export const ARGOX_OS214_40x25_2COL_PPLA: LabelTemplate = {
  id: 'argox-os214-40x25-2col-ppla',
  name: 'Argox OS-214 Plus 40x25mm 2 col (PPLA)',
  printerModel: 'Argox OS-214 Plus',
  language: 'PPLA',
  dpi: 203,
  labelWidthMm: 40,
  labelHeightMm: 25,
  columns: 2,
  columnGapMm: 2,
  rowGapMm: 0,
  labelGapMm: 3,
  marginTopMm: 1,
  marginRightMm: 1,
  marginBottomMm: 1,
  marginLeftMm: 1
}
