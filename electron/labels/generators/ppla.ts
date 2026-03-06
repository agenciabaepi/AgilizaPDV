import { mmToDots } from '../units'
import type { LabelCellLayout, LabelLayout } from '../types'
import type { CommandGenerator, GeneratedPrintPayload } from './types'

function sanitizeText(value: string): string {
  return value.replace(/"/g, "'").replace(/\r?\n/g, ' ')
}

function calculateEan13CheckDigit(ean12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i += 1) {
    const digit = Number(ean12[i] ?? '0')
    sum += digit * (i % 2 === 0 ? 1 : 3)
  }
  return (10 - (sum % 10)) % 10
}

function resolveEan13Data(rawValue: string): string | null {
  const digits = rawValue.replace(/\D/g, '')
  if (digits.length === 12) return digits
  if (digits.length === 13) {
    const ean12 = digits.slice(0, 12)
    const expectedCheck = calculateEan13CheckDigit(ean12)
    const providedCheck = Number(digits[12])
    if (expectedCheck === providedCheck) return ean12
  }
  return null
}

/** Comandos PPLA: A = texto, B = código de barras. Estrutura compatível com Argox OS-214 em modo PPLA. */
function pushTextCommand(commands: string[], x: number, y: number, role: string, text: string): void {
  const font =
    role === 'price'
      ? '4'
      : role === 'productName' || role === 'productNameLine2'
        ? '1'
        : role === 'barcodeText'
          ? '1'
          : '2'
  const xmul = role === 'price' ? 2 : 1
  const ymul = role === 'price' ? 2 : 1
  commands.push(`A${x},${y},0,${font},${xmul},${ymul},N,"${sanitizeText(text)}"`)
}

/** PPLA: EAN-13 usa o mesmo código E30 que PPLB na família Argox OS-214. */
function pushBarcodeCommand(commands: string[], x: number, y: number, height: number, value: string): void {
  const ean13Data = resolveEan13Data(value)
  if (ean13Data) {
    commands.push(`B${x},${y},0,E30,2,3,${height},N,"${ean13Data}"`)
    return
  }
  const cleaned = value.replace(/[^0-9A-Za-z]/g, '')
  if (!cleaned) return
  commands.push(`B${x},${y},0,1,2,3,${height},N,"${cleaned}"`)
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

export class PplaGenerator implements CommandGenerator {
  generate(layout: LabelLayout): GeneratedPrintPayload {
    const t = layout.template
    const mediaWidthDots = mmToDots(layout.mediaWidthMm, t.dpi)
    const mediaHeightDots = mmToDots(t.marginTopMm + t.marginBottomMm + t.labelHeightMm, t.dpi)
    const gapDots = mmToDots(t.rowGapMm, t.dpi)
    const commands: string[] = []

    const rows = groupByRow(layout.cells)
    for (const rowCells of rows) {
      commands.push('N')
      commands.push(`q${mediaWidthDots}`)
      commands.push(`Q${mediaHeightDots},${gapDots}`)
      commands.push('D11')
      commands.push('S4')

      for (const cell of rowCells) {
        for (const element of cell.elements) {
          const xDots = mmToDots(cell.originXMm + element.xMm, t.dpi)
          const yDots = mmToDots(cell.originYMm + element.yMm, t.dpi)
          if (element.type === 'text') {
            pushTextCommand(commands, xDots, yDots, element.role, element.text)
            continue
          }
          const hDots = mmToDots(element.heightMm, t.dpi)
          pushBarcodeCommand(commands, xDots, yDots, hDots, element.value)
        }
      }

      commands.push('P1')
    }

    const payload = `${commands.join('\n')}\n`
    return {
      mimeType: 'application/octet-stream',
      language: 'PPLA',
      raw: Buffer.from(payload, 'ascii'),
      previewText: payload
    }
  }
}
