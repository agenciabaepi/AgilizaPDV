import { supabase } from './supabase'
import { hashSenhaWeb, verificarSenhaWeb } from './web-crypto'
import { isValidEmail, isValidPhone } from './validators'
import { pedidoElegivelParaVenda, type LojaOnlinePedidoStatus } from './loja-online-pedido-status'
import type {
  LojaOnlinePedido,
  LojaOnlinePedidoItem,
  LojaOnlineProduto,
  LojaOnlineUgcComissao,
  LojaOnlineUgcComissaoStatus,
  LojaOnlineUgcCriador,
  LojaOnlineUgcCriadorKpi,
  LojaOnlineUgcCriadorSession,
  LojaOnlineUgcCriadorStatus,
  LojaOnlineUgcLink,
  LojaOnlineUgcSaldo,
  LojaOnlineUgcSaque,
  LojaOnlineUgcSaqueStatus,
} from './loja-online-types'

function normalizeCodigo(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16)
}

function slugFromNome(nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 8)
  return base || 'UGC'
}

async function gerarCodigoUnico(empresaId: string, nome: string): Promise<string> {
  const prefix = slugFromNome(nome).slice(0, 6)
  for (let i = 0; i < 12; i++) {
    const suffix = Math.floor(10 + Math.random() * 89).toString()
    const codigo = normalizeCodigo(`${prefix}${suffix}`)
    if (codigo.length < 3) continue
    const { data } = await supabase
      .from('loja_online_ugc_criadores')
      .select('id')
      .eq('empresa_id', empresaId)
      .ilike('codigo', codigo)
      .maybeSingle()
    if (!data) return codigo
  }
  return normalizeCodigo(`${prefix}${Date.now().toString(36).slice(-4)}`)
}

function toSession(row: LojaOnlineUgcCriador): LojaOnlineUgcCriadorSession {
  return {
    id: row.id,
    empresa_id: row.empresa_id,
    nome: row.nome,
    email: row.email,
    telefone: row.telefone,
    instagram: row.instagram,
    tiktok: row.tiktok,
    youtube: row.youtube,
    pix_chave: row.pix_chave,
    codigo: row.codigo,
    status: row.status,
  }
}

function mapCriador(row: Record<string, unknown>): LojaOnlineUgcCriador {
  return {
    id: String(row.id),
    empresa_id: String(row.empresa_id),
    nome: String(row.nome ?? ''),
    email: String(row.email ?? ''),
    telefone: (row.telefone as string | null) ?? null,
    instagram: (row.instagram as string | null) ?? null,
    tiktok: (row.tiktok as string | null) ?? null,
    youtube: (row.youtube as string | null) ?? null,
    pix_chave: (row.pix_chave as string | null) ?? null,
    codigo: String(row.codigo ?? ''),
    status: (row.status as LojaOnlineUgcCriadorStatus) || 'pendente',
    notas_admin: (row.notas_admin as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    aprovado_em: (row.aprovado_em as string | null) ?? null,
  }
}

function mapComissao(row: Record<string, unknown>): LojaOnlineUgcComissao {
  return {
    id: String(row.id),
    empresa_id: String(row.empresa_id),
    criador_id: String(row.criador_id),
    pedido_id: String(row.pedido_id),
    pedido_item_id: String(row.pedido_item_id),
    produto_id: String(row.produto_id),
    link_id: (row.link_id as string | null) ?? null,
    base_calculo: Number(row.base_calculo) || 0,
    percentual: Number(row.percentual) || 0,
    valor: Number(row.valor) || 0,
    status: (row.status as LojaOnlineUgcComissaoStatus) || 'pendente',
    motivo_cancelamento: (row.motivo_cancelamento as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    aprovada_em: (row.aprovada_em as string | null) ?? null,
    paga_em: (row.paga_em as string | null) ?? null,
  }
}

function mapSaque(row: Record<string, unknown>): LojaOnlineUgcSaque {
  return {
    id: String(row.id),
    empresa_id: String(row.empresa_id),
    criador_id: String(row.criador_id),
    valor: Number(row.valor) || 0,
    pix_chave: String(row.pix_chave ?? ''),
    status: (row.status as LojaOnlineUgcSaqueStatus) || 'solicitado',
    admin_nota: (row.admin_nota as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    pago_em: (row.pago_em as string | null) ?? null,
  }
}

function mapLink(row: Record<string, unknown>): LojaOnlineUgcLink {
  return {
    id: String(row.id),
    empresa_id: String(row.empresa_id),
    criador_id: String(row.criador_id),
    produto_id: String(row.produto_id),
    cliques: Number(row.cliques) || 0,
    pedidos: Number(row.pedidos) || 0,
    vendas_valor: Number(row.vendas_valor) || 0,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

export async function fetchLojaOnlineUgcConfig(empresaId: string): Promise<{
  ativo: boolean
  cookieDias: number
  saqueMinimo: number
}> {
  const { data, error } = await supabase
    .from('empresas_config')
    .select('loja_online_ugc_ativo, loja_online_ugc_cookie_dias, loja_online_ugc_saque_minimo')
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (error && !/does not exist|column/i.test(error.message)) throw error
  return {
    ativo: Number(data?.loja_online_ugc_ativo) === 1,
    cookieDias: Math.max(1, Number(data?.loja_online_ugc_cookie_dias) || 30),
    saqueMinimo: Math.max(0, Number(data?.loja_online_ugc_saque_minimo) || 50),
  }
}

export async function saveLojaOnlineUgcConfig(
  empresaId: string,
  input: { ativo: boolean; cookieDias?: number; saqueMinimo?: number }
): Promise<void> {
  const patch: Record<string, unknown> = {
    loja_online_ugc_ativo: input.ativo ? 1 : 0,
  }
  if (input.cookieDias != null) patch.loja_online_ugc_cookie_dias = Math.max(1, Math.round(input.cookieDias))
  if (input.saqueMinimo != null) patch.loja_online_ugc_saque_minimo = Math.max(0, Number(input.saqueMinimo) || 0)
  const { error } = await supabase.from('empresas_config').update(patch).eq('empresa_id', empresaId)
  if (error) throw error
}

export async function registerLojaOnlineUgcCriador(input: {
  empresaId: string
  nome: string
  email: string
  senha: string
  telefone?: string
  instagram?: string
  tiktok?: string
  youtube?: string
  pix_chave?: string
}): Promise<LojaOnlineUgcCriadorSession> {
  const nome = input.nome.trim()
  const email = input.email.trim().toLowerCase()
  if (!nome) throw new Error('Informe seu nome.')
  if (!isValidEmail(email)) throw new Error('E-mail inválido.')
  if (!input.senha || input.senha.length < 6) throw new Error('A senha precisa ter ao menos 6 caracteres.')
  if (input.telefone && !isValidPhone(input.telefone)) throw new Error('Telefone inválido.')

  const cfg = await fetchLojaOnlineUgcConfig(input.empresaId)
  if (!cfg.ativo) throw new Error('O programa de parceiros está desativado nesta loja.')

  const { data: existing } = await supabase
    .from('loja_online_ugc_criadores')
    .select('id')
    .eq('empresa_id', input.empresaId)
    .ilike('email', email)
    .maybeSingle()
  if (existing) throw new Error('Já existe um cadastro com este e-mail.')

  const senha_hash = await hashSenhaWeb(input.senha)
  const codigo = await gerarCodigoUnico(input.empresaId, nome)
  const now = new Date().toISOString()
  const row = {
    id: crypto.randomUUID(),
    empresa_id: input.empresaId,
    nome,
    email,
    senha_hash,
    telefone: input.telefone?.trim() || null,
    instagram: input.instagram?.trim() || null,
    tiktok: input.tiktok?.trim() || null,
    youtube: input.youtube?.trim() || null,
    pix_chave: input.pix_chave?.trim() || null,
    codigo,
    status: 'pendente' as const,
    notas_admin: null,
    created_at: now,
    updated_at: now,
    aprovado_em: null,
  }

  const { error } = await supabase.from('loja_online_ugc_criadores').insert(row)
  if (error) throw error
  return toSession(mapCriador(row))
}

export async function loginLojaOnlineUgcCriador(input: {
  empresaId: string
  email: string
  senha: string
}): Promise<LojaOnlineUgcCriadorSession> {
  const email = input.email.trim().toLowerCase()
  const { data, error } = await supabase
    .from('loja_online_ugc_criadores')
    .select('*')
    .eq('empresa_id', input.empresaId)
    .ilike('email', email)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('E-mail ou senha incorretos.')
  const ok = await verificarSenhaWeb(input.senha, data.senha_hash as string)
  if (!ok) throw new Error('E-mail ou senha incorretos.')
  const criador = mapCriador(data as Record<string, unknown>)
  if (criador.status === 'bloqueado') throw new Error('Sua conta está bloqueada. Fale com a loja.')
  if (criador.status === 'rejeitado') throw new Error('Seu cadastro foi rejeitado.')
  return toSession(criador)
}

export async function fetchLojaOnlineUgcCriadorById(
  empresaId: string,
  criadorId: string
): Promise<LojaOnlineUgcCriador | null> {
  const { data, error } = await supabase
    .from('loja_online_ugc_criadores')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('id', criadorId)
    .maybeSingle()
  if (error) throw error
  return data ? mapCriador(data as Record<string, unknown>) : null
}

export async function fetchLojaOnlineUgcCriadorByCodigo(
  empresaId: string,
  codigo: string
): Promise<LojaOnlineUgcCriador | null> {
  const code = normalizeCodigo(codigo)
  if (!code) return null
  const { data, error } = await supabase
    .from('loja_online_ugc_criadores')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('status', 'aprovado')
    .ilike('codigo', code)
    .maybeSingle()
  if (error) throw error
  return data ? mapCriador(data as Record<string, unknown>) : null
}

export async function updateLojaOnlineUgcCriadorPerfil(
  criadorId: string,
  empresaId: string,
  patch: {
    nome?: string
    telefone?: string | null
    instagram?: string | null
    tiktok?: string | null
    youtube?: string | null
    pix_chave?: string | null
  }
): Promise<LojaOnlineUgcCriadorSession> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.nome != null) update.nome = patch.nome.trim()
  if (patch.telefone !== undefined) update.telefone = patch.telefone?.trim() || null
  if (patch.instagram !== undefined) update.instagram = patch.instagram?.trim() || null
  if (patch.tiktok !== undefined) update.tiktok = patch.tiktok?.trim() || null
  if (patch.youtube !== undefined) update.youtube = patch.youtube?.trim() || null
  if (patch.pix_chave !== undefined) update.pix_chave = patch.pix_chave?.trim() || null

  const { data, error } = await supabase
    .from('loja_online_ugc_criadores')
    .update(update)
    .eq('id', criadorId)
    .eq('empresa_id', empresaId)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Criador não encontrado.')
  return toSession(mapCriador(data as Record<string, unknown>))
}

export async function fetchLojaOnlineUgcCriadoresAdmin(empresaId: string): Promise<LojaOnlineUgcCriadorKpi[]> {
  const { data, error } = await supabase
    .from('loja_online_ugc_criadores')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
  if (error) throw error
  const criadores = (data ?? []).map((r) => mapCriador(r as Record<string, unknown>))
  if (criadores.length === 0) return []

  const ids = criadores.map((c) => c.id)
  const [{ data: links }, { data: cliques }, { data: comissoes }] = await Promise.all([
    supabase.from('loja_online_ugc_links').select('criador_id, cliques, pedidos, vendas_valor').in('criador_id', ids),
    supabase.from('loja_online_ugc_cliques').select('criador_id').in('criador_id', ids),
    supabase.from('loja_online_ugc_comissoes').select('criador_id, status, valor').in('criador_id', ids),
  ])

  const linkStats = new Map<string, { links: number; cliques: number; pedidos: number; vendas_valor: number }>()
  for (const l of links ?? []) {
    const id = String((l as { criador_id: string }).criador_id)
    const cur = linkStats.get(id) ?? { links: 0, cliques: 0, pedidos: 0, vendas_valor: 0 }
    cur.links += 1
    cur.cliques += Number((l as { cliques: number }).cliques) || 0
    cur.pedidos += Number((l as { pedidos: number }).pedidos) || 0
    cur.vendas_valor += Number((l as { vendas_valor: number }).vendas_valor) || 0
    linkStats.set(id, cur)
  }

  const cliqueCount = new Map<string, number>()
  for (const c of cliques ?? []) {
    const id = String((c as { criador_id: string }).criador_id)
    cliqueCount.set(id, (cliqueCount.get(id) ?? 0) + 1)
  }

  const comStats = new Map<string, { pendente: number; aprovada: number; paga: number }>()
  for (const c of comissoes ?? []) {
    const id = String((c as { criador_id: string }).criador_id)
    const cur = comStats.get(id) ?? { pendente: 0, aprovada: 0, paga: 0 }
    const valor = Number((c as { valor: number }).valor) || 0
    const status = (c as { status: string }).status
    if (status === 'pendente') cur.pendente += valor
    else if (status === 'aprovada') cur.aprovada += valor
    else if (status === 'paga') cur.paga += valor
    comStats.set(id, cur)
  }

  return criadores.map((c) => {
    const ls = linkStats.get(c.id) ?? { links: 0, cliques: 0, pedidos: 0, vendas_valor: 0 }
    const cs = comStats.get(c.id) ?? { pendente: 0, aprovada: 0, paga: 0 }
    return {
      ...c,
      links: ls.links,
      cliques: Math.max(ls.cliques, cliqueCount.get(c.id) ?? 0),
      pedidos: ls.pedidos,
      vendas_valor: ls.vendas_valor,
      comissao_pendente: round2(cs.pendente),
      comissao_aprovada: round2(cs.aprovada),
      comissao_paga: round2(cs.paga),
    }
  })
}

export async function updateLojaOnlineUgcCriadorStatusAdmin(input: {
  empresaId: string
  criadorId: string
  status: LojaOnlineUgcCriadorStatus
  codigo?: string
  notas_admin?: string | null
}): Promise<void> {
  const update: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  }
  if (input.notas_admin !== undefined) update.notas_admin = input.notas_admin
  if (input.codigo) {
    const codigo = normalizeCodigo(input.codigo)
    if (codigo.length < 3) throw new Error('Código precisa ter ao menos 3 caracteres.')
    const { data: clash } = await supabase
      .from('loja_online_ugc_criadores')
      .select('id')
      .eq('empresa_id', input.empresaId)
      .ilike('codigo', codigo)
      .neq('id', input.criadorId)
      .maybeSingle()
    if (clash) throw new Error('Este código já está em uso.')
    update.codigo = codigo
  }
  if (input.status === 'aprovado') update.aprovado_em = new Date().toISOString()

  const { error } = await supabase
    .from('loja_online_ugc_criadores')
    .update(update)
    .eq('id', input.criadorId)
    .eq('empresa_id', input.empresaId)
  if (error) throw error
}

export async function ensureLojaOnlineUgcLink(input: {
  empresaId: string
  criadorId: string
  produtoId: string
}): Promise<LojaOnlineUgcLink> {
  const { data: existing } = await supabase
    .from('loja_online_ugc_links')
    .select('*')
    .eq('criador_id', input.criadorId)
    .eq('produto_id', input.produtoId)
    .maybeSingle()
  if (existing) return mapLink(existing as Record<string, unknown>)

  const now = new Date().toISOString()
  const row = {
    id: crypto.randomUUID(),
    empresa_id: input.empresaId,
    criador_id: input.criadorId,
    produto_id: input.produtoId,
    cliques: 0,
    pedidos: 0,
    vendas_valor: 0,
    created_at: now,
    updated_at: now,
  }
  const { error } = await supabase.from('loja_online_ugc_links').insert(row)
  if (error) {
    // race: outro insert ganhou
    const { data: again } = await supabase
      .from('loja_online_ugc_links')
      .select('*')
      .eq('criador_id', input.criadorId)
      .eq('produto_id', input.produtoId)
      .maybeSingle()
    if (again) return mapLink(again as Record<string, unknown>)
    throw error
  }
  return mapLink(row)
}

export async function fetchLojaOnlineUgcLinksCriador(
  empresaId: string,
  criadorId: string
): Promise<LojaOnlineUgcLink[]> {
  const { data, error } = await supabase
    .from('loja_online_ugc_links')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('criador_id', criadorId)
    .order('created_at', { ascending: false })
  if (error) throw error
  const links = (data ?? []).map((r) => mapLink(r as Record<string, unknown>))
  if (links.length === 0) return []

  const produtoIds = [...new Set(links.map((l) => l.produto_id))]
  const { data: produtos } = await supabase
    .from('produtos')
    .select('id, nome, imagem, preco, comissao_ugc_percentual')
    .eq('empresa_id', empresaId)
    .in('id', produtoIds)

  const map = new Map(
    (produtos ?? []).map((p) => [
      String((p as { id: string }).id),
      p as Pick<LojaOnlineProduto, 'id' | 'nome' | 'imagem' | 'preco' | 'comissao_ugc_percentual'>,
    ])
  )
  return links.map((l) => ({ ...l, produto: map.get(l.produto_id) ?? null }))
}

export async function fetchLojaOnlineUgcProdutosElegiveis(
  empresaId: string
): Promise<Pick<LojaOnlineProduto, 'id' | 'nome' | 'imagem' | 'preco' | 'comissao_ugc_percentual'>[]> {
  const { data, error } = await supabase
    .from('produtos')
    .select('id, nome, imagem, preco, comissao_ugc_percentual')
    .eq('empresa_id', empresaId)
    .eq('loja_online', 1)
    .gt('comissao_ugc_percentual', 0)
    .order('nome')
    .limit(500)
  if (error) throw error
  return (data ?? []) as Pick<
    LojaOnlineProduto,
    'id' | 'nome' | 'imagem' | 'preco' | 'comissao_ugc_percentual'
  >[]
}

/** Registra clique de afiliado (idempotente por session+produto em janela curta no client). */
export async function registerLojaOnlineUgcClique(input: {
  empresaId: string
  codigo: string
  produtoId?: string | null
  path?: string | null
  sessionId?: string | null
}): Promise<{ criadorId: string; linkId: string | null } | null> {
  const criador = await fetchLojaOnlineUgcCriadorByCodigo(input.empresaId, input.codigo)
  if (!criador) return null

  let linkId: string | null = null
  if (input.produtoId) {
    const link = await ensureLojaOnlineUgcLink({
      empresaId: input.empresaId,
      criadorId: criador.id,
      produtoId: input.produtoId,
    })
    linkId = link.id
    await supabase
      .from('loja_online_ugc_links')
      .update({
        cliques: (link.cliques || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', link.id)
  }

  await supabase.from('loja_online_ugc_cliques').insert({
    id: crypto.randomUUID(),
    empresa_id: input.empresaId,
    criador_id: criador.id,
    link_id: linkId,
    produto_id: input.produtoId ?? null,
    session_id: input.sessionId ?? null,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : null,
    referrer: typeof document !== 'undefined' ? (document.referrer || null)?.slice(0, 500) : null,
    path: input.path?.slice(0, 500) ?? null,
    created_at: new Date().toISOString(),
  })

  return { criadorId: criador.id, linkId }
}

export async function resolveLojaOnlineUgcAttribution(input: {
  empresaId: string
  codigo: string
  produtoIds?: string[]
}): Promise<{ criadorId: string; codigo: string; linkId: string | null } | null> {
  const criador = await fetchLojaOnlineUgcCriadorByCodigo(input.empresaId, input.codigo)
  if (!criador) return null
  let linkId: string | null = null
  const firstProduto = input.produtoIds?.[0]
  if (firstProduto) {
    const link = await ensureLojaOnlineUgcLink({
      empresaId: input.empresaId,
      criadorId: criador.id,
      produtoId: firstProduto,
    })
    linkId = link.id
  }
  return { criadorId: criador.id, codigo: criador.codigo, linkId }
}

export async function fetchLojaOnlineUgcSaldo(
  empresaId: string,
  criadorId: string
): Promise<LojaOnlineUgcSaldo> {
  const [{ data: comissoes }, { data: saques }] = await Promise.all([
    supabase
      .from('loja_online_ugc_comissoes')
      .select('status, valor')
      .eq('empresa_id', empresaId)
      .eq('criador_id', criadorId),
    supabase
      .from('loja_online_ugc_saques')
      .select('status, valor')
      .eq('empresa_id', empresaId)
      .eq('criador_id', criadorId)
      .eq('status', 'solicitado'),
  ])

  let pendente = 0
  let aprovado = 0
  let pago = 0
  for (const c of comissoes ?? []) {
    const valor = Number((c as { valor: number }).valor) || 0
    const status = (c as { status: string }).status
    if (status === 'pendente') pendente += valor
    else if (status === 'aprovada') aprovado += valor
    else if (status === 'paga') pago += valor
  }
  const em_saque = (saques ?? []).reduce((s, r) => s + (Number((r as { valor: number }).valor) || 0), 0)
  const disponivel = Math.max(0, round2(aprovado - em_saque))
  return {
    pendente: round2(pendente),
    aprovado: round2(aprovado),
    pago: round2(pago),
    em_saque: round2(em_saque),
    disponivel,
  }
}

export async function fetchLojaOnlineUgcComissoes(input: {
  empresaId: string
  criadorId?: string
  limit?: number
}): Promise<LojaOnlineUgcComissao[]> {
  let q = supabase
    .from('loja_online_ugc_comissoes')
    .select('*')
    .eq('empresa_id', input.empresaId)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 200)
  if (input.criadorId) q = q.eq('criador_id', input.criadorId)
  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []).map((r) => mapComissao(r as Record<string, unknown>))
  if (rows.length === 0) return []

  const produtoIds = [...new Set(rows.map((r) => r.produto_id))]
  const pedidoIds = [...new Set(rows.map((r) => r.pedido_id))]
  const [{ data: produtos }, { data: pedidos }] = await Promise.all([
    supabase.from('produtos').select('id, nome').in('id', produtoIds),
    supabase.from('loja_online_pedidos').select('id, cliente_nome').in('id', pedidoIds),
  ])
  const prodMap = new Map((produtos ?? []).map((p) => [String((p as { id: string }).id), String((p as { nome: string }).nome)]))
  const pedMap = new Map(
    (pedidos ?? []).map((p) => [
      String((p as { id: string }).id),
      ((p as { cliente_nome: string | null }).cliente_nome as string | null) ?? null,
    ])
  )
  return rows.map((r) => ({
    ...r,
    produto_nome: prodMap.get(r.produto_id) ?? null,
    pedido_cliente: pedMap.get(r.pedido_id) ?? null,
  }))
}

export async function fetchLojaOnlineUgcSaques(input: {
  empresaId: string
  criadorId?: string
  limit?: number
}): Promise<LojaOnlineUgcSaque[]> {
  let q = supabase
    .from('loja_online_ugc_saques')
    .select('*')
    .eq('empresa_id', input.empresaId)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 100)
  if (input.criadorId) q = q.eq('criador_id', input.criadorId)
  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []).map((r) => mapSaque(r as Record<string, unknown>))
  if (!input.criadorId && rows.length > 0) {
    const ids = [...new Set(rows.map((r) => r.criador_id))]
    const { data: criadores } = await supabase
      .from('loja_online_ugc_criadores')
      .select('id, nome, email')
      .in('id', ids)
    const map = new Map(
      (criadores ?? []).map((c) => [
        String((c as { id: string }).id),
        c as { id: string; nome: string; email: string },
      ])
    )
    return rows.map((r) => ({
      ...r,
      criador_nome: map.get(r.criador_id)?.nome ?? null,
      criador_email: map.get(r.criador_id)?.email ?? null,
    }))
  }
  return rows
}

export async function solicitarLojaOnlineUgcSaque(input: {
  empresaId: string
  criadorId: string
  valor: number
  pix_chave?: string
}): Promise<LojaOnlineUgcSaque> {
  const valor = round2(input.valor)
  if (valor <= 0) throw new Error('Informe um valor válido.')

  const [cfg, saldo, criador] = await Promise.all([
    fetchLojaOnlineUgcConfig(input.empresaId),
    fetchLojaOnlineUgcSaldo(input.empresaId, input.criadorId),
    fetchLojaOnlineUgcCriadorById(input.empresaId, input.criadorId),
  ])
  if (!criador || criador.status !== 'aprovado') throw new Error('Conta não aprovada para saque.')
  if (valor < cfg.saqueMinimo) {
    throw new Error(`O saque mínimo é R$ ${cfg.saqueMinimo.toFixed(2).replace('.', ',')}.`)
  }
  if (valor > saldo.disponivel + 0.001) {
    throw new Error('Saldo disponível insuficiente.')
  }
  const pix = (input.pix_chave ?? criador.pix_chave ?? '').trim()
  if (!pix) throw new Error('Cadastre uma chave PIX antes de sacar.')

  const now = new Date().toISOString()
  const row = {
    id: crypto.randomUUID(),
    empresa_id: input.empresaId,
    criador_id: input.criadorId,
    valor,
    pix_chave: pix,
    status: 'solicitado' as const,
    admin_nota: null,
    created_at: now,
    updated_at: now,
    pago_em: null,
  }
  const { error } = await supabase.from('loja_online_ugc_saques').insert(row)
  if (error) throw error
  return mapSaque(row)
}

export async function updateLojaOnlineUgcSaqueAdmin(input: {
  empresaId: string
  saqueId: string
  status: Exclude<LojaOnlineUgcSaqueStatus, 'solicitado'>
  admin_nota?: string | null
}): Promise<void> {
  const { data: saque, error: fetchErr } = await supabase
    .from('loja_online_ugc_saques')
    .select('*')
    .eq('id', input.saqueId)
    .eq('empresa_id', input.empresaId)
    .maybeSingle()
  if (fetchErr) throw fetchErr
  if (!saque) throw new Error('Saque não encontrado.')
  if (saque.status !== 'solicitado') throw new Error('Este saque já foi processado.')

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('loja_online_ugc_saques')
    .update({
      status: input.status,
      admin_nota: input.admin_nota ?? null,
      updated_at: now,
      pago_em: input.status === 'pago' ? now : null,
    })
    .eq('id', input.saqueId)
  if (error) throw error

  if (input.status === 'pago') {
    // Marca comissões aprovadas como pagas até cobrir o valor (FIFO)
    let restante = Number(saque.valor) || 0
    const { data: comissoes } = await supabase
      .from('loja_online_ugc_comissoes')
      .select('id, valor')
      .eq('empresa_id', input.empresaId)
      .eq('criador_id', saque.criador_id)
      .eq('status', 'aprovada')
      .order('aprovada_em', { ascending: true })
      .order('created_at', { ascending: true })

    for (const c of comissoes ?? []) {
      if (restante <= 0) break
      const valor = Number((c as { valor: number }).valor) || 0
      await supabase
        .from('loja_online_ugc_comissoes')
        .update({ status: 'paga', paga_em: now, updated_at: now })
        .eq('id', (c as { id: string }).id)
      restante = round2(restante - valor)
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Cria comissões pendentes por item quando o pedido está pago/elegível e tem UGC.
 * Idempotente por pedido_item_id.
 */
export async function ensureLojaOnlineUgcComissoesPendentes(
  pedido: Pick<
    LojaOnlinePedido,
    | 'id'
    | 'empresa_id'
    | 'ugc_criador_id'
    | 'ugc_link_id'
    | 'ugc_codigo'
    | 'forma_pagamento'
    | 'pagamento_status'
    | 'status'
    | 'subtotal'
    | 'valor_desconto'
  >,
  itens?: LojaOnlinePedidoItem[]
): Promise<void> {
  if (!pedido.ugc_criador_id) return
  if (!pedidoElegivelParaVenda(pedido)) return

  const { data: criador } = await supabase
    .from('loja_online_ugc_criadores')
    .select('id, status')
    .eq('id', pedido.ugc_criador_id)
    .eq('empresa_id', pedido.empresa_id)
    .maybeSingle()
  if (!criador || criador.status !== 'aprovado') return

  let pedidoItens = itens
  if (!pedidoItens) {
    const { data } = await supabase
      .from('loja_online_pedido_itens')
      .select('*')
      .eq('pedido_id', pedido.id)
    pedidoItens = (data ?? []) as LojaOnlinePedidoItem[]
  }
  if (!pedidoItens.length) return

  const produtoIds = [...new Set(pedidoItens.map((i) => i.produto_id))]
  const { data: produtos } = await supabase
    .from('produtos')
    .select('id, comissao_ugc_percentual')
    .eq('empresa_id', pedido.empresa_id)
    .in('id', produtoIds)

  const pctMap = new Map(
    (produtos ?? []).map((p) => [
      String((p as { id: string }).id),
      Number((p as { comissao_ugc_percentual: number | null }).comissao_ugc_percentual) || 0,
    ])
  )

  const subtotalPedido = Number(pedido.subtotal) || pedidoItens.reduce((s, i) => s + Number(i.subtotal), 0)
  const desconto = Math.min(subtotalPedido, Math.max(0, Number(pedido.valor_desconto) || 0))

  const now = new Date().toISOString()
  const rows: Record<string, unknown>[] = []
  let comissaoTotal = 0
  let vendasValor = 0

  for (const item of pedidoItens) {
    const pct = pctMap.get(item.produto_id) ?? 0
    if (pct <= 0) continue
    const itemSub = Number(item.subtotal) || 0
    const descontoItem =
      subtotalPedido > 0 ? (itemSub / subtotalPedido) * desconto : 0
    const base = Math.max(0, round2(itemSub - descontoItem))
    if (base <= 0) continue
    const valor = round2((base * pct) / 100)
    if (valor <= 0) continue
    comissaoTotal += valor
    vendasValor += base
    rows.push({
      id: crypto.randomUUID(),
      empresa_id: pedido.empresa_id,
      criador_id: pedido.ugc_criador_id,
      pedido_id: pedido.id,
      pedido_item_id: item.id,
      produto_id: item.produto_id,
      link_id: pedido.ugc_link_id ?? null,
      base_calculo: base,
      percentual: pct,
      valor,
      status: 'pendente',
      motivo_cancelamento: null,
      created_at: now,
      updated_at: now,
      aprovada_em: null,
      paga_em: null,
    })
  }

  if (rows.length === 0) return

  const { data: existing } = await supabase
    .from('loja_online_ugc_comissoes')
    .select('id')
    .eq('pedido_id', pedido.id)
    .limit(1)
  const jaExiste = (existing ?? []).length > 0

  const { error } = await supabase.from('loja_online_ugc_comissoes').upsert(rows, {
    onConflict: 'pedido_item_id',
    ignoreDuplicates: true,
  })
  if (error) {
    // fallback: insert one-by-one ignoring duplicates
    for (const row of rows) {
      const { error: insErr } = await supabase.from('loja_online_ugc_comissoes').insert(row)
      if (insErr && !/duplicate|unique/i.test(insErr.message)) throw insErr
    }
  }

  // Contadores do link só na primeira criação de comissão deste pedido
  if (!jaExiste && pedido.ugc_link_id) {
    const { data: link } = await supabase
      .from('loja_online_ugc_links')
      .select('pedidos, vendas_valor')
      .eq('id', pedido.ugc_link_id)
      .maybeSingle()
    if (link) {
      await supabase
        .from('loja_online_ugc_links')
        .update({
          pedidos: (Number(link.pedidos) || 0) + 1,
          vendas_valor: round2((Number(link.vendas_valor) || 0) + vendasValor),
          updated_at: now,
        })
        .eq('id', pedido.ugc_link_id)
    }
  }

  void comissaoTotal
}

export async function syncLojaOnlineUgcComissoesStatusPedido(
  pedidoId: string,
  status: LojaOnlinePedidoStatus
): Promise<void> {
  const cancelStatuses: LojaOnlinePedidoStatus[] = ['cancelado', 'reembolsado', 'pagamento_recusado']
  const now = new Date().toISOString()

  if (status === 'entregue') {
    await supabase
      .from('loja_online_ugc_comissoes')
      .update({ status: 'aprovada', aprovada_em: now, updated_at: now })
      .eq('pedido_id', pedidoId)
      .eq('status', 'pendente')
    return
  }

  if (cancelStatuses.includes(status)) {
    await supabase
      .from('loja_online_ugc_comissoes')
      .update({
        status: 'cancelada',
        motivo_cancelamento: `Pedido ${status}`,
        updated_at: now,
      })
      .eq('pedido_id', pedidoId)
      .in('status', ['pendente', 'aprovada'])
  }
}

/** Sincroniza comissões a partir do estado atual do pedido (criar + aprovar/cancelar). */
export async function syncLojaOnlineUgcComissoesForPedido(pedidoId: string): Promise<void> {
  const { data, error } = await supabase
    .from('loja_online_pedidos')
    .select('*')
    .eq('id', pedidoId)
    .maybeSingle()
  if (error) throw error
  if (!data) return
  const pedido = data as LojaOnlinePedido
  await ensureLojaOnlineUgcComissoesPendentes(pedido)
  await syncLojaOnlineUgcComissoesStatusPedido(pedidoId, pedido.status as LojaOnlinePedidoStatus)
}

export function buildLojaOnlineUgcProductUrl(input: {
  mode: 'subdomain' | 'path'
  slug: string
  produtoId: string
  codigo: string
  origin?: string
}): string {
  const codigo = normalizeCodigo(input.codigo)
  const origin = (input.origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '')
  if (input.mode === 'path') {
    return `${origin}/#/loja/${input.slug}/produto/${input.produtoId}?ref=${encodeURIComponent(codigo)}`
  }
  // subdomain: origin já é a loja
  return `${origin}/produto/${input.produtoId}?ref=${encodeURIComponent(codigo)}`
}

export { normalizeCodigo as normalizeLojaOnlineUgcCodigo }
