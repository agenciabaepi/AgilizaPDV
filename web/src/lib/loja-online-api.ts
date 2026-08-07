import { supabase } from './supabase'
import { hashSenhaWeb, verificarSenhaWeb } from './web-crypto'
import {
  cartTotal as calcTotal,
  pedidoElegivelParaVenda,
  pedidoPrecisaAcaoAdmin,
  pedidoTotalLiquido,
  type LojaOnlineCartItem,
  type LojaOnlineCategoria,
  type LojaOnlineClienteSession,
  type LojaOnlineCupom,
  type LojaOnlineFavorito,
  type LojaOnlinePedido,
  type LojaOnlinePedidoItem,
  type LojaOnlinePedidoItemComImagem,
  type LojaOnlineProduto,
  type LojaOnlineAvaliacao,
  type LojaOnlineStoreConfig,
} from './loja-online-types'
import {
  normalizePedido,
  statusInicialPedido,
  type LojaOnlinePedidoStatus,
} from './loja-online-pedido-status'
import {
  debitarCashbackOnline,
  ensureClientePdvForOnline,
  gerarCashbackPedidoOnline,
  normalizeDocDigits,
} from './loja-online-cashback'
import { formaPagamentoFromPedidoOnline } from './pagamento-meio'

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
  loja_online_categorias_titulo,
  loja_online_cards_config_json,
  loja_online_seo_titulo, loja_online_seo_descricao,
  loja_online_politica_privacidade, loja_online_termos_uso,
  loja_online_politica_trocas, loja_online_politica_entrega,
  loja_online_ga4_id, loja_online_meta_pixel_id, loja_online_dominio_custom,
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

export async function fetchLojaOnlineStore(slug: string): Promise<LojaOnlineStoreConfig | null> {
  const run = (select: string) =>
    supabase
      .from('empresas_config')
      .select(select)
      .eq('loja_online_slug', slug)
      .eq('loja_online_ativa', 1)
      .maybeSingle()

  const full = await run(STORE_SELECT)
  if (!full.error) return full.data as LojaOnlineStoreConfig | null

  if (isSupabaseMissingColumnError(full.error)) {
    const legacy = await run(STORE_SELECT_LEGACY)
    if (!legacy.error) return legacy.data as LojaOnlineStoreConfig | null
    if (isSupabaseMissingColumnError(legacy.error)) {
      const minimal = await run(STORE_SELECT_LEGACY_MINIMAL)
      if (minimal.error) throw minimal.error
      return minimal.data as LojaOnlineStoreConfig | null
    }
    throw legacy.error
  }

  throw full.error
}

const PRODUTO_SELECT =
  'id, empresa_id, nome, descricao, imagem, preco, unidade, estoque_atual, controla_estoque, categoria_id, codigo, marca_id, marcas(nome), loja_online_destaque, loja_online_destaque_ordem, loja_online_imagens_json, loja_online_preco_de, loja_online_card_json'

const PRODUTO_SELECT_SEM_MARCA =
  'id, empresa_id, nome, descricao, imagem, preco, unidade, estoque_atual, controla_estoque, categoria_id, codigo, loja_online_destaque, loja_online_destaque_ordem, loja_online_imagens_json, loja_online_preco_de, loja_online_card_json'

const PRODUTO_SELECT_LEGACY =
  'id, empresa_id, nome, descricao, imagem, preco, unidade, estoque_atual, controla_estoque, categoria_id, codigo, loja_online_destaque, loja_online_destaque_ordem, loja_online_imagens_json'

async function fetchProdutosQuery(
  empresaId: string,
  select: string,
  options: { destaqueOnly: boolean }
) {
  let query = supabase
    .from('produtos')
    .select(select)
    .eq('empresa_id', empresaId)
    .eq('ativo', 1)
    .eq('loja_online', 1)

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

async function fetchProdutosList(
  empresaId: string,
  ocultarSemEstoque: boolean,
  destaqueOnly: boolean
): Promise<LojaOnlineProduto[]> {
  let result = await fetchProdutosQuery(empresaId, PRODUTO_SELECT, { destaqueOnly })
  if (result.error && isSupabaseMissingColumnError(result.error)) {
    result = await fetchProdutosQuery(empresaId, PRODUTO_SELECT_SEM_MARCA, { destaqueOnly })
  }
  if (result.error && isSupabaseMissingColumnError(result.error)) {
    result = await fetchProdutosQuery(empresaId, PRODUTO_SELECT_LEGACY, { destaqueOnly })
  }
  if (result.error) throw result.error

  let list = (result.data ?? []) as LojaOnlineProduto[]
  if (ocultarSemEstoque) {
    list = list.filter((p) => !p.controla_estoque || (p.estoque_atual ?? 0) > 0)
  }
  return list
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

export async function fetchLojaOnlineProduto(
  empresaId: string,
  produtoId: string
): Promise<LojaOnlineProduto | null> {
  const run = (select: string) =>
    supabase
      .from('produtos')
      .select(select)
      .eq('empresa_id', empresaId)
      .eq('id', produtoId)
      .eq('ativo', 1)
      .eq('loja_online', 1)
      .maybeSingle()

  let result = await run(PRODUTO_SELECT)
  if (result.error && isSupabaseMissingColumnError(result.error)) {
    result = await run(PRODUTO_SELECT_SEM_MARCA)
  }
  if (result.error && isSupabaseMissingColumnError(result.error)) {
    result = await run(PRODUTO_SELECT_LEGACY)
  }
  if (result.error) throw result.error
  return result.data as LojaOnlineProduto | null
}

export async function fetchLojaOnlineCategorias(empresaId: string): Promise<LojaOnlineCategoria[]> {
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
  telefone?: string
  endereco?: string
  cpf_cnpj?: string
  cep?: string
}): Promise<LojaOnlineClienteSession> {
  const email = input.email.trim().toLowerCase()
  const cpfNorm = normalizeDocDigits(input.cpf_cnpj)
  if (!cpfNorm) throw new Error('Informe um CPF ou CNPJ válido.')

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
    telefone: input.telefone,
    cpf_cnpj: cpfNorm,
    endereco: input.endereco,
  })

  const id = crypto.randomUUID()
  const senha_hash = await hashSenhaWeb(input.senha)
  const { error } = await supabase.from('loja_online_clientes').insert({
    id,
    empresa_id: input.empresaId,
    nome: input.nome.trim(),
    email,
    senha_hash,
    telefone: input.telefone?.trim() || null,
    endereco: input.endereco?.trim() || null,
    cpf_cnpj: cpfNorm,
    cep: input.cep?.replace(/\D/g, '') || null,
    cliente_pdv_id: clientePdvId,
  })
  if (error) throw error
  return {
    id,
    empresa_id: input.empresaId,
    nome: input.nome.trim(),
    email,
    telefone: input.telefone?.trim() || null,
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

export async function createLojaOnlinePedido(input: {
  empresaId: string
  cliente?: LojaOnlineClienteSession | null
  guest?: { nome: string; email: string; telefone?: string | null }
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
}): Promise<{ pedido: LojaOnlinePedido; itens: LojaOnlinePedidoItem[] }> {
  if (input.items.length === 0) throw new Error('Carrinho vazio.')

  const isGuest = !input.cliente?.id
  if (isGuest) {
    if (!input.guest?.nome?.trim() || !input.guest?.email?.trim()) {
      throw new Error('Informe nome e e-mail para finalizar a compra.')
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

  const { error: pedErr } = await supabase.from('loja_online_pedidos').insert({
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
  })
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
    return {
      id: crypto.randomUUID(),
      pedido_id: pedidoId,
      produto_id: item.produtoId,
      nome: item.nome,
      preco: item.preco,
      quantidade: item.quantidade,
      subtotal: itemSubtotal,
      unidade: item.unidade,
    }
  })

  const { error: itensErr } = await supabase.from('loja_online_pedido_itens').insert(itens)
  if (itensErr) throw itensErr

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
    observacoes: input.observacoes?.trim() || null,
    endereco_entrega: input.formaEntrega === 'entrega' ? input.enderecoEntrega?.trim() || null : null,
    forma_entrega: input.formaEntrega,
    cliente_nome: input.cliente?.nome ?? input.guest!.nome.trim(),
    cliente_email: input.cliente?.email ?? input.guest!.email.trim(),
    cliente_telefone: input.cliente?.telefone ?? input.guest?.telefone?.trim() ?? null,
    venda_id: null,
    forma_pagamento: formaPagamento,
    pagamento_status: pagamentoStatus,
    gateway_payment_id: null,
    gateway_checkout_url: null,
    pagamento_meio: null,
    codigo_rastreio: null,
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
    .filter(pedidoPrecisaAcaoAdmin)
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
      imagem: imagens.get(item.produto_id) ?? null,
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

    const vendaId = await criarVendaFromPedidoOnline(updatedRow)
    const { data: linked } = await supabase
      .from('loja_online_pedidos')
      .update({ venda_id: vendaId })
      .eq('id', pedidoId)
      .is('venda_id', null)
      .select('venda_id')
      .maybeSingle()
    if (!linked?.venda_id) {
      await supabase.from('vendas').update({ status: 'CANCELADA' }).eq('id', vendaId).eq('venda_online', 1)
    }
  }
}

export async function updateLojaOnlinePedidoRastreio(
  pedidoId: string,
  codigoRastreio: string | null
): Promise<void> {
  const { error } = await supabase
    .from('loja_online_pedidos')
    .update({ codigo_rastreio: codigoRastreio?.trim() || null })
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
    if ((m as { tipo: string }).tipo === 'ENTRADA' || (m as { tipo: string }).tipo === 'DEVOLUCAO') saldo += q
    else saldo -= q
  }

  await supabase
    .from('produtos')
    .update({ estoque_atual: saldo })
    .eq('id', params.produto_id)
    .eq('empresa_id', params.empresa_id)
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
  const vendaId = crypto.randomUUID()
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
  if (vendaErr) throw new Error(`Falha ao registrar venda online: ${vendaErr.message}`)

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
  for (const item of items) {
    const p = map.get(item.produtoId)
    if (!p) return `Produto "${item.nome}" não está mais disponível.`
    if (p.controla_estoque && (p.estoque_atual ?? 0) < item.quantidade) {
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

export async function fetchLojaOnlineAvaliacoes(
  empresaId: string,
  produtoId: string
): Promise<LojaOnlineAvaliacao[]> {
  const { data, error } = await supabase
    .from('loja_online_avaliacoes')
    .select('id, empresa_id, produto_id, cliente_id, cliente_nome, nota, comentario, created_at')
    .eq('empresa_id', empresaId)
    .eq('produto_id', produtoId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as LojaOnlineAvaliacao[]
}

export async function createLojaOnlineAvaliacao(input: {
  empresaId: string
  produtoId: string
  clienteId: string
  clienteNome: string
  nota: number
  comentario: string | null
}): Promise<LojaOnlineAvaliacao> {
  const nota = Math.min(5, Math.max(1, Math.round(input.nota)))
  const row = {
    id: crypto.randomUUID(),
    empresa_id: input.empresaId,
    produto_id: input.produtoId,
    cliente_id: input.clienteId,
    cliente_nome: input.clienteNome.trim(),
    nota,
    comentario: input.comentario?.trim() || null,
  }
  const { data, error } = await supabase
    .from('loja_online_avaliacoes')
    .insert(row)
    .select('id, empresa_id, produto_id, cliente_id, cliente_nome, nota, comentario, created_at')
    .single()
  if (error) throw error
  return data as LojaOnlineAvaliacao
}
