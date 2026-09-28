import { supabase } from './supabase'
import {
  invalidateLojaOnlineCatalogCache,
  lojaCategoriasCache,
  lojaProdutosCache,
  lojaProdutosCacheKey,
  lojaStoreCacheKey,
  peekLojaOnlineCategoriasCache,
  peekLojaOnlineProdutosCache,
  writeLojaOnlineCategoriasCache,
  writeLojaOnlineProdutosCache,
  writeLojaOnlineStoreCache,
} from './loja-online-catalog-cache'
import { hashSenhaWeb, verificarSenhaWeb } from './web-crypto'
import { lojaOnlineCustomDomainVariants } from './loja-online'
import {
  cartTotal as calcTotal,
  pedidoElegivelParaVenda,
  pedidoMostraNotificacaoPainel,
  pedidoTotalLiquido,
  type LojaOnlineCartItem,
  type LojaOnlineCategoria,
  type LojaOnlineColecao,
  type LojaOnlineClienteSession,
  type LojaOnlineClienteAdmin,
  type LojaOnlineCupom,
  type LojaOnlineOrderBump,
  type LojaOnlineFavorito,
  type LojaOnlinePedido,
  type LojaOnlinePedidoItem,
  type LojaOnlinePedidoItemComImagem,
  type LojaOnlineProduto,
  type LojaOnlineAvaliacao,
  type LojaOnlineMidia,
  type LojaOnlineStoreConfig,
  parseLojaOnlinePersonalizacao,
  serializeLojaOnlineAvaliacaoMidias,
} from './loja-online-types'
import {
  normalizePedido,
  normalizePedidoStatus,
  statusInicialPedido,
  type LojaOnlinePedidoStatus,
} from './loja-online-pedido-status'
import {
  debitarCashbackOnline,
  ensureClientePdvForOnline,
  gerarCashbackPedidoOnline,
  normalizeDocDigits,
} from './loja-online-cashback'
import { parseVariacaoEixos } from './produto-variacoes'
import { subirBase64EmTexto } from './produto-midias-storage'
import { formatCPF, isValidCPF, isValidEmail, isValidPhone, onlyDigits } from './validators'

type SupabaseLikeError = { message?: string; code?: string } | null

function isSupabaseMissingColumnError(error: SupabaseLikeError): boolean {
  if (!error) return false
  const msg = (error.message ?? '').toLowerCase()
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    msg.includes('does not exist') ||
    (msg.includes('column') && msg.includes('schema'))
  )
}

const STORE_SELECT = `
  empresa_id, loja_online_slug, loja_online_titulo, loja_online_descricao, loja_online_whatsapp,
  loja_online_whatsapp_flutuante, loja_online_whatsapp_flutuante_msg,
  loja_online_mostrar_preco, loja_online_ocultar_sem_estoque, loja_online_banner, loja_online_banners_json,
  loja_online_banner_tamanho, loja_online_banner_tamanho_mobile,
  loja_online_faixa_ativa, loja_online_faixa_avisos_json,
  loja_online_rodape_texto, loja_online_instagram, loja_online_facebook, loja_online_email_contato,
  loja_online_exigir_cadastro, loja_online_permitir_retirada, loja_online_permitir_entrega,
  loja_online_mensagem_checkout, loja_online_checkout_oferta_json, loja_online_pag_manual, loja_online_pag_manual_cidade, loja_online_pag_asaas, loja_online_pag_mercadopago,
  loja_online_mercadopago_public_key, loja_online_mp_pronto, loja_online_asaas_pronto,
  loja_online_frete_tipo, loja_online_frete_valor_fixo,
  loja_online_frete_cep_origem, loja_online_frete_peso_padrao,
  loja_online_frete_gratis_ativo, loja_online_frete_gratis_minimo,
  loja_online_cashback_ativo,
  loja_online_cor_primaria,
  loja_online_cor_fundo,
  loja_online_cor_header,
  loja_online_cor_menu,
  loja_online_categorias_titulo,
  loja_online_cards_config_json,
  loja_online_seo_titulo, loja_online_seo_descricao,
  loja_online_politica_privacidade, loja_online_termos_uso,
  loja_online_politica_trocas, loja_online_politica_entrega,
  loja_online_ga4_id, loja_online_meta_pixel_id, loja_online_dominio_custom, loja_online_header_mobile,
  loja_online_logo_header,
  loja_online_logo_header_size,
  logo, cor_primaria, telefone, endereco, empresas(nome)
`

/** Select sem colunas de migrations recentes — evita quebra antes de rodar o SQL no Supabase. */
const STORE_SELECT_LEGACY = `
  empresa_id, loja_online_slug, loja_online_titulo, loja_online_descricao, loja_online_whatsapp,
  loja_online_mostrar_preco, loja_online_ocultar_sem_estoque, loja_online_banner, loja_online_banners_json,
  loja_online_banner_tamanho,
  loja_online_faixa_ativa, loja_online_faixa_avisos_json,
  loja_online_rodape_texto, loja_online_instagram, loja_online_facebook, loja_online_email_contato,
  loja_online_exigir_cadastro, loja_online_permitir_retirada, loja_online_permitir_entrega,
  loja_online_mensagem_checkout, loja_online_pag_manual, loja_online_pag_asaas, loja_online_pag_mercadopago,
  loja_online_mercadopago_public_key, loja_online_mp_pronto, loja_online_asaas_pronto,
  loja_online_frete_tipo, loja_online_frete_valor_fixo,
  loja_online_frete_cep_origem, loja_online_frete_peso_padrao, loja_online_cashback_ativo,
  loja_online_cor_primaria,
  loja_online_cor_fundo,
  loja_online_cards_config_json,
  loja_online_seo_titulo, loja_online_seo_descricao,
  loja_online_politica_privacidade, loja_online_termos_uso,
  loja_online_politica_trocas, loja_online_politica_entrega,
  loja_online_ga4_id, loja_online_meta_pixel_id, loja_online_dominio_custom,
  logo, cor_primaria, telefone, endereco, empresas(nome)
`

const STORE_SELECT_LEGACY_MINIMAL = `
  empresa_id, loja_online_slug, loja_online_titulo, loja_online_descricao, loja_online_whatsapp,
  loja_online_mostrar_preco, loja_online_ocultar_sem_estoque, loja_online_banner, loja_online_banners_json,
  loja_online_banner_tamanho,
  loja_online_faixa_ativa, loja_online_faixa_avisos_json,
  loja_online_rodape_texto, loja_online_instagram, loja_online_facebook, loja_online_email_contato,
  loja_online_exigir_cadastro, loja_online_permitir_retirada, loja_online_permitir_entrega,
  loja_online_mensagem_checkout, loja_online_pag_manual, loja_online_pag_asaas, loja_online_pag_mercadopago,
  loja_online_mercadopago_public_key, loja_online_mp_pronto, loja_online_asaas_pronto,
  loja_online_frete_tipo, loja_online_frete_valor_fixo,
  loja_online_frete_cep_origem, loja_online_frete_peso_padrao, loja_online_cashback_ativo,
  loja_online_cor_primaria,
  loja_online_seo_titulo, loja_online_seo_descricao,
  loja_online_politica_privacidade, loja_online_termos_uso,
  loja_online_politica_trocas, loja_online_politica_entrega,
  loja_online_ga4_id, loja_online_meta_pixel_id, loja_online_dominio_custom,
  logo, cor_primaria, telefone, endereco, empresas(nome)
`

type LojaOnlineStoreFilter =
  | { kind: 'slug'; slug: string }
  | { kind: 'domain'; variants: string[] }

async function fetchLojaOnlineStoreWith(
  filter: LojaOnlineStoreFilter
): Promise<LojaOnlineStoreConfig | null> {
  const cacheKey =
    filter.kind === 'slug'
      ? lojaStoreCacheKey('slug', filter.slug)
      : lojaStoreCacheKey('domain', filter.variants[0] ?? '')

  const run = (select: string) => {
    const query = supabase.from('empresas_config').select(select).eq('loja_online_ativa', 1)
    if (filter.kind === 'slug') {
      return query.eq('loja_online_slug', filter.slug).maybeSingle()
    }
    return query.in('loja_online_dominio_custom', filter.variants).limit(1).maybeSingle()
  }

  const full = await run(STORE_SELECT)
  if (!full.error) {
    const data = (full.data as LojaOnlineStoreConfig | null) ?? null
    if (data) writeLojaOnlineStoreCache(cacheKey, data)
    return data
  }

  if (isSupabaseMissingColumnError(full.error)) {
    // Uma tentativa enxuta (sem colunas novas) em vez de cascata de 5–6 round-trips
    const compact = STORE_SELECT
      .replace(/\s*loja_online_pag_manual_cidade,/g, '')
      .replace(/\s*loja_online_frete_gratis_ativo,/g, '')
      .replace(/\s*loja_online_frete_gratis_minimo,/g, '')
      .replace(/\s*loja_online_banner_tamanho_mobile,/g, '')
    const compactRes = await run(compact)
    if (!compactRes.error) {
      const data = (compactRes.data as LojaOnlineStoreConfig | null) ?? null
      if (data) writeLojaOnlineStoreCache(cacheKey, data)
      return data
    }
    const legacy = await run(STORE_SELECT_LEGACY)
    if (!legacy.error) {
      const data = (legacy.data as LojaOnlineStoreConfig | null) ?? null
      if (data) writeLojaOnlineStoreCache(cacheKey, data)
      return data
    }
    if (isSupabaseMissingColumnError(legacy.error)) {
      const minimal = await run(STORE_SELECT_LEGACY_MINIMAL)
      if (minimal.error) throw minimal.error
      const data = (minimal.data as LojaOnlineStoreConfig | null) ?? null
      if (data) writeLojaOnlineStoreCache(cacheKey, data)
      return data
    }
    throw legacy.error
  }

  throw full.error
}

export async function fetchLojaOnlineStore(slug: string): Promise<LojaOnlineStoreConfig | null> {
  return fetchLojaOnlineStoreWith({ kind: 'slug', slug })
}

export async function fetchLojaOnlineStoreByDomain(
  hostname: string
): Promise<LojaOnlineStoreConfig | null> {
  const variants = lojaOnlineCustomDomainVariants(hostname)
  if (variants.length === 0) return null
  return fetchLojaOnlineStoreWith({ kind: 'domain', variants })
}

export async function isLojaOnlineCustomDomainTaken(
  domain: string,
  excludeEmpresaId: string
): Promise<boolean> {
  const variants = lojaOnlineCustomDomainVariants(domain)
  if (variants.length === 0) return false
  const { data, error } = await supabase
    .from('empresas_config')
    .select('empresa_id')
    .in('loja_online_dominio_custom', variants)
    .neq('empresa_id', excludeEmpresaId)
    .limit(1)
    .maybeSingle()
  if (error && !isSupabaseMissingColumnError(error)) throw error
  return Boolean(data)
}

/** Select enxuto para listagens/cards — sem descrição HTML pesada. */
const PRODUTO_SELECT =
  'id, empresa_id, nome, imagem, preco, unidade, estoque_atual, controla_estoque, categoria_id, codigo, marca_id, marcas(nome), loja_online_destaque, loja_online_destaque_ordem, loja_online_imagens_json, loja_online_preco_de, loja_online_card_json, produto_pai_id, variacao_eixos_json'

const PRODUTO_SELECT_SEM_MARCA =
  'id, empresa_id, nome, imagem, preco, unidade, estoque_atual, controla_estoque, categoria_id, codigo, loja_online_destaque, loja_online_destaque_ordem, loja_online_imagens_json, loja_online_preco_de, loja_online_card_json, produto_pai_id, variacao_eixos_json'

const PRODUTO_SELECT_LEGACY =
  'id, empresa_id, nome, imagem, preco, unidade, estoque_atual, controla_estoque, categoria_id, codigo, loja_online_destaque, loja_online_destaque_ordem, loja_online_imagens_json'

/** Select completo só na página do produto (inclui descrição). */
const PRODUTO_SELECT_DETAIL =
  'id, empresa_id, nome, descricao, imagem, preco, unidade, estoque_atual, controla_estoque, categoria_id, codigo, marca_id, marcas(nome), loja_online_destaque, loja_online_destaque_ordem, loja_online_imagens_json, loja_online_preco_de, loja_online_card_json, produto_pai_id, variacao_eixos_json'

const PRODUTO_SELECT_DETAIL_SEM_MARCA =
  'id, empresa_id, nome, descricao, imagem, preco, unidade, estoque_atual, controla_estoque, categoria_id, codigo, loja_online_destaque, loja_online_destaque_ordem, loja_online_imagens_json, loja_online_preco_de, loja_online_card_json, produto_pai_id, variacao_eixos_json'

const PRODUTO_SELECT_DETAIL_LEGACY =
  'id, empresa_id, nome, descricao, imagem, preco, unidade, estoque_atual, controla_estoque, categoria_id, codigo, loja_online_destaque, loja_online_destaque_ordem, loja_online_imagens_json'

type ProdutoSelectMode = 'full' | 'sem_marca' | 'legacy'
let produtoSelectMode: ProdutoSelectMode | null = null
let lojaHideChildren = true

export { invalidateLojaOnlineCatalogCache } from './loja-online-catalog-cache'

async function fetchProdutosQuery(
  empresaId: string,
  select: string,
  options: { destaqueOnly: boolean; ids?: string[] }
) {
  let query = supabase
    .from('produtos')
    .select(select)
    .eq('empresa_id', empresaId)
    .eq('ativo', 1)
    .eq('loja_online', 1)
  if (lojaHideChildren) query = query.is('produto_pai_id', null)

  if (options.ids?.length) {
    query = query.in('id', options.ids)
  }

  if (options.destaqueOnly) {
    query = query
      .eq('loja_online_destaque', 1)
      .order('loja_online_destaque_ordem', { ascending: true })
      .order('nome', { ascending: true })
  } else {
    query = query.order('nome')
  }

  return query
}

const PRODUTO_SELECT_BY_MODE: Record<ProdutoSelectMode, string> = {
  full: PRODUTO_SELECT,
  sem_marca: PRODUTO_SELECT_SEM_MARCA,
  legacy: PRODUTO_SELECT_LEGACY,
}

async function enrichProdutosComVariacoes(
  empresaId: string,
  list: LojaOnlineProduto[]
): Promise<LojaOnlineProduto[]> {
  if (list.length === 0) return list
  const withEixos = list.map((p) => {
    const eixos = parseVariacaoEixos(p.variacao_eixos_json)
    return { ...p, tem_variacoes: eixos.length > 0 }
  })
  const parentIds = list.map((p) => p.id)
  if (parentIds.length === 0) return withEixos

  type ChildRow = {
    produto_pai_id: string
    preco: number
    estoque_atual: number
    controla_estoque: number
    ativo: number
  }
  const children: ChildRow[] = []
  const CHUNK = 80
  for (let i = 0; i < parentIds.length; i += CHUNK) {
    const chunk = parentIds.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from('produtos')
      .select('produto_pai_id, preco, estoque_atual, controla_estoque, ativo')
      .eq('empresa_id', empresaId)
      .in('produto_pai_id', chunk)
      .eq('ativo', 1)
    if (error) {
      if (isSupabaseMissingColumnError(error)) return withEixos
      throw error
    }
    for (const row of data ?? []) children.push(row as ChildRow)
  }

  const parentsComFilhos = new Set<string>()
  const byParent = new Map<string, { precoMin: number; estoque: number; controla: boolean }>()
  for (const row of children) {
    const pai = String(row.produto_pai_id)
    parentsComFilhos.add(pai)
    const preco = Number(row.preco) || 0
    const estoque = Number(row.estoque_atual) || 0
    const controla = Number(row.controla_estoque) === 1
    const cur = byParent.get(pai) ?? { precoMin: preco, estoque: 0, controla: false }
    cur.precoMin = Math.min(cur.precoMin, preco)
    if (controla) {
      cur.controla = true
      cur.estoque += estoque
    }
    byParent.set(pai, cur)
  }

  return withEixos.map((p) => {
    const agg = byParent.get(p.id)
    const temFilhos = parentsComFilhos.has(p.id)
    const base = temFilhos ? { ...p, tem_variacoes: true } : p
    if (!agg) return base
    return {
      ...base,
      preco: agg.precoMin > 0 ? agg.precoMin : p.preco,
      controla_estoque: agg.controla ? 1 : p.controla_estoque,
      estoque_atual: agg.controla ? agg.estoque : p.estoque_atual,
    }
  })
}

export type LojaOnlineVariacaoSku = {
  id: string
  nome: string
  preco: number
  imagem: string | null
  estoque_atual: number
  controla_estoque: number
  unidade: string
  ativo: number
  variacao_chave: string | null
  variacao_valores_json: string | null
}

export async function fetchLojaOnlineProdutoVariacoes(
  empresaId: string,
  parentId: string
): Promise<LojaOnlineVariacaoSku[]> {
  const { data, error } = await supabase
    .from('produtos')
    .select(
      'id, nome, preco, imagem, estoque_atual, controla_estoque, unidade, ativo, variacao_chave, variacao_valores_json'
    )
    .eq('empresa_id', empresaId)
    .eq('produto_pai_id', parentId)
    .eq('ativo', 1)
    .order('nome')
  if (error) {
    if (isSupabaseMissingColumnError(error)) return []
    throw error
  }
  return (data ?? []) as LojaOnlineVariacaoSku[]
}

async function fetchProdutosListUncached(
  empresaId: string,
  ocultarSemEstoque: boolean,
  destaqueOnly: boolean,
  ids?: string[]
): Promise<LojaOnlineProduto[]> {
  const modes: ProdutoSelectMode[] = produtoSelectMode
    ? [produtoSelectMode]
    : ['full', 'sem_marca', 'legacy']

  let lastError: SupabaseLikeError = null
  let list: LojaOnlineProduto[] | null = null
  for (const mode of modes) {
    const result = await fetchProdutosQuery(empresaId, PRODUTO_SELECT_BY_MODE[mode], {
      destaqueOnly,
      ids,
    })
    if (!result.error) {
      produtoSelectMode = mode
      list = (result.data ?? []) as unknown as LojaOnlineProduto[]
      break
    }
    lastError = result.error
    if (isSupabaseMissingColumnError(result.error)) {
      if (lojaHideChildren) lojaHideChildren = false
      produtoSelectMode = null
      continue
    }
    throw result.error
  }
  if (!list) throw lastError ?? new Error('Não foi possível carregar os produtos.')

  list = await enrichProdutosComVariacoes(empresaId, list)

  if (ocultarSemEstoque) {
    list = list.filter((p) => !p.controla_estoque || (p.estoque_atual ?? 0) > 0)
  }
  return list
}

async function fetchProdutosList(
  empresaId: string,
  ocultarSemEstoque: boolean,
  destaqueOnly: boolean
): Promise<LojaOnlineProduto[]> {
  const key = lojaProdutosCacheKey(empresaId, ocultarSemEstoque, destaqueOnly)
  const warm = peekLojaOnlineProdutosCache(key)
  if (warm) {
    void fetchProdutosListUncached(empresaId, ocultarSemEstoque, destaqueOnly)
      .then((fresh) => writeLojaOnlineProdutosCache(key, fresh))
      .catch(() => {})
    return warm
  }
  const data = await lojaProdutosCache.get(key, () =>
    fetchProdutosListUncached(empresaId, ocultarSemEstoque, destaqueOnly)
  )
  writeLojaOnlineProdutosCache(key, data)
  return data
}

export async function fetchLojaOnlineProdutos(
  empresaId: string,
  ocultarSemEstoque: boolean
): Promise<LojaOnlineProduto[]> {
  return fetchProdutosList(empresaId, ocultarSemEstoque, false)
}

export async function fetchLojaOnlineProdutosDestaque(
  empresaId: string,
  ocultarSemEstoque: boolean
): Promise<LojaOnlineProduto[]> {
  return fetchProdutosList(empresaId, ocultarSemEstoque, true)
}

/** Pré-carrega catálogo e categorias da vitrine (home + menu). */
export function prefetchLojaOnlineCatalog(empresaId: string, ocultarSemEstoque: boolean): void {
  void fetchLojaOnlineProdutos(empresaId, ocultarSemEstoque).catch(() => {})
  void fetchLojaOnlineCategorias(empresaId).catch(() => {})
  void fetchLojaOnlineProdutosDestaque(empresaId, ocultarSemEstoque).catch(() => {})
}

export async function fetchLojaOnlineProduto(
  empresaId: string,
  produtoId: string
): Promise<LojaOnlineProduto | null> {
  const selects = [PRODUTO_SELECT_DETAIL, PRODUTO_SELECT_DETAIL_SEM_MARCA, PRODUTO_SELECT_DETAIL_LEGACY]
  const run = (select: string) =>
    supabase
      .from('produtos')
      .select(select)
      .eq('empresa_id', empresaId)
      .eq('id', produtoId)
      .eq('ativo', 1)
      .eq('loja_online', 1)
      .maybeSingle()

  let result = await run(selects[0])
  if (result.error && isSupabaseMissingColumnError(result.error)) {
    result = await run(selects[1])
  }
  if (result.error && isSupabaseMissingColumnError(result.error)) {
    result = await run(selects[2])
  }
  if (result.error) throw result.error
  return result.data as LojaOnlineProduto | null
}

/** IDs de categoria usados no menu — sem carregar o catálogo inteiro. */
export async function fetchLojaOnlineProdutoCategoriaIds(
  empresaId: string,
  ocultarSemEstoque: boolean
): Promise<{ categoriaIds: (string | null)[]; temSemCategoria: boolean }> {
  let query = supabase
    .from('produtos')
    .select('categoria_id, controla_estoque, estoque_atual')
    .eq('empresa_id', empresaId)
    .eq('ativo', 1)
    .eq('loja_online', 1)
  if (lojaHideChildren) query = query.is('produto_pai_id', null)

  const { data, error } = await query
  if (error) {
    if (isSupabaseMissingColumnError(error)) {
      const fallback = await supabase
        .from('produtos')
        .select('categoria_id, controla_estoque, estoque_atual')
        .eq('empresa_id', empresaId)
        .eq('ativo', 1)
        .eq('loja_online', 1)
      if (fallback.error) throw fallback.error
      return summarizeCategoriaIds(fallback.data ?? [], ocultarSemEstoque)
    }
    throw error
  }
  return summarizeCategoriaIds(data ?? [], ocultarSemEstoque)
}

function summarizeCategoriaIds(
  rows: Array<{ categoria_id?: string | null; controla_estoque?: number; estoque_atual?: number }>,
  ocultarSemEstoque: boolean
) {
  const categoriaIds: (string | null)[] = []
  let temSemCategoria = false
  for (const row of rows) {
    if (ocultarSemEstoque && Number(row.controla_estoque) === 1 && !(Number(row.estoque_atual) > 0)) {
      continue
    }
    const cat = row.categoria_id ?? null
    if (!cat) temSemCategoria = true
    categoriaIds.push(cat)
  }
  return { categoriaIds, temSemCategoria }
}

async function fetchLojaOnlineCategoriasUncached(empresaId: string): Promise<LojaOnlineCategoria[]> {
  const { data, error } = await supabase
    .from('categorias')
    .select('id, nome, parent_id, ordem')
    .eq('empresa_id', empresaId)
    .eq('ativo', 1)
    .order('ordem')
  if (error) throw error
  const rows = (data ?? []) as Pick<LojaOnlineCategoria, 'id' | 'nome' | 'parent_id' | 'ordem'>[]
  const byId = new Map(rows.map((c) => [c.id, c]))

  const pathFor = (id: string): string => {
    const parts: string[] = []
    let currentId: string | null = id
    const seen = new Set<string>()
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId)
      const cat = byId.get(currentId)
      if (!cat) break
      parts.unshift(cat.nome)
      currentId = cat.parent_id
    }
    return parts.join(' › ')
  }

  return rows.map((c) => ({ ...c, path: pathFor(c.id) }))
}

export async function fetchLojaOnlineCategorias(empresaId: string): Promise<LojaOnlineCategoria[]> {
  const key = `${empresaId}:c`
  const warm = peekLojaOnlineCategoriasCache(key)
  if (warm) {
    void fetchLojaOnlineCategoriasUncached(empresaId)
      .then((fresh) => writeLojaOnlineCategoriasCache(key, fresh))
      .catch(() => {})
    return warm
  }
  const data = await lojaCategoriasCache.get(key, () => fetchLojaOnlineCategoriasUncached(empresaId))
  writeLojaOnlineCategoriasCache(key, data)
  return data
}

const CATEGORIA_VITRINE_SELECT =
  'id, nome, parent_id, ordem, imagem, loja_online_subtitulo, loja_online_vitrine'

export async function fetchLojaOnlineCategoriasVitrine(
  empresaId: string
): Promise<LojaOnlineCategoria[]> {
  const run = (select: string, filterVitrine: boolean) => {
    let query = supabase
      .from('categorias')
      .select(select)
      .eq('empresa_id', empresaId)
      .eq('ativo', 1)
      .order('ordem')
    if (filterVitrine) query = query.eq('loja_online_vitrine', 1)
    return query
  }

  let result = await run(CATEGORIA_VITRINE_SELECT, true)
  if (result.error && isSupabaseMissingColumnError(result.error)) {
    return []
  }
  if (result.error) throw result.error
  const rows = (result.data ?? []) as Pick<
    LojaOnlineCategoria,
    'id' | 'nome' | 'parent_id' | 'ordem' | 'imagem' | 'loja_online_subtitulo' | 'loja_online_vitrine'
  >[]
  const byId = new Map(rows.map((c) => [c.id, c]))

  const pathFor = (id: string): string => {
    const parts: string[] = []
    let currentId: string | null = id
    const seen = new Set<string>()
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId)
      const cat = byId.get(currentId)
      if (!cat) break
      parts.unshift(cat.nome)
      currentId = cat.parent_id
    }
    return parts.join(' › ')
  }

  return rows.map((c) => ({ ...c, path: pathFor(c.id) }))
}

export async function registerLojaOnlineCliente(input: {
  empresaId: string
  nome: string
  email: string
  senha: string
  telefone: string
  endereco?: string
  cpf_cnpj?: string
  cep?: string
  /** YYYY-MM-DD */
  data_nascimento?: string
}): Promise<LojaOnlineClienteSession> {
  const email = input.email.trim().toLowerCase()
  const cpfNorm = normalizeDocDigits(input.cpf_cnpj)
  if (!cpfNorm) throw new Error('Informe um CPF ou CNPJ válido.')

  const telefone = input.telefone.trim()
  const telefoneDigits = telefone.replace(/\D/g, '')
  if (!telefoneDigits || telefoneDigits.length < 10 || telefoneDigits.length > 11) {
    throw new Error('Informe um WhatsApp válido com DDD.')
  }

  const { data: existing } = await supabase
    .from('loja_online_clientes')
    .select('id')
    .eq('empresa_id', input.empresaId)
    .ilike('email', email)
    .maybeSingle()
  if (existing) throw new Error('Este e-mail já está cadastrado nesta loja.')

  const clientePdvId = await ensureClientePdvForOnline({
    empresaId: input.empresaId,
    nome: input.nome,
    email,
    telefone,
    cpf_cnpj: cpfNorm,
    endereco: input.endereco,
  })

  const id = crypto.randomUUID()
  const senha_hash = await hashSenhaWeb(input.senha)
  const row: Record<string, unknown> = {
    id,
    empresa_id: input.empresaId,
    nome: input.nome.trim(),
    email,
    senha_hash,
    telefone,
    endereco: input.endereco?.trim() || null,
    cpf_cnpj: cpfNorm,
    cep: input.cep?.replace(/\D/g, '') || null,
    cliente_pdv_id: clientePdvId,
  }
  let { error } = await supabase
    .from('loja_online_clientes')
    .insert(input.data_nascimento ? { ...row, data_nascimento: input.data_nascimento } : row)
  // Banco sem a coluna data_nascimento (migração pendente): cadastra mesmo assim
  if (error && input.data_nascimento && /data_nascimento/.test(error.message)) {
    ;({ error } = await supabase.from('loja_online_clientes').insert(row))
  }
  if (error) throw error
  return {
    id,
    empresa_id: input.empresaId,
    nome: input.nome.trim(),
    email,
    telefone,
    endereco: input.endereco?.trim() || null,
    cpf_cnpj: cpfNorm,
    cep: input.cep?.replace(/\D/g, '') || null,
    cliente_pdv_id: clientePdvId,
  }
}

export async function loginLojaOnlineCliente(input: {
  empresaId: string
  email: string
  senha: string
}): Promise<LojaOnlineClienteSession> {
  const email = input.email.trim().toLowerCase()
  const { data, error } = await supabase
    .from('loja_online_clientes')
    .select('id, empresa_id, nome, email, senha_hash, telefone, endereco, cpf_cnpj, cep, cliente_pdv_id')
    .eq('empresa_id', input.empresaId)
    .ilike('email', email)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('E-mail ou senha incorretos.')
  const ok = await verificarSenhaWeb(input.senha, data.senha_hash as string)
  if (!ok) throw new Error('E-mail ou senha incorretos.')

  let clientePdvId = (data.cliente_pdv_id as string | null) ?? null
  if (!clientePdvId) {
    clientePdvId = await ensureClientePdvForOnline({
      empresaId: input.empresaId,
      nome: data.nome as string,
      email: data.email as string,
      telefone: (data.telefone as string | null) ?? null,
      cpf_cnpj: (data.cpf_cnpj as string | null) ?? null,
      endereco: (data.endereco as string | null) ?? null,
    })
    await supabase.from('loja_online_clientes').update({ cliente_pdv_id: clientePdvId }).eq('id', data.id)
  }

  return {
    id: data.id as string,
    empresa_id: data.empresa_id as string,
    nome: data.nome as string,
    email: data.email as string,
    telefone: (data.telefone as string | null) ?? null,
    endereco: (data.endereco as string | null) ?? null,
    cpf_cnpj: (data.cpf_cnpj as string | null) ?? null,
    cep: (data.cep as string | null) ?? null,
    cliente_pdv_id: clientePdvId,
  }
}

export async function updateLojaOnlineCliente(input: {
  empresaId: string
  clienteId: string
  nome: string
  email: string
  telefone: string
  endereco?: string
  cpf_cnpj?: string
  cep?: string
  senhaAtual?: string
  senhaNova?: string
}): Promise<LojaOnlineClienteSession> {
  const nome = input.nome.trim()
  const email = input.email.trim().toLowerCase()
  const telefone = input.telefone.trim()
  const telefoneDigits = onlyDigits(telefone)
  const cpfNorm = normalizeDocDigits(input.cpf_cnpj)
  const cepDigits = onlyDigits(input.cep ?? '')
  const endereco = input.endereco?.trim() || null
  const senhaNova = input.senhaNova?.trim() || ''

  if (!nome) throw new Error('Informe o nome completo.')
  if (!email || !isValidEmail(email)) throw new Error('Informe um e-mail válido.')
  if (!cpfNorm || cpfNorm.length !== 11 || !isValidCPF(cpfNorm)) {
    throw new Error('Informe um CPF válido.')
  }
  if (!telefoneDigits || !isValidPhone(telefone)) {
    throw new Error('Informe um WhatsApp válido com DDD.')
  }
  if (cepDigits && cepDigits.length !== 8) throw new Error('Informe um CEP válido.')
  if (senhaNova && senhaNova.length < 6) {
    throw new Error('A nova senha deve ter pelo menos 6 caracteres.')
  }

  const { data: current, error: readErr } = await supabase
    .from('loja_online_clientes')
    .select('id, senha_hash, cliente_pdv_id, email')
    .eq('id', input.clienteId)
    .eq('empresa_id', input.empresaId)
    .maybeSingle()
  if (readErr) throw readErr
  if (!current) throw new Error('Conta não encontrada.')

  if (senhaNova) {
    const atual = input.senhaAtual?.trim() ?? ''
    if (!atual) throw new Error('Informe a senha atual para definir uma nova.')
    const ok = await verificarSenhaWeb(atual, current.senha_hash as string)
    if (!ok) throw new Error('Senha atual incorreta.')
  }

  const emailAtual = String(current.email ?? '').trim().toLowerCase()
  if (email !== emailAtual) {
    const { data: existing, error: existErr } = await supabase
      .from('loja_online_clientes')
      .select('id')
      .eq('empresa_id', input.empresaId)
      .ilike('email', email)
      .neq('id', input.clienteId)
      .maybeSingle()
    if (existErr) throw existErr
    if (existing) throw new Error('Este e-mail já está cadastrado nesta loja.')
  }

  const patch: Record<string, string | null> = {
    nome,
    email,
    telefone,
    endereco,
    cpf_cnpj: cpfNorm,
    cep: cepDigits || null,
  }
  if (senhaNova) patch.senha_hash = await hashSenhaWeb(senhaNova)

  const { error } = await supabase
    .from('loja_online_clientes')
    .update(patch)
    .eq('id', input.clienteId)
    .eq('empresa_id', input.empresaId)
  if (error) throw error

  const clientePdvId = (current.cliente_pdv_id as string | null) ?? null
  if (clientePdvId) {
    const { error: pdvErr } = await supabase
      .from('clientes')
      .update({
        nome,
        email,
        telefone,
        endereco,
        cpf_cnpj: cpfNorm,
      })
      .eq('id', clientePdvId)
      .eq('empresa_id', input.empresaId)
    if (pdvErr) throw pdvErr
  }

  return {
    id: input.clienteId,
    empresa_id: input.empresaId,
    nome,
    email,
    telefone,
    endereco,
    cpf_cnpj: cpfNorm,
    cep: cepDigits || null,
    cliente_pdv_id: clientePdvId,
  }
}

export async function createLojaOnlinePedido(input: {
  empresaId: string
  cliente?: LojaOnlineClienteSession | null
  guest?: {
    nome: string
    email: string
    telefone?: string | null
    cpf?: string | null
    endereco?: string | null
    cep?: string | null
  }
  items: LojaOnlineCartItem[]
  formaEntrega: 'retirada' | 'entrega'
  enderecoEntrega?: string
  observacoes?: string
  formaPagamento?: import('./loja-online-types').LojaOnlineFormaPagamento
  valorFrete?: number
  valorDesconto?: number
  cashbackUsado?: number
  cupomId?: string | null
  cupomCodigo?: string | null
  tipoFrete?: string | null
  cepDestino?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  fbclid?: string | null
}): Promise<{ pedido: LojaOnlinePedido; itens: LojaOnlinePedidoItem[] }> {
  if (input.items.length === 0) throw new Error('Carrinho vazio.')

  const isGuest = !input.cliente?.id
  if (isGuest) {
    const g = input.guest
    if (!g?.nome?.trim() || !g?.email?.trim()) {
      throw new Error('Informe nome e e-mail para finalizar a compra.')
    }
    if (!g.cpf || !isValidCPF(g.cpf)) throw new Error('Informe um CPF válido.')
    if (!g.telefone || !isValidPhone(g.telefone)) throw new Error('Informe um WhatsApp válido com DDD.')
    if (!g.endereco?.trim() || (g.cep ?? '').replace(/\D/g, '').length !== 8) {
      throw new Error('Informe o endereço completo com CEP.')
    }
  } else if (!input.cliente?.id) {
    throw new Error('É necessário estar logado para finalizar a compra.')
  }

  const stockErr = await validateLojaOnlineCartStock(input.empresaId, input.items)
  if (stockErr) throw new Error(stockErr)

  const pedidoId = crypto.randomUUID()
  const subtotal = calcTotal(input.items)
  const valorFrete = input.formaEntrega === 'entrega' ? Math.max(0, input.valorFrete ?? 0) : 0
  const valorDesconto = Math.min(subtotal, Math.max(0, input.valorDesconto ?? 0))
  const cashbackUsado = isGuest
    ? 0
    : Math.min(
        subtotal - valorDesconto + valorFrete,
        Math.max(0, input.cashbackUsado ?? 0)
      )
  const total = pedidoTotalLiquido({ subtotal, valorFrete, valorDesconto, cashbackUsado })

  const formaPagamento = input.formaPagamento ?? 'manual'
  const pagamentoStatus = formaPagamento === 'manual' ? 'na_entrega' : 'pendente'

  const cpfNorm = input.cliente ? normalizeDocDigits(input.cliente.cpf_cnpj) : null
  if (cashbackUsado > 0 && input.cliente?.cliente_pdv_id && cpfNorm) {
    await debitarCashbackOnline({
      empresaId: input.empresaId,
      clientePdvId: input.cliente.cliente_pdv_id,
      cpfNorm,
      valor: cashbackUsado,
      pedidoId,
    })
  }

  const pedidoStatus = statusInicialPedido({ forma_pagamento: formaPagamento, pagamento_status: pagamentoStatus })

  const guestCpf = isGuest ? onlyDigits(input.guest!.cpf ?? '') || null : null
  const guestEndereco = isGuest ? input.guest!.endereco?.trim() || null : null
  let observacoes = input.observacoes?.trim() || null

  const pedidoRow: Record<string, unknown> = {
    id: pedidoId,
    empresa_id: input.empresaId,
    cliente_id: input.cliente?.id ?? null,
    status: pedidoStatus,
    subtotal,
    total,
    valor_frete: valorFrete,
    valor_desconto: valorDesconto,
    cashback_usado: cashbackUsado,
    cupom_id: input.cupomId ?? null,
    cupom_codigo: input.cupomCodigo ?? null,
    tipo_frete: input.tipoFrete ?? null,
    cep_destino: input.cepDestino?.replace(/\D/g, '') || null,
    observacoes: input.observacoes?.trim() || null,
    endereco_entrega: input.formaEntrega === 'entrega' ? input.enderecoEntrega?.trim() || null : null,
    forma_entrega: input.formaEntrega,
    cliente_nome: input.cliente?.nome ?? input.guest!.nome.trim(),
    cliente_email: input.cliente?.email ?? input.guest!.email.trim(),
    cliente_telefone: input.cliente?.telefone ?? input.guest?.telefone?.trim() ?? null,
    forma_pagamento: formaPagamento,
    pagamento_status: pagamentoStatus,
    utm_source: input.utm_source?.trim() || null,
    utm_medium: input.utm_medium?.trim() || null,
    utm_campaign: input.utm_campaign?.trim() || null,
    fbclid: input.fbclid?.trim() || null,
  }
  if (isGuest) {
    pedidoRow.cliente_cpf = guestCpf
    pedidoRow.cliente_endereco = guestEndereco
  }

  let { error: pedErr } = await supabase.from('loja_online_pedidos').insert(pedidoRow)
  if (pedErr && isGuest && /cliente_cpf|cliente_endereco/i.test(pedErr.message ?? '')) {
    // Colunas ainda não criadas: guarda os dados do convidado nas observações.
    delete pedidoRow.cliente_cpf
    delete pedidoRow.cliente_endereco
    const extra = [guestCpf ? `CPF: ${formatCPF(guestCpf)}` : '', guestEndereco ? `Endereço: ${guestEndereco}` : '']
      .filter(Boolean)
      .join(' | ')
    observacoes = [observacoes, extra].filter(Boolean).join(' | ') || null
    pedidoRow.observacoes = observacoes
    ;({ error: pedErr } = await supabase.from('loja_online_pedidos').insert(pedidoRow))
  }
  if (pedErr) throw pedErr

  if (input.cupomId) {
    const { data: cupom } = await supabase
      .from('loja_online_cupons')
      .select('usos_atual')
      .eq('id', input.cupomId)
      .maybeSingle()
    if (cupom) {
      await supabase
        .from('loja_online_cupons')
        .update({ usos_atual: (Number(cupom.usos_atual) || 0) + 1 })
        .eq('id', input.cupomId)
    }
  }

  const itens: LojaOnlinePedidoItem[] = input.items.map((item) => {
    const itemSubtotal = item.preco * item.quantidade
    const row: LojaOnlinePedidoItem = {
      id: crypto.randomUUID(),
      pedido_id: pedidoId,
      produto_id: item.produtoId,
      nome: item.personalizacao ? `${item.nome} (arte personalizada)` : item.nome,
      preco: item.preco,
      quantidade: item.quantidade,
      subtotal: itemSubtotal,
      unidade: item.unidade,
    }
    if (item.personalizacao) row.personalizacao_json = JSON.stringify(item.personalizacao)
    return row
  })

  const personalizados = input.items.filter((i) => i.personalizacao)
  const itensRows =
    personalizados.length > 0
      ? itens.map((i) => ({ ...i, personalizacao_json: i.personalizacao_json ?? null }))
      : itens
  let { error: itensErr } = await supabase.from('loja_online_pedido_itens').insert(itensRows)
  if (itensErr && personalizados.length > 0 && isSupabaseMissingColumnError(itensErr)) {
    // Coluna ainda não criada: mantém o link da arte nas observações para a produção não perder.
    const artes = personalizados
      .map((i) => `Arte ${i.personalizacao!.modeloNome}: ${i.personalizacao!.printUrl ?? i.personalizacao!.previewUrl}`)
      .join(' | ')
    observacoes = [observacoes, artes].filter(Boolean).join(' | ')
    await supabase.from('loja_online_pedidos').update({ observacoes }).eq('id', pedidoId)
    ;({ error: itensErr } = await supabase
      .from('loja_online_pedido_itens')
      .insert(itens.map(({ personalizacao_json: _p, ...rest }) => rest)))
  }
  if (itensErr) throw itensErr

  if (personalizados.length > 0) {
    await supabase
      .from('loja_online_capa_designs')
      .update({ pedido_id: pedidoId, status: 'pedido' })
      .in('id', personalizados.map((i) => i.personalizacao!.designId))
      .then(() => undefined, () => undefined)
  }

  const pedido: LojaOnlinePedido = {
    id: pedidoId,
    empresa_id: input.empresaId,
    cliente_id: input.cliente?.id ?? null,
    status: pedidoStatus,
    subtotal,
    total,
    valor_frete: valorFrete,
    valor_desconto: valorDesconto,
    cashback_usado: cashbackUsado,
    cupom_codigo: input.cupomCodigo ?? null,
    cupom_id: input.cupomId ?? null,
    tipo_frete: input.tipoFrete ?? null,
    cep_destino: input.cepDestino?.replace(/\D/g, '') || null,
    observacoes,
    endereco_entrega: input.formaEntrega === 'entrega' ? input.enderecoEntrega?.trim() || null : null,
    forma_entrega: input.formaEntrega,
    cliente_nome: input.cliente?.nome ?? input.guest!.nome.trim(),
    cliente_email: input.cliente?.email ?? input.guest!.email.trim(),
    cliente_telefone: input.cliente?.telefone ?? input.guest?.telefone?.trim() ?? null,
    cliente_cpf: guestCpf,
    cliente_endereco: guestEndereco,
    venda_id: null,
    forma_pagamento: formaPagamento,
    pagamento_status: pagamentoStatus,
    gateway_payment_id: null,
    gateway_checkout_url: null,
    pagamento_meio: null,
    codigo_rastreio: null,
    utm_source: input.utm_source?.trim() || null,
    utm_medium: input.utm_medium?.trim() || null,
    utm_campaign: input.utm_campaign?.trim() || null,
    fbclid: input.fbclid?.trim() || null,
    created_at: new Date().toISOString(),
  }

  notifyLojaOnlinePedidosUpdated()
  return { pedido, itens }
}

export async function fetchLojaOnlinePedidosCliente(
  empresaId: string,
  clienteId: string
): Promise<LojaOnlinePedido[]> {
  const { data, error } = await supabase
    .from('loja_online_pedidos')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => normalizePedido(row as LojaOnlinePedido))
}

/** Lista clientes cadastrados na loja online (painel admin). */
export async function fetchLojaOnlineClientesAdmin(empresaId: string): Promise<LojaOnlineClienteAdmin[]> {
  const { data, error } = await supabase
    .from('loja_online_clientes')
    .select('id, empresa_id, nome, email, telefone, endereco, cpf_cnpj, cep, cliente_pdv_id, created_at')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error

  const clientes = (data ?? []) as Array<
    LojaOnlineClienteSession & { created_at: string }
  >
  if (clientes.length === 0) return []

  const { data: pedidosRows, error: pedidosErr } = await supabase
    .from('loja_online_pedidos')
    .select('cliente_id, total')
    .eq('empresa_id', empresaId)
    .not('cliente_id', 'is', null)
  if (pedidosErr) throw pedidosErr

  const stats = new Map<string, { count: number; total: number }>()
  for (const row of pedidosRows ?? []) {
    const id = String((row as { cliente_id?: string }).cliente_id ?? '')
    if (!id) continue
    const prev = stats.get(id) ?? { count: 0, total: 0 }
    prev.count += 1
    prev.total += Number((row as { total?: number }).total) || 0
    stats.set(id, prev)
  }

  return clientes.map((c) => {
    const s = stats.get(c.id)
    return {
      ...c,
      telefone: c.telefone ?? null,
      endereco: c.endereco ?? null,
      cpf_cnpj: c.cpf_cnpj ?? null,
      cep: c.cep ?? null,
      cliente_pdv_id: c.cliente_pdv_id ?? null,
      pedidos_count: s?.count ?? 0,
      pedidos_total: s?.total ?? 0,
    }
  })
}

export async function fetchLojaOnlinePedidoCliente(
  empresaId: string,
  clienteId: string,
  pedidoId: string
): Promise<LojaOnlinePedido | null> {
  const { data, error } = await supabase
    .from('loja_online_pedidos')
    .select('*')
    .eq('id', pedidoId)
    .eq('empresa_id', empresaId)
    .eq('cliente_id', clienteId)
    .maybeSingle()
  if (error) throw error
  const row = data as LojaOnlinePedido | null
  return row ? normalizePedido(row) : null
}

export async function fetchLojaOnlinePedidosAdmin(empresaId: string): Promise<LojaOnlinePedido[]> {
  const { data, error } = await supabase
    .from('loja_online_pedidos')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []).map((row) => normalizePedido(row as LojaOnlinePedido))
}

/** Pedidos que exigem ação no painel (envio, confirmação etc.). */
export async function fetchLojaOnlinePedidosAcaoAdmin(empresaId: string): Promise<LojaOnlinePedido[]> {
  const { data, error } = await supabase
    .from('loja_online_pedidos')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? [])
    .map((row) => normalizePedido(row as LojaOnlinePedido))
    .filter(pedidoMostraNotificacaoPainel)
}

/** Quantidade de pedidos aguardando ação no painel. */
export async function countLojaOnlinePedidosNotificacao(empresaId: string): Promise<number> {
  const pedidos = await fetchLojaOnlinePedidosAcaoAdmin(empresaId)
  return pedidos.length
}

/** @deprecated Use countLojaOnlinePedidosNotificacao */
export async function countLojaOnlinePedidosPendentes(empresaId: string): Promise<number> {
  return countLojaOnlinePedidosNotificacao(empresaId)
}

export function notifyLojaOnlinePedidosUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('agiliza:lojaOnlinePedidosUpdated'))
  }
}

export async function fetchLojaOnlinePedidoItens(pedidoId: string): Promise<LojaOnlinePedidoItem[]> {
  const { data, error } = await supabase
    .from('loja_online_pedido_itens')
    .select('*')
    .eq('pedido_id', pedidoId)
  if (error) throw error
  return (data ?? []) as LojaOnlinePedidoItem[]
}

/** Itens de vários pedidos com imagem do produto (lista Meus pedidos). */
export async function fetchLojaOnlinePedidosItensBatch(
  pedidoIds: string[]
): Promise<Record<string, LojaOnlinePedidoItemComImagem[]>> {
  if (pedidoIds.length === 0) return {}

  const { data: itens, error } = await supabase
    .from('loja_online_pedido_itens')
    .select('*')
    .in('pedido_id', pedidoIds)
  if (error) throw error

  const produtoIds = [...new Set((itens ?? []).map((i) => i.produto_id as string))]
  const imagens = new Map<string, string | null>()

  if (produtoIds.length > 0) {
    const { data: prods, error: prodErr } = await supabase
      .from('produtos')
      .select('id, imagem')
      .in('id', produtoIds)
    if (prodErr) throw prodErr
    for (const p of prods ?? []) {
      imagens.set(p.id as string, (p.imagem as string | null) ?? null)
    }
  }

  const map: Record<string, LojaOnlinePedidoItemComImagem[]> = {}
  for (const row of itens ?? []) {
    const item = row as LojaOnlinePedidoItem
    const enriched: LojaOnlinePedidoItemComImagem = {
      ...item,
      imagem:
        parseLojaOnlinePersonalizacao(item.personalizacao_json)?.previewUrl ??
        imagens.get(item.produto_id) ??
        null,
    }
    if (!map[item.pedido_id]) map[item.pedido_id] = []
    map[item.pedido_id].push(enriched)
  }
  return map
}

export async function updateLojaOnlinePedidoStatus(
  pedidoId: string,
  status: LojaOnlinePedidoStatus
): Promise<void> {
  const { data: pedido, error: fetchErr } = await supabase
    .from('loja_online_pedidos')
    .select('*')
    .eq('id', pedidoId)
    .maybeSingle()
  if (fetchErr) throw fetchErr
  if (!pedido) throw new Error('Pedido não encontrado.')

  const { error } = await supabase.from('loja_online_pedidos').update({ status }).eq('id', pedidoId)
  if (error) throw error

  const row = normalizePedido(pedido as LojaOnlinePedido)
  const cancelStatuses: LojaOnlinePedidoStatus[] = ['cancelado', 'reembolsado', 'pagamento_recusado']

  if (cancelStatuses.includes(status) && row.venda_id) {
    await cancelarVendaOnline(row.venda_id)
  } else if (!row.venda_id) {
    const updatedRow = { ...row, status }
    if (!pedidoElegivelParaVenda(updatedRow)) return

    const { data: existing } = await supabase.from('vendas').select('id').eq('id', pedidoId).maybeSingle()
    const vendaId = existing?.id ? String(existing.id) : await criarVendaFromPedidoOnline(updatedRow)
    await supabase.from('loja_online_pedidos').update({ venda_id: vendaId }).eq('id', pedidoId)
    if (existing?.id) {
      await supabase
        .from('vendas')
        .update({ status: 'CONCLUIDA' })
        .eq('id', vendaId)
        .eq('venda_online', 1)
        .eq('status', 'CANCELADA')
    }
  }
}

export async function updateLojaOnlinePedidoRastreio(
  pedidoId: string,
  codigoRastreio: string | null
): Promise<void> {
  const codigo = codigoRastreio?.trim() || null
  const { error } = await supabase
    .from('loja_online_pedidos')
    .update({ codigo_rastreio: codigo, melhor_envio_tracking: codigo })
    .eq('id', pedidoId)
  if (error) throw error
}

const CAIXA_LOJA_ONLINE_PREFIX = 'loja-online-caixa-'

async function nextNumeroVenda(empresaId: string): Promise<number> {
  const { data, error } = await supabase
    .from('vendas')
    .select('numero')
    .eq('empresa_id', empresaId)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  const n = data?.numero
  return typeof n === 'number' && Number.isFinite(n) ? n + 1 : 1
}

async function ensureLojaOnlineCaixa(empresaId: string, usuarioId: string): Promise<string> {
  const id = `${CAIXA_LOJA_ONLINE_PREFIX}${empresaId}`
  const { data } = await supabase.from('caixas').select('id').eq('id', id).maybeSingle()
  if (data?.id) return id

  const now = new Date().toISOString()
  const { error } = await supabase.from('caixas').insert({
    id,
    empresa_id: empresaId,
    usuario_id: usuarioId,
    status: 'FECHADO',
    valor_inicial: 0,
    aberto_em: now,
    fechado_em: now,
  })
  if (error) throw error
  return id
}

async function getUsuarioIdLojaOnline(empresaId: string): Promise<string> {
  const { data } = await supabase
    .from('usuarios')
    .select('id')
    .eq('empresa_id', empresaId)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  return (data?.id as string | undefined) ?? `loja-online-${empresaId}`
}

async function registrarSaidaEstoquePedido(params: {
  empresa_id: string
  produto_id: string
  quantidade: number
  custo_unitario: number
  venda_id: string
  usuario_id: string
}): Promise<void> {
  const { error } = await supabase.from('estoque_movimentos').insert({
    id: crypto.randomUUID(),
    empresa_id: params.empresa_id,
    produto_id: params.produto_id,
    tipo: 'SAIDA',
    quantidade: params.quantidade,
    custo_unitario: params.custo_unitario,
    referencia_tipo: 'VENDA',
    referencia_id: params.venda_id,
    usuario_id: params.usuario_id,
    created_at: new Date().toISOString(),
  })
  if (error) throw error

  const { data: movs } = await supabase
    .from('estoque_movimentos')
    .select('tipo, quantidade')
    .eq('empresa_id', params.empresa_id)
    .eq('produto_id', params.produto_id)

  let saldo = 0
  for (const m of movs ?? []) {
    const q = Number((m as { quantidade: number }).quantidade)
    const tipo = (m as { tipo: string }).tipo
    if (tipo === 'ENTRADA' || tipo === 'DEVOLUCAO' || tipo === 'AJUSTE') saldo += q
    else if (tipo === 'SAIDA') saldo -= q
  }

  await supabase
    .from('produtos')
    .update({ estoque_atual: saldo })
    .eq('id', params.produto_id)
    .eq('empresa_id', params.empresa_id)
  invalidateLojaOnlineCatalogCache(params.empresa_id)
}

async function cancelarVendaOnline(vendaId: string): Promise<void> {
  const { data } = await supabase.from('vendas').select('status, venda_online').eq('id', vendaId).maybeSingle()
  if (!data || Number(data.venda_online) !== 1 || data.status === 'CANCELADA') return
  const { error } = await supabase.from('vendas').update({ status: 'CANCELADA' }).eq('id', vendaId)
  if (error) throw error
}

async function criarVendaFromPedidoOnline(pedido: LojaOnlinePedido): Promise<string> {
  const itens = await fetchLojaOnlinePedidoItens(pedido.id)
  if (itens.length === 0) throw new Error('Pedido sem itens.')

  const usuarioId = await getUsuarioIdLojaOnline(pedido.empresa_id)
  const caixaId = await ensureLojaOnlineCaixa(pedido.empresa_id, usuarioId)
  const vendaId = pedido.id
  const numero = await nextNumeroVenda(pedido.empresa_id)
  const subtotal = pedido.subtotal ?? pedido.total
  const descontoTotal = Number(pedido.valor_desconto) || 0
  const cashbackUsado = Number(pedido.cashback_usado) || 0
  const now = new Date().toISOString()

  let clientePdvId: string | null = null
  if (pedido.cliente_id) {
    const { data: cli } = await supabase
      .from('loja_online_clientes')
      .select('cliente_pdv_id')
      .eq('id', pedido.cliente_id)
      .maybeSingle()
    clientePdvId = (cli?.cliente_pdv_id as string | null) ?? null
  }

  const { data: cfgLoja } = await supabase
    .from('empresas_config')
    .select('loja_online_cashback_ativo')
    .eq('empresa_id', pedido.empresa_id)
    .maybeSingle()

  const { error: vendaErr } = await supabase.from('vendas').insert({
    id: vendaId,
    empresa_id: pedido.empresa_id,
    caixa_id: caixaId,
    usuario_id: usuarioId,
    cliente_id: clientePdvId,
    numero,
    status: 'CONCLUIDA',
    subtotal,
    desconto_total: descontoTotal + cashbackUsado,
    total: pedido.total,
    troco: 0,
    venda_a_prazo: 0,
    data_vencimento: null,
    cashback_gerado: 0,
    cashback_usado: cashbackUsado,
    venda_online: 1,
    created_at: pedido.created_at || now,
  })
  if (vendaErr) {
    if (/duplicate key|unique constraint/i.test(vendaErr.message)) return vendaId
    throw new Error(`Falha ao registrar venda online: ${vendaErr.message}`)
  }

  const itensRows = itens.map((item) => ({
    id: crypto.randomUUID(),
    empresa_id: pedido.empresa_id,
    venda_id: vendaId,
    produto_id: item.produto_id,
    descricao: item.nome,
    preco_unitario: item.preco,
    quantidade: item.quantidade,
    desconto: 0,
    total: item.subtotal,
  }))
  const { error: itensErr } = await supabase.from('venda_itens').insert(itensRows)
  if (itensErr) throw new Error(`Falha ao registrar itens da venda: ${itensErr.message}`)

  const produtoIds = [...new Set(itens.map((i) => i.produto_id))]
  const { data: produtos } = await supabase
    .from('produtos')
    .select('id, controla_estoque, custo')
    .in('id', produtoIds)

  const prodMap = new Map(
    (produtos ?? []).map((p) => [
      String((p as { id: string }).id),
      p as { id: string; controla_estoque: number; custo: number },
    ])
  )

  for (const item of itens) {
    const produto = prodMap.get(item.produto_id)
    if (produto && Number(produto.controla_estoque) === 1) {
      await registrarSaidaEstoquePedido({
        empresa_id: pedido.empresa_id,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        custo_unitario: Number(produto.custo) || 0,
        venda_id: vendaId,
        usuario_id: usuarioId,
      })
    }
  }

  const pagamentoBase = {
    id: crypto.randomUUID(),
    empresa_id: pedido.empresa_id,
    venda_id: vendaId,
    valor: pedido.total,
  }
  const formaPagamento = formaPagamentoFromPedidoOnline(pedido)
  let { error: pagErr } = await supabase.from('pagamentos').insert({
    ...pagamentoBase,
    forma: formaPagamento,
  })
  if (pagErr?.message?.includes('pagamentos_forma_check')) {
    const retry = await supabase.from('pagamentos').insert({
      ...pagamentoBase,
      forma: 'OUTROS',
    })
    pagErr = retry.error
  }
  if (pagErr) throw new Error(`Falha ao registrar pagamento: ${pagErr.message}`)

  if (Number(cfgLoja?.loja_online_cashback_ativo) === 1 && clientePdvId) {
    const { data: cliRow } = await supabase
      .from('loja_online_clientes')
      .select('cpf_cnpj')
      .eq('id', pedido.cliente_id)
      .maybeSingle()
    const cpfNorm = normalizeDocDigits(cliRow?.cpf_cnpj as string | null)
    if (cpfNorm) {
      const valorBase = Math.max(0, pedido.total)
      const gerado = await gerarCashbackPedidoOnline({
        empresaId: pedido.empresa_id,
        clientePdvId,
        cpfNorm,
        vendaId,
        valorBase,
      })
      if (gerado > 0) {
        await supabase.from('vendas').update({ cashback_gerado: gerado }).eq('id', vendaId)
      }
    }
  }

  return vendaId
}

export function buildPedidoWhatsAppMessage(
  pedido: LojaOnlinePedido,
  itens: LojaOnlinePedidoItem[],
  lojaTitulo: string
): string {
  const lines = [
    `Olá! Novo pedido na loja ${lojaTitulo}.`,
    `Pedido #${pedido.id.slice(0, 8).toUpperCase()}`,
    '',
    ...itens.map((i) => `• ${i.quantidade}x ${i.nome} — R$ ${i.subtotal.toFixed(2)}`),
    '',
    `Total: R$ ${pedido.total.toFixed(2)}`,
    `Entrega: ${pedido.forma_entrega === 'entrega' ? 'Delivery' : 'Retirada na loja'}`,
  ]
  if (pedido.endereco_entrega) lines.push(`Endereço: ${pedido.endereco_entrega}`)
  if (pedido.observacoes) lines.push(`Obs: ${pedido.observacoes}`)
  if (pedido.cliente_nome) lines.push(`Cliente: ${pedido.cliente_nome}`)
  if (pedido.cliente_telefone) lines.push(`Tel: ${pedido.cliente_telefone}`)
  if (pedido.cupom_codigo) lines.push(`Cupom: ${pedido.cupom_codigo}`)
  if (pedido.valor_frete) lines.push(`Frete: R$ ${Number(pedido.valor_frete).toFixed(2)}`)
  if (pedido.valor_desconto) lines.push(`Desconto: R$ ${Number(pedido.valor_desconto).toFixed(2)}`)
  if (pedido.cashback_usado) lines.push(`Cashback usado: R$ ${Number(pedido.cashback_usado).toFixed(2)}`)
  return lines.join('\n')
}

// ——— Cupons (admin) ———

export async function fetchLojaOnlineCupons(empresaId: string): Promise<LojaOnlineCupom[]> {
  const { data, error } = await supabase
    .from('loja_online_cupons')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as LojaOnlineCupom[]
}

export async function saveLojaOnlineCupom(input: {
  empresaId: string
  id?: string
  codigo: string
  tipo: 'percentual' | 'fixo'
  valor: number
  valorMinimo?: number
  usoMaximo?: number | null
  ativo?: boolean
  validoAte?: string | null
}): Promise<void> {
  const row = {
    empresa_id: input.empresaId,
    codigo: input.codigo.trim().toUpperCase(),
    tipo: input.tipo,
    valor: input.valor,
    valor_minimo: input.valorMinimo ?? 0,
    uso_maximo: input.usoMaximo ?? null,
    ativo: input.ativo === false ? 0 : 1,
    valido_ate: input.validoAte || null,
  }
  if (input.id) {
    const { error } = await supabase.from('loja_online_cupons').update(row).eq('id', input.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('loja_online_cupons').insert({ id: crypto.randomUUID(), ...row })
    if (error) throw error
  }
}

export async function deleteLojaOnlineCupom(id: string): Promise<void> {
  const { error } = await supabase.from('loja_online_cupons').delete().eq('id', id)
  if (error) throw error
}

function isSupabaseMissingRelationError(error: SupabaseLikeError): boolean {
  if (!error) return false
  const msg = (error.message ?? '').toLowerCase()
  return error.code === '42P01' || msg.includes('schema cache') || msg.includes('does not exist')
}

const ORDER_BUMP_PRODUTO_SELECT =
  'id, empresa_id, nome, descricao, imagem, preco, unidade, estoque_atual, controla_estoque, categoria_id, codigo, loja_online_preco_de'

const ORDER_BUMP_CACHE_TTL_MS = 90_000
const orderBumpCache = new Map<
  string,
  { at: number; data: LojaOnlineOrderBump[]; inflight?: Promise<LojaOnlineOrderBump[]> }
>()

function orderBumpCacheKey(empresaId: string, somenteAtivos: boolean, withTriggers: boolean) {
  return `${empresaId}:${somenteAtivos ? '1' : '0'}:${withTriggers ? 't' : 'p'}`
}

export function invalidateLojaOnlineOrderBumpsCache(empresaId?: string) {
  if (!empresaId) {
    orderBumpCache.clear()
    return
  }
  for (const key of orderBumpCache.keys()) {
    if (key.startsWith(`${empresaId}:`)) orderBumpCache.delete(key)
  }
}

async function attachOrderBumpProdutos(
  empresaId: string,
  bumps: LojaOnlineOrderBump[],
  opts?: { includeTriggers?: boolean }
): Promise<LojaOnlineOrderBump[]> {
  if (bumps.length === 0) return bumps
  const includeTriggers = opts?.includeTriggers !== false
  const ids = [
    ...new Set(
      bumps.flatMap((b) => {
        const list = [b.produto_id]
        if (includeTriggers && b.trigger_produto_id) list.push(b.trigger_produto_id)
        return list
      })
    ),
  ]
  const { data } = await supabase
    .from('produtos')
    .select(ORDER_BUMP_PRODUTO_SELECT)
    .eq('empresa_id', empresaId)
    .in('id', ids)
  const byId = new Map(((data ?? []) as LojaOnlineProduto[]).map((p) => [p.id, p]))
  return bumps.map((b) => ({
    ...b,
    produto: byId.get(b.produto_id) ?? null,
    trigger_produto: includeTriggers && b.trigger_produto_id
      ? byId.get(b.trigger_produto_id) ?? null
      : b.trigger_produto ?? null,
  }))
}

async function fetchLojaOnlineOrderBumpsUncached(
  empresaId: string,
  opts?: { somenteAtivos?: boolean; includeTriggers?: boolean }
): Promise<LojaOnlineOrderBump[]> {
  const somenteAtivos = !!opts?.somenteAtivos
  const includeTriggers = opts?.includeTriggers !== false
  let query = supabase
    .from('loja_online_order_bumps')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true })
  if (somenteAtivos) query = query.eq('ativo', 1)

  const { data, error } = await query
  if (error) {
    if (isSupabaseMissingRelationError(error)) return []
    throw error
  }
  return attachOrderBumpProdutos(empresaId, (data ?? []) as LojaOnlineOrderBump[], {
    includeTriggers,
  })
}

export async function fetchLojaOnlineOrderBumps(
  empresaId: string,
  opts?: { somenteAtivos?: boolean; includeTriggers?: boolean; bypassCache?: boolean }
): Promise<LojaOnlineOrderBump[]> {
  const somenteAtivos = !!opts?.somenteAtivos
  const includeTriggers = opts?.includeTriggers !== false
  const key = orderBumpCacheKey(empresaId, somenteAtivos, includeTriggers)
  const cached = orderBumpCache.get(key)
  const now = Date.now()

  if (!opts?.bypassCache && cached?.data && now - cached.at < ORDER_BUMP_CACHE_TTL_MS) {
    return cached.data
  }
  if (!opts?.bypassCache && cached?.inflight) return cached.inflight

  const inflight = fetchLojaOnlineOrderBumpsUncached(empresaId, { somenteAtivos, includeTriggers })
    .then((data) => {
      orderBumpCache.set(key, { at: Date.now(), data })
      return data
    })
    .catch((err) => {
      const prev = orderBumpCache.get(key)
      if (prev?.inflight === inflight) {
        orderBumpCache.set(key, { at: prev.at, data: prev.data })
      }
      throw err
    })

  orderBumpCache.set(key, {
    at: cached?.at ?? 0,
    data: cached?.data ?? [],
    inflight,
  })
  return inflight
}

/** Pré-carrega bumps ativos do checkout (carrinho → finalizar). */
export function prefetchLojaOnlineOrderBumps(empresaId: string): void {
  void fetchLojaOnlineOrderBumps(empresaId, {
    somenteAtivos: true,
    includeTriggers: false,
  }).catch(() => {})
}

export function peekLojaOnlineOrderBumpsCache(empresaId: string): LojaOnlineOrderBump[] | null {
  const key = orderBumpCacheKey(empresaId, true, false)
  const cached = orderBumpCache.get(key)
  if (!cached || cached.at <= 0) return null
  if (Date.now() - cached.at >= ORDER_BUMP_CACHE_TTL_MS) return null
  return cached.data
}

export async function saveLojaOnlineOrderBump(input: {
  empresaId: string
  id?: string
  tipo: 'fixo' | 'personalizado'
  produtoId: string
  triggerProdutoId?: string | null
  titulo?: string | null
  descricao?: string | null
  precoEspecial?: number | null
  ativo?: boolean
  ordem?: number
}): Promise<void> {
  const row = {
    empresa_id: input.empresaId,
    tipo: input.tipo,
    produto_id: input.produtoId,
    trigger_produto_id: input.tipo === 'personalizado' ? input.triggerProdutoId || null : null,
    titulo: input.titulo?.trim() || null,
    descricao: input.descricao?.trim() || null,
    preco_especial: input.precoEspecial != null && input.precoEspecial > 0 ? input.precoEspecial : null,
    ativo: input.ativo === false ? 0 : 1,
    ordem: input.ordem ?? 0,
  }
  if (input.tipo === 'personalizado' && !row.trigger_produto_id) {
    throw new Error('Escolha o produto que dispara o order bump.')
  }
  if (row.trigger_produto_id && row.trigger_produto_id === row.produto_id) {
    throw new Error('O produto extra precisa ser diferente do produto do carrinho.')
  }
  if (input.id) {
    const { error } = await supabase.from('loja_online_order_bumps').update(row).eq('id', input.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('loja_online_order_bumps').insert({ id: crypto.randomUUID(), ...row })
    if (error) {
      if (error.code === '23505') throw new Error('Esse order bump já está cadastrado.')
      throw error
    }
  }
  invalidateLojaOnlineOrderBumpsCache(input.empresaId)
}

export async function deleteLojaOnlineOrderBump(id: string, empresaId?: string): Promise<void> {
  const { error } = await supabase.from('loja_online_order_bumps').delete().eq('id', id)
  if (error) throw error
  invalidateLojaOnlineOrderBumpsCache(empresaId)
}

// ——— Coleções ———

export function slugifyLojaOnlineColecao(nome: string): string {
  const slug = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return slug || 'colecao'
}

async function uniqueColecaoSlug(empresaId: string, nome: string, excludeId?: string): Promise<string> {
  const base = slugifyLojaOnlineColecao(nome)
  let slug = base
  for (let i = 0; i < 12; i++) {
    const { data, error } = await supabase
      .from('loja_online_colecoes')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('slug', slug)
      .maybeSingle()
    if (error) {
      if (isSupabaseMissingRelationError(error)) return slug
      throw error
    }
    if (!data || (excludeId && data.id === excludeId)) return slug
    slug = `${base}-${i + 2}`
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`
}

async function attachColecaoProdutos(
  colecoes: LojaOnlineColecao[]
): Promise<LojaOnlineColecao[]> {
  if (colecoes.length === 0) return colecoes
  const ids = colecoes.map((c) => c.id)
  const { data, error } = await supabase
    .from('loja_online_colecao_produtos')
    .select('colecao_id, produto_id, ordem')
    .in('colecao_id', ids)
    .order('ordem', { ascending: true })
  if (error) {
    if (isSupabaseMissingRelationError(error)) {
      return colecoes.map((c) => ({ ...c, produto_ids: [], produtos_count: 0 }))
    }
    throw error
  }
  const byColecao = new Map<string, { id: string; ordem: number }[]>()
  for (const row of data ?? []) {
    const list = byColecao.get(row.colecao_id) ?? []
    list.push({ id: row.produto_id, ordem: row.ordem })
    byColecao.set(row.colecao_id, list)
  }
  return colecoes.map((c) => {
    const list = (byColecao.get(c.id) ?? []).sort((a, b) => a.ordem - b.ordem)
    return {
      ...c,
      produto_ids: list.map((p) => p.id),
      produtos_count: list.length,
    }
  })
}

export async function fetchLojaOnlineColecoes(
  empresaId: string,
  opts?: { somenteAtivas?: boolean }
): Promise<LojaOnlineColecao[]> {
  let query = supabase
    .from('loja_online_colecoes')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })
  if (opts?.somenteAtivas) query = query.eq('ativo', 1)
  const { data, error } = await query
  if (error) {
    if (isSupabaseMissingRelationError(error)) return []
    throw error
  }
  return attachColecaoProdutos((data ?? []) as LojaOnlineColecao[])
}

export async function fetchLojaOnlineColecao(
  empresaId: string,
  slugOrId: string
): Promise<LojaOnlineColecao | null> {
  const run = async (column: 'slug' | 'id') =>
    supabase
      .from('loja_online_colecoes')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq(column, slugOrId)
      .eq('ativo', 1)
      .maybeSingle()

  let result = await run('slug')
  if (result.error) {
    if (isSupabaseMissingRelationError(result.error)) return null
    throw result.error
  }
  if (!result.data) {
    result = await run('id')
    if (result.error) throw result.error
  }
  if (!result.data) return null
  const [colecao] = await attachColecaoProdutos([result.data as LojaOnlineColecao])
  return colecao ?? null
}

export async function fetchLojaOnlineColecaoProdutos(
  empresaId: string,
  colecao: LojaOnlineColecao,
  ocultarSemEstoque: boolean
): Promise<LojaOnlineProduto[]> {
  const ids = [...new Set((colecao.produto_ids ?? []).map(String).filter(Boolean))]
  if (ids.length === 0) return []

  const list = await fetchProdutosListUncached(empresaId, ocultarSemEstoque, false, ids)
  const byId = new Map(list.map((p) => [p.id, p]))
  return ids.map((id) => byId.get(id)).filter((p): p is LojaOnlineProduto => !!p)
}

export async function saveLojaOnlineColecao(input: {
  empresaId: string
  id?: string
  nome: string
  subtitulo?: string | null
  descricao?: string | null
  categoriaId?: string | null
  imagem?: string | null
  imagemCapa?: string | null
  ordem?: number
  ativo?: boolean
  produtoIds: string[]
  slug?: string | null
}): Promise<LojaOnlineColecao> {
  const nome = input.nome.trim()
  if (!nome) throw new Error('Nome da coleção é obrigatório.')
  const id = input.id || crypto.randomUUID()
  const slug = input.slug?.trim()
    ? input.slug.trim()
    : await uniqueColecaoSlug(input.empresaId, nome, input.id)
  const now = new Date().toISOString()
  const row = {
    id,
    empresa_id: input.empresaId,
    nome,
    slug,
    subtitulo: input.subtitulo?.trim() || null,
    descricao: input.descricao?.trim() || null,
    categoria_id: input.categoriaId || null,
    imagem: (await subirBase64EmTexto(input.imagem?.trim(), input.empresaId)) || null,
    imagem_capa: (await subirBase64EmTexto(input.imagemCapa?.trim(), input.empresaId)) || null,
    ordem: input.ordem ?? 0,
    ativo: input.ativo === false ? 0 : 1,
    updated_at: now,
  }

  if (input.id) {
    const { error } = await supabase.from('loja_online_colecoes').update(row).eq('id', input.id)
    if (error) {
      if (isSupabaseMissingRelationError(error)) {
        throw new Error('Execute o SQL de coleções no Supabase (web/sql/supabase-loja-online-colecoes.sql) para ativar este recurso.')
      }
      throw error
    }
  } else {
    const { error } = await supabase.from('loja_online_colecoes').insert({ ...row, created_at: now })
    if (error) {
      if (isSupabaseMissingRelationError(error)) {
        throw new Error('Execute o SQL de coleções no Supabase (web/sql/supabase-loja-online-colecoes.sql) para ativar este recurso.')
      }
      if (error.code === '23505') throw new Error('Já existe uma coleção com esse nome.')
      throw error
    }
  }

  const { error: delError } = await supabase
    .from('loja_online_colecao_produtos')
    .delete()
    .eq('colecao_id', id)
  if (delError) throw delError

  const uniqueIds = [...new Set(input.produtoIds.filter(Boolean))]
  if (uniqueIds.length > 0) {
    const { error: insError } = await supabase.from('loja_online_colecao_produtos').insert(
      uniqueIds.map((produtoId, ordem) => ({
        colecao_id: id,
        produto_id: produtoId,
        ordem,
      }))
    )
    if (insError) throw insError
  }

  return {
    ...row,
    produto_ids: uniqueIds,
    produtos_count: uniqueIds.length,
  }
}

export async function deleteLojaOnlineColecao(id: string): Promise<void> {
  const { error } = await supabase.from('loja_online_colecoes').delete().eq('id', id)
  if (error) throw error
}

/** IDs das coleções em que o produto participa. */
export async function fetchLojaOnlineColecaoIdsByProduto(produtoId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('loja_online_colecao_produtos')
    .select('colecao_id')
    .eq('produto_id', produtoId)
  if (error) {
    if (isSupabaseMissingRelationError(error)) return []
    throw error
  }
  return (data ?? []).map((row) => String((row as { colecao_id: string }).colecao_id))
}

/**
 * Sincroniza as coleções do produto (adiciona/remove na tabela de ligação
 * sem reescrever a ordem dos demais itens de cada coleção).
 */
export async function setLojaOnlineProdutoColecoes(
  produtoId: string,
  colecaoIds: string[]
): Promise<void> {
  const desired = [...new Set(colecaoIds.map(String).filter(Boolean))]
  const { data: current, error } = await supabase
    .from('loja_online_colecao_produtos')
    .select('colecao_id')
    .eq('produto_id', produtoId)
  if (error) {
    if (isSupabaseMissingRelationError(error)) {
      throw new Error(
        'Execute o SQL de coleções no Supabase (web/sql/supabase-loja-online-colecoes.sql) para ativar este recurso.'
      )
    }
    throw error
  }

  const currentIds = new Set(
    (current ?? []).map((row) => String((row as { colecao_id: string }).colecao_id))
  )
  const desiredSet = new Set(desired)
  const toRemove = [...currentIds].filter((id) => !desiredSet.has(id))
  const toAdd = desired.filter((id) => !currentIds.has(id))

  if (toRemove.length > 0) {
    const { error: delErr } = await supabase
      .from('loja_online_colecao_produtos')
      .delete()
      .eq('produto_id', produtoId)
      .in('colecao_id', toRemove)
    if (delErr) throw delErr
  }

  for (const colecaoId of toAdd) {
    const { data: maxRow } = await supabase
      .from('loja_online_colecao_produtos')
      .select('ordem')
      .eq('colecao_id', colecaoId)
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle()
    const ordem = Number((maxRow as { ordem?: number } | null)?.ordem ?? -1) + 1
    const { error: insErr } = await supabase.from('loja_online_colecao_produtos').insert({
      colecao_id: colecaoId,
      produto_id: produtoId,
      ordem,
    })
    if (insErr) throw insErr
  }
}

// ——— Favoritos ———

export async function fetchLojaOnlineFavoritos(
  empresaId: string,
  clienteId: string
): Promise<LojaOnlineFavorito[]> {
  const { data, error } = await supabase
    .from('loja_online_favoritos')
    .select('id, empresa_id, cliente_id, produto_id, created_at')
    .eq('empresa_id', empresaId)
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })
  if (error) throw error
  const favs = (data ?? []) as LojaOnlineFavorito[]
  if (favs.length === 0) return []

  const produtoIds = favs.map((f) => f.produto_id)
  const { data: produtos } = await supabase
    .from('produtos')
    .select('id, empresa_id, nome, descricao, imagem, preco, unidade, estoque_atual, controla_estoque, categoria_id, codigo')
    .in('id', produtoIds)
    .eq('ativo', 1)
    .eq('loja_online', 1)

  const prodMap = new Map((produtos ?? []).map((p) => [String((p as { id: string }).id), p as LojaOnlineProduto]))
  return favs.map((f) => ({ ...f, produto: prodMap.get(f.produto_id) ?? null }))
}

export async function fetchLojaOnlineFavoritoIds(empresaId: string, clienteId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('loja_online_favoritos')
    .select('produto_id')
    .eq('empresa_id', empresaId)
    .eq('cliente_id', clienteId)
  if (error) throw error
  return new Set((data ?? []).map((r) => String((r as { produto_id: string }).produto_id)))
}

export async function toggleLojaOnlineFavorito(input: {
  empresaId: string
  clienteId: string
  produtoId: string
  favorito: boolean
}): Promise<void> {
  if (input.favorito) {
    const { data: exists } = await supabase
      .from('loja_online_favoritos')
      .select('id')
      .eq('empresa_id', input.empresaId)
      .eq('cliente_id', input.clienteId)
      .eq('produto_id', input.produtoId)
      .maybeSingle()
    if (!exists) {
      const { error } = await supabase.from('loja_online_favoritos').insert({
        id: crypto.randomUUID(),
        empresa_id: input.empresaId,
        cliente_id: input.clienteId,
        produto_id: input.produtoId,
      })
      if (error) throw error
    }
  } else {
    const { error } = await supabase
      .from('loja_online_favoritos')
      .delete()
      .eq('empresa_id', input.empresaId)
      .eq('cliente_id', input.clienteId)
      .eq('produto_id', input.produtoId)
    if (error) throw error
  }
}

export async function validateLojaOnlineCartStock(
  empresaId: string,
  items: LojaOnlineCartItem[]
): Promise<string | null> {
  const ids = items.map((i) => i.produtoId)
  const { data, error } = await supabase
    .from('produtos')
    .select('id, nome, estoque_atual, controla_estoque')
    .eq('empresa_id', empresaId)
    .in('id', ids)
  if (error) throw error
  const map = new Map((data ?? []).map((p) => [String((p as { id: string }).id), p as LojaOnlineProduto]))
  const qtdPorProduto = new Map<string, number>()
  for (const item of items) {
    qtdPorProduto.set(item.produtoId, (qtdPorProduto.get(item.produtoId) ?? 0) + item.quantidade)
  }
  for (const item of items) {
    const p = map.get(item.produtoId)
    if (!p) return `Produto "${item.nome}" não está mais disponível.`
    if (p.controla_estoque && (p.estoque_atual ?? 0) < (qtdPorProduto.get(item.produtoId) ?? item.quantidade)) {
      const disp = Math.max(0, p.estoque_atual ?? 0)
      return disp > 0
        ? `Estoque insuficiente para "${p.nome}". Disponível: ${disp}.`
        : `"${p.nome}" está sem estoque.`
    }
  }
  return null
}

export async function fetchLojaOnlineAvaliacoesResumoBatch(
  empresaId: string,
  produtoIds: string[]
): Promise<Map<string, { media: number; total: number }>> {
  const resumo = new Map<string, { media: number; total: number }>()
  if (!produtoIds.length) return resumo

  const { data, error } = await supabase
    .from('loja_online_avaliacoes')
    .select('produto_id, nota')
    .eq('empresa_id', empresaId)
    .in('produto_id', produtoIds)
  if (error) throw error

  const agg = new Map<string, { sum: number; count: number }>()
  for (const row of data ?? []) {
    const id = String((row as { produto_id: string }).produto_id)
    const nota = Number((row as { nota: number }).nota)
    const cur = agg.get(id) ?? { sum: 0, count: 0 }
    cur.sum += nota
    cur.count += 1
    agg.set(id, cur)
  }

  for (const [id, { sum, count }] of agg) {
    resumo.set(id, { media: sum / count, total: count })
  }
  return resumo
}

/** Pedidos que não entram no contador público de “vendidos”. */
const PEDIDO_STATUS_EXCLUIDOS_VENDIDOS: LojaOnlinePedidoStatus[] = [
  'aguardando_pagamento',
  'cancelado',
  'reembolsado',
  'pagamento_recusado',
]

const VENDIDOS_IN_CHUNK = 80

/**
 * Soma quantidade vendida na loja online por produto (pai).
 * Vendas de SKUs filhos são agregadas no produto pai.
 */
export async function fetchLojaOnlineVendidosResumoBatch(
  empresaId: string,
  produtoIds: string[]
): Promise<Map<string, number>> {
  const resumo = new Map<string, number>()
  if (!produtoIds.length) return resumo

  const parents = [...new Set(produtoIds.map(String))]
  for (const id of parents) resumo.set(id, 0)

  const { data: filhos, error: filhosErr } = await supabase
    .from('produtos')
    .select('id, produto_pai_id')
    .eq('empresa_id', empresaId)
    .in('produto_pai_id', parents)
  if (filhosErr) throw filhosErr

  const childToParent = new Map<string, string>()
  for (const row of filhos ?? []) {
    childToParent.set(
      String((row as { id: string }).id),
      String((row as { produto_pai_id: string }).produto_pai_id)
    )
  }

  const allIds = [...new Set([...parents, ...childToParent.keys()])]
  type ItemRow = { produto_id: string; quantidade: number; pedido_id: string }
  const itens: ItemRow[] = []

  for (let i = 0; i < allIds.length; i += VENDIDOS_IN_CHUNK) {
    const chunk = allIds.slice(i, i + VENDIDOS_IN_CHUNK)
    const { data, error } = await supabase
      .from('loja_online_pedido_itens')
      .select('produto_id, quantidade, pedido_id')
      .in('produto_id', chunk)
    if (error) throw error
    for (const row of data ?? []) {
      itens.push({
        produto_id: String((row as ItemRow).produto_id),
        quantidade: Number((row as ItemRow).quantidade) || 0,
        pedido_id: String((row as ItemRow).pedido_id),
      })
    }
  }

  if (itens.length === 0) {
    await somarAjusteVendidos(empresaId, resumo)
    return resumo
  }

  const pedidoIds = [...new Set(itens.map((r) => r.pedido_id))]
  const pedidosValidos = new Set<string>()
  const excludedFilter = `(${PEDIDO_STATUS_EXCLUIDOS_VENDIDOS.join(',')})`

  for (let i = 0; i < pedidoIds.length; i += VENDIDOS_IN_CHUNK) {
    const chunk = pedidoIds.slice(i, i + VENDIDOS_IN_CHUNK)
    const { data, error } = await supabase
      .from('loja_online_pedidos')
      .select('id, status')
      .eq('empresa_id', empresaId)
      .in('id', chunk)
      .not('status', 'in', excludedFilter)
    if (error) throw error
    for (const row of data ?? []) {
      pedidosValidos.add(String((row as { id: string }).id))
    }
  }

  for (const row of itens) {
    if (!pedidosValidos.has(row.pedido_id)) continue
    const target = childToParent.get(row.produto_id) ?? (resumo.has(row.produto_id) ? row.produto_id : null)
    if (!target) continue
    resumo.set(target, (resumo.get(target) ?? 0) + row.quantidade)
  }

  await somarAjusteVendidos(empresaId, resumo)
  for (const [id, qty] of resumo) {
    resumo.set(id, Math.round(qty))
  }
  return resumo
}

/** Soma `produtos.loja_online_vendidos_ajuste` (contador manual) ao total calculado dos pedidos. */
async function somarAjusteVendidos(empresaId: string, resumo: Map<string, number>): Promise<void> {
  const ids = [...resumo.keys()]
  for (let i = 0; i < ids.length; i += VENDIDOS_IN_CHUNK) {
    const chunk = ids.slice(i, i + VENDIDOS_IN_CHUNK)
    const { data, error } = await supabase
      .from('produtos')
      .select('id, loja_online_vendidos_ajuste')
      .eq('empresa_id', empresaId)
      .in('id', chunk)
    if (error) return
    for (const row of data ?? []) {
      const ajuste = Number((row as { loja_online_vendidos_ajuste?: number }).loja_online_vendidos_ajuste) || 0
      if (!ajuste) continue
      const id = String((row as { id: string }).id)
      resumo.set(id, (resumo.get(id) ?? 0) + ajuste)
    }
  }
}

export async function fetchLojaOnlineVendidosCount(
  empresaId: string,
  produtoId: string
): Promise<number> {
  const parentId = String(produtoId)
  const ajusteMap = new Map<string, number>([[parentId, 0]])
  await somarAjusteVendidos(empresaId, ajusteMap)
  const ajuste = ajusteMap.get(parentId) ?? 0

  const { data: filhos } = await supabase
    .from('produtos')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('produto_pai_id', parentId)

  const ids = [parentId, ...(filhos ?? []).map((r) => String((r as { id: string }).id))]

  const { data: itens, error } = await supabase
    .from('loja_online_pedido_itens')
    .select('quantidade, pedido_id')
    .in('produto_id', ids)
  if (error) throw error
  if (!itens?.length) return Math.round(ajuste)

  const pedidoIds = [...new Set(itens.map((r) => String((r as { pedido_id: string }).pedido_id)))]
  const excludedFilter = `(${PEDIDO_STATUS_EXCLUIDOS_VENDIDOS.join(',')})`
  const { data: pedidos, error: pedErr } = await supabase
    .from('loja_online_pedidos')
    .select('id')
    .eq('empresa_id', empresaId)
    .in('id', pedidoIds)
    .not('status', 'in', excludedFilter)
  if (pedErr) throw pedErr

  const valid = new Set((pedidos ?? []).map((r) => String((r as { id: string }).id)))
  let total = 0
  for (const row of itens) {
    if (!valid.has(String((row as { pedido_id: string }).pedido_id))) continue
    total += Number((row as { quantidade: number }).quantidade) || 0
  }
  return Math.round(total + ajuste)
}

export async function fetchLojaOnlineAvaliacoes(
  empresaId: string,
  produtoId: string
): Promise<LojaOnlineAvaliacao[]> {
  const { data, error } = await supabase
    .from('loja_online_avaliacoes')
    .select(
      'id, empresa_id, produto_id, cliente_id, cliente_nome, nota, comentario, midias_json, pedido_id, created_at'
    )
    .eq('empresa_id', empresaId)
    .eq('produto_id', produtoId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) {
    // Coluna midias_json ainda não migrada
    if (isSupabaseMissingColumnError(error)) {
      const legacy = await supabase
        .from('loja_online_avaliacoes')
        .select('id, empresa_id, produto_id, cliente_id, cliente_nome, nota, comentario, created_at')
        .eq('empresa_id', empresaId)
        .eq('produto_id', produtoId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (legacy.error) throw legacy.error
      return (legacy.data ?? []) as LojaOnlineAvaliacao[]
    }
    throw error
  }
  return (data ?? []) as LojaOnlineAvaliacao[]
}

const PEDIDO_STATUS_EXCLUIDOS_AVALIACAO: LojaOnlinePedidoStatus[] = [
  'aguardando_pagamento',
  'cancelado',
  'reembolsado',
  'pagamento_recusado',
]

export type LojaOnlineElegibilidadeAvaliacao = {
  podeAvaliar: boolean
  jaAvaliou: boolean
  comprou: boolean
  pedidoId: string | null
  motivo: string | null
}

/**
 * Só quem recebeu o produto (pedido entregue/retirado) pode avaliar.
 * Variações (SKU filho) contam para o produto pai.
 */
export async function fetchLojaOnlineElegibilidadeAvaliacao(
  empresaId: string,
  produtoId: string,
  clienteId: string,
  pedidoId?: string | null
): Promise<LojaOnlineElegibilidadeAvaliacao> {
  const base: LojaOnlineElegibilidadeAvaliacao = {
    podeAvaliar: false,
    jaAvaliou: false,
    comprou: false,
    pedidoId: null,
    motivo: null,
  }

  const { data: ja, error: jaErr } = await supabase
    .from('loja_online_avaliacoes')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('produto_id', produtoId)
    .eq('cliente_id', clienteId)
    .limit(1)
  if (jaErr) throw jaErr
  if ((ja ?? []).length > 0) {
    return {
      ...base,
      jaAvaliou: true,
      comprou: true,
      motivo: 'Você já avaliou este produto.',
    }
  }

  const { data: filhos, error: filhosErr } = await supabase
    .from('produtos')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('produto_pai_id', produtoId)
  if (filhosErr && !isSupabaseMissingColumnError(filhosErr)) throw filhosErr

  const produtoIds = [
    produtoId,
    ...(filhos ?? []).map((r) => String((r as { id: string }).id)),
  ]

  let pedidosQuery = supabase
    .from('loja_online_pedidos')
    .select('id, status')
    .eq('empresa_id', empresaId)
    .eq('cliente_id', clienteId)
    .not('status', 'in', `(${PEDIDO_STATUS_EXCLUIDOS_AVALIACAO.join(',')})`)
  if (pedidoId) pedidosQuery = pedidosQuery.eq('id', pedidoId)
  const { data: pedidos, error: pedErr } = await pedidosQuery
    .order('created_at', { ascending: false })
    .limit(80)
  if (pedErr) throw pedErr

  const pedidoRows = (pedidos ?? []) as { id: string; status: string }[]
  if (pedidoRows.length === 0) {
    return {
      ...base,
      motivo: 'Só quem comprou este produto pode avaliar.',
    }
  }

  const { data: itens, error: itensErr } = await supabase
    .from('loja_online_pedido_itens')
    .select('pedido_id, produto_id')
    .in('pedido_id', pedidoRows.map((p) => String(p.id)))
    .in('produto_id', produtoIds)
  if (itensErr) throw itensErr

  const pedidosComProduto = new Set(
    ((itens ?? []) as { pedido_id?: string }[]).map((i) => String(i.pedido_id ?? '')).filter(Boolean)
  )
  if (pedidosComProduto.size === 0) {
    return {
      ...base,
      motivo: 'Só quem comprou este produto pode avaliar.',
    }
  }

  const entregue = pedidoRows.find(
    (p) => pedidosComProduto.has(String(p.id)) && normalizePedidoStatus(p.status) === 'entregue'
  )
  if (!entregue) {
    return {
      ...base,
      comprou: true,
      motivo: 'Você poderá avaliar este produto depois que o pedido for entregue.',
    }
  }

  return {
    podeAvaliar: true,
    jaAvaliou: false,
    comprou: true,
    pedidoId: String(entregue.id),
    motivo: null,
  }
}

export type LojaOnlinePedidoAvaliacaoInfo = {
  /** produto_id do item (pode ser variação) → produto pai que recebe a avaliação */
  produtoAvaliadoPorItem: Record<string, string>
  produtosJaAvaliados: Set<string>
}

/** Resolve o produto pai de cada item do pedido e quais o cliente já avaliou. */
export async function fetchLojaOnlinePedidoAvaliacaoInfo(
  empresaId: string,
  clienteId: string,
  itemProdutoIds: string[]
): Promise<LojaOnlinePedidoAvaliacaoInfo> {
  const ids = [...new Set(itemProdutoIds.filter(Boolean))]
  const produtoAvaliadoPorItem: Record<string, string> = {}
  for (const id of ids) produtoAvaliadoPorItem[id] = id
  if (ids.length === 0) return { produtoAvaliadoPorItem, produtosJaAvaliados: new Set() }

  const { data: produtos, error: prodErr } = await supabase
    .from('produtos')
    .select('id, produto_pai_id')
    .eq('empresa_id', empresaId)
    .in('id', ids)
  if (prodErr && !isSupabaseMissingColumnError(prodErr)) throw prodErr
  for (const row of (produtos ?? []) as { id: string; produto_pai_id?: string | null }[]) {
    if (row.produto_pai_id) produtoAvaliadoPorItem[String(row.id)] = String(row.produto_pai_id)
  }

  const alvos = [...new Set(Object.values(produtoAvaliadoPorItem))]
  const { data: avaliacoes, error: avErr } = await supabase
    .from('loja_online_avaliacoes')
    .select('produto_id')
    .eq('empresa_id', empresaId)
    .eq('cliente_id', clienteId)
    .in('produto_id', alvos)
  if (avErr) throw avErr

  return {
    produtoAvaliadoPorItem,
    produtosJaAvaliados: new Set(
      ((avaliacoes ?? []) as { produto_id: string }[]).map((a) => String(a.produto_id))
    ),
  }
}

export async function createLojaOnlineAvaliacao(input: {
  empresaId: string
  produtoId: string
  clienteId: string
  clienteNome: string
  nota: number
  comentario: string | null
  midias?: LojaOnlineMidia[]
  pedidoId?: string | null
}): Promise<LojaOnlineAvaliacao> {
  const elegivel = await fetchLojaOnlineElegibilidadeAvaliacao(
    input.empresaId,
    input.produtoId,
    input.clienteId,
    input.pedidoId
  )
  if (elegivel.jaAvaliou) {
    throw new Error('Você já avaliou este produto.')
  }
  if (!elegivel.podeAvaliar) {
    throw new Error(elegivel.motivo || 'Só quem comprou este produto pode avaliar.')
  }

  const midias = (input.midias ?? [])
    .map((m) => ({
      tipo: m.tipo === 'video' ? ('video' as const) : ('image' as const),
      url: m.url.trim(),
    }))
    .filter((m) => m.url)
  if (midias.filter((m) => m.tipo === 'video').length > 1) {
    throw new Error('Envie no máximo 1 vídeo por avaliação.')
  }
  if (midias.length > 6) {
    throw new Error('Envie no máximo 6 fotos/vídeos por avaliação.')
  }

  const nota = Math.min(5, Math.max(1, Math.round(input.nota)))
  const midiasJson = serializeLojaOnlineAvaliacaoMidias(midias)
  const row = {
    id: crypto.randomUUID(),
    empresa_id: input.empresaId,
    produto_id: input.produtoId,
    cliente_id: input.clienteId,
    cliente_nome: input.clienteNome.trim(),
    nota,
    comentario: input.comentario?.trim() || null,
    midias_json: midiasJson,
    pedido_id: input.pedidoId?.trim() || elegivel.pedidoId,
  }

  const { data, error } = await supabase
    .from('loja_online_avaliacoes')
    .insert(row)
    .select(
      'id, empresa_id, produto_id, cliente_id, cliente_nome, nota, comentario, midias_json, pedido_id, created_at'
    )
    .single()

  if (error) {
    if (isSupabaseMissingColumnError(error)) {
      const { midias_json: _m, pedido_id: _p, ...legacyRow } = row
      const legacy = await supabase
        .from('loja_online_avaliacoes')
        .insert(legacyRow)
        .select('id, empresa_id, produto_id, cliente_id, cliente_nome, nota, comentario, created_at')
        .single()
      if (legacy.error) throw legacy.error
      return legacy.data as LojaOnlineAvaliacao
    }
    if (error.code === '23505') {
      throw new Error('Você já avaliou este produto.')
    }
    throw error
  }
  return data as LojaOnlineAvaliacao
}
