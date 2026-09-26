import { createElement, Fragment, type ReactNode } from 'react'

/** Título em negrito: linha começando com ##  */
const TITLE_RE = /^##\s+(.+)$/
/** Negrito inline: **texto** */
const BOLD_RE = /\*\*(.+?)\*\*/g

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Converte trechos **negrito** em nós React seguros. */
export function renderInlineBold(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  const re = new RegExp(BOLD_RE.source, 'g')
  while ((match = re.exec(text)) != null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index))
    }
    nodes.push(
      createElement('strong', { key: `${keyPrefix}-b-${match.index}` }, match[1])
    )
    last = match.index + match[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes.length ? nodes : [text]
}

/**
 * Renderiza descrição do produto com títulos (## Título) e negrito (**texto**).
 * Não executa HTML — só marcações simples.
 */
export function renderProdutoDescricao(descricao: string): ReactNode {
  const text = descricao.replace(/\r\n/g, '\n').trim()
  if (!text) return null

  const blocks = text.split(/\n{2,}/)
  const children: ReactNode[] = []

  blocks.forEach((block, bi) => {
    const lines = block.split('\n')
    const titleMatch = lines[0]?.match(TITLE_RE)
    if (titleMatch && lines.length === 1) {
      children.push(
        createElement(
          'h3',
          { key: `t-${bi}`, className: 'loja-produto-desc-title' },
          titleMatch[1].trim()
        )
      )
      return
    }

    if (titleMatch) {
      children.push(
        createElement(
          'h3',
          { key: `t-${bi}`, className: 'loja-produto-desc-title' },
          titleMatch[1].trim()
        )
      )
      const rest = lines.slice(1).join('\n').trim()
      if (rest) {
        children.push(
          createElement(
            'p',
            { key: `p-${bi}` },
            ...renderInlineBold(rest, `p-${bi}`)
          )
        )
      }
      return
    }

    children.push(
      createElement(
        'p',
        { key: `p-${bi}` },
        ...renderInlineBold(lines.join('\n'), `p-${bi}`)
      )
    )
  })

  return createElement(Fragment, null, ...children)
}

/** Insere/converte a linha atual (ou seleção) em título ##  */
export function wrapDescricaoAsTitle(
  value: string,
  selectionStart: number,
  selectionEnd: number
): { next: string; cursor: number } {
  const start = Math.min(selectionStart, selectionEnd)
  const end = Math.max(selectionStart, selectionEnd)

  if (start !== end) {
    const selected = value.slice(start, end).replace(/\n/g, ' ').trim()
    if (!selected) {
      return { next: value, cursor: end }
    }
    const wrapped = `## ${selected}`
    const next = `${value.slice(0, start)}${wrapped}${value.slice(end)}`
    return { next, cursor: start + wrapped.length }
  }

  // Sem seleção: marca a linha atual como título
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const lineEndIdx = value.indexOf('\n', start)
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx
  const line = value.slice(lineStart, lineEnd)
  const stripped = line.replace(/^##\s+/, '')
  const titled = stripped.trim() ? `## ${stripped.trim()}` : '## '
  const next = `${value.slice(0, lineStart)}${titled}${value.slice(lineEnd)}`
  return { next, cursor: lineStart + titled.length }
}

/** Envolve a seleção com **negrito** (ou insere placeholder). */
export function wrapDescricaoAsBold(
  value: string,
  selectionStart: number,
  selectionEnd: number
): { next: string; cursor: number } {
  const start = Math.min(selectionStart, selectionEnd)
  const end = Math.max(selectionStart, selectionEnd)
  if (start !== end) {
    const selected = value.slice(start, end)
    const wrapped = `**${selected}**`
    const next = `${value.slice(0, start)}${wrapped}${value.slice(end)}`
    return { next, cursor: start + wrapped.length }
  }
  const insert = '**negrito**'
  const next = `${value.slice(0, start)}${insert}${value.slice(end)}`
  return { next, cursor: start + 2 }
}

export function descricaoHasFormatting(value: string): boolean {
  return /^##\s+/m.test(value) || /\*\*.+\*\*/.test(value)
}

/** Strip for plain-text contexts (SEO, search). */
export function plainProdutoDescricao(descricao: string): string {
  return descricao
    .replace(/\r\n/g, '\n')
    .replace(/^##\s+/gm, '')
    .replace(new RegExp(escapeRegExp('**'), 'g'), '')
    .trim()
}
