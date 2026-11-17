import { supabase } from './supabase'
import { invalidateLojaOnlineCatalogCache } from './loja-online-catalog-cache'

export type DevolucaoItemPreview = {
  produto_id: string
  descricao: string
  quantidade_vendida: number
  quantidade_ja_devolvida: number
  quantidade_disponivel: number
  preco_unitario_liquido: number
  controla_estoque: boolean
  custo: number
}

export type DevolucaoPreview = {
  venda_id: string
  venda_numero: number
  empresa_id: string
  status: string
  created_at: string
  total_venda: number
  itens: DevolucaoItemPreview[]
}

export type DevolverVendaItemInput = {
  produto_id: string
  quantidade: number
}

export type DevolverVendaInput = {
  empresa_id: string
  venda_id: string
  usuario_id: string
  itens: DevolverVendaItemInput[]
  /** Registra sangria no caixa aberto com o valor proporcional dos itens devolvidos */
  estornar_caixa?: boolean
}

export type DevolverVendaResult = {
  movimentos: number
  valor_estornado: number
  sangria_registrada: boolean
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

async function getSaldoProduto(empresaId: string, produtoId: string): Promise<number> {
  const { data, error } = await supabase
    .from('estoque_movimentos')
    .select('tipo, quantidade')
    .eq('empresa_id', empresaId)
    .eq('produto_id', produtoId)
  if (error) throw error
  let acc = 0
  for (const row of data ?? []) {
    const tipo = String((row as { tipo?: string }).tipo ?? '')
    const q = Number((row as { quantidade?: unknown }).quantidade)
    if (!Number.isFinite(q)) continue
    if (tipo === 'ENTRADA' || tipo === 'DEVOLUCAO') acc += q
    else if (tipo === 'SAIDA') acc -= q
    else if (tipo === 'AJUSTE') acc += q
  }
  return acc
}

export async function loadDevolucaoPreview(vendaId: string): Promise<DevolucaoPreview> {
  const { data: venda, error: vErr } = await supabase
    .from('vendas')
    .select('id, empresa_id, numero, status, total, created_at')
    .eq('id', vendaId)
    .maybeSingle()
  if (vErr) throw vErr
  if (!venda) throw new Error('Venda não encontrada.')

  const { data: itens, error: iErr } = await supabase
    .from('venda_itens')
    .select('produto_id, descricao, quantidade, total')
    .eq('venda_id', vendaId)
  if (iErr) throw iErr

  const { data: devolvidos, error: dErr } = await supabase
    .from('estoque_movimentos')
    .select('produto_id, quantidade')
    .eq('empresa_id', String(venda.empresa_id))
    .eq('tipo', 'DEVOLUCAO')
    .eq('referencia_tipo', 'VENDA')
    .eq('referencia_id', vendaId)
  if (dErr) throw dErr

  const jaDevMap = new Map<string, number>()
  for (const row of devolvidos ?? []) {
    const pid = String((row as { produto_id: string }).produto_id)
    const q = Number((row as { quantidade: number }).quantidade) || 0
    jaDevMap.set(pid, (jaDevMap.get(pid) ?? 0) + q)
  }

  type AccItem = {
    produto_id: string
    descricao: string
    quantidade_vendida: number
    total: number
  }
  const byProduto = new Map<string, AccItem>()
  for (const raw of itens ?? []) {
    const item = raw as {
      produto_id: string | null
      descricao: string
      quantidade: number
      total: number
    }
    if (!item.produto_id) continue
    const pid = String(item.produto_id)
    const acc = byProduto.get(pid) ?? {
      produto_id: pid,
      descricao: String(item.descricao || 'Produto'),
      quantidade_vendida: 0,
      total: 0,
    }
    acc.quantidade_vendida += Number(item.quantidade) || 0
    acc.total += Number(item.total) || 0
    if (item.descricao) acc.descricao = String(item.descricao)
    byProduto.set(pid, acc)
  }

  const produtoIds = [...byProduto.keys()]
  const prodMap = new Map<string, { controla_estoque: number; custo: number }>()
  if (produtoIds.length > 0) {
    const { data: produtos, error: pErr } = await supabase
      .from('produtos')
      .select('id, controla_estoque, custo')
      .in('id', produtoIds)
    if (pErr) throw pErr
    for (const p of produtos ?? []) {
      prodMap.set(String((p as { id: string }).id), {
        controla_estoque: Number((p as { controla_estoque: number }).controla_estoque) || 0,
        custo: Number((p as { custo: number }).custo) || 0,
      })
    }
  }

  const previewItens: DevolucaoItemPreview[] = [...byProduto.values()].map((acc) => {
    const ja = jaDevMap.get(acc.produto_id) ?? 0
    const disponivel = Math.max(0, round2(acc.quantidade_vendida - ja))
    const prod = prodMap.get(acc.produto_id)
    const precoLiq =
      acc.quantidade_vendida > 0 ? round2(acc.total / acc.quantidade_vendida) : 0
    return {
      produto_id: acc.produto_id,
      descricao: acc.descricao,
      quantidade_vendida: acc.quantidade_vendida,
      quantidade_ja_devolvida: ja,
      quantidade_disponivel: disponivel,
      preco_unitario_liquido: precoLiq,
      controla_estoque: Number(prod?.controla_estoque) === 1,
      custo: Number(prod?.custo) || 0,
    }
  })

  return {
    venda_id: String(venda.id),
    venda_numero: Number(venda.numero) || 0,
    empresa_id: String(venda.empresa_id),
    status: String(venda.status),
    created_at: String(venda.created_at),
    total_venda: Number(venda.total) || 0,
    itens: previewItens,
  }
}

export async function devolverVenda(input: DevolverVendaInput): Promise<DevolverVendaResult> {
  if (!input.itens.length) throw new Error('Selecione ao menos um item para devolver.')

  const preview = await loadDevolucaoPreview(input.venda_id)
  if (preview.empresa_id !== input.empresa_id) {
    throw new Error('Venda não pertence a esta empresa.')
  }
  if (preview.status !== 'CONCLUIDA') {
    throw new Error('Só é possível devolver vendas concluídas.')
  }

  const previewMap = new Map(preview.itens.map((i) => [i.produto_id, i]))
  const toProcess: { item: DevolucaoItemPreview; quantidade: number }[] = []

  for (const req of input.itens) {
    const qty = Number(req.quantidade)
    if (!Number.isFinite(qty) || qty <= 0) continue
    const base = previewMap.get(req.produto_id)
    if (!base) throw new Error('Item não encontrado na venda.')
    if (qty > base.quantidade_disponivel + 0.0001) {
      throw new Error(
        `Quantidade inválida para "${base.descricao}". Disponível: ${base.quantidade_disponivel}.`
      )
    }
    toProcess.push({ item: base, quantidade: qty })
  }

  if (toProcess.length === 0) {
    throw new Error('Informe a quantidade a devolver em ao menos um item.')
  }

  let movimentos = 0
  let valorEstornado = 0
  const now = new Date().toISOString()

  for (const { item, quantidade } of toProcess) {
    valorEstornado += quantidade * item.preco_unitario_liquido

    if (!item.controla_estoque) continue

    const { error } = await supabase.from('estoque_movimentos').insert({
      id: crypto.randomUUID(),
      empresa_id: input.empresa_id,
      produto_id: item.produto_id,
      tipo: 'DEVOLUCAO',
      quantidade,
      custo_unitario: item.custo,
      referencia_tipo: 'VENDA',
      referencia_id: input.venda_id,
      usuario_id: input.usuario_id,
      created_at: now,
    })
    if (error) throw new Error(`Falha ao registrar devolução de estoque: ${error.message}`)

    const novoSaldo = await getSaldoProduto(input.empresa_id, item.produto_id)
    const { error: upErr } = await supabase
      .from('produtos')
      .update({ estoque_atual: novoSaldo })
      .eq('id', item.produto_id)
      .eq('empresa_id', input.empresa_id)
    if (upErr) throw upErr

    movimentos += 1
  }

  valorEstornado = round2(valorEstornado)
  let sangriaRegistrada = false

  if (input.estornar_caixa && valorEstornado > 0) {
    const { data: caixa, error: cxErr } = await supabase
      .from('caixas')
      .select('id, status')
      .eq('empresa_id', input.empresa_id)
      .eq('status', 'ABERTO')
      .order('aberto_em', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (cxErr) throw cxErr
    if (!caixa?.id) {
      throw new Error('Não há caixa aberto para registrar o estorno. Abra o caixa ou desmarque o estorno.')
    }

    const { error: sangriaErr } = await supabase.from('caixa_movimentos').insert({
      id: crypto.randomUUID(),
      empresa_id: input.empresa_id,
      caixa_id: caixa.id,
      tipo: 'SANGRIA',
      valor: valorEstornado,
      motivo: `Devolução venda #${preview.venda_numero}`,
      usuario_id: input.usuario_id,
      created_at: now,
    })
    if (sangriaErr) throw new Error(`Estoque devolvido, mas falhou o estorno no caixa: ${sangriaErr.message}`)
    sangriaRegistrada = true
  }

  if (movimentos > 0) invalidateLojaOnlineCatalogCache(input.empresa_id)

  return {
    movimentos,
    valor_estornado: valorEstornado,
    sangria_registrada: sangriaRegistrada,
  }
}
