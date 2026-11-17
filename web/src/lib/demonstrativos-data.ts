import { supabase } from './supabase'
import type { ContaPagar } from './contas-pagar-types'
import type { VendaComNfce } from '../vite-env'

/** Competência no formato YYYY-MM */
export type DemonstrativoPeriodo = string

export type DemonstrativoAba = 'ebitda' | 'dre' | 'cmv' | 'contas' | 'compras'

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_LONGOS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export type DemonstrativoResumo = {
  periodo: DemonstrativoPeriodo
  periodoLabel: string
  dataInicio: string
  dataFim: string
  qtdVendas: number
  receita: number
  cmv: number
  lucroBruto: number
  comissoes: number
  ebitda: number
  lucroLiquido: number
  margemBrutaPct: number | null
  margemEbitdaPct: number | null
  margemLiquidaPct: number | null
}

export type DemonstrativoCmvFonte = 'estoque' | 'cadastro' | 'misto'

export type DemonstrativoCmvItem = {
  produto_id: string
  nome: string
  quantidade: number
  custo_unitario: number
  custo_total: number
  receita: number
  lucro: number
  margemPct: number | null
  fonte: DemonstrativoCmvFonte
}

export type DemonstrativoCmvDetalhe = {
  periodo: DemonstrativoPeriodo
  periodoLabel: string
  total: number
  receitaItens: number
  lucroItens: number
  itens: DemonstrativoCmvItem[]
}

export type DemonstrativoContaItem = {
  id: string
  descricao: string
  categoria_nome: string | null
  tipo: 'FIXA' | 'AVULSA'
  status: ContaPagar['status']
  valor: number
  vencimento: string
  competencia: string
  pago_em: string | null
}

export type DemonstrativoCategoriaGasto = {
  categoria: string
  valor: number
  qtd: number
  pct: number | null
}

export type DemonstrativoContasGrupo = {
  total: number
  pago: number
  pendente: number
  qtd: number
  itens: DemonstrativoContaItem[]
  porCategoria: DemonstrativoCategoriaGasto[]
}

export type DemonstrativoCompraItem = {
  produto_id: string
  nome: string
  quantidade: number
  custo_unitario: number
  custo_total: number
  qtd_movimentos: number
  ultima_entrada: string | null
}

export type DemonstrativoDreLinha = {
  id: string
  label: string
  valor: number
  pctReceita: number | null
  nivel: 0 | 1 | 2
  tipo: 'receita' | 'deducao' | 'subtotal' | 'resultado' | 'info'
  sinal?: '+' | '−' | '='
}

export type DemonstrativoCompleto = {
  periodo: DemonstrativoPeriodo
  periodoLabel: string
  dataInicio: string
  dataFim: string
  qtdVendas: number
  qtdVendasCanceladas: number
  receitaBruta: number
  descontos: number
  cashbackUsado: number
  cashbackGerado: number
  receita: number
  ticketMedio: number
  cmv: number
  cmvItens: DemonstrativoCmvItem[]
  lucroBruto: number
  comissoes: number
  despesasFixas: DemonstrativoContasGrupo
  despesasVariaveis: DemonstrativoContasGrupo
  despesasOperacionais: number
  compras: {
    total: number
    quantidade: number
    qtdProdutos: number
    itens: DemonstrativoCompraItem[]
  }
  ebitda: number
  lucroLiquido: number
  margemBrutaPct: number | null
  margemEbitdaPct: number | null
  margemLiquidaPct: number | null
  cmvSobreReceitaPct: number | null
  dre: DemonstrativoDreLinha[]
}

export function currentDemonstrativoCompetencia(d = new Date()): DemonstrativoPeriodo {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function shiftDemonstrativoCompetencia(comp: string, delta: number): DemonstrativoPeriodo {
  const [ys, ms] = comp.split('-')
  const base = new Date(Number(ys), Number(ms) - 1 + delta, 1)
  return currentDemonstrativoCompetencia(base)
}

export function buildDemonstrativoMesTabs(centro: string, raio = 5): DemonstrativoPeriodo[] {
  const tabs: DemonstrativoPeriodo[] = []
  for (let i = -raio; i <= raio; i += 1) {
    tabs.push(shiftDemonstrativoCompetencia(centro, i))
  }
  return tabs
}

export function labelDemonstrativoCompetenciaCurta(comp: string): string {
  const [ys, ms] = comp.split('-')
  const m = Number(ms) - 1
  return `${MESES_CURTOS[m] ?? ms}/${ys.slice(2)}`
}

export function getDemonstrativoPeriodoRange(
  periodo: DemonstrativoPeriodo
): { dataInicio: string; dataFim: string } {
  // Legado: hoje | semana | mes (mantido por compatibilidade)
  if (periodo === 'hoje' || periodo === 'semana' || periodo === 'mes') {
    const now = new Date()
    const dataFim = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    if (periodo === 'hoje') {
      const dataInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      return { dataInicio: dataInicio.toISOString(), dataFim: dataFim.toISOString() }
    }
    if (periodo === 'semana') {
      const dataInicio = new Date(now)
      dataInicio.setDate(now.getDate() - now.getDay())
      dataInicio.setHours(0, 0, 0, 0)
      return { dataInicio: dataInicio.toISOString(), dataFim: dataFim.toISOString() }
    }
    const dataInicio = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    return { dataInicio: dataInicio.toISOString(), dataFim: dataFim.toISOString() }
  }

  const [ys, ms] = periodo.split('-')
  const y = Number(ys)
  const m = Number(ms) - 1
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 0 || m > 11) {
    return getDemonstrativoPeriodoRange(currentDemonstrativoCompetencia())
  }
  const dataInicio = new Date(y, m, 1, 0, 0, 0, 0)
  const dataFim = new Date(y, m + 1, 0, 23, 59, 59, 999)
  return { dataInicio: dataInicio.toISOString(), dataFim: dataFim.toISOString() }
}

export function labelDemonstrativoPeriodo(periodo: DemonstrativoPeriodo): string {
  if (periodo === 'hoje') return 'Hoje'
  if (periodo === 'semana') return 'Esta semana'
  if (periodo === 'mes') return 'Este mês'
  const [ys, ms] = periodo.split('-')
  const m = Number(ms) - 1
  if (!Number.isFinite(m) || m < 0 || m > 11) return periodo
  return `${MESES_LONGOS[m]} de ${ys}`
}

function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function itemKey(vendaId: string, produtoId: string): string {
  return `${vendaId}:${produtoId}`
}

function pctOf(parte: number, base: number): number | null {
  return base > 0 ? (parte / base) * 100 : null
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

type AccProduto = {
  quantidade: number
  custo_total: number
  receita: number
  nome: string
  qtdEstoque: number
  qtdCadastro: number
}

async function fetchVendasPeriodo(
  empresaId: string,
  periodo: DemonstrativoPeriodo
): Promise<{ dataInicio: string; dataFim: string; vendas: VendaComNfce[] }> {
  const { dataInicio, dataFim } = getDemonstrativoPeriodoRange(periodo)
  const vendas = await window.electronAPI.vendas.list(empresaId, {
    dataInicio,
    dataFim,
    limit: 50_000,
  })
  return { dataInicio, dataFim, vendas }
}

async function fetchCmvBreakdown(
  empresaId: string,
  vendaIds: string[]
): Promise<{ total: number; itens: DemonstrativoCmvItem[] }> {
  if (vendaIds.length === 0) return { total: 0, itens: [] }

  const covered = new Set<string>()
  const byProduto = new Map<string, AccProduto>()

  const ensure = (produtoId: string, nome: string): AccProduto => {
    let acc = byProduto.get(produtoId)
    if (!acc) {
      acc = { quantidade: 0, custo_total: 0, receita: 0, nome, qtdEstoque: 0, qtdCadastro: 0 }
      byProduto.set(produtoId, acc)
    } else if (nome && (!acc.nome || acc.nome === 'Produto')) {
      acc.nome = nome
    }
    return acc
  }

  for (const chunk of chunkIds(vendaIds, 200)) {
    const { data } = await supabase
      .from('estoque_movimentos')
      .select('referencia_id, produto_id, quantidade, custo_unitario')
      .eq('empresa_id', empresaId)
      .eq('tipo', 'SAIDA')
      .eq('referencia_tipo', 'VENDA')
      .in('referencia_id', chunk)

    for (const row of data ?? []) {
      const vendaId = row.referencia_id != null ? String(row.referencia_id) : ''
      const produtoId = row.produto_id != null ? String(row.produto_id) : ''
      if (!vendaId || !produtoId) continue
      const qty = Number(row.quantidade || 0)
      const custoUnit = Number(row.custo_unitario || 0)
      const acc = ensure(produtoId, 'Produto')
      acc.quantidade += qty
      acc.custo_total += qty * custoUnit
      acc.qtdEstoque += qty
      covered.add(itemKey(vendaId, produtoId))
    }
  }

  type ItemRow = { venda_id: string; produto_id: string; quantidade: number; total: number; descricao: string }
  const fallbackItens: ItemRow[] = []

  for (const chunk of chunkIds(vendaIds, 200)) {
    const { data: itens } = await supabase
      .from('venda_itens')
      .select('venda_id, produto_id, quantidade, total, descricao')
      .in('venda_id', chunk)

    for (const item of itens ?? []) {
      if (!item.produto_id || !item.venda_id) continue
      const vendaId = String(item.venda_id)
      const produtoId = String(item.produto_id)
      const qty = Number(item.quantidade || 0)
      const receita = Number(item.total || 0)
      const nome = String(item.descricao || 'Produto')

      if (covered.has(itemKey(vendaId, produtoId))) {
        const acc = ensure(produtoId, nome)
        acc.receita += receita
        if (nome) acc.nome = nome
        continue
      }

      fallbackItens.push({
        venda_id: vendaId,
        produto_id: produtoId,
        quantidade: qty,
        total: receita,
        descricao: nome,
      })
    }
  }

  if (fallbackItens.length > 0) {
    const produtoIds = [...new Set(fallbackItens.map((i) => i.produto_id))]
    const custoMap = new Map<string, number>()
    const nomeMap = new Map<string, string>()

    for (const chunk of chunkIds(produtoIds, 200)) {
      const { data: produtos } = await supabase.from('produtos').select('id, custo, nome').in('id', chunk)
      for (const p of produtos ?? []) {
        custoMap.set(String(p.id), Number(p.custo) || 0)
        if (p.nome) nomeMap.set(String(p.id), String(p.nome))
      }
    }

    for (const item of fallbackItens) {
      const custoUnit = custoMap.get(item.produto_id) ?? 0
      const nome = nomeMap.get(item.produto_id) || item.descricao || 'Produto'
      const acc = ensure(item.produto_id, nome)
      acc.quantidade += item.quantidade
      acc.custo_total += item.quantidade * custoUnit
      acc.receita += item.total
      acc.qtdCadastro += item.quantidade
    }
  }

  const missingNomes = [...byProduto.entries()]
    .filter(([, acc]) => !acc.nome || acc.nome === 'Produto')
    .map(([id]) => id)

  if (missingNomes.length > 0) {
    for (const chunk of chunkIds(missingNomes, 200)) {
      const { data: produtos } = await supabase.from('produtos').select('id, nome').in('id', chunk)
      for (const p of produtos ?? []) {
        const acc = byProduto.get(String(p.id))
        if (acc && p.nome) acc.nome = String(p.nome)
      }
    }
  }

  const itens: DemonstrativoCmvItem[] = [...byProduto.entries()]
    .map(([produto_id, acc]) => {
      let fonte: DemonstrativoCmvFonte = 'estoque'
      if (acc.qtdEstoque > 0 && acc.qtdCadastro > 0) fonte = 'misto'
      else if (acc.qtdCadastro > 0) fonte = 'cadastro'
      const custo_total = round2(acc.custo_total)
      const receita = round2(acc.receita)
      const lucro = round2(receita - custo_total)
      return {
        produto_id,
        nome: acc.nome || 'Produto',
        quantidade: acc.quantidade,
        custo_unitario: acc.quantidade > 0 ? custo_total / acc.quantidade : 0,
        custo_total,
        receita,
        lucro,
        margemPct: pctOf(lucro, receita),
        fonte,
      }
    })
    .sort((a, b) => b.custo_total - a.custo_total)

  const total = round2(itens.reduce((s, i) => s + i.custo_total, 0))
  return { total, itens }
}

async function fetchComissoesTotal(empresaId: string, vendas: VendaComNfce[]): Promise<number> {
  const elegiveis = vendas.filter((v) => v.status === 'CONCLUIDA' && Number(v.venda_online) !== 1)
  if (elegiveis.length === 0) return 0

  const [{ data: configRow }, { data: usuarios }] = await Promise.all([
    supabase
      .from('empresas_config')
      .select('comissao_percentual_padrao')
      .eq('empresa_id', empresaId)
      .maybeSingle(),
    supabase
      .from('usuarios')
      .select('id, comissao_percentual')
      .eq('empresa_id', empresaId),
  ])

  const padrao = Math.max(0, Number(configRow?.comissao_percentual_padrao ?? 0))
  const pctMap = new Map<string, number>()
  for (const u of usuarios ?? []) {
    const raw = u.comissao_percentual
    const pct =
      raw != null && !Number.isNaN(Number(raw)) ? Math.max(0, Number(raw)) : padrao
    pctMap.set(String(u.id), pct)
  }

  let total = 0
  for (const v of elegiveis) {
    const pct = pctMap.get(v.usuario_id) ?? padrao
    total += (Number(v.total) * pct) / 100
  }
  return round2(total)
}

function mapContaItem(c: ContaPagar): DemonstrativoContaItem {
  return {
    id: c.id,
    descricao: c.descricao,
    categoria_nome: c.categoria_nome ?? null,
    tipo: c.tipo,
    status: c.status,
    valor: Number(c.valor) || 0,
    vencimento: c.vencimento,
    competencia: c.competencia,
    pago_em: c.pago_em,
  }
}

function buildContasGrupo(itens: DemonstrativoContaItem[]): DemonstrativoContasGrupo {
  const ativos = itens.filter((i) => i.status !== 'CANCELADA')
  const total = round2(ativos.reduce((s, i) => s + i.valor, 0))
  const pago = round2(ativos.filter((i) => i.status === 'PAGA').reduce((s, i) => s + i.valor, 0))
  const pendente = round2(ativos.filter((i) => i.status === 'PENDENTE').reduce((s, i) => s + i.valor, 0))

  const byCat = new Map<string, { valor: number; qtd: number }>()
  for (const i of ativos) {
    const key = i.categoria_nome?.trim() || 'Sem categoria'
    const acc = byCat.get(key) ?? { valor: 0, qtd: 0 }
    acc.valor += i.valor
    acc.qtd += 1
    byCat.set(key, acc)
  }

  const porCategoria: DemonstrativoCategoriaGasto[] = [...byCat.entries()]
    .map(([categoria, acc]) => ({
      categoria,
      valor: round2(acc.valor),
      qtd: acc.qtd,
      pct: pctOf(acc.valor, total),
    }))
    .sort((a, b) => b.valor - a.valor)

  return {
    total,
    pago,
    pendente,
    qtd: ativos.length,
    itens: [...ativos].sort((a, b) => a.vencimento.localeCompare(b.vencimento) || b.valor - a.valor),
    porCategoria,
  }
}

async function fetchContasNoPeriodo(
  empresaId: string,
  dataInicio: string,
  dataFim: string,
  competencia?: string
): Promise<{ fixas: DemonstrativoContasGrupo; variaveis: DemonstrativoContasGrupo }> {
  let query = supabase
    .from('contas_pagar')
    .select('*, categorias_despesa(nome)')
    .eq('empresa_id', empresaId)
    .order('vencimento', { ascending: true })
    .limit(2000)

  if (competencia && /^\d{4}-\d{2}$/.test(competencia)) {
    query = query.eq('competencia', competencia)
  } else {
    query = query
      .gte('vencimento', dataInicio.slice(0, 10))
      .lte('vencimento', dataFim.slice(0, 10))
  }

  const { data, error } = await query

  if (error) throw error

  const rows: ContaPagar[] = (data ?? []).map((r) => {
    const row = r as Record<string, unknown>
    const catRaw = row.categorias_despesa
    const cat = Array.isArray(catRaw)
      ? (catRaw[0] as Record<string, unknown> | undefined)
      : (catRaw as Record<string, unknown> | null)
    return {
      id: String(row.id),
      empresa_id: String(row.empresa_id),
      categoria_id: row.categoria_id != null ? String(row.categoria_id) : null,
      conta_fixa_id: row.conta_fixa_id != null ? String(row.conta_fixa_id) : null,
      descricao: String(row.descricao ?? ''),
      valor: Number(row.valor) || 0,
      vencimento: String(row.vencimento ?? '').slice(0, 10),
      competencia: String(row.competencia ?? ''),
      tipo: row.tipo === 'FIXA' ? 'FIXA' : 'AVULSA',
      status: (row.status as ContaPagar['status']) || 'PENDENTE',
      pago_em: row.pago_em != null ? String(row.pago_em) : null,
      forma_pagamento: row.forma_pagamento != null ? String(row.forma_pagamento) : null,
      pagamento_caixa_id: row.pagamento_caixa_id != null ? String(row.pagamento_caixa_id) : null,
      caixa_movimento_id: row.caixa_movimento_id != null ? String(row.caixa_movimento_id) : null,
      usuario_pagamento_id: row.usuario_pagamento_id != null ? String(row.usuario_pagamento_id) : null,
      observacao: row.observacao != null ? String(row.observacao) : null,
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
      categoria_nome: cat?.nome != null ? String(cat.nome) : null,
    }
  })

  const itens = rows.map(mapContaItem)
  return {
    fixas: buildContasGrupo(itens.filter((i) => i.tipo === 'FIXA')),
    variaveis: buildContasGrupo(itens.filter((i) => i.tipo === 'AVULSA')),
  }
}

async function fetchComprasProduto(
  empresaId: string,
  dataInicio: string,
  dataFim: string
): Promise<DemonstrativoCompleto['compras']> {
  const { data, error } = await supabase
    .from('estoque_movimentos')
    .select('id, produto_id, quantidade, custo_unitario, created_at')
    .eq('empresa_id', empresaId)
    .eq('tipo', 'ENTRADA')
    .gte('created_at', dataInicio)
    .lte('created_at', dataFim)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) throw error

  const movimentos = data ?? []
  if (movimentos.length === 0) {
    return { total: 0, quantidade: 0, qtdProdutos: 0, itens: [] }
  }

  type AccCompra = {
    quantidade: number
    custo_total: number
    qtd_movimentos: number
    ultima_entrada: string | null
    nome: string
  }

  const byProduto = new Map<string, AccCompra>()
  for (const m of movimentos) {
    const produtoId = String(m.produto_id)
    const qty = Number(m.quantidade || 0)
    const custoUnit = Number(m.custo_unitario || 0)
    const acc = byProduto.get(produtoId) ?? {
      quantidade: 0,
      custo_total: 0,
      qtd_movimentos: 0,
      ultima_entrada: null,
      nome: 'Produto',
    }
    acc.quantidade += qty
    acc.custo_total += qty * custoUnit
    acc.qtd_movimentos += 1
    const created = m.created_at != null ? String(m.created_at) : null
    if (created && (!acc.ultima_entrada || created > acc.ultima_entrada)) {
      acc.ultima_entrada = created
    }
    byProduto.set(produtoId, acc)
  }

  const produtoIds = [...byProduto.keys()]
  for (const chunk of chunkIds(produtoIds, 200)) {
    const { data: produtos } = await supabase.from('produtos').select('id, nome').in('id', chunk)
    for (const p of produtos ?? []) {
      const acc = byProduto.get(String(p.id))
      if (acc && p.nome) acc.nome = String(p.nome)
    }
  }

  const itens: DemonstrativoCompraItem[] = [...byProduto.entries()]
    .map(([produto_id, acc]) => ({
      produto_id,
      nome: acc.nome,
      quantidade: acc.quantidade,
      custo_unitario: acc.quantidade > 0 ? acc.custo_total / acc.quantidade : 0,
      custo_total: round2(acc.custo_total),
      qtd_movimentos: acc.qtd_movimentos,
      ultima_entrada: acc.ultima_entrada,
    }))
    .sort((a, b) => b.custo_total - a.custo_total)

  return {
    total: round2(itens.reduce((s, i) => s + i.custo_total, 0)),
    quantidade: itens.reduce((s, i) => s + i.quantidade, 0),
    qtdProdutos: itens.length,
    itens,
  }
}

function buildDre(params: {
  receitaBruta: number
  descontos: number
  receita: number
  cmv: number
  lucroBruto: number
  comissoes: number
  despesasFixas: number
  despesasVariaveis: number
  cashbackGerado: number
  ebitda: number
  lucroLiquido: number
}): DemonstrativoDreLinha[] {
  const base = params.receita
  const line = (
    id: string,
    label: string,
    valor: number,
    nivel: 0 | 1 | 2,
    tipo: DemonstrativoDreLinha['tipo'],
    sinal?: DemonstrativoDreLinha['sinal']
  ): DemonstrativoDreLinha => ({
    id,
    label,
    valor: round2(valor),
    pctReceita: pctOf(valor, base),
    nivel,
    tipo,
    sinal,
  })

  return [
    line('receita_bruta', 'Receita bruta de vendas', params.receitaBruta, 0, 'receita', '+'),
    line('descontos', 'Descontos concedidos', params.descontos, 1, 'deducao', '−'),
    line('receita_liquida', 'Receita líquida', params.receita, 0, 'subtotal', '='),
    line('cmv', 'CMV — custo das mercadorias vendidas', params.cmv, 1, 'deducao', '−'),
    line('lucro_bruto', 'Lucro bruto', params.lucroBruto, 0, 'subtotal', '='),
    line('comissoes', 'Comissões de vendas (PDV)', params.comissoes, 1, 'deducao', '−'),
    line('despesas_fixas', 'Despesas com contas fixas', params.despesasFixas, 1, 'deducao', '−'),
    line('despesas_variaveis', 'Despesas com contas variáveis', params.despesasVariaveis, 1, 'deducao', '−'),
    line('cashback', 'Cashback gerado (provisão)', params.cashbackGerado, 1, 'deducao', '−'),
    line('ebitda', 'EBITDA (resultado operacional)', params.ebitda, 0, 'resultado', '='),
    line('lucro_liquido', 'Lucro líquido estimado', params.lucroLiquido, 0, 'resultado', '='),
  ]
}

export async function loadDemonstrativosCompleto(
  empresaId: string,
  periodo: DemonstrativoPeriodo
): Promise<DemonstrativoCompleto> {
  const { dataInicio, dataFim, vendas } = await fetchVendasPeriodo(empresaId, periodo)
  const concluidas = vendas.filter((v) => v.status === 'CONCLUIDA')
  const canceladas = vendas.filter((v) => v.status === 'CANCELADA')

  const receitaBruta = round2(concluidas.reduce((s, v) => s + Number(v.subtotal || 0), 0))
  const descontos = round2(concluidas.reduce((s, v) => s + Number(v.desconto_total || 0), 0))
  const receita = round2(concluidas.reduce((s, v) => s + Number(v.total || 0), 0))
  const cashbackUsado = round2(concluidas.reduce((s, v) => s + Number(v.cashback_usado || 0), 0))
  const cashbackGerado = round2(concluidas.reduce((s, v) => s + Number(v.cashback_gerado || 0), 0))

  const vendaIds = concluidas.map((v) => v.id)

  const competencia = /^\d{4}-\d{2}$/.test(periodo) ? periodo : undefined

  const [{ total: cmv, itens: cmvItens }, comissoes, contas, compras] = await Promise.all([
    fetchCmvBreakdown(empresaId, vendaIds),
    fetchComissoesTotal(empresaId, concluidas),
    fetchContasNoPeriodo(empresaId, dataInicio, dataFim, competencia),
    fetchComprasProduto(empresaId, dataInicio, dataFim),
  ])

  const lucroBruto = round2(receita - cmv)
  const despesasOperacionais = round2(
    comissoes + contas.fixas.total + contas.variaveis.total + cashbackGerado
  )
  const ebitda = round2(lucroBruto - despesasOperacionais)
  // Sem juros, impostos e depreciação cadastrados: lucro líquido estimado = EBITDA
  const lucroLiquido = ebitda

  const dre = buildDre({
    receitaBruta,
    descontos,
    receita,
    cmv,
    lucroBruto,
    comissoes,
    despesasFixas: contas.fixas.total,
    despesasVariaveis: contas.variaveis.total,
    cashbackGerado,
    ebitda,
    lucroLiquido,
  })

  return {
    periodo,
    periodoLabel: labelDemonstrativoPeriodo(periodo),
    dataInicio,
    dataFim,
    qtdVendas: concluidas.length,
    qtdVendasCanceladas: canceladas.length,
    receitaBruta,
    descontos,
    cashbackUsado,
    cashbackGerado,
    receita,
    ticketMedio: concluidas.length > 0 ? round2(receita / concluidas.length) : 0,
    cmv,
    cmvItens,
    lucroBruto,
    comissoes,
    despesasFixas: contas.fixas,
    despesasVariaveis: contas.variaveis,
    despesasOperacionais,
    compras,
    ebitda,
    lucroLiquido,
    margemBrutaPct: pctOf(lucroBruto, receita),
    margemEbitdaPct: pctOf(ebitda, receita),
    margemLiquidaPct: pctOf(lucroLiquido, receita),
    cmvSobreReceitaPct: pctOf(cmv, receita),
    dre,
  }
}

export async function loadDemonstrativoResumo(
  empresaId: string,
  periodo: DemonstrativoPeriodo
): Promise<DemonstrativoResumo> {
  const full = await loadDemonstrativosCompleto(empresaId, periodo)
  return {
    periodo: full.periodo,
    periodoLabel: full.periodoLabel,
    dataInicio: full.dataInicio,
    dataFim: full.dataFim,
    qtdVendas: full.qtdVendas,
    receita: full.receita,
    cmv: full.cmv,
    lucroBruto: full.lucroBruto,
    comissoes: full.comissoes,
    ebitda: full.ebitda,
    lucroLiquido: full.lucroLiquido,
    margemBrutaPct: full.margemBrutaPct,
    margemEbitdaPct: full.margemEbitdaPct,
    margemLiquidaPct: full.margemLiquidaPct,
  }
}

export async function loadDemonstrativoCmvDetalhe(
  empresaId: string,
  periodo: DemonstrativoPeriodo
): Promise<DemonstrativoCmvDetalhe> {
  const full = await loadDemonstrativosCompleto(empresaId, periodo)
  return {
    periodo: full.periodo,
    periodoLabel: full.periodoLabel,
    total: full.cmv,
    receitaItens: round2(full.cmvItens.reduce((s, i) => s + i.receita, 0)),
    lucroItens: round2(full.cmvItens.reduce((s, i) => s + i.lucro, 0)),
    itens: full.cmvItens,
  }
}
