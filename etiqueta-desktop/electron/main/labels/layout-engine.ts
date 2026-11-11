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

/** Prévia = mesmo leiaute da impressão (título / barcode centro / preço+COD). */
function createElements(template: LabelTemplate, product: ProductLabelData): LayoutElement[] {
  const w = template.labelWidthMm
  const [nameLine1] = wrapToTwoLines(product.nome.trim(), 22)
  const priceText = formatCurrencyBRL(product.preco).replace('.', ',')
  const codeText = ellipsize(`COD:${product.codigoInterno}`, 10)
  const unitText = ellipsize(product.unidade ?? 'UN', 4)
  const elements: LayoutElement[] = []

  if (nameLine1) {
    elements.push({
      type: 'text',
      role: 'productName',
      text: nameLine1,
      xMm: 2.5,
      yMm: 1.2,
      widthMm: w - 5,
      heightMm: 2.8
    })
  }

  if (product.codigoBarras?.trim()) {
    const digits = product.codigoBarras.trim().replace(/\D/g, '')
    const barcodeText =
      digits.length >= 8
        ? `${digits.slice(0, 1)} ${digits.slice(1, 7)} ${digits.slice(7, 13)}`
        : product.codigoBarras.trim()
    const barW = 30
    const barX = (w - barW) / 2
    elements.push({
      type: 'barcode',
      role: 'barcode',
      value: product.codigoBarras.trim(),
      xMm: barX,
      yMm: 4.5,
      widthMm: barW,
      heightMm: 10
    })
    elements.push({
      type: 'text',
      role: 'barcodeText',
      text: barcodeText,
      xMm: barX + 1,
      yMm: 15.0,
      widthMm: barW - 2,
      heightMm: 2
    })
  }

  elements.push({
    type: 'text',
    role: 'price',
    text: priceText,
    xMm: 2.5,
    yMm: 20.0,
    widthMm: 20,
    heightMm: 3
  })
  elements.push({
    type: 'text',
    role: 'internalCode',
    text: codeText,
    xMm: 28.0,
    yMm: 19.0,
    widthMm: 10,
    heightMm: 2
  })
  elements.push({
    type: 'text',
    role: 'unit',
    text: unitText,
    xMm: 32.5,
    yMm: 21.5,
    widthMm: 5,
    heightMm: 2
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
    return {
      index,
      row,
      column,
      originXMm: template.marginLeftMm + column * pitchX,
      originYMm: template.marginTopMm + row * pitchY,
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
