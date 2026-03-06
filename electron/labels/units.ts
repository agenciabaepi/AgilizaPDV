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
