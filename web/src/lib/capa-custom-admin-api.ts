import { supabase } from './supabase'
import { invalidateLojaOnlineCatalogCache } from './loja-online-catalog-cache'
import { invalidateProdutosCaches } from './web-electron-api'
import { fetchProdutoVariacoesFilhos, saveProdutoVariacoes } from './produto-variacoes-api'
import { variacaoChave, type VariacaoEixo } from './produto-variacoes'
import { CAPA_EIXO_ID, capaModeloIdDoSku } from '../capa-custom/lib/capa-catalogo'
import { PHONE_MODELS } from '../capa-custom/phoneModels'

export type CapaModeloConfig = {
  modelId: string
  ativo: boolean
  preco: number
  estoque: number
  sku: string
  codigoBarras: string
}

export type CapaProdutoAdmin = {
  id: string
  nome: string
  descricao: string | null
  imagem: string | null
  controlaEstoque: boolean
  lojaOnline: boolean
  ativo: boolean
  modelos: CapaModeloConfig[]
}

export type CapaDesignStatus = 'rascunho' | 'pedido' | 'produzido' | 'cancelado'

export type CapaDesignAdmin = {
  id: string
  modelo_nome: string
  preview_url: string | null
  print_url: string | null
  print_largura: number | null
  print_altura: number | null
  print_dpi: number | null
  assets_json: string[] | null
  status: CapaDesignStatus
  pedido_id: string | null
  created_at: string
}

const PARENT_COLUMNS =
  'id, empresa_id, nome, custo, markup, unidade, controla_estoque, estoque_minimo, ncm, cfop, fornecedor_id, categoria_id, marca_id, descricao, imagem, permitir_resgate_cashback_no_produto, cashback_observacao, loja_online, ativo'

function capaEixo(): VariacaoEixo {
  return {
    id: CAPA_EIXO_ID,
    nome: 'Modelo',
    tipo: 'texto',
    dependeDeEixoId: null,
    valores: PHONE_MODELS.map((m) => ({ id: m.id, nome: m.name })),
  }
}

function isMissingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = (error.message ?? '').toLowerCase()
  return error.code === '42P01' || error.code === 'PGRST205' || msg.includes('does not exist') || msg.includes('could not find the table')
}

/** Produto "Capa personalizada" da empresa (identificado pelo eixo de variação fixo). */
export async function fetchCapaCustomProduto(empresaId: string): Promise<CapaProdutoAdmin | null> {
  const { data, error } = await supabase
    .from('produtos')
    .select('id, nome, descricao, imagem, controla_estoque, loja_online, ativo')
    .eq('empresa_id', empresaId)
    .is('produto_pai_id', null)
    .ilike('variacao_eixos_json', `%${CAPA_EIXO_ID}%`)
    .order('ativo', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const filhos = await fetchProdutoVariacoesFilhos(String(data.id))
  const byModel = new Map(filhos.map((f) => [capaModeloIdDoSku(f.variacao_valores_json), f]))

  return {
    id: String(data.id),
    nome: String(data.nome ?? ''),
    descricao: (data.descricao as string | null) ?? null,
    imagem: (data.imagem as string | null) ?? null,
    controlaEstoque: Number(data.controla_estoque) === 1,
    lojaOnline: Number(data.loja_online) === 1,
    ativo: Number(data.ativo) === 1,
    modelos: PHONE_MODELS.map((m) => {
      const f = byModel.get(m.id)
      return {
        modelId: m.id,
        ativo: f ? Number(f.ativo) === 1 : false,
        preco: f ? Number(f.preco) || 0 : 0,
        estoque: f ? Number(f.estoque_atual) || 0 : 0,
        sku: f?.sku ?? '',
        codigoBarras: f?.codigo_barras ?? '',
      }
    }),
  }
}

async function nextCodigo(empresaId: string): Promise<number> {
  const { data, error } = await supabase
    .from('produtos')
    .select('codigo')
    .eq('empresa_id', empresaId)
    .not('codigo', 'is', null)
    .order('codigo', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (Number(data?.codigo) || 0) + 1
}

export async function createCapaCustomProduto(input: {
  empresaId: string
  nome: string
  precoPadrao: number
  estoquePadrao: number
  controlaEstoque: boolean
}): Promise<CapaProdutoAdmin> {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const { error } = await supabase.from('produtos').insert({
    id,
    empresa_id: input.empresaId,
    codigo: await nextCodigo(input.empresaId),
    nome: input.nome.trim() || 'Capa personalizada',
    descricao:
      'Crie uma capa única com as suas fotos, frases e cores. Escolha o modelo do seu celular, monte a arte no editor e receba em casa.',
    preco: input.precoPadrao,
    custo: 0,
    markup: 0,
    unidade: 'UN',
    controla_estoque: input.controlaEstoque ? 1 : 0,
    estoque_minimo: 0,
    ativo: 1,
    loja_online: 1,
    variacao_eixos_json: JSON.stringify({ eixos: [capaEixo()] }),
    created_at: now,
    updated_at: now,
  })
  if (error) throw error

  await saveCapaCustomProduto({
    empresaId: input.empresaId,
    produtoId: id,
    nome: input.nome.trim() || 'Capa personalizada',
    descricao: null,
    controlaEstoque: input.controlaEstoque,
    lojaOnline: true,
    modelos: PHONE_MODELS.map((m) => ({
      modelId: m.id,
      ativo: true,
      preco: input.precoPadrao,
      estoque: input.estoquePadrao,
      sku: '',
      codigoBarras: '',
    })),
    manterDescricao: true,
  })

  const created = await fetchCapaCustomProduto(input.empresaId)
  if (!created) throw new Error('Produto criado, mas não foi possível carregá-lo.')
  return created
}

/** Salva dados do produto e cria/atualiza um SKU por modelo com preço, estoque e visibilidade. */
export async function saveCapaCustomProduto(input: {
  empresaId: string
  produtoId: string
  nome: string
  descricao: string | null
  controlaEstoque: boolean
  lojaOnline: boolean
  modelos: CapaModeloConfig[]
  manterDescricao?: boolean
}): Promise<void> {
  const ativos = input.modelos.filter((m) => m.ativo)
  const precoMin = ativos.length ? Math.min(...ativos.map((m) => m.preco)) : 0

  const patch: Record<string, unknown> = {
    nome: input.nome.trim() || 'Capa personalizada',
    controla_estoque: input.controlaEstoque ? 1 : 0,
    loja_online: input.lojaOnline ? 1 : 0,
    preco: precoMin,
    updated_at: new Date().toISOString(),
  }
  if (!input.manterDescricao) patch.descricao = input.descricao?.trim() || null

  const { data: parent, error } = await supabase
    .from('produtos')
    .update(patch)
    .eq('id', input.produtoId)
    .eq('empresa_id', input.empresaId)
    .select(PARENT_COLUMNS)
    .single()
  if (error) throw error

  const p = parent as Record<string, unknown>
  const eixos = [capaEixo()]
  await saveProdutoVariacoes({
    parent: {
      id: String(p.id),
      empresa_id: String(p.empresa_id),
      nome: String(p.nome ?? ''),
      custo: Number(p.custo) || 0,
      markup: Number(p.markup) || 0,
      unidade: String(p.unidade || 'UN'),
      controla_estoque: Number(p.controla_estoque) === 1 ? 1 : 0,
      estoque_minimo: Number(p.estoque_minimo) || 0,
      ncm: (p.ncm as string | null) ?? null,
      cfop: (p.cfop as string | null) ?? null,
      fornecedor_id: (p.fornecedor_id as string | null) ?? null,
      categoria_id: (p.categoria_id as string | null) ?? null,
      marca_id: (p.marca_id as string | null) ?? null,
      descricao: (p.descricao as string | null) ?? null,
      imagem: (p.imagem as string | null) ?? null,
      permitir_resgate_cashback_no_produto: Number(p.permitir_resgate_cashback_no_produto) || 0,
      cashback_observacao: (p.cashback_observacao as string | null) ?? null,
    },
    eixos,
    skus: input.modelos.map((m) => {
      const valores = { [CAPA_EIXO_ID]: m.modelId }
      return {
        chave: variacaoChave(valores),
        valores,
        ativo: m.ativo,
        sku: m.sku,
        codigo_barras: m.codigoBarras,
        preco: Math.max(0, m.preco),
        estoque: Math.max(0, Math.round(m.estoque)),
      }
    }),
  })

  invalidateProdutosCaches(input.empresaId)
  invalidateLojaOnlineCatalogCache(input.empresaId)
}

/** Artes ligadas a pedidos (as que ficaram só no carrinho não entram). */
export async function fetchCapaDesignsDePedidos(
  empresaId: string
): Promise<{ designs: CapaDesignAdmin[]; tabelaAusente: boolean }> {
  const { data, error } = await supabase
    .from('loja_online_capa_designs')
    .select('id, modelo_nome, preview_url, print_url, print_largura, print_altura, print_dpi, assets_json, status, pedido_id, created_at')
    .eq('empresa_id', empresaId)
    .not('pedido_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) {
    if (isMissingRelation(error)) return { designs: [], tabelaAusente: true }
    throw error
  }
  return { designs: (data ?? []) as CapaDesignAdmin[], tabelaAusente: false }
}

export async function updateCapaDesignStatus(id: string, status: CapaDesignStatus): Promise<void> {
  const { error } = await supabase.from('loja_online_capa_designs').update({ status }).eq('id', id)
  if (error) throw error
}
