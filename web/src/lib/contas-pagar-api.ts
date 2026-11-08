import { supabase } from './supabase'
import {
  CATEGORIAS_DESPESA_SEED,
  type CategoriaDespesa,
  type ContaPagar,
  type ContaPagarFixa,
  type CreateCategoriaDespesaInput,
  type CreateContaPagarFixaInput,
  type CreateContaPagarInput,
  type ListContasPagarOptions,
  type PagarContaPagarInput,
  type UpdateCategoriaDespesaInput,
  type UpdateContaPagarFixaInput,
  type UpdateContaPagarInput,
} from './contas-pagar-types'

function asBool(v: unknown): boolean {
  return v === true || v === 1 || v === '1'
}

function competenciaFromDate(isoDate: string): string {
  return isoDate.slice(0, 7)
}

function currentCompetencia(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function nextCompetencia(comp: string): string {
  const [ys, ms] = comp.split('-')
  const y = Number(ys)
  const m = Number(ms)
  if (m >= 12) return `${y + 1}-01`
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

function vencimentoNaCompetencia(competencia: string, dia: number): string {
  const safeDia = Math.min(28, Math.max(1, Math.floor(dia) || 1))
  const [y, m] = competencia.split('-')
  return `${y}-${m}-${String(safeDia).padStart(2, '0')}`
}

function mapCategoria(r: Record<string, unknown>): CategoriaDespesa {
  return {
    id: String(r.id),
    empresa_id: String(r.empresa_id),
    nome: String(r.nome ?? ''),
    ativo: asBool(r.ativo),
    sistema: asBool(r.sistema),
    ordem: Number(r.ordem) || 0,
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  }
}

function mapFixa(r: Record<string, unknown>): ContaPagarFixa {
  const catRaw = r.categorias_despesa
  const cat = Array.isArray(catRaw)
    ? (catRaw[0] as Record<string, unknown> | undefined)
    : (catRaw as Record<string, unknown> | null)
  return {
    id: String(r.id),
    empresa_id: String(r.empresa_id),
    categoria_id: r.categoria_id != null ? String(r.categoria_id) : null,
    fornecedor_id: r.fornecedor_id != null ? String(r.fornecedor_id) : null,
    descricao: String(r.descricao ?? ''),
    valor_padrao: Number(r.valor_padrao) || 0,
    dia_vencimento: Number(r.dia_vencimento) || 1,
    ativa: asBool(r.ativa),
    observacao: r.observacao != null ? String(r.observacao) : null,
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
    categoria_nome: cat?.nome != null ? String(cat.nome) : null,
  }
}

function mapConta(r: Record<string, unknown>): ContaPagar {
  const catRaw = r.categorias_despesa
  const cat = Array.isArray(catRaw)
    ? (catRaw[0] as Record<string, unknown> | undefined)
    : (catRaw as Record<string, unknown> | null)
  return {
    id: String(r.id),
    empresa_id: String(r.empresa_id),
    categoria_id: r.categoria_id != null ? String(r.categoria_id) : null,
    conta_fixa_id: r.conta_fixa_id != null ? String(r.conta_fixa_id) : null,
    descricao: String(r.descricao ?? ''),
    valor: Number(r.valor) || 0,
    vencimento: String(r.vencimento ?? '').slice(0, 10),
    competencia: String(r.competencia ?? ''),
    tipo: r.tipo === 'FIXA' ? 'FIXA' : 'AVULSA',
    status: (r.status as ContaPagar['status']) || 'PENDENTE',
    pago_em: r.pago_em != null ? String(r.pago_em) : null,
    forma_pagamento: r.forma_pagamento != null ? String(r.forma_pagamento) : null,
    pagamento_caixa_id: r.pagamento_caixa_id != null ? String(r.pagamento_caixa_id) : null,
    caixa_movimento_id: r.caixa_movimento_id != null ? String(r.caixa_movimento_id) : null,
    usuario_pagamento_id: r.usuario_pagamento_id != null ? String(r.usuario_pagamento_id) : null,
    observacao: r.observacao != null ? String(r.observacao) : null,
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
    categoria_nome: cat?.nome != null ? String(cat.nome) : null,
  }
}

export async function ensureCategoriasDespesaSeed(empresaId: string): Promise<void> {
  const { data, error } = await supabase
    .from('categorias_despesa')
    .select('id, nome')
    .eq('empresa_id', empresaId)
  if (error) throw error
  const existing = new Set((data ?? []).map((r) => String((r as { nome: string }).nome).toLowerCase()))
  const now = new Date().toISOString()
  const toInsert = CATEGORIAS_DESPESA_SEED.filter((s) => !existing.has(s.nome.toLowerCase())).map((s) => ({
    id: crypto.randomUUID(),
    empresa_id: empresaId,
    nome: s.nome,
    ativo: 1,
    sistema: 1,
    ordem: s.ordem,
    created_at: now,
    updated_at: now,
  }))
  if (toInsert.length === 0) return
  const { error: insErr } = await supabase.from('categorias_despesa').insert(toInsert)
  if (insErr) throw insErr
}

export async function listCategoriasDespesa(empresaId: string, onlyAtivas = false): Promise<CategoriaDespesa[]> {
  await ensureCategoriasDespesaSeed(empresaId)
  let query = supabase
    .from('categorias_despesa')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })
  if (onlyAtivas) query = query.eq('ativo', 1)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((r) => mapCategoria(r as Record<string, unknown>))
}

export async function createCategoriaDespesa(input: CreateCategoriaDespesaInput): Promise<CategoriaDespesa> {
  const nome = input.nome.trim()
  if (!nome) throw new Error('Informe o nome da categoria.')
  const now = new Date().toISOString()
  const row = {
    id: crypto.randomUUID(),
    empresa_id: input.empresa_id,
    nome,
    ativo: 1,
    sistema: 0,
    ordem: input.ordem ?? 200,
    created_at: now,
    updated_at: now,
  }
  const { data, error } = await supabase.from('categorias_despesa').insert(row).select('*').single()
  if (error) throw error
  return mapCategoria(data as Record<string, unknown>)
}

export async function updateCategoriaDespesa(
  id: string,
  empresaId: string,
  patch: UpdateCategoriaDespesaInput
): Promise<CategoriaDespesa> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.nome != null) {
    const nome = patch.nome.trim()
    if (!nome) throw new Error('Informe o nome da categoria.')
    updates.nome = nome
  }
  if (patch.ordem != null) updates.ordem = patch.ordem
  if (patch.ativo != null) updates.ativo = patch.ativo ? 1 : 0
  const { data, error } = await supabase
    .from('categorias_despesa')
    .update(updates)
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .select('*')
    .single()
  if (error) throw error
  return mapCategoria(data as Record<string, unknown>)
}

export async function toggleCategoriaDespesa(
  id: string,
  empresaId: string,
  ativo: boolean
): Promise<CategoriaDespesa> {
  return updateCategoriaDespesa(id, empresaId, { ativo })
}

export async function listContasPagarFixas(empresaId: string): Promise<ContaPagarFixa[]> {
  const { data, error } = await supabase
    .from('contas_pagar_fixas')
    .select('*, categorias_despesa(nome)')
    .eq('empresa_id', empresaId)
    .order('descricao', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => mapFixa(r as Record<string, unknown>))
}

export async function createContaPagarFixa(input: CreateContaPagarFixaInput): Promise<ContaPagarFixa> {
  const descricao = input.descricao.trim()
  if (!descricao) throw new Error('Informe a descrição da conta fixa.')
  if (!Number.isFinite(input.valor_padrao) || input.valor_padrao < 0) {
    throw new Error('Informe um valor padrão válido.')
  }
  const dia = Math.min(28, Math.max(1, Math.floor(input.dia_vencimento) || 1))
  const now = new Date().toISOString()
  const row = {
    id: crypto.randomUUID(),
    empresa_id: input.empresa_id,
    categoria_id: input.categoria_id ?? null,
    fornecedor_id: input.fornecedor_id ?? null,
    descricao,
    valor_padrao: input.valor_padrao,
    dia_vencimento: dia,
    ativa: input.ativa === false ? 0 : 1,
    observacao: input.observacao?.trim() || null,
    created_at: now,
    updated_at: now,
  }
  const { data, error } = await supabase
    .from('contas_pagar_fixas')
    .insert(row)
    .select('*, categorias_despesa(nome)')
    .single()
  if (error) throw error
  return mapFixa(data as Record<string, unknown>)
}

export async function updateContaPagarFixa(
  id: string,
  empresaId: string,
  patch: UpdateContaPagarFixaInput
): Promise<ContaPagarFixa> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.descricao != null) {
    const d = patch.descricao.trim()
    if (!d) throw new Error('Informe a descrição.')
    updates.descricao = d
  }
  if (patch.valor_padrao != null) {
    if (!Number.isFinite(patch.valor_padrao) || patch.valor_padrao < 0) {
      throw new Error('Informe um valor padrão válido.')
    }
    updates.valor_padrao = patch.valor_padrao
  }
  if (patch.dia_vencimento != null) {
    updates.dia_vencimento = Math.min(28, Math.max(1, Math.floor(patch.dia_vencimento) || 1))
  }
  if (patch.categoria_id !== undefined) updates.categoria_id = patch.categoria_id
  if (patch.fornecedor_id !== undefined) updates.fornecedor_id = patch.fornecedor_id
  if (patch.observacao !== undefined) updates.observacao = patch.observacao?.trim() || null
  if (patch.ativa != null) updates.ativa = patch.ativa ? 1 : 0

  const { data, error } = await supabase
    .from('contas_pagar_fixas')
    .update(updates)
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .select('*, categorias_despesa(nome)')
    .single()
  if (error) throw error
  return mapFixa(data as Record<string, unknown>)
}

export async function toggleContaPagarFixa(
  id: string,
  empresaId: string,
  ativa: boolean
): Promise<ContaPagarFixa> {
  return updateContaPagarFixa(id, empresaId, { ativa })
}

export async function listContasPagar(
  empresaId: string,
  options?: ListContasPagarOptions
): Promise<ContaPagar[]> {
  const limit = options?.limit != null ? Math.min(Math.max(options.limit, 1), 2000) : 500
  let query = supabase
    .from('contas_pagar')
    .select('*, categorias_despesa(nome)')
    .eq('empresa_id', empresaId)

  if (options?.status === 'aberto' || options?.status === 'PENDENTE') {
    query = query.eq('status', 'PENDENTE')
  } else if (options?.status && options.status !== 'todas') {
    query = query.eq('status', options.status)
  }
  if (options?.categoria_id) query = query.eq('categoria_id', options.categoria_id)
  if (options?.competencia) query = query.eq('competencia', options.competencia)
  if (options?.vencimento_de) query = query.gte('vencimento', options.vencimento_de)
  if (options?.vencimento_ate) query = query.lte('vencimento', options.vencimento_ate)

  if (options?.status === 'PAGA') {
    query = query.order('pago_em', { ascending: false })
  } else {
    query = query.order('vencimento', { ascending: true }).order('created_at', { ascending: false })
  }

  const { data, error } = await query.limit(limit)
  if (error) throw error

  let rows = (data ?? []).map((r) => mapConta(r as Record<string, unknown>))
  if (options?.busca?.trim()) {
    const t = options.busca.trim().toLowerCase()
    rows = rows.filter(
      (c) =>
        c.descricao.toLowerCase().includes(t) ||
        (c.categoria_nome ?? '').toLowerCase().includes(t)
    )
  }
  return rows
}

export async function createContaPagar(input: CreateContaPagarInput): Promise<ContaPagar> {
  const descricao = input.descricao.trim()
  if (!descricao) throw new Error('Informe a descrição.')
  if (!Number.isFinite(input.valor) || input.valor <= 0) throw new Error('Informe um valor válido.')
  const vencimento = input.vencimento.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) throw new Error('Vencimento inválido.')
  const competencia = input.competencia || competenciaFromDate(vencimento)
  const now = new Date().toISOString()
  const row = {
    id: crypto.randomUUID(),
    empresa_id: input.empresa_id,
    categoria_id: input.categoria_id ?? null,
    conta_fixa_id: null,
    descricao,
    valor: input.valor,
    vencimento,
    competencia,
    tipo: 'AVULSA',
    status: 'PENDENTE',
    observacao: input.observacao?.trim() || null,
    created_at: now,
    updated_at: now,
  }
  const { data, error } = await supabase
    .from('contas_pagar')
    .insert(row)
    .select('*, categorias_despesa(nome)')
    .single()
  if (error) throw error
  return mapConta(data as Record<string, unknown>)
}

export async function updateContaPagar(
  id: string,
  empresaId: string,
  patch: UpdateContaPagarInput
): Promise<ContaPagar> {
  const { data: existing, error: exErr } = await supabase
    .from('contas_pagar')
    .select('*')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (exErr) throw exErr
  if (!existing) throw new Error('Conta não encontrada.')
  if (existing.status !== 'PENDENTE') throw new Error('Só é possível editar contas pendentes.')

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.descricao != null) {
    const d = patch.descricao.trim()
    if (!d) throw new Error('Informe a descrição.')
    updates.descricao = d
  }
  if (patch.valor != null) {
    if (!Number.isFinite(patch.valor) || patch.valor <= 0) throw new Error('Informe um valor válido.')
    updates.valor = patch.valor
  }
  if (patch.vencimento != null) {
    const v = patch.vencimento.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error('Vencimento inválido.')
    updates.vencimento = v
    updates.competencia = competenciaFromDate(v)
  }
  if (patch.categoria_id !== undefined) updates.categoria_id = patch.categoria_id
  if (patch.observacao !== undefined) updates.observacao = patch.observacao?.trim() || null

  const { data, error } = await supabase
    .from('contas_pagar')
    .update(updates)
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .select('*, categorias_despesa(nome)')
    .single()
  if (error) throw error
  return mapConta(data as Record<string, unknown>)
}

export async function cancelarContaPagar(id: string, empresaId: string): Promise<ContaPagar> {
  const { data: existing, error: exErr } = await supabase
    .from('contas_pagar')
    .select('status')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (exErr) throw exErr
  if (!existing) throw new Error('Conta não encontrada.')
  if (existing.status !== 'PENDENTE') throw new Error('Só é possível cancelar contas pendentes.')

  const { data, error } = await supabase
    .from('contas_pagar')
    .update({ status: 'CANCELADA', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .select('*, categorias_despesa(nome)')
    .single()
  if (error) throw error
  return mapConta(data as Record<string, unknown>)
}

export async function gerarCompetenciaContasPagar(
  empresaId: string,
  competencia?: string
): Promise<{ criadas: number; competencia: string }> {
  const comp = competencia || currentCompetencia()
  const { data: fixas, error: fErr } = await supabase
    .from('contas_pagar_fixas')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('ativa', 1)
  if (fErr) throw fErr

  const { data: existentes, error: eErr } = await supabase
    .from('contas_pagar')
    .select('conta_fixa_id')
    .eq('empresa_id', empresaId)
    .eq('competencia', comp)
    .neq('status', 'CANCELADA')
    .not('conta_fixa_id', 'is', null)
  if (eErr) throw eErr

  const jaTem = new Set(
    (existentes ?? [])
      .map((r) => (r as { conta_fixa_id: string | null }).conta_fixa_id)
      .filter((id): id is string => !!id)
  )

  const now = new Date().toISOString()
  const toInsert = (fixas ?? [])
    .filter((f) => !jaTem.has(String((f as { id: string }).id)))
    .map((f) => {
      const row = f as Record<string, unknown>
      const dia = Number(row.dia_vencimento) || 1
      return {
        id: crypto.randomUUID(),
        empresa_id: empresaId,
        categoria_id: row.categoria_id != null ? String(row.categoria_id) : null,
        conta_fixa_id: String(row.id),
        descricao: String(row.descricao ?? ''),
        valor: Number(row.valor_padrao) || 0,
        vencimento: vencimentoNaCompetencia(comp, dia),
        competencia: comp,
        tipo: 'FIXA',
        status: 'PENDENTE',
        observacao: row.observacao != null ? String(row.observacao) : null,
        created_at: now,
        updated_at: now,
      }
    })

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase.from('contas_pagar').insert(toInsert)
    if (insErr) throw insErr
  }

  return { criadas: toInsert.length, competencia: comp }
}

export async function gerarCompetenciasAbertura(empresaId: string): Promise<void> {
  const hoje = new Date()
  await gerarCompetenciaContasPagar(empresaId, currentCompetencia(hoje))
  if (hoje.getDate() >= 25) {
    await gerarCompetenciaContasPagar(empresaId, nextCompetencia(currentCompetencia(hoje)))
  }
}

export async function pagarContaPagar(input: PagarContaPagarInput): Promise<ContaPagar> {
  const { data: conta, error: cErr } = await supabase
    .from('contas_pagar')
    .select('*')
    .eq('id', input.conta_id)
    .maybeSingle()
  if (cErr) throw cErr
  if (!conta) throw new Error('Conta a pagar não encontrada.')
  if (conta.empresa_id !== input.empresa_id) throw new Error('Conta não pertence à empresa.')
  if (conta.status !== 'PENDENTE') throw new Error('Esta conta já foi paga ou cancelada.')
  const valorConta = Number(conta.valor) || 0
  if (valorConta <= 0) throw new Error('Ajuste o valor da conta antes de pagar.')

  const now = new Date().toISOString()
  const forma = (input.forma || 'DINHEIRO').toUpperCase()
  const updates: Record<string, unknown> = {
    status: 'PAGA',
    pago_em: now,
    forma_pagamento: forma,
    usuario_pagamento_id: input.usuario_id,
    updated_at: now,
  }

  if (input.modo === 'caixa') {
    if (!input.caixa_id) throw new Error('Informe o caixa aberto para dar baixa.')
    const { data: caixa, error: cxErr } = await supabase
      .from('caixas')
      .select('id, status, empresa_id')
      .eq('id', input.caixa_id)
      .maybeSingle()
    if (cxErr) throw cxErr
    if (!caixa || caixa.status !== 'ABERTO' || caixa.empresa_id !== input.empresa_id) {
      throw new Error('Pagamento no caixa exige o caixa aberto atual.')
    }

    const movimentoId = crypto.randomUUID()
    const { error: movErr } = await supabase.from('caixa_movimentos').insert({
      id: movimentoId,
      caixa_id: input.caixa_id,
      empresa_id: input.empresa_id,
      usuario_id: input.usuario_id,
      tipo: 'SANGRIA',
      valor: valorConta,
      motivo: `Conta a pagar: ${String(conta.descricao ?? '')}`,
      created_at: now,
    })
    if (movErr) throw movErr

    updates.pagamento_caixa_id = input.caixa_id
    updates.caixa_movimento_id = movimentoId
  }

  const { data, error } = await supabase
    .from('contas_pagar')
    .update(updates)
    .eq('id', input.conta_id)
    .select('*, categorias_despesa(nome)')
    .single()
  if (error) throw error
  return mapConta(data as Record<string, unknown>)
}

export const contasPagarApi = {
  listCategorias: listCategoriasDespesa,
  createCategoria: createCategoriaDespesa,
  updateCategoria: updateCategoriaDespesa,
  toggleCategoria: toggleCategoriaDespesa,
  listFixas: listContasPagarFixas,
  createFixa: createContaPagarFixa,
  updateFixa: updateContaPagarFixa,
  toggleFixa: toggleContaPagarFixa,
  list: listContasPagar,
  create: createContaPagar,
  update: updateContaPagar,
  cancelar: cancelarContaPagar,
  gerarCompetencia: gerarCompetenciaContasPagar,
  gerarCompetenciasAbertura,
  pagar: pagarContaPagar,
}
