/**
 * Trava o scroll do documento com contagem de referência.
 * O scroll da app fica no `html`; travamos html+body para cobrir
 * modais, menus e o caso do PDV (viewport travada).
 */
let lockCount = 0
let previousBodyOverflow = ''
let previousHtmlOverflow = ''
let previousHtmlOverflowX = ''
let previousHtmlOverflowY = ''

export function lockDocumentScroll(): void {
  if (typeof document === 'undefined') return
  if (lockCount === 0) {
    previousBodyOverflow = document.body.style.overflow
    previousHtmlOverflow = document.documentElement.style.overflow
    previousHtmlOverflowX = document.documentElement.style.overflowX
    previousHtmlOverflowY = document.documentElement.style.overflowY
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.documentElement.style.overflowX = 'hidden'
    document.documentElement.style.overflowY = 'hidden'
  }
  lockCount += 1
}

export function unlockDocumentScroll(): void {
  if (typeof document === 'undefined') return
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    document.body.style.overflow = previousBodyOverflow
    document.documentElement.style.overflow = previousHtmlOverflow
    document.documentElement.style.overflowX = previousHtmlOverflowX
    document.documentElement.style.overflowY = previousHtmlOverflowY
  }
}
