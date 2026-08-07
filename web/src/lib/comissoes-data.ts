import { supabase } from './supabase'
import type { VendaComNfce, Usuario } from '../vite-env'

export type ComissaoPeriodo = 'hoje' | 'semana' | 'mes'

export type ComissaoConfig = {
  comissao_percentual_padrao: number
}

export type ComissaoVendedorResumo = {
  usuario_id: string
  nome: string
  role: string
  comissao_percentual: number
  meta_vendas_mes: number | null
  qtd_vendas: number
  total_vendido: number
  total_comissao: number
  vendido_mes_atual: number
  percentual_meta: number | null
}

export type ComissaoVendaDetalhe = {
  venda_id: string
  numero: number
  created_at: string
  usuario_id: string
  vendedor_nome: string
  total: number
  comissao_percentual: number
  comissao_valor: number
  status: string
  venda_online: boolean
}

export type ComissaoTopProduto = {
  produto_id: string
  descricao: string
  quantidade: number
  receita: number
}

export type ComissaoRelatorio = {
  config: ComissaoConfig
  vendedores: ComissaoVendedorResumo[]
  vendas: ComissaoVendaDetalhe[]
  topProdutos: ComissaoTopProduto[]
  periodoLabel: string
  empresaNome: string
}

export function getComissaoPeriodoRange(periodo: ComissaoPeriodo): { dataInicio: string; dataFim: string } {
  const now = new Date()
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  if (periodo === 'hoje') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    return { dataInicio: start.toISOString(), dataFim: endOfToday.toISOString() }
  }

  if (periodo === 'semana') {
    const day = now.getDay()
    const startSemana = new Date(now)
    startSemana.setDate(now.getDate() - day)
    startSemana.setHours(0, 0, 0, 0)
    return { dataInicio: startSemana.toISOString(), dataFim: endOfToday.toISOString() }
  }

  const startMes = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  return { dataInicio: startMes.toISOString(), dataFim: endOfToday.toISOString() }
}

export function getMesAtualRange(): { dataInicio: string; dataFim: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { dataInicio: start.toISOString(), dataFim: end.toISOString() }
}

export function labelComissaoPeriodo(periodo: ComissaoPeriodo): string {
  if (periodo === 'hoje') return 'Hoje'
  if (periodo === 'semana') return 'Esta semana'
  return 'Este mês'
}

function resolvePercentual(usuario: Usuario, padrao: number): number {
  const raw = usuario.comissao_percentual
  if (raw != null && !Number.isNaN(Number(raw))) return Math.max(0, Number(raw))
  return Math.max(0, padrao)
}

function vendaElegivelComissao(v: VendaComNfce): boolean {
  return v.status === 'CONCLUIDA' && Number(v.venda_online) !== 1
}

async function fetchComissaoConfig(empresaId: string): Promise<ComissaoConfig> {
  const { data } = await supabase
    .from('empresas_config')
    .select('comissao_percentual_padrao')
    .eq('empresa_id', empresaId)
    .maybeSingle()

  return {
    comissao_percentual_padrao: Math.max(0, Number(data?.comissao_percentual_padrao ?? 0)),
  }
}

async function fetchUsuariosComComissao(empresaId: string): Promise<Usuario[]> {
  const extended = await supabase
    .from('usuarios')
    .select('id, empresa_id, nome, login, email, role, modulos_json, created_at, comissao_percentual, meta_vendas_mes')
    .eq('empresa_id', empresaId)
    .order('nome')

  if (!extended.error) {
    return (extended.data ?? []).map((row) => ({
      id: String(row.id),
      empresa_id: String(row.empresa_id),
      nome: String(row.nome),
      login: String(row.login),
      email: row.email != null ? String(row.email) : null,
      role: String(row.role),
      modulos_json: row.modulos_json != null ? String(row.modulos_json) : null,
      created_at: String(row.created_at ?? ''),
      comissao_percentual: row.comissao_percentual != null ? Number(row.comissao_percentual) : null,
      meta_vendas_mes: row.meta_vendas_mes != null ? Number(row.meta_vendas_mes) : null,
    }))
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, empresa_id, nome, login, email, role, modulos_json, created_at')
    .eq('empresa_id', empresaId)
    .order('nome')

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    empresa_id: String(row.empresa_id),
    nome: String(row.nome),
    login: String(row.login),
    email: row.email != null ? String(row.email) : null,
    role: String(row.role),
    modulos_json: row.modulos_json != null ? String(row.modulos_json) : null,
    created_at: String(row.created_at ?? ''),
    comissao_percentual: null,
    meta_vendas_mes: null,
  }))
}

async function aggregateTopProdutos(
  vendaIds: string[],
  usuarioId?: string | null
): Promise<ComissaoTopProduto[]> {
  if (vendaIds.length === 0) return []

  const qtyMap = new Map<string, { quantidade: number; receita: number; descricao: string }>()

  for (let i = 0; i < vendaIds.length; i += 200) {
    const chunk = vendaIds.slice(i, i + 200)
    let query = supabase
      .from('venda_itens')
      .select('produto_id, descricao, quantidade, total, venda_id, vendas!inner(usuario_id)')
      .in('venda_id', chunk)

    if (usuarioId) {
      query = query.eq('vendas.usuario_id', usuarioId)
    }

    const { data: itens } = await query

    for (const item of itens ?? []) {
      const pid = item.produto_id != null ? String(item.produto_id) : `desc:${item.descricao}`
      const entry = qtyMap.get(pid) ?? {
        quantidade: 0,
        receita: 0,
        descricao: String(item.descricao),
      }
      entry.quantidade += Number(item.quantidade)
      entry.receita += Number(item.total)
      qtyMap.set(pid, entry)
    }
  }

  return [...qtyMap.entries()]
    .sort((a, b) => b[1].quantidade - a[1].quantidade)
    .slice(0, 10)
    .map(([id, stats]) => ({
      produto_id: id,
      descricao: stats.descricao,
      quantidade: stats.quantidade,
      receita: stats.receita,
    }))
}

async function aggregateTopProdutosSimples(vendaIds: string[]): Promise<ComissaoTopProduto[]> {
  if (vendaIds.length === 0) return []

  const qtyMap = new Map<string, { quantidade: number; receita: number; descricao: string }>()

  for (let i = 0; i < vendaIds.length; i += 200) {
    const chunk = vendaIds.slice(i, i + 200)
    const { data: itens } = await supabase
      .from('venda_itens')
      .select('produto_id, descricao, quantidade, total')
      .in('venda_id', chunk)

    for (const item of itens ?? []) {
      const pid = item.produto_id != null ? String(item.produto_id) : `desc:${item.descricao}`
      const entry = qtyMap.get(pid) ?? {
        quantidade: 0,
        receita: 0,
        descricao: String(item.descricao),
      }
      entry.quantidade += Number(item.quantidade)
      entry.receita += Number(item.total)
      qtyMap.set(pid, entry)
    }
  }

  return [...qtyMap.entries()]
    .sort((a, b) => b[1].quantidade - a[1].quantidade)
    .slice(0, 10)
    .map(([id, stats]) => ({
      produto_id: id,
      descricao: stats.descricao,
      quantidade: stats.quantidade,
      receita: stats.receita,
    }))
}

export async function loadComissaoRelatorio(
  empresaId: string,
  periodo: ComissaoPeriodo,
  options?: {
    usuarioId?: string | null
    vendas?: VendaComNfce[]
    vendasMesAtual?: VendaComNfce[]
  }
): Promise<ComissaoRelatorio> {
  const { dataInicio, dataFim } = getComissaoPeriodoRange(periodo)
  const mesRange = getMesAtualRange()

  const [config, usuarios, empresaRow, vendasPeriodo, vendasMes] = await Promise.all([
    fetchComissaoConfig(empresaId),
    fetchUsuariosComComissao(empresaId),
    supabase.from('empresas').select('nome').eq('id', empresaId).maybeSingle(),
    options?.vendas
      ? Promise.resolve(options.vendas)
      : window.electronAPI.vendas.list(empresaId, {
          dataInicio,
          dataFim,
          limit: 10_000,
        }),
    options?.vendasMesAtual
      ? Promise.resolve(options.vendasMesAtual)
      : window.electronAPI.vendas.list(empresaId, {
          dataInicio: mesRange.dataInicio,
          dataFim: mesRange.dataFim,
          limit: 10_000,
        }),
  ])

  const usuarioMap = new Map(usuarios.map((u) => [u.id, u]))
  const percentualMap = new Map(
    usuarios.map((u) => [u.id, resolvePercentual(u, config.comissao_percentual_padrao)])
  )

  const filtroUsuario = options?.usuarioId ?? null

  const elegiveis = vendasPeriodo.filter(vendaElegivelComissao)
  const elegiveisFiltradas = filtroUsuario
    ? elegiveis.filter((v) => v.usuario_id === filtroUsuario)
    : elegiveis

  const vendasMesElegiveis = vendasMes.filter(vendaElegivelComissao)

  const resumoMap = new Map<string, ComissaoVendedorResumo>()

  for (const u of usuarios) {
    if (filtroUsuario && u.id !== filtroUsuario) continue
    resumoMap.set(u.id, {
      usuario_id: u.id,
      nome: u.nome,
      role: u.role,
      comissao_percentual: percentualMap.get(u.id) ?? config.comissao_percentual_padrao,
      meta_vendas_mes: u.meta_vendas_mes ?? null,
      qtd_vendas: 0,
      total_vendido: 0,
      total_comissao: 0,
      vendido_mes_atual: 0,
      percentual_meta: null,
    })
  }

  for (const v of vendasMesElegiveis) {
    if (filtroUsuario && v.usuario_id !== filtroUsuario) continue
    const entry = resumoMap.get(v.usuario_id)
    if (entry) entry.vendido_mes_atual += v.total
  }

  const vendasDetalhe: ComissaoVendaDetalhe[] = []

  for (const v of elegiveisFiltradas) {
    const usuario = usuarioMap.get(v.usuario_id)
    const pct = percentualMap.get(v.usuario_id) ?? config.comissao_percentual_padrao
    const comissaoValor = (v.total * pct) / 100

    let entry = resumoMap.get(v.usuario_id)
    if (!entry && usuario) {
      entry = {
        usuario_id: v.usuario_id,
        nome: usuario.nome,
        role: usuario.role,
        comissao_percentual: pct,
        meta_vendas_mes: usuario.meta_vendas_mes ?? null,
        qtd_vendas: 0,
        total_vendido: 0,
        total_comissao: 0,
        vendido_mes_atual: 0,
        percentual_meta: null,
      }
      resumoMap.set(v.usuario_id, entry)
    } else if (!entry) {
      entry = {
        usuario_id: v.usuario_id,
        nome: 'Vendedor removido',
        role: '—',
        comissao_percentual: pct,
        meta_vendas_mes: null,
        qtd_vendas: 0,
        total_vendido: 0,
        total_comissao: 0,
        vendido_mes_atual: 0,
        percentual_meta: null,
      }
      resumoMap.set(v.usuario_id, entry)
    }

    entry!.qtd_vendas += 1
    entry!.total_vendido += v.total
    entry!.total_comissao += comissaoValor

    vendasDetalhe.push({
      venda_id: v.id,
      numero: v.numero,
      created_at: v.created_at,
      usuario_id: v.usuario_id,
      vendedor_nome: usuario?.nome ?? entry!.nome,
      total: v.total,
      comissao_percentual: pct,
      comissao_valor: comissaoValor,
      status: v.status,
      venda_online: Number(v.venda_online) === 1,
    })
  }

  for (const entry of resumoMap.values()) {
    if (entry.meta_vendas_mes != null && entry.meta_vendas_mes > 0) {
      entry.percentual_meta = Math.min(100, (entry.vendido_mes_atual / entry.meta_vendas_mes) * 100)
    }
  }

  const vendedores = [...resumoMap.values()]
    .filter((v) => !filtroUsuario || v.usuario_id === filtroUsuario)
    .sort((a, b) => b.total_vendido - a.total_vendido)

  const vendaIds = elegiveisFiltradas.map((v) => v.id)
  let topProdutos: ComissaoTopProduto[]
  try {
    topProdutos = await aggregateTopProdutos(vendaIds, filtroUsuario)
  } catch {
    topProdutos = await aggregateTopProdutosSimples(vendaIds)
  }

  return {
    config,
    vendedores,
    vendas: vendasDetalhe.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ),
    topProdutos,
    periodoLabel: labelComissaoPeriodo(periodo),
    empresaNome: empresaRow.data?.nome?.trim() || 'Empresa',
  }
}

export async function saveComissaoConfigPadrao(
  empresaId: string,
  comissao_percentual_padrao: number
): Promise<void> {
  const valor = Math.max(0, Math.min(100, comissao_percentual_padrao))
  const { error } = await supabase
    .from('empresas_config')
    .upsert({ empresa_id: empresaId, comissao_percentual_padrao: valor }, { onConflict: 'empresa_id' })
  if (error) throw error
}
