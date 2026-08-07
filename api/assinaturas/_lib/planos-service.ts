import { getSupabaseAdmin } from './supabase'
import {
  PLANOS,
  PLANO_DEFAULT,
  normalizePlanoId,
  type PlanoDef,
  type PlanoId,
} from './planos'

export type PlanoPublic = PlanoDef & {
  descricao: string
  destaque: boolean
  ativo: boolean
  recursos: string[]
  ordem: number
}

type PlanoRow = {
  id: string
  nome: string
  valor_mensal: number
  descricao: string | null
  notas_fiscais: number
  loja_online: number
  destaque: number
  ativo: number
  recursos_json: string | null
  ordem: number
  updated_at: string | null
}

const DEFAULT_RECURSOS: Record<PlanoId, string[]> = {
  basic: [
    'Dashboard, PDV e vendas',
    'Produtos, estoque e caixa',
    'Clientes, fornecedores e usuários',
    'Financeiro e cashback',
  ],
  pro: ['Tudo do plano Basic', 'Emissão de NFC-e e NF-e', 'Configuração fiscal completa'],
  ultra: ['Tudo do plano Pro', 'Loja online com catálogo', 'Subdomínio personalizado'],
}

const DEFAULT_DESCRICAO: Record<PlanoId, string> = {
  basic: 'PDV completo para o dia a dia da loja.',
  pro: 'Tudo do Basic com emissão fiscal integrada.',
  ultra: 'Pacote completo com loja virtual.',
}

let cache: { planos: PlanoPublic[]; map: Record<PlanoId, PlanoDef>; at: number } | null = null
const CACHE_MS = 60_000

function parseRecursos(id: PlanoId, json: string | null): string[] {
  if (!json?.trim()) return DEFAULT_RECURSOS[id]
  try {
    const parsed = JSON.parse(json) as string[]
    if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(String)
  } catch {
    /* fallback */
  }
  return DEFAULT_RECURSOS[id]
}

function rowToPublic(row: PlanoRow): PlanoPublic | null {
  if (row.id !== 'basic' && row.id !== 'pro' && row.id !== 'ultra') return null
  const id = row.id as PlanoId
  return {
    id,
    nome: row.nome,
    valor: Number(row.valor_mensal),
    notasFiscais: row.notas_fiscais === 1,
    lojaOnline: row.loja_online === 1,
    descricao: row.descricao?.trim() || DEFAULT_DESCRICAO[id],
    destaque: row.destaque === 1,
    ativo: row.ativo === 1,
    recursos: parseRecursos(id, row.recursos_json),
    ordem: row.ordem ?? 0,
  }
}

function defaultsToPublic(): PlanoPublic[] {
  return (['basic', 'pro', 'ultra'] as PlanoId[]).map((id, idx) => ({
    ...PLANOS[id],
    descricao: DEFAULT_DESCRICAO[id],
    destaque: id === 'pro',
    ativo: true,
    recursos: DEFAULT_RECURSOS[id],
    ordem: idx + 1,
  }))
}

export function invalidatePlanosCache(): void {
  cache = null
}

export async function loadPlanosPublic(includeInactive = false): Promise<PlanoPublic[]> {
  if (!includeInactive && cache && Date.now() - cache.at < CACHE_MS) {
    return cache.planos.filter((p) => p.ativo)
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('saas_planos')
    .select('id, nome, valor_mensal, descricao, notas_fiscais, loja_online, destaque, ativo, recursos_json, ordem, updated_at')
    .order('ordem', { ascending: true })

  if (error || !data?.length) {
    const defaults = defaultsToPublic()
    cache = {
      planos: defaults,
      map: {
        basic: PLANOS.basic,
        pro: PLANOS.pro,
        ultra: PLANOS.ultra,
      },
      at: Date.now(),
    }
    return includeInactive ? defaults : defaults.filter((p) => p.ativo)
  }

  const planos = (data as PlanoRow[])
    .map(rowToPublic)
    .filter((p): p is PlanoPublic => p != null)

  const map: Record<PlanoId, PlanoDef> = { ...PLANOS }
  for (const p of planos) {
    map[p.id] = {
      id: p.id,
      nome: p.nome,
      valor: p.valor,
      notasFiscais: p.notasFiscais,
      lojaOnline: p.lojaOnline,
    }
  }

  cache = { planos, map, at: Date.now() }
  return includeInactive ? planos : planos.filter((p) => p.ativo)
}

export async function loadPlanosMap(): Promise<Record<PlanoId, PlanoDef>> {
  await loadPlanosPublic(true)
  return cache?.map ?? PLANOS
}

export async function getPlanoAsync(planoId: string | null | undefined): Promise<PlanoDef> {
  const map = await loadPlanosMap()
  return map[normalizePlanoId(planoId)]
}

export async function getPlanoDefaultAsync(): Promise<PlanoDef> {
  return getPlanoAsync(PLANO_DEFAULT)
}
