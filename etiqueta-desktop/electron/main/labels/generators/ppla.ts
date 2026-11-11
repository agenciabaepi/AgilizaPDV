import type { LabelCellLayout, LabelLayout } from '../types'
import type { CommandGenerator, GeneratedPrintPayload } from './types'

const STX = '\x02'
const CR = '\r'

/** Largura útil de uma etiqueta no rolo 2 colunas. */
const LABEL_W_MM = 40
const LABEL_H_MM = 25
/** Margem interna (evita cortar no fio do adesivo). */
const PAD_MM = 2.5

/** PPLA métrico: coords em décimos de mm. Origem inferior-esquerda; texto sobe a partir do Y. */
function mm10(mm: number): number {
  return Math.max(0, Math.round(mm * 10))
}

function pad(value: number | string, size: number): string {
  const s = String(Math.max(0, Math.round(Number(value) || 0)))
  if (s.length >= size) return s.slice(-size)
  return s.padStart(size, '0')
}

function sanitizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/"/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 22)
}

function calculateEan13CheckDigit(ean12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i += 1) {
    sum += Number(ean12[i] ?? '0') * (i % 2 === 0 ? 1 : 3)
  }
  return (10 - (sum % 10)) % 10
}

function resolveEan13Data(rawValue: string): string | null {
  const digits = rawValue.replace(/\D/g, '')
  if (digits.length === 12) return `${digits}${calculateEan13CheckDigit(digits)}`
  if (digits.length === 13) {
    const ean12 = digits.slice(0, 12)
    if (calculateEan13CheckDigit(ean12) === Number(digits[12])) return digits
  }
  return null
}

function groupByRow(cells: LabelCellLayout[]): LabelCellLayout[][] {
  const map = new Map<number, LabelCellLayout[]>()
  for (const cell of cells) {
    if (!map.has(cell.row)) map.set(cell.row, [])
    map.get(cell.row)?.push(cell)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map((entry) => entry[1].sort((a, b) => a.column - b.column))
}

function textField(
  xMm: number,
  yMm: number,
  text: string,
  opts: { font?: string; h?: string; v?: string } = {}
): string {
  const body = sanitizeText(text)
  if (!body) return ''
  const font = opts.font ?? '2'
  const h = opts.h ?? '1'
  const v = opts.v ?? '1'
  return `1${font}${h}${v}000${pad(mm10(yMm), 4)}${pad(mm10(xMm), 4)}${body}${CR}`
}

function barcodeField(xMm: number, yMm: number, heightDots: number, value: string): string {
  const h = pad(Math.max(40, Math.min(72, heightDots)), 3)
  const y = pad(mm10(yMm), 4)
  const x = pad(mm10(xMm), 4)
  const ean13 = resolveEan13Data(value)
  // F32 = EAN-13 com módulos mais largos; HRI sob as barras
  if (ean13) return `1F32${h}${y}${x}${ean13}${CR}`
  const cleaned = value.replace(/[^0-9A-Za-z\-]/g, '').slice(0, 20)
  if (!cleaned) return ''
  return `1A32${h}${y}${x}${cleaned}${CR}`
}

/**
 * Leiaute igual à prévia do app (2ª imagem):
 *
 *  ┌────────────────────────────────┐
 *  │ Cabo Kaidi Iphone              │  nome topo-esquerda
 *  │      ▮▮▮▮ BARCODE ▮▮▮▮         │  código centralizado
 *  │      5 527077 170641           │  dígitos (HRI da impressora)
 *  │ R$ 25,00              COD:6    │  preço esq / cod dir
 *  │                         UN     │
 *  └────────────────────────────────┘
 */
function buildColumnFields(
  colX: number,
  product: {
    nome: string
    preco: number
    codigoInterno: string
    codigoBarras: string | null
    unidade?: string
  }
): string[] {
  const lines: string[] = []
  const nome = sanitizeText(product.nome) || 'PRODUTO'
  const preco = `R$ ${product.preco.toFixed(2).replace('.', ',')}`
  const cod = sanitizeText(`COD:${product.codigoInterno}`) || 'COD'
  const und = sanitizeText(product.unidade ?? 'UN') || 'UN'

  // 1) Nome — topo esquerdo
  lines.push(textField(colX + PAD_MM, 20.0, nome, { font: '2', h: '1', v: '1' }))

  // 2) Código de barras centralizado (mais largo / alto)
  const rawBars = product.codigoBarras?.trim() ?? ''
  const barcodeWidthMm = 30
  const barcodeX = colX + (LABEL_W_MM - barcodeWidthMm) / 2
  if (rawBars) {
    // Base do barcode; barras ~8 mm de altura → topo ~17–18 mm (abaixo do nome)
    lines.push(barcodeField(barcodeX, 9.5, 64, rawBars))
  }

  // 3) Preço canto inferior esquerdo (um pouco menor que antes)
  lines.push(textField(colX + PAD_MM, 1.6, preco, { font: '3', h: '1', v: '1' }))

  // 4) COD + UN canto inferior direito
  lines.push(textField(colX + 28.0, 3.4, cod, { font: '1', h: '1', v: '1' }))
  lines.push(textField(colX + 32.5, 1.5, und, { font: '1', h: '1', v: '1' }))

  return lines.filter(Boolean)
}

export class PplaGenerator implements CommandGenerator {
  generate(layout: LabelLayout): GeneratedPrintPayload {
    const t = layout.template
    const rows = groupByRow(layout.cells)
    const parts: string[] = []

    const maxLen = pad(mm10(Math.max(LABEL_H_MM, t.labelHeightMm) + 5), 4)
    parts.push(
      `${STX}m${CR}`,
      `${STX}e${CR}`,
      `${STX}M${maxLen}${CR}`,
      `${STX}MTD${CR}`,
      `${STX}KI71${CR}`,
      `${STX}O0220${CR}`,
      `${STX}c0000${CR}`
    )

    for (const rowCells of rows) {
      parts.push(`${STX}L${CR}`)
      parts.push(`D11${CR}`)
      parts.push(`H17${CR}`)
      parts.push(`PC${CR}`)

      for (const cell of rowCells) {
        parts.push(...buildColumnFields(cell.originXMm, cell.product))
      }

      parts.push(`Q0001${CR}`)
      parts.push(`E${CR}`)
    }

    const payload = parts.join('')
    return {
      mimeType: 'application/octet-stream',
      language: 'PPLA',
      raw: Buffer.from(payload, 'latin1'),
      previewText: payload.replace(/\x02/g, '<STX>').replace(/\r/g, '<CR>\n')
    }
  }
}
