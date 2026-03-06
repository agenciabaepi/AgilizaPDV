import type { LabelLayout, LabelPreview, LayoutElement } from './types'

const EAN13_L_PATTERNS = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const EAN13_G_PATTERNS = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const EAN13_R_PATTERNS = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
const EAN13_PARITY_BY_FIRST = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

function calculateEan13CheckDigit(ean12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i += 1) {
    const digit = Number(ean12[i] ?? '0')
    sum += digit * (i % 2 === 0 ? 1 : 3)
  }
  return (10 - (sum % 10)) % 10
}

function normalizeEan13(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 12) return `${digits}${calculateEan13CheckDigit(digits)}`
  if (digits.length === 13) {
    const expected = calculateEan13CheckDigit(digits.slice(0, 12))
    if (expected === Number(digits[12])) return digits
  }
  return null
}

function buildEan13Bars(ean13: string): string {
  const first = Number(ean13[0])
  const leftDigits = ean13.slice(1, 7).split('').map((d) => Number(d))
  const rightDigits = ean13.slice(7).split('').map((d) => Number(d))
  const parity = EAN13_PARITY_BY_FIRST[first]

  let bits = '101'
  for (let i = 0; i < 6; i += 1) {
    const digit = leftDigits[i]
    bits += parity[i] === 'G' ? EAN13_G_PATTERNS[digit] : EAN13_L_PATTERNS[digit]
  }
  bits += '01010'
  for (let i = 0; i < 6; i += 1) {
    bits += EAN13_R_PATTERNS[rightDigits[i]]
  }
  bits += '101'
  return bits
}

function formatBarcodeHumanReadable(value: string): string {
  const normalized = normalizeEan13(value)
  if (normalized) return `${normalized.slice(0, 1)} ${normalized.slice(1, 7)} ${normalized.slice(7)}`
  const digits = value.replace(/\D/g, '')
  if (digits.length >= 8) return `${digits.slice(0, 1)} ${digits.slice(1, 7)} ${digits.slice(7)}`
  return value
}

function renderEan13Svg(value: string, widthMm: number, heightMm: number): string | null {
  const normalized = normalizeEan13(value)
  if (!normalized) return null
  const bars = buildEan13Bars(normalized)
  const quietModules = 11
  const totalModules = quietModules + bars.length + quietModules
  const moduleWidth = widthMm / totalModules

  const barHeightMm = Math.max(1, heightMm - 1.8)
  const guardBarHeightMm = Math.min(heightMm, barHeightMm + 0.7)

  const barRects: string[] = []
  for (let i = 0; i < bars.length; i += 1) {
    if (bars[i] !== '1') continue
    const moduleIndex = quietModules + i
    const x = moduleIndex * moduleWidth
    const isGuard = i < 3 || (i >= 45 && i < 50) || i >= 92
    const h = isGuard ? guardBarHeightMm : barHeightMm
    barRects.push(`<rect x="${x.toFixed(3)}" y="0" width="${moduleWidth.toFixed(3)}" height="${h.toFixed(3)}" fill="#111"/>`)
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthMm} ${heightMm}" preserveAspectRatio="none">
    <rect x="0" y="0" width="${widthMm}" height="${heightMm}" fill="#fff"/>
    ${barRects.join('')}
  </svg>`
}

function renderElement(el: LayoutElement): string {
  if (el.type === 'text') {
    const className = `el-text el-${el.role}`
    return `<div class="${className}" style="left:${el.xMm}mm;top:${el.yMm}mm;">${el.text}</div>`
  }
  const barcodeValue = el.value.replace(/[<>&"]/g, '')
  const barcodeLabel = formatBarcodeHumanReadable(barcodeValue)
  const barcodeSvg = renderEan13Svg(barcodeValue, el.widthMm, el.heightMm)
  return `<div class="el-barcode" style="left:${el.xMm}mm;top:${el.yMm}mm;width:${el.widthMm}mm;height:${el.heightMm}mm;">
    <div class="el-barcode-bars">${barcodeSvg ?? ''}</div>
    <div class="el-barcode-text">${barcodeLabel}</div>
  </div>`
}

export function buildLabelPreview(layout: LabelLayout): LabelPreview {
  const html = `
<style>
  .labels-preview{font-family:Arial,sans-serif;background:#f4f5f8;padding:12px;display:flex;justify-content:center}
  .labels-sheet{position:relative;background:#fff;border:1px solid #d0d4dd;width:${layout.mediaWidthMm}mm;height:${layout.mediaHeightMm}mm}
  .labels-cell{position:absolute;border:1px dashed #c5cad4;box-sizing:border-box}
  .el-text{position:absolute;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#1d2433}
  .el-productName,.el-productNameLine2{font-size:5.5pt;font-weight:700;max-width:38mm;line-height:1.15}
  .el-price{font-size:10pt;font-weight:800}
  .el-internalCode,.el-unit{font-size:5.5pt}
  .el-barcodeText{font-family:monospace;font-size:6.8pt;letter-spacing:0.03em;text-align:center}
  .el-barcode{position:absolute;display:flex;flex-direction:column;justify-content:space-between;background:#fff}
  .el-barcode-bars{
    flex:1;
    margin:0.3mm 0.35mm 0 0.35mm;
  }
  .el-barcode-bars svg{
    width:100%;
    height:100%;
    display:block;
  }
  .el-barcode-text{display:none}
</style>
<div class="labels-preview">
  <div class="labels-sheet">
    ${layout.cells
      .map((cell) => {
        const elements = cell.elements.map((e) => renderElement(e)).join('')
        return `
<div class="labels-cell" style="left:${cell.originXMm}mm;top:${cell.originYMm}mm;width:${layout.template.labelWidthMm}mm;height:${layout.template.labelHeightMm}mm;">
  ${elements}
</div>`
      })
      .join('')}
  </div>
</div>`

  return {
    templateId: layout.template.id,
    mediaWidthMm: layout.mediaWidthMm,
    mediaHeightMm: layout.mediaHeightMm,
    totalLabels: layout.totalLabels,
    html
  }
}
