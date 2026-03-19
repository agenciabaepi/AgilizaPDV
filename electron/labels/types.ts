export type PrinterLanguage = 'PPLA' | 'PPLB' | 'PPLZ'

export type LabelTemplate = {
  id: string
  name: string
  printerModel: string
  language: PrinterLanguage
  dpi: number
  labelWidthMm: number
  labelHeightMm: number
  columns: number
  columnGapMm: number
  rowGapMm: number
  labelGapMm: number
  marginTopMm: number
  marginRightMm: number
  marginBottomMm: number
  marginLeftMm: number
}

export type ProductLabelData = {
  id: string
  nome: string
  preco: number
  codigoInterno: string
  codigoBarras: string | null
  unidade?: string
}

export type LabelJobItem = {
  product: ProductLabelData
  quantity: number
}

export type LabelJob = {
  templateId: string
  printerName: string
  items: LabelJobItem[]
}

export type LayoutTextElement = {
  type: 'text'
  role: 'productName' | 'productNameLine2' | 'price' | 'internalCode' | 'unit' | 'barcodeText'
  text: string
  xMm: number
  yMm: number
  widthMm?: number
  heightMm?: number
}

export type LayoutBarcodeElement = {
  type: 'barcode'
  role: 'barcode'
  value: string
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
}

export type LayoutElement = LayoutTextElement | LayoutBarcodeElement

export type LabelCellLayout = {
  index: number
  row: number
  column: number
  originXMm: number
  originYMm: number
  product: ProductLabelData
  elements: LayoutElement[]
}

export type LabelLayout = {
  template: LabelTemplate
  totalLabels: number
  mediaWidthMm: number
  mediaHeightMm: number
  cells: LabelCellLayout[]
}

export type PrintResult = {
  ok: boolean
  error?: string
}

export type LabelPreview = {
  templateId: string
  mediaWidthMm: number
  mediaHeightMm: number
  totalLabels: number
  html: string
}

export type PrinterInfo = {
  name: string
  isDefault: boolean
}

export type PrinterStatus = {
  name: string
  online: boolean
  detail: string
}
