import type { SupabaseClient } from '@supabase/supabase-js'

export type CapaEventoRow = {
  session_id: string
  produto_id: string | null
  props: Record<string, unknown> | null
}

export type CapaDesignRow = {
  modelo_nome: string
  status: string
  pedido_id: string | null
  created_at: string
}

type CapaSess = {
  etapas: Set<string>
  modelos: Set<string>
  modeloCarrinho: string | null
  valorCarrinho: number
  textos: number
}

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100
const pct = (part: number, total: number) => (total > 0 ? r1((part / total) * 100) : 0)
const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)
const median = (arr: number[]) => {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const bump = (m: Map<string, number>, k: string | null | undefined) => {
  if (k) m.set(k, (m.get(k) ?? 0) + 1)
}
const top = (m: Map<string, number>, limit: number) =>
  [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([nome, total]) => ({ nome, total }))

export function capaProdutoIdsDosEventos(eventos: CapaEventoRow[]): Set<string> {
  const ids = new Set<string>()
  for (const e of eventos) if (e.produto_id) ids.add(e.produto_id)
  return ids
}

/**
 * Funil do editor de capa por sessão (eventos "capa_step") + vendas reais das artes salvas.
 * Retorna null quando a loja não teve nenhum sinal de capa personalizada no período.
 */
export function resumirCapaPersonalizada(input: {
  eventos: CapaEventoRow[]
  designs: CapaDesignRow[]
  sessoesQueViramProduto: number
  sessoesQueCompraram: Set<string>
  tempoEditorS: number[]
}) {
  const sessoes = new Map<string, CapaSess>()
  const erros = new Map<string, number>()
  const ajudaViram = new Set<string>()
  const ajudaClicaram = new Set<string>()
  let ajudaExibicoes = 0
  let ajudaCliques = 0
  const editarArte = new Set<string>()
  const outraCapa = new Set<string>()
  for (const e of input.eventos) {
    const p = e.props ?? {}
    const etapa = str(p.etapa)
    if (!etapa) continue
    if (etapa === 'erro') {
      bump(erros, `${str(p.etapa_erro) ?? 'editor'}: ${str(p.msg)?.slice(0, 140) ?? 'erro'}`)
      continue
    }
    if (etapa === 'ajuda_whatsapp_exibida') {
      ajudaViram.add(e.session_id)
      ajudaExibicoes++
      continue
    }
    if (etapa === 'ajuda_whatsapp_clique') {
      ajudaClicaram.add(e.session_id)
      ajudaCliques++
      continue
    }
    if (etapa === 'carrinho_editar_arte') {
      editarArte.add(e.session_id)
      continue
    }
    if (etapa === 'carrinho_outra_capa') {
      outraCapa.add(e.session_id)
      continue
    }
    let cs = sessoes.get(e.session_id)
    if (!cs) {
      cs = { etapas: new Set(), modelos: new Set(), modeloCarrinho: null, valorCarrinho: 0, textos: 0 }
      sessoes.set(e.session_id, cs)
    }
    cs.etapas.add(etapa)
    const modelo = str(p.modelo)
    if (etapa === 'modelo' && modelo) cs.modelos.add(modelo)
    if (etapa === 'texto') cs.textos++
    if (etapa === 'carrinho') {
      cs.modeloCarrinho = modelo ?? cs.modeloCarrinho
      cs.valorCarrinho += num(p.valor) ?? 0
    }
  }

  const comecaram = sessoes.size
  if (comecaram === 0 && input.sessoesQueViramProduto === 0 && input.designs.length === 0) return null

  const nivel = (cs: CapaSess) =>
    cs.etapas.has('carrinho') ? 5
      : cs.etapas.has('finalizar') ? 4
        : cs.etapas.has('foto') || cs.etapas.has('texto') ? 3
          : cs.etapas.has('modelo') ? 2
            : cs.etapas.has('editor_aberto') ? 1
              : 0
  const linhas = [...sessoes.entries()].map(([sid, cs]) => ({ cs, n: nivel(cs), comprou: input.sessoesQueCompraram.has(sid) }))

  const etapas: [string, number][] = [
    ['Viram a página da capa', input.sessoesQueViramProduto],
    ['Clicaram em Personalizar / abriram o editor', comecaram],
    ['Escolheram o modelo', linhas.filter((l) => l.n >= 2).length],
    ['Enviaram foto ou texto', linhas.filter((l) => l.n >= 3).length],
    ['Clicaram em Finalizar', linhas.filter((l) => l.n >= 4).length],
    ['Colocaram no carrinho', linhas.filter((l) => l.n >= 5).length],
    ['Compraram', linhas.filter((l) => l.n >= 5 && l.comprou).length],
  ]
  let anterior = 0
  const funil = etapas.map(([etapa, n], i) => {
    const row = {
      etapa,
      sessoes: n,
      pct_de_quem_comecou: i === 0 ? null : pct(n, comecaram),
      queda_da_etapa_anterior_pct: i > 0 && anterior > 0 ? r1(100 - (n / anterior) * 100) : null,
    }
    anterior = n
    return row
  })

  const saiuEm = new Map<string, number>()
  const modelosEscolhidos = new Map<string, number>()
  const modelosCarrinho = new Map<string, number>()
  const abandonaram = linhas.filter((l) => !(l.n >= 5 && l.comprou))
  for (const l of abandonaram) {
    bump(
      saiuEm,
      l.n >= 5 ? 'colocou no carrinho e não comprou'
        : l.n === 4 ? 'abriu Finalizar e desistiu'
          : l.n === 3 ? 'montou a capa e saiu sem finalizar'
            : l.n === 2 ? 'escolheu o modelo e saiu sem enviar foto'
              : l.n === 1 ? 'abriu o editor e saiu sem escolher o modelo'
                : 'clicou em Personalizar mas o editor não chegou a abrir'
    )
  }
  for (const l of linhas) {
    for (const m of l.cs.modelos) bump(modelosEscolhidos, m)
    bump(modelosCarrinho, l.cs.modeloCarrinho)
  }

  const designsValidos = input.designs.filter((d) => d.status !== 'cancelado')
  const vendidas = designsValidos.filter((d) => d.pedido_id)
  const vendasPorModelo = new Map<string, number>()
  for (const d of vendidas) bump(vendasPorModelo, d.modelo_nome)
  const tempo = input.tempoEditorS

  return {
    tracking_por_sessao: {
      sessoes_que_comecaram: comecaram,
      abandonaram: abandonaram.length,
      abandono_pct: pct(abandonaram.length, comecaram),
      valor_no_carrinho_nao_comprado: r2(linhas.filter((l) => l.n >= 5 && !l.comprou).reduce((a, l) => a + l.cs.valorCarrinho, 0)),
      usaram_texto_pct: pct(linhas.filter((l) => l.cs.textos > 0).length, comecaram),
      trocaram_de_modelo: linhas.filter((l) => l.cs.modelos.size > 1).length,
      tempo_medio_no_editor_s: tempo.length ? r1(avg(tempo)) : null,
      tempo_mediano_no_editor_s: tempo.length ? r1(median(tempo)) : null,
    },
    funil,
    abandonaram_em: top(saiuEm, 6),
    modelos_mais_escolhidos: top(modelosEscolhidos, 15),
    modelos_no_carrinho: top(modelosCarrinho, 15),
    erros_top: top(erros, 8),
    ajuda_whatsapp: {
      sessoes_que_viram: ajudaViram.size,
      exibicoes: ajudaExibicoes,
      sessoes_que_clicaram: ajudaClicaram.size,
      cliques: ajudaCliques,
      taxa_clique_pct: pct(ajudaClicaram.size, ajudaViram.size),
    },
    acoes_no_carrinho: {
      editaram_a_arte: editarArte.size,
      criaram_outra_capa: outraCapa.size,
    },
    artes_salvas: {
      capas_colocadas_no_carrinho: designsValidos.length,
      capas_vendidas: vendidas.length,
      capas_nao_compradas: designsValidos.length - vendidas.length,
      conversao_carrinho_para_venda_pct: pct(vendidas.length, designsValidos.length),
      vendas_por_modelo: top(vendasPorModelo, 15),
    },
  }
}

export type CapaPersonalizadaResumo = NonNullable<ReturnType<typeof resumirCapaPersonalizada>>

async function todas<T>(q: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await q(from, from + 999)
    if (error) throw error
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < 1000) break
  }
  return out
}

/** Versão leve para o Dashboard: lê só os eventos da capa, sem montar todas as métricas da IA. */
export async function loadCapaPersonalizada(supabase: SupabaseClient, empresaId: string, inicio: string, fim: string) {
  const [eventos, tempos, designs] = await Promise.all([
    todas<CapaEventoRow>((from, to) =>
      supabase
        .from('loja_online_comportamento')
        .select('session_id, produto_id, props')
        .eq('empresa_id', empresaId)
        .eq('event_type', 'capa_step')
        .gte('created_at', inicio)
        .lte('created_at', fim)
        .range(from, to)
    ),
    todas<{ props: Record<string, unknown> | null }>((from, to) =>
      supabase
        .from('loja_online_comportamento')
        .select('props')
        .eq('empresa_id', empresaId)
        .eq('event_type', 'page_leave')
        .like('path', '%/personalizar/%')
        .gte('created_at', inicio)
        .lte('created_at', fim)
        .range(from, to)
    ),
    todas<CapaDesignRow>((from, to) =>
      supabase
        .from('loja_online_capa_designs')
        .select('modelo_nome, status, pedido_id, created_at')
        .eq('empresa_id', empresaId)
        .gte('created_at', inicio)
        .lte('created_at', fim)
        .range(from, to)
    ).catch(() => [] as CapaDesignRow[]),
  ])

  const capaIds = [...capaProdutoIdsDosEventos(eventos)]
  const viram = new Set<string>()
  if (capaIds.length) {
    const views = await todas<{ session_id: string }>((from, to) =>
      supabase
        .from('loja_online_eventos')
        .select('session_id')
        .eq('empresa_id', empresaId)
        .eq('event_name', 'view_content')
        .in('produto_id', capaIds)
        .gte('created_at', inicio)
        .lte('created_at', fim)
        .range(from, to)
    )
    for (const v of views) viram.add(v.session_id)
  }

  const compraram = new Set<string>()
  const sessoesCapa = [...new Set(eventos.map((e) => e.session_id))]
  for (let i = 0; i < sessoesCapa.length; i += 200) {
    const { data } = await supabase
      .from('loja_online_eventos')
      .select('session_id')
      .eq('empresa_id', empresaId)
      .eq('event_name', 'purchase')
      .in('session_id', sessoesCapa.slice(i, i + 200))
      .gte('created_at', inicio)
      .lte('created_at', fim)
    for (const r of data ?? []) compraram.add(String(r.session_id))
  }

  const tempoEditorS = tempos
    .map((t) => num(t.props?.ms_active))
    .filter((ms): ms is number => ms !== null && ms > 0 && ms < 30 * 60_000)
    .map((ms) => ms / 1000)

  return resumirCapaPersonalizada({ eventos, designs, sessoesQueViramProduto: viram.size, sessoesQueCompraram: compraram, tempoEditorS })
}
