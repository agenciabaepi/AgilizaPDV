export const MAX_VARIACAO_COMBINACOES = 150

export type VariacaoEixoTipo = 'texto' | 'cor'

export type VariacaoValor = {
  id: string
  nome: string
  hex?: string
  parentValorId?: string
}

export type VariacaoEixo = {
  id: string
  nome: string
  tipo: VariacaoEixoTipo
  dependeDeEixoId?: string | null
  valores: VariacaoValor[]
}

export type VariacaoSkuDraft = {
  chave: string
  valores: Record<string, string>
  ativo: boolean
  sku: string
  codigo_barras: string
  preco: number
  estoque: number
  id?: string
}

export type VariacaoEixosConfig = {
  eixos: VariacaoEixo[]
}

export function newEixoId(): string {
  return crypto.randomUUID()
}

export function emptyEixo(partial?: Partial<VariacaoEixo>): VariacaoEixo {
  return {
    id: newEixoId(),
    nome: '',
    tipo: 'texto',
    dependeDeEixoId: null,
    valores: [],
    ...partial,
  }
}

export function emptyValor(partial?: Partial<VariacaoValor>): VariacaoValor {
  return {
    id: newEixoId(),
    nome: '',
    ...partial,
  }
}

export function parseVariacaoEixos(json: string | null | undefined): VariacaoEixo[] {
  if (!json?.trim()) return []
  try {
    const parsed = JSON.parse(json) as unknown
    const raw = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as VariacaoEixosConfig).eixos)
        ? (parsed as VariacaoEixosConfig).eixos
        : []
    return raw
      .map((item) => normalizeEixo(item))
      .filter((eixo): eixo is VariacaoEixo => !!eixo)
  } catch {
    return []
  }
}

function normalizeEixo(item: unknown): VariacaoEixo | null {
  if (!item || typeof item !== 'object') return null
  const row = item as Record<string, unknown>
  const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : newEixoId()
  const nome = typeof row.nome === 'string' ? row.nome.trim() : ''
  const tipo: VariacaoEixoTipo = row.tipo === 'cor' ? 'cor' : 'texto'
  const dependeDeEixoId =
    typeof row.dependeDeEixoId === 'string' && row.dependeDeEixoId.trim()
      ? row.dependeDeEixoId.trim()
      : null
  const valores = Array.isArray(row.valores)
    ? row.valores
        .map((v) => normalizeValor(v))
        .filter((v): v is VariacaoValor => !!v)
    : []
  return { id, nome, tipo, dependeDeEixoId, valores }
}

function normalizeValor(item: unknown): VariacaoValor | null {
  if (!item || typeof item !== 'object') return null
  const row = item as Record<string, unknown>
  const nome = typeof row.nome === 'string' ? row.nome.trim() : ''
  if (!nome) return null
  const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : newEixoId()
  const hex = typeof row.hex === 'string' && row.hex.trim() ? row.hex.trim() : undefined
  const parentValorId =
    typeof row.parentValorId === 'string' && row.parentValorId.trim()
      ? row.parentValorId.trim()
      : undefined
  return { id, nome, hex, parentValorId }
}

export function serializeVariacaoEixos(eixos: VariacaoEixo[]): string | null {
  const clean = eixos
    .map((eixo) => ({
      ...eixo,
      nome: eixo.nome.trim(),
      valores: eixo.valores
        .map((v) => ({ ...v, nome: v.nome.trim() }))
        .filter((v) => v.nome),
    }))
    .filter((eixo) => eixo.nome && eixo.valores.length > 0)
  if (clean.length === 0) return null
  return JSON.stringify({ eixos: clean })
}

export function variacaoChave(valores: Record<string, string>): string {
  return Object.keys(valores)
    .sort()
    .map((k) => `${k}:${valores[k]}`)
    .join('|')
}

export function parseVariacaoValores(json: string | null | undefined): Record<string, string> {
  if (!json?.trim()) return {}
  try {
    const parsed = JSON.parse(json) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) out[k] = v.trim()
    }
    return out
  } catch {
    return {}
  }
}

function eixoById(eixos: VariacaoEixo[], id: string): VariacaoEixo | undefined {
  return eixos.find((e) => e.id === id)
}

function valoresElegiveis(eixo: VariacaoEixo, selecionados: Record<string, string>): VariacaoValor[] {
  if (!eixo.dependeDeEixoId) return eixo.valores.filter((v) => v.nome.trim())
  const parentId = selecionados[eixo.dependeDeEixoId]
  if (!parentId) return []
  return eixo.valores.filter((v) => v.nome.trim() && v.parentValorId === parentId)
}

export function generateVariacaoCombinacoes(eixos: VariacaoEixo[]): Record<string, string>[] {
  const usable = eixos.filter((e) => e.nome.trim() && e.valores.some((v) => v.nome.trim()))
  if (usable.length === 0) return []

  const ordered: VariacaoEixo[] = []
  const remaining = [...usable]
  while (remaining.length) {
    const nextIdx = remaining.findIndex(
      (e) => !e.dependeDeEixoId || ordered.some((o) => o.id === e.dependeDeEixoId)
    )
    const idx = nextIdx >= 0 ? nextIdx : 0
    const picked = remaining.splice(idx, 1)[0]
    if (!picked) break
    ordered.push(picked)
  }

  let combos: Record<string, string>[] = [{}]
  for (const eixo of ordered) {
    const next: Record<string, string>[] = []
    for (const combo of combos) {
      const vals = valoresElegiveis(eixo, combo)
      if (vals.length === 0) continue
      for (const valor of vals) {
        next.push({ ...combo, [eixo.id]: valor.id })
      }
    }
    combos = next
    if (combos.length > MAX_VARIACAO_COMBINACOES) {
      return combos.slice(0, MAX_VARIACAO_COMBINACOES)
    }
  }
  return combos
}

export function valorById(eixos: VariacaoEixo[], eixoId: string, valorId: string): VariacaoValor | undefined {
  return eixoById(eixos, eixoId)?.valores.find((v) => v.id === valorId)
}

export function labelCombinacao(eixos: VariacaoEixo[], valores: Record<string, string>): string {
  return eixos
    .filter((e) => e.nome.trim())
    .map((eixo) => valorById(eixos, eixo.id, valores[eixo.id])?.nome)
    .filter(Boolean)
    .join(' / ')
}

export function nomeProdutoVariacao(nomePai: string, eixos: VariacaoEixo[], valores: Record<string, string>): string {
  const label = labelCombinacao(eixos, valores)
  const base = nomePai.trim()
  return label ? `${base} — ${label}` : base
}

/** Filhos cuja chave ainda existe na grade atual. Sobras de eixos antigos ficam de fora. */
export function filtrarFilhosDaGrade<T extends { variacao_chave?: string | null }>(
  eixos: VariacaoEixo[],
  filhos: T[]
): T[] {
  if (eixos.length === 0 || filhos.length === 0) return filhos
  if (!filhos.some((f) => f.variacao_chave?.trim())) return filhos
  const chaves = new Set(generateVariacaoCombinacoes(eixos).map((valores) => variacaoChave(valores)))
  const seen = new Set<string>()
  const out: T[] = []
  for (const filho of filhos) {
    const chave = filho.variacao_chave?.trim()
    if (!chave || !chaves.has(chave) || seen.has(chave)) continue
    seen.add(chave)
    out.push(filho)
  }
  return out
}

export function mergeSkusComCombinacoes(
  eixos: VariacaoEixo[],
  atuais: VariacaoSkuDraft[],
  precoPadrao: number
): VariacaoSkuDraft[] {
  const combos = generateVariacaoCombinacoes(eixos)
  const byChave = new Map(atuais.map((s) => [s.chave, s]))
  return combos.map((valores) => {
    const chave = variacaoChave(valores)
    const prev = byChave.get(chave)
    if (prev) return { ...prev, valores }
    return {
      chave,
      valores,
      ativo: true,
      sku: '',
      codigo_barras: '',
      preco: precoPadrao,
      estoque: 0,
    }
  })
}

export function eixosTemplateCapaCelular(): VariacaoEixo[] {
  const marca = emptyEixo({ nome: 'Marca', tipo: 'texto' })
  const modelo = emptyEixo({ nome: 'Modelo', tipo: 'texto', dependeDeEixoId: marca.id })
  return [marca, modelo]
}

/** Identifica eixos Marca / Modelo no padrão capa de celular. */
export function resolverEixosMarcaModelo(eixos: VariacaoEixo[]): {
  marca: VariacaoEixo | null
  modelo: VariacaoEixo | null
  extras: VariacaoEixo[]
} {
  if (eixos.length === 0) return { marca: null, modelo: null, extras: [] }

  const byNome = (nome: string) =>
    eixos.find((e) => e.nome.trim().toLowerCase() === nome)

  let marca =
    byNome('marca') ??
    eixos.find((e) => !e.dependeDeEixoId) ??
    eixos[0] ??
    null

  let modelo =
    byNome('modelo') ??
    (marca ? eixos.find((e) => e.dependeDeEixoId === marca!.id) : null) ??
    eixos.find((e) => Boolean(e.dependeDeEixoId)) ??
    null

  if (marca && modelo && marca.id === modelo.id) {
    modelo = eixos.find((e) => e.id !== marca!.id) ?? null
  }

  const used = new Set([marca?.id, modelo?.id].filter(Boolean) as string[])
  const extras = eixos.filter((e) => !used.has(e.id))
  return { marca, modelo, extras }
}

export function eixoTemValores(eixo: VariacaoEixo): boolean {
  return eixo.valores.some((v) => v.nome.trim())
}

export function eixosProntos(eixos: VariacaoEixo[]): boolean {
  return eixos.length > 0 && eixos.every((e) => e.nome.trim() && eixoTemValores(e))
}

type SkuVariacaoRef = { variacao_valores_json?: string | null; nome?: string }

/** Garante que valores referenciados nos SKUs existam nos eixos (evita seletor vazio após reconfigurar). */
export function mergeEixosComSkus(eixos: VariacaoEixo[], skus: SkuVariacaoRef[]): VariacaoEixo[] {
  if (skus.length === 0) return eixos

  const valorIdsByEixo = new Map<string, Set<string>>()
  for (const sku of skus) {
    const vals = parseVariacaoValores(sku.variacao_valores_json)
    for (const [eixoId, valorId] of Object.entries(vals)) {
      if (!valorIdsByEixo.has(eixoId)) valorIdsByEixo.set(eixoId, new Set())
      valorIdsByEixo.get(eixoId)!.add(valorId)
    }
  }

  if (eixos.length === 0) {
    return [...valorIdsByEixo.entries()].map(([eixoId, valorIds], index) => ({
      id: eixoId,
      nome: `Opção ${index + 1}`,
      tipo: 'texto' as const,
      dependeDeEixoId: null,
      valores: [...valorIds].map((id) => ({ id, nome: id.slice(0, 8) })),
    }))
  }

  return eixos.map((eixo) => {
    const skuValorIds = valorIdsByEixo.get(eixo.id)
    if (!skuValorIds?.size) return eixo
    const known = new Set(eixo.valores.map((v) => v.id))
    const extras = [...skuValorIds]
      .filter((id) => !known.has(id))
      .map((id) => ({ id, nome: `Opção ${id.slice(0, 6)}` }))
    return extras.length ? { ...eixo, valores: [...eixo.valores, ...extras] } : eixo
  })
}

export function labelVariacaoSku(nomePai: string, nomeSku: string): string {
  const prefix = `${nomePai.trim()} — `
  return nomeSku.startsWith(prefix) ? nomeSku.slice(prefix.length) : nomeSku
}
