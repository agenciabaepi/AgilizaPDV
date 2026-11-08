import { supabase } from './supabase'
import type { VendaComNfce } from '../vite-env'

export type DemonstrativoPeriodo = 'hoje' | 'semana' | 'mes'

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
  fonte: DemonstrativoCmvFonte
}

export type DemonstrativoCmvDetalhe = {
  periodo: DemonstrativoPeriodo
  periodoLabel: string
  total: number
  itens: DemonstrativoCmvItem[]
}

export function getDemonstrativoPeriodoRange(
  periodo: DemonstrativoPeriodo
): { dataInicio: string; dataFim: string } {
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

export function labelDemonstrativoPeriodo(periodo: DemonstrativoPeriodo): string {
  if (periodo === 'hoje') return 'Hoje'
  if (periodo === 'semana') return 'Esta semana'
  return 'Este mês'
}

function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function itemKey(vendaId: string, produtoId: string): string {
  return `${vendaId}:${produtoId}`
}

type AccProduto = {
  quantidade: number
  custo_total: number
  receita: number
  nome: string
  qtdEstoque: number
  qtdCadastro: number
}

async function fetchVendasConcluidas(
  empresaId: string,
  periodo: DemonstrativoPeriodo
): Promise<{ dataInicio: string; dataFim: string; concluidas: VendaComNfce[] }> {
  const { dataInicio, dataFim } = getDemonstrativoPeriodoRange(periodo)
  const vendas = await window.electronAPI.vendas.list(empresaId, {
    dataInicio,
    dataFim,
    limit: 50_000,
  })
  return {
    dataInicio,
    dataFim,
    concluidas: vendas.filter((v) => v.status === 'CONCLUIDA'),
  }
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
      return {
        produto_id,
        nome: acc.nome || 'Produto',
        quantidade: acc.quantidade,
        custo_unitario: acc.quantidade > 0 ? acc.custo_total / acc.quantidade : 0,
        custo_total: acc.custo_total,
        receita: acc.receita,
        fonte,
      }
    })
    .sort((a, b) => b.custo_total - a.custo_total)

  const total = itens.reduce((s, i) => s + i.custo_total, 0)
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
    total += (v.total * pct) / 100
  }
  return total
}

export async function loadDemonstrativoResumo(
  empresaId: string,
  periodo: DemonstrativoPeriodo
): Promise<DemonstrativoResumo> {
  const { dataInicio, dataFim, concluidas } = await fetchVendasConcluidas(empresaId, periodo)
  const receita = concluidas.reduce((acc, v) => acc + Number(v.total || 0), 0)
  const vendaIds = concluidas.map((v) => v.id)

  const { total: cmv } = await fetchCmvBreakdown(empresaId, vendaIds)

  const comissoes = await fetchComissoesTotal(empresaId, concluidas)
  const lucroBruto = receita - cmv
  const ebitda = lucroBruto - comissoes
  const lucroLiquido = ebitda

  const pct = (parte: number) => (receita > 0 ? (parte / receita) * 100 : null)

  return {
    periodo,
    periodoLabel: labelDemonstrativoPeriodo(periodo),
    dataInicio,
    dataFim,
    qtdVendas: concluidas.length,
    receita,
    cmv,
    lucroBruto,
    comissoes,
    ebitda,
    lucroLiquido,
    margemBrutaPct: pct(lucroBruto),
    margemEbitdaPct: pct(ebitda),
    margemLiquidaPct: pct(lucroLiquido),
  }
}

export async function loadDemonstrativoCmvDetalhe(
  empresaId: string,
  periodo: DemonstrativoPeriodo
): Promise<DemonstrativoCmvDetalhe> {
  const { concluidas } = await fetchVendasConcluidas(empresaId, periodo)
  const { total, itens } = await fetchCmvBreakdown(
    empresaId,
    concluidas.map((v) => v.id)
  )

  return {
    periodo,
    periodoLabel: labelDemonstrativoPeriodo(periodo),
    total,
    itens,
  }
}
