/** Tags / selos exibidos nos cards da loja online. */

export const LOJA_ONLINE_PRODUTO_TAG_IDS = [
  'mais_vendido',
  'novo',
  'promocao',
  'lancamento',
  'exclusivo',
  'frete_gratis',
] as const

export type LojaOnlineProdutoTagId = (typeof LOJA_ONLINE_PRODUTO_TAG_IDS)[number]

export type LojaOnlineProdutoTagDef = {
  id: LojaOnlineProdutoTagId
  label: string
  /** Classe CSS: loja-galaxy-card-tag--{tone} */
  tone: 'amber' | 'teal' | 'rose' | 'sky' | 'slate' | 'green'
}

export const LOJA_ONLINE_PRODUTO_TAGS: LojaOnlineProdutoTagDef[] = [
  { id: 'mais_vendido', label: 'Mais vendido', tone: 'amber' },
  { id: 'novo', label: 'Novo', tone: 'teal' },
  { id: 'promocao', label: 'Promoção', tone: 'rose' },
  { id: 'lancamento', label: 'Lançamento', tone: 'sky' },
  { id: 'exclusivo', label: 'Exclusivo', tone: 'slate' },
  { id: 'frete_gratis', label: 'Frete grátis', tone: 'green' },
]

const TAG_BY_ID = new Map(LOJA_ONLINE_PRODUTO_TAGS.map((t) => [t.id, t]))

export function isLojaOnlineProdutoTagId(value: string): value is LojaOnlineProdutoTagId {
  return TAG_BY_ID.has(value as LojaOnlineProdutoTagId)
}

export function parseLojaOnlineProdutoTagIds(raw: unknown): LojaOnlineProdutoTagId[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<LojaOnlineProdutoTagId>()
  const out: LojaOnlineProdutoTagId[] = []
  for (const item of raw) {
    const id = typeof item === 'string' ? item.trim().toLowerCase() : ''
    if (!isLojaOnlineProdutoTagId(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function getLojaOnlineProdutoTagDef(id: LojaOnlineProdutoTagId): LojaOnlineProdutoTagDef {
  return TAG_BY_ID.get(id) ?? { id, label: id, tone: 'slate' }
}

/** Resolve tags manuais + promoção automática quando há preço “de”. */
export function resolveLojaOnlineProdutoTags(input: {
  tags?: LojaOnlineProdutoTagId[] | null
  preco: number
  precoDe?: number | null
}): LojaOnlineProdutoTagDef[] {
  const ids = new Set<LojaOnlineProdutoTagId>(input.tags ?? [])
  if (input.precoDe != null && input.precoDe > input.preco && input.preco > 0) {
    ids.add('promocao')
  }
  return LOJA_ONLINE_PRODUTO_TAGS.filter((t) => ids.has(t.id))
}
