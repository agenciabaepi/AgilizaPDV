import { supabase } from './supabase'
import { invalidateLojaOnlineCatalogCache } from './loja-online-catalog-cache'
import { invalidateProdutosCaches } from './web-electron-api'
import {
  labelCombinacao,
  nomeProdutoVariacao,
  parseVariacaoValores,
  serializeVariacaoEixos,
  type VariacaoEixo,
  type VariacaoSkuDraft,
} from './produto-variacoes'

const MSG_MIGRACAO_VARIACOES =
  'Para usar variações, execute o SQL web/sql/supabase-produtos-variacoes.sql no Supabase (SQL Editor).'

function isMissingColumnError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = (error.message ?? '').toLowerCase()
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    msg.includes('does not exist') ||
    (msg.includes('column') && msg.includes('schema'))
  )
}

export type ProdutoVariacaoRow = {
  id: string
  nome: string
  sku: string | null
  codigo_barras?: string | null
  preco: number
  estoque_atual: number
  ativo: number
  imagem: string | null
  controla_estoque: number
  unidade: string
  variacao_chave: string | null
  variacao_valores_json: string | null
  produto_pai_id: string | null
}

type ParentSnapshot = {
  id: string
  empresa_id: string
  nome: string
  custo: number
  markup: number
  unidade: string
  controla_estoque: number
  estoque_minimo: number
  ncm: string | null
  cfop: string | null
  fornecedor_id: string | null
  categoria_id: string | null
  marca_id: string | null
  descricao: string | null
  imagem: string | null
  permitir_resgate_cashback_no_produto: number
  cashback_observacao: string | null
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

async function ajustarSaldo(empresaId: string, produtoId: string, novoSaldo: number): Promise<void> {
  const { data: movs, error } = await supabase
    .from('estoque_movimentos')
    .select('tipo, quantidade')
    .eq('empresa_id', empresaId)
    .eq('produto_id', produtoId)
  if (error) throw error
  let saldo = 0
  for (const m of movs ?? []) {
    const q = Number((m as { quantidade: number }).quantidade)
    const tipo = String((m as { tipo: string }).tipo)
    if (tipo === 'ENTRADA' || tipo === 'DEVOLUCAO') saldo += q
    else saldo -= q
  }
  const delta = novoSaldo - saldo
  if (delta === 0) {
    await supabase.from('produtos').update({ estoque_atual: novoSaldo }).eq('id', produtoId)
    return
  }
  const { error: insErr } = await supabase.from('estoque_movimentos').insert({
    id: crypto.randomUUID(),
    empresa_id: empresaId,
    produto_id: produtoId,
    tipo: 'AJUSTE',
    quantidade: delta,
    created_at: new Date().toISOString(),
  })
  if (insErr) throw insErr
  const { error: upErr } = await supabase
    .from('produtos')
    .update({ estoque_atual: novoSaldo })
    .eq('id', produtoId)
    .eq('empresa_id', empresaId)
  if (upErr) throw upErr
}

export async function fetchProdutoVariacoesFilhos(parentId: string): Promise<ProdutoVariacaoRow[]> {
  const { data, error } = await supabase
    .from('produtos')
    .select(
      'id, nome, sku, codigo_barras, preco, estoque_atual, ativo, imagem, controla_estoque, unidade, variacao_chave, variacao_valores_json, produto_pai_id'
    )
    .eq('produto_pai_id', parentId)
    .order('nome')
  if (error) {
    const msg = (error.message ?? '').toLowerCase()
    if (error.code === '42703' || msg.includes('does not exist')) return []
    throw error
  }
  return (data ?? []) as ProdutoVariacaoRow[]
}

export function filhosParaSkus(filhos: ProdutoVariacaoRow[]): VariacaoSkuDraft[] {
  return filhos.map((f) => ({
    id: f.id,
    chave: f.variacao_chave || '',
    valores: parseVariacaoValores(f.variacao_valores_json),
    ativo: Number(f.ativo) === 1,
    sku: f.sku ?? '',
    codigo_barras: '',
    preco: Number(f.preco) || 0,
    estoque: Number(f.estoque_atual) || 0,
  }))
}

export async function saveProdutoVariacoes(params: {
  parent: ParentSnapshot
  eixos: VariacaoEixo[]
  skus: VariacaoSkuDraft[]
}): Promise<void> {
  const { parent, eixos, skus } = params
  const eixosJson = serializeVariacaoEixos(eixos)
  const temVariacoes = Boolean(eixosJson) || skus.some((s) => s.ativo)

  if (!temVariacoes) {
    const existing = await fetchProdutoVariacoesFilhos(parent.id)
    if (existing.length === 0) return
  }

  const now = new Date().toISOString()

  const { error: parentErr } = await supabase
    .from('produtos')
    .update({
      variacao_eixos_json: eixosJson,
      updated_at: now,
    })
    .eq('id', parent.id)
    .eq('empresa_id', parent.empresa_id)
  if (parentErr) {
    if (isMissingColumnError(parentErr)) throw new Error(MSG_MIGRACAO_VARIACOES)
    throw parentErr
  }

  const existing = await fetchProdutoVariacoesFilhos(parent.id)
  const existingByChave = new Map(existing.filter((f) => f.variacao_chave).map((f) => [f.variacao_chave as string, f]))
  const keptChaves = new Set(skus.map((s) => s.chave))

  let codigo = await nextCodigo(parent.empresa_id)

  for (const sku of skus) {
    const nome = nomeProdutoVariacao(parent.nome, eixos, sku.valores)
    const valoresJson = JSON.stringify(sku.valores)
    const row = existingByChave.get(sku.chave)

    if (row) {
      const { error } = await supabase
        .from('produtos')
        .update({
          nome,
          sku: sku.sku.trim() || null,
          preco: sku.preco,
          ativo: sku.ativo ? 1 : 0,
          loja_online: 0,
          controla_estoque: parent.controla_estoque,
          estoque_minimo: parent.estoque_minimo,
          custo: parent.custo,
          markup: parent.markup,
          unidade: parent.unidade,
          ncm: parent.ncm,
          cfop: parent.cfop,
          fornecedor_id: parent.fornecedor_id,
          categoria_id: parent.categoria_id,
          marca_id: parent.marca_id,
          descricao: parent.descricao,
          imagem: parent.imagem,
          variacao_valores_json: valoresJson,
          variacao_chave: sku.chave,
          produto_pai_id: parent.id,
          updated_at: now,
        })
        .eq('id', row.id)
      if (error) {
        if (isMissingColumnError(error)) throw new Error(MSG_MIGRACAO_VARIACOES)
        throw error
      }
      if (parent.controla_estoque === 1 && sku.ativo) {
        await ajustarSaldo(parent.empresa_id, row.id, sku.estoque)
      }
      continue
    }

    if (!sku.ativo) continue

    const id = crypto.randomUUID()
    const { error } = await supabase.from('produtos').insert({
      id,
      empresa_id: parent.empresa_id,
      codigo,
      nome,
      sku: sku.sku.trim() || null,
      preco: sku.preco,
      custo: parent.custo,
      markup: parent.markup,
      unidade: parent.unidade,
      controla_estoque: parent.controla_estoque,
      estoque_minimo: parent.estoque_minimo,
      ativo: 1,
      loja_online: 0,
      ncm: parent.ncm,
      cfop: parent.cfop,
      fornecedor_id: parent.fornecedor_id,
      categoria_id: parent.categoria_id,
      marca_id: parent.marca_id,
      descricao: parent.descricao,
      imagem: parent.imagem,
      permitir_resgate_cashback_no_produto: parent.permitir_resgate_cashback_no_produto,
      cashback_observacao: parent.cashback_observacao,
      produto_pai_id: parent.id,
      variacao_valores_json: valoresJson,
      variacao_chave: sku.chave,
      estoque_atual: 0,
      created_at: now,
      updated_at: now,
    })
    if (error) {
      if (isMissingColumnError(error)) throw new Error(MSG_MIGRACAO_VARIACOES)
      throw error
    }
    codigo += 1
    if (parent.controla_estoque === 1 && sku.estoque !== 0) {
      await ajustarSaldo(parent.empresa_id, id, sku.estoque)
    }
  }

  for (const row of existing) {
    const chave = row.variacao_chave
    if (chave && keptChaves.has(chave)) continue
    const { error } = await supabase
      .from('produtos')
      .update({ ativo: 0, loja_online: 0, updated_at: now })
      .eq('id', row.id)
    if (error) throw error
  }

  invalidateProdutosCaches(parent.empresa_id)
  invalidateLojaOnlineCatalogCache(parent.empresa_id)
}

export function labelSkuLoja(eixos: VariacaoEixo[], valoresJson: string | null): string {
  return labelCombinacao(eixos, parseVariacaoValores(valoresJson))
}
