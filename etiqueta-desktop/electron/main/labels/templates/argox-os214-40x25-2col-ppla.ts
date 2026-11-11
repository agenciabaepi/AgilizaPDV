import type { LabelTemplate } from '../types'

/**
 * Rolo 40×25 mm, 2 colunas, térmica direta (sem ribbon).
 * Dimensões alinhadas ao FAQ Argox multi-coluna (Page Setup):
 * - largura/altura de UMA etiqueta
 * - gap horizontal entre colunas
 * - margens laterais do liner
 *
 * Total aproximado: 1.5 + 40 + 2 + 40 + 1.5 = 85 mm
 */
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
  marginTopMm: 0.5,
  marginRightMm: 2,
  marginBottomMm: 0.5,
  marginLeftMm: 2
}
