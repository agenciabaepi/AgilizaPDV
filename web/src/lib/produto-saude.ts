/**
 * Dados da página "Saúde do produto": vendas, faturamento, lucro estimado,
 * margem e evolução do estoque, calculados a partir das vendas concluídas e
 * dos movimentos de estoque (o mesmo histórico da tela Estoque).
 */
import { supabase } from './supabase'

export type ProdutoSaudeBase = {
  id: string
  empresa_id: string
  codigo: number | null
  nome: string
  sku: string | null
  codigo_barras: string | null
  unidade: string | null
  imagem: string | null
  preco: number
  custo: number
  controla_estoque: boolean
  estoque_atual: number
  estoque_minimo: number
  ativo: boolean
  categoria_nome: string | null
  marca_nome: string | null
  created_at: string | null
}

export type DiaVenda = { dia: string; label: string; quantidade: number; faturamento: number; lucro: number }
export type DiaEstoque = { dia: string; label: string; saldo: number }
export type MovimentoResumo = { id: string; tipo: string; quantidade: number; created_at: string }

export type ProdutoSaude = {
  produto: ProdutoSaudeBase
  dias: number
  periodo: { quantidade: number; faturamento: number; lucro: number; vendas: number }
  periodoAnterior: { quantidade: number; faturamento: number }
  total: { quantidade: number; faturamento: number }
  ultimaVenda: string | null
  vendasPorDia: DiaVenda[]
  estoquePorDia: DiaEstoque[]
  movimentos: MovimentoResumo[]
}

const DIA_MS = 24 * 60 * 60 * 1000

/** Data local AAAA-MM-DD (fuso de São Paulo, como o resto do sistema). */
function diaLocal(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

function labelDia(dia: string): string {
  const [, m, d] = dia.split('-')
  return `${d}/${m}`
}

function listaDias(dias: number): string[] {
  const out: string[] = []
  const hoje = Date.now()
  for (let i = dias - 1; i >= 0; i--) out.push(diaLocal(new Date(hoje - i * DIA_MS)))
  return out
}

/** Efeito do movimento no saldo (mesma regra da tela Estoque). */
function efeitoMovimento(tipo: string, quantidade: number): number {
  const q = Number(quantidade) || 0
  if (tipo === 'SAIDA') return -Math.abs(q)
  if (tipo === 'AJUSTE') return q
  return Math.abs(q)
}

async function emLotesParalelo<T>(ids: string[], fn: (lote: string[]) => Promise<T[]>): Promise<T[]> {
  const lotes: string[][] = []
  for (let i = 0; i < ids.length; i += 150) lotes.push(ids.slice(i, i + 150))
  return (await Promise.all(lotes.map(fn))).flat()
}

export async function carregarSaudeProduto(produtoId: string, dias: number): Promise<ProdutoSaude | null> {
  const [{ data: p, error }, filhos] = await Promise.all([
    supabase.from('produtos').select('*').eq('id', produtoId).maybeSingle(),
    // Produto com variações: soma as vendas e o estoque dos filhos.
    supabase.from('produtos').select('id, estoque_atual').eq('produto_pai_id', produtoId),
  ])
  if (error) throw error
  if (!p) return null
  const row = p as Record<string, unknown>

  const nomes = Promise.all([
    row.categoria_id
      ? supabase.from('categorias').select('nome').eq('id', row.categoria_id as string).maybeSingle()
      : Promise.resolve({ data: null }),
    row.marca_id
      ? supabase.from('marcas').select('nome').eq('id', row.marca_id as string).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const filhosRows = ((filhos as { data: { id: string; estoque_atual: number | null }[] | null }).data ?? [])
  const ids = [produtoId, ...filhosRows.map((f) => f.id)]

  const produto: ProdutoSaudeBase = {
    id: String(row.id),
    empresa_id: String(row.empresa_id),
    codigo: row.codigo != null ? Number(row.codigo) : null,
    nome: String(row.nome ?? ''),
    sku: (row.sku as string | null) ?? null,
    codigo_barras: (row.codigo_barras as string | null) ?? null,
    unidade: (row.unidade as string | null) ?? 'UN',
    imagem: (row.imagem as string | null) ?? null,
    preco: Number(row.preco) || 0,
    custo: Number(row.custo) || 0,
    controla_estoque: Number(row.controla_estoque) === 1,
    estoque_atual:
      (Number(row.estoque_atual) || 0) + filhosRows.reduce((s, f) => s + (Number(f.estoque_atual) || 0), 0),
    estoque_minimo: Number(row.estoque_minimo) || 0,
    ativo: Number(row.ativo) !== 0,
    categoria_nome: null,
    marca_nome: null,
    created_at: (row.created_at as string | null) ?? null,
  }

  // Vendas, custos das variações e movimentos de estoque em paralelo (cada ida ao banco custa ~0,2–0,5 s).
  const carregarVendas = async () => {
    const { data: itensData, error: itensErr } = await supabase
      .from('venda_itens')
      .select('venda_id, produto_id, quantidade, total')
      .in('produto_id', ids)
      .limit(20000)
    if (itensErr) throw itensErr
    const its = (itensData ?? []) as { venda_id: string; produto_id: string; quantidade: number; total: number }[]
    const vendaIds = [...new Set(its.map((i) => i.venda_id))]
    const vendas = await emLotesParalelo(vendaIds, async (lote) => {
      const { data } = await supabase.from('vendas').select('id, created_at, status').in('id', lote)
      return (data ?? []) as { id: string; created_at: string; status: string }[]
    })
    return { itens: its, vendas }
  }
  const carregarCustos = async () => {
    if (!filhosRows.length) return [] as { id: string; custo: number | null }[]
    const { data } = await supabase.from('produtos').select('id, custo').in('id', ids)
    return (data ?? []) as { id: string; custo: number | null }[]
  }
  const carregarMovimentos = async () => {
    const { data } = await supabase
      .from('estoque_movimentos')
      .select('id, tipo, quantidade, created_at')
      .in('produto_id', ids)
      .gte('created_at', new Date(Date.now() - (dias + 1) * DIA_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(10000)
    return (data ?? []) as MovimentoResumo[]
  }
  const [{ itens, vendas }, custos, movs, [categoria, marca]] = await Promise.all([
    carregarVendas(),
    carregarCustos(),
    carregarMovimentos(),
    nomes,
  ])
  produto.categoria_nome = ((categoria as { data: { nome?: string } | null }).data?.nome as string) ?? null
  produto.marca_nome = ((marca as { data: { nome?: string } | null }).data?.nome as string) ?? null
  const vendaMap = new Map(vendas.filter((v) => v.status === 'CONCLUIDA').map((v) => [v.id, v.created_at]))

  // Custo por produto (variação pode ter custo próprio).
  const custoPorId = new Map<string, number>([[produtoId, produto.custo]])
  for (const c of custos) custoPorId.set(c.id, Number(c.custo) || produto.custo)

  const diasLista = listaDias(dias)
  const inicio = diasLista[0]
  const inicioAnterior = diaLocal(new Date(Date.now() - (2 * dias - 1) * DIA_MS))
  const porDia = new Map<string, DiaVenda>(
    diasLista.map((d) => [d, { dia: d, label: labelDia(d), quantidade: 0, faturamento: 0, lucro: 0 }])
  )
  const periodo = { quantidade: 0, faturamento: 0, lucro: 0, vendas: 0 }
  const periodoAnterior = { quantidade: 0, faturamento: 0 }
  const total = { quantidade: 0, faturamento: 0 }
  const vendasNoPeriodo = new Set<string>()
  let ultimaVenda: string | null = null

  for (const it of itens) {
    const criada = vendaMap.get(it.venda_id)
    if (!criada) continue
    const qtd = Number(it.quantidade) || 0
    const fat = Number(it.total) || 0
    const lucro = fat - qtd * (custoPorId.get(it.produto_id) ?? produto.custo)
    total.quantidade += qtd
    total.faturamento += fat
    if (!ultimaVenda || criada > ultimaVenda) ultimaVenda = criada
    const dia = diaLocal(new Date(criada))
    const slot = porDia.get(dia)
    if (slot) {
      slot.quantidade += qtd
      slot.faturamento += fat
      slot.lucro += lucro
      periodo.quantidade += qtd
      periodo.faturamento += fat
      periodo.lucro += lucro
      vendasNoPeriodo.add(it.venda_id)
    } else if (dia >= inicioAnterior && dia < inicio) {
      periodoAnterior.quantidade += qtd
      periodoAnterior.faturamento += fat
    }
  }
  periodo.vendas = vendasNoPeriodo.size

  // Estoque: parte do saldo de hoje e desfaz os movimentos para trás, dia a dia.
  const efeitoPorDia = new Map<string, number>()
  for (const m of movs) {
    const dia = diaLocal(new Date(m.created_at))
    efeitoPorDia.set(dia, (efeitoPorDia.get(dia) ?? 0) + efeitoMovimento(m.tipo, m.quantidade))
  }
  const estoquePorDia: DiaEstoque[] = []
  let saldo = produto.estoque_atual
  for (let i = diasLista.length - 1; i >= 0; i--) {
    const d = diasLista[i]
    estoquePorDia.unshift({ dia: d, label: labelDia(d), saldo: Math.round(saldo * 100) / 100 })
    saldo -= efeitoPorDia.get(d) ?? 0
  }

  return {
    produto,
    dias,
    periodo,
    periodoAnterior,
    total,
    ultimaVenda,
    vendasPorDia: [...porDia.values()],
    estoquePorDia,
    movimentos: movs.slice(0, 12),
  }
}
