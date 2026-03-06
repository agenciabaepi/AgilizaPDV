import type { LabelJobItem, LabelLayout, LayoutElement, ProductLabelData, LabelTemplate } from './types'
import { clampMin, ellipsize, formatCurrencyBRL, wrapToTwoLines } from './units'

type ExpandedItem = {
  product: ProductLabelData
}

function expandItems(items: LabelJobItem[]): ExpandedItem[] {
  const expanded: ExpandedItem[] = []
  for (const item of items) {
    const quantity = clampMin(Math.floor(item.quantity || 0), 0)
    for (let i = 0; i < quantity; i += 1) {
      expanded.push({ product: item.product })
    }
  }
  return expanded
}

function createElements(template: LabelTemplate, product: ProductLabelData): LayoutElement[] {
  const innerLeftMm = 0.8
  const innerTopMm = 0.6
  const innerWidthMm = template.labelWidthMm - 1.6
  const rightEdgeMm = template.labelWidthMm - 0.8

  const maxCharsPerLine = 24
  const [nameLine1, nameLine2] = wrapToTwoLines(product.nome.trim(), maxCharsPerLine)
  const priceText = formatCurrencyBRL(product.preco)
  const codeText = ellipsize(`COD: ${product.codigoInterno}`, 12)
  const unitText = ellipsize(product.unidade ?? 'UN', 4)

  const elements: LayoutElement[] = []

  if (nameLine1) {
    elements.push({
      type: 'text',
      role: 'productName',
      text: nameLine1,
      xMm: innerLeftMm,
      yMm: innerTopMm,
      widthMm: innerWidthMm,
      heightMm: 2
    })
  }
  if (nameLine2) {
    elements.push({
      type: 'text',
      role: 'productNameLine2',
      text: nameLine2,
      xMm: innerLeftMm,
      yMm: innerTopMm + 1.8,
      widthMm: innerWidthMm,
      heightMm: 2
    })
  }

  const barcodeY = 4.4
  const barcodeHeightMm = 10.2
  if (product.codigoBarras?.trim()) {
    const digits = product.codigoBarras.trim().replace(/\D/g, '')
    const barcodeText = digits.length >= 8
      ? `${digits.slice(0, 1)} ${digits.slice(1, 7)} ${digits.slice(7, 13)}`
      : product.codigoBarras.trim()
    elements.push({
      type: 'barcode',
      role: 'barcode',
      value: product.codigoBarras.trim(),
      xMm: innerLeftMm,
      yMm: barcodeY,
      widthMm: innerWidthMm,
      heightMm: barcodeHeightMm
    })
    elements.push({
      type: 'text',
      role: 'barcodeText',
      text: barcodeText,
      xMm: innerLeftMm + 1.5,
      yMm: barcodeY + barcodeHeightMm + 0.15,
      widthMm: innerWidthMm - 3,
      heightMm: 2
    })
  }

  const bottomY = template.labelHeightMm - 5.5
  elements.push({
    type: 'text',
    role: 'price',
    text: priceText,
    xMm: innerLeftMm,
    yMm: bottomY,
    widthMm: 20,
    heightMm: 3
  })
  elements.push({
    type: 'text',
    role: 'internalCode',
    text: codeText,
    xMm: rightEdgeMm - 14,
    yMm: bottomY,
    widthMm: 12,
    heightMm: 2.4
  })
  elements.push({
    type: 'text',
    role: 'unit',
    text: unitText,
    xMm: rightEdgeMm - 5,
    yMm: bottomY,
    widthMm: 5,
    heightMm: 2.4
  })

  return elements
}

export function buildLabelLayout(template: LabelTemplate, items: LabelJobItem[]): LabelLayout {
  const expanded = expandItems(items)
  const pitchX = template.labelWidthMm + template.columnGapMm
  const pitchY = template.labelHeightMm + template.rowGapMm
  const rowCount = Math.max(1, Math.ceil(expanded.length / template.columns))
  const mediaWidthMm =
    template.marginLeftMm +
    template.marginRightMm +
    template.columns * template.labelWidthMm +
    (template.columns - 1) * template.columnGapMm
  const mediaHeightMm =
    template.marginTopMm +
    template.marginBottomMm +
    rowCount * template.labelHeightMm +
    (rowCount - 1) * template.rowGapMm

  const cells = expanded.map((expandedItem, index) => {
    const column = index % template.columns
    const row = Math.floor(index / template.columns)
    const originXMm = template.marginLeftMm + column * pitchX
    const originYMm = template.marginTopMm + row * pitchY

    return {
      index,
      row,
      column,
      originXMm,
      originYMm,
      product: expandedItem.product,
      elements: createElements(template, expandedItem.product)
    }
  })

  return {
    template,
    totalLabels: cells.length,
    mediaWidthMm,
    mediaHeightMm,
    cells
  }
}
