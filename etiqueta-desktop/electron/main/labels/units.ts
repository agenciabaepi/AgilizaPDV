export function mmToDots(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi)
}

export function dotsToMm(dots: number, dpi: number): number {
  return (dots * 25.4) / dpi
}

export function clampMin(value: number, min: number): number {
  return value < min ? min : value
}

export function formatCurrencyBRL(value: number): string {
  return `R$ ${value.toFixed(2)}`
}

export function ellipsize(value: string, max: number): string {
  if (value.length <= max) return value
  if (max <= 3) return value.slice(0, max)
  return `${value.slice(0, max - 3)}...`
}

/** Quebra o texto em até 2 linhas com no máximo maxCharsPerLine por linha (evita cortar no meio da palavra quando possível). */
export function wrapToTwoLines(value: string, maxCharsPerLine: number): [string, string] {
  const t = value.trim()
  if (!t) return ['', '']
  if (t.length <= maxCharsPerLine) return [t, '']
  const firstLine = t.slice(0, maxCharsPerLine)
  const lastSpace = firstLine.lastIndexOf(' ')
  const breakAt = lastSpace > maxCharsPerLine * 0.5 ? lastSpace : maxCharsPerLine
  return [t.slice(0, breakAt).trim(), t.slice(breakAt).trim()]
}

/** Letras por linha que cabem nos 40 mm da etiqueta (fonte normal / fonte pequena). */
export const NOME_MAX_LETRAS_NORMAL = 22
export const NOME_MAX_LETRAS_PEQUENA = 32

/**
 * Nome do produto na etiqueta: 1 linha se couber; senão 2 linhas na letra normal;
 * se ainda não couber, 2 linhas na letra pequena (a 2ª linha ganha "..." se sobrar texto).
 */
export function layoutNomeEtiqueta(nome: string): { linhas: string[]; pequeno: boolean } {
  const t = nome.trim().replace(/\s+/g, ' ')
  if (!t) return { linhas: [], pequeno: false }
  if (t.length <= NOME_MAX_LETRAS_NORMAL) return { linhas: [t], pequeno: false }
  const [n1, n2] = wrapToTwoLines(t, NOME_MAX_LETRAS_NORMAL)
  if (n2.length <= NOME_MAX_LETRAS_NORMAL) return { linhas: [n1, n2], pequeno: false }
  const [p1, p2] = wrapToTwoLines(t, NOME_MAX_LETRAS_PEQUENA)
  return { linhas: [p1, ellipsize(p2, NOME_MAX_LETRAS_PEQUENA)].filter(Boolean), pequeno: true }
}
