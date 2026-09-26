import type { VercelRequest, VercelResponse } from '@vercel/node'
import { assertSupabaseConfigured, getSupabaseAdmin } from '../_lib/supabase'
import { getLojaConfigBySlug } from '../_lib/config'
import { calcularFreteCorreios } from '../_lib/correios'
import { resolveMelhorEnvioAuth } from '../_lib/melhor-envio'
import type { MelhorEnvioProductInput } from '../_lib/melhor-envio'

type FreteItemInput = {
  id?: string
  quantidade?: number
  preco?: number
  pesoKg?: number
  alturaCm?: number
  larguraCm?: number
  comprimentoCm?: number
}

type ProdutoFreteRow = {
  id: string
  produto_pai_id?: string | null
  peso_kg?: number | null
  altura_cm?: number | null
  largura_cm?: number | null
  comprimento_cm?: number | null
}

const DEFAULT_DIMS = { width: 15, height: 5, length: 20 }

function positive(n: unknown, fallback: number): number {
  const v = Number(n)
  return Number.isFinite(v) && v > 0 ? v : fallback
}

async function loadProdutoFreteMap(ids: string[]): Promise<Map<string, ProdutoFreteRow>> {
  const map = new Map<string, ProdutoFreteRow>()
  if (ids.length === 0) return map
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('produtos')
    .select('id, produto_pai_id, peso_kg, altura_cm, largura_cm, comprimento_cm')
    .in('id', ids)

  if (error) {
    const msg = (error.message ?? '').toLowerCase()
    if (msg.includes('peso_kg') || msg.includes('altura_cm') || msg.includes('does not exist')) {
      return map
    }
    throw error
  }

  for (const row of data ?? []) {
    map.set(String(row.id), row as ProdutoFreteRow)
  }

  const parentIds = [...new Set(
    [...map.values()]
      .filter((r) => {
        const missing =
          !(Number(r.peso_kg) > 0) ||
          !(Number(r.altura_cm) > 0) ||
          !(Number(r.largura_cm) > 0) ||
          !(Number(r.comprimento_cm) > 0)
        return missing && r.produto_pai_id
      })
      .map((r) => String(r.produto_pai_id))
  )].filter((id) => !map.has(id))

  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from('produtos')
      .select('id, produto_pai_id, peso_kg, altura_cm, largura_cm, comprimento_cm')
      .in('id', parentIds)
    for (const row of parents ?? []) {
      map.set(String(row.id), row as ProdutoFreteRow)
    }
  }

  return map
}

function resolveDims(
  item: FreteItemInput,
  row: ProdutoFreteRow | undefined,
  parent: ProdutoFreteRow | undefined,
  pesoPadrao: number
): { width: number; height: number; length: number; weight: number } {
  const peso =
    positive(item.pesoKg, 0) ||
    positive(row?.peso_kg, 0) ||
    positive(parent?.peso_kg, 0) ||
    pesoPadrao
  const height =
    positive(item.alturaCm, 0) ||
    positive(row?.altura_cm, 0) ||
    positive(parent?.altura_cm, 0) ||
    DEFAULT_DIMS.height
  const width =
    positive(item.larguraCm, 0) ||
    positive(row?.largura_cm, 0) ||
    positive(parent?.largura_cm, 0) ||
    DEFAULT_DIMS.width
  const length =
    positive(item.comprimentoCm, 0) ||
    positive(row?.comprimento_cm, 0) ||
    positive(parent?.comprimento_cm, 0) ||
    DEFAULT_DIMS.length
  return { width, height, length, weight: Math.max(0.1, Math.min(peso, 30)) }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  const body = (req.body ?? {}) as {
    slug?: string
    cepDestino?: string
    pesoKg?: number
    subtotal?: number
    itens?: FreteItemInput[]
  }

  const slug = String(body.slug ?? '').trim()
  const cepDestino = String(body.cepDestino ?? '').replace(/\D/g, '')

  if (!slug || !cepDestino) {
    res.status(400).json({ ok: false, error: 'slug e cepDestino são obrigatórios.' })
    return
  }
  if (cepDestino.length !== 8) {
    res.status(400).json({ ok: false, error: 'Informe um CEP válido com 8 dígitos.' })
    return
  }

  try {
    assertSupabaseConfigured()
    const cfg = await getLojaConfigBySlug(slug)
    if (!cfg) {
      res.status(404).json({ ok: false, error: 'Loja não encontrada.' })
      return
    }

    const tipo = cfg.loja_online_frete_tipo ?? 'fixo'
    const minimo = Number(cfg.loja_online_frete_gratis_minimo) || 0
    const promoAtiva = Number(cfg.loja_online_frete_gratis_ativo) === 1 && minimo > 0 && tipo !== 'gratis'
    const subtotal = Number(body.subtotal) || 0
    if (promoAtiva && subtotal >= minimo) {
      res.status(200).json({
        ok: true,
        tipo: 'gratis',
        opcoes: [{ servico: 'gratis', codigo: 'GRATIS', nome: 'Frete grátis', valor: 0, prazo: 0 }],
      })
      return
    }

    if (tipo === 'gratis') {
      res.status(200).json({
        ok: true,
        tipo: 'gratis',
        opcoes: [{ servico: 'gratis', codigo: 'GRATIS', nome: 'Frete grátis', valor: 0, prazo: 0 }],
      })
      return
    }

    if (tipo === 'fixo') {
      const valor = Number(cfg.loja_online_frete_valor_fixo) || 0
      res.status(200).json({
        ok: true,
        tipo: 'fixo',
        opcoes: [{ servico: 'fixo', codigo: 'FIXO', nome: 'Frete fixo', valor, prazo: 0 }],
      })
      return
    }

    const cepOrigem = String(cfg.loja_online_frete_cep_origem ?? '').replace(/\D/g, '')
    if (cepOrigem.length !== 8) {
      res.status(400).json({ ok: false, error: 'CEP de origem da loja não configurado.' })
      return
    }

    const { auth } = resolveMelhorEnvioAuth(
      cfg.loja_online_melhor_envio_token,
      Number(cfg.loja_online_melhor_envio_sandbox) === 1
    )
    if (!auth) {
      res.status(400).json({
        ok: false,
        error:
          'Melhor Envio não conectado. Em Loja online → Entrega e frete, cole o token (Integrações → Permissões de Acesso → Gerar novo token).',
      })
      return
    }

    const pesoPadrao = Number(cfg.loja_online_frete_peso_padrao) || 0.3
    const pesoKg = body.pesoKg ?? pesoPadrao
    const itens = Array.isArray(body.itens) ? body.itens : []
    const produtoIds = [
      ...new Set(itens.map((i) => String(i.id ?? '').trim()).filter(Boolean)),
    ]
    const freteMap = await loadProdutoFreteMap(produtoIds)

    const products: MelhorEnvioProductInput[] = itens
      .filter((item) => Number(item.quantidade) > 0)
      .map((item, i) => {
        const id = String(item.id || `item-${i + 1}`).slice(0, 60)
        const row = freteMap.get(id)
        const parent = row?.produto_pai_id ? freteMap.get(String(row.produto_pai_id)) : undefined
        const dims = resolveDims(item, row, parent, pesoPadrao)
        return {
          id,
          width: dims.width,
          height: dims.height,
          length: dims.length,
          weight: dims.weight,
          insurance_value: Math.max(1, Number(item.preco) || 0),
          quantity: Math.max(1, Math.round(Number(item.quantidade) || 1)),
        }
      })

    const opcoes = await calcularFreteCorreios({
      cepOrigem,
      cepDestino,
      pesoKg,
      melhorEnvioToken: cfg.loja_online_melhor_envio_token,
      melhorEnvioSandbox: Number(cfg.loja_online_melhor_envio_sandbox) === 1,
      valorSeguro: subtotal || undefined,
      products: products.length > 0 ? products : undefined,
      empresaId: cfg.empresa_id,
    })
    res.status(200).json({ ok: true, tipo: 'correios', opcoes })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: msg })
  }
}
