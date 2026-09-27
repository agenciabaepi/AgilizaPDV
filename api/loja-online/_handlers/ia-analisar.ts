import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from '../_lib/supabase'
import { param, parsePeriodo, requireIaAdmin } from '../_lib/ia-request'
import { loadInteligenciaMetricas } from '../_lib/inteligencia-metricas'
import { loadIaConfig, openAiChat } from '../_lib/openai'
import { IA_ANALISE_PARTES, iaAnaliseSystemPrompt } from '../_lib/ia-prompts'
import { fetchMetaInsights, loadMetaAuth, toMetaDate } from '../_lib/meta-ads'

const MAX_ANALISES_POR_HORA = 15

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = requireIaAdmin(req, res)
  if (!auth) return
  const { empresaId, session } = auth
  const supabase = getSupabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('loja_online_ia_analises')
      .select('id, periodo_inicio, periodo_fim, modelo, foco, resultado, tokens_entrada, tokens_saida, created_at')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) {
      res.status(500).json({ ok: false, error: error.message })
      return
    }
    res.status(200).json({ ok: true, analises: data ?? [] })
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  const periodo = parsePeriodo(req)
  if (typeof periodo === 'string') {
    res.status(400).json({ ok: false, error: periodo })
    return
  }
  const foco = param(req, 'foco').slice(0, 500) || null
  const inicioMs = Date.now()

  try {
    const cfg = await loadIaConfig(supabase, empresaId)
    if (!cfg.apiKey) {
      res.status(400).json({ ok: false, error: 'Configure sua chave da API da OpenAI antes de gerar análises.' })
      return
    }

    const umaHoraAtras = new Date(Date.now() - 3600_000).toISOString()
    const { count } = await supabase
      .from('loja_online_ia_analises')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .gte('created_at', umaHoraAtras)
    if ((count ?? 0) >= MAX_ANALISES_POR_HORA) {
      res.status(429).json({ ok: false, error: `Limite de ${MAX_ANALISES_POR_HORA} análises por hora atingido.` })
      return
    }

    const duracao = Date.parse(periodo.fim) - Date.parse(periodo.inicio)
    const anteriorFim = new Date(Date.parse(periodo.inicio) - 1).toISOString()
    const anteriorInicio = new Date(Date.parse(periodo.inicio) - duracao).toISOString()

    const [metricas, anterior, loja, meta] = await Promise.all([
      loadInteligenciaMetricas(supabase, empresaId, periodo.inicio, periodo.fim),
      loadInteligenciaMetricas(supabase, empresaId, anteriorInicio, anteriorFim).catch(() => null),
      supabase
        .from('empresas_config')
        .select('loja_online_titulo, loja_online_frete_tipo, loja_online_frete_gratis_ativo, loja_online_frete_gratis_minimo, loja_online_exigir_cadastro')
        .eq('empresa_id', empresaId)
        .maybeSingle()
        .then((r) => r.data),
      loadMetaResumo(empresaId, periodo.inicio, periodo.fim),
    ])

    if (metricas.qualidade_dados.sessoes_total === 0) {
      res.status(400).json({ ok: false, error: 'Ainda não há visitas registradas neste período para analisar.' })
      return
    }

    const contexto = {
      loja: {
        nome: loja?.loja_online_titulo ?? null,
        tipo_frete: loja?.loja_online_frete_tipo ?? null,
        frete_gratis_ativo: Number(loja?.loja_online_frete_gratis_ativo) === 1,
        frete_gratis_minimo: loja?.loja_online_frete_gratis_minimo ?? null,
        exige_cadastro_para_comprar: Number(loja?.loja_online_exigir_cadastro) === 1,
      },
      metricas_periodo_atual: metricas,
      periodo_anterior_resumo: anterior
        ? {
            periodo: anterior.periodo,
            visao_geral: anterior.visao_geral,
            funil: anterior.funil,
            abandono_carrinho_pct: anterior.carrinho.abandono_pct,
            valor_abandonado_estimado: anterior.carrinho.valor_abandonado_estimado,
            conversao_apos_cotacao_frete_pct: anterior.frete.conversao_apos_cotacao_pct,
          }
        : null,
      meta_ads: meta,
    }

    const userPrompt = [
      foco ? `FOCO PEDIDO PELO LOJISTA: ${foco}\n` : '',
      'Dados da loja (JSON):',
      JSON.stringify(compactar(contexto)),
    ].join('\n')
    const restanteMs = Math.max(20_000, (process.env.VERCEL ? 57_000 : 180_000) - (Date.now() - inicioMs))

    const partes = await Promise.allSettled(
      IA_ANALISE_PARTES.map(async (parte) => {
        const ai = await openAiChat({
          apiKey: cfg.apiKey!,
          model: cfg.model,
          json: true,
          maxTokens: 8000,
          timeoutMs: restanteMs,
          messages: [
            { role: 'system', content: iaAnaliseSystemPrompt(parte.formato) },
            { role: 'user', content: userPrompt },
          ],
        })
        try {
          return { ai, dados: JSON.parse(ai.content) as Record<string, unknown> }
        } catch {
          throw new Error('A IA retornou um formato inesperado. Tente novamente.')
        }
      })
    )

    const ok = partes.filter((p): p is PromiseFulfilledResult<{ ai: Awaited<ReturnType<typeof openAiChat>>; dados: Record<string, unknown> }> => p.status === 'fulfilled')
    if (ok.length === 0) {
      const erro = partes[0].status === 'rejected' ? partes[0].reason : null
      throw erro instanceof Error ? erro : new Error('Falha ao gerar análise.')
    }
    const resultado: Record<string, unknown> = Object.assign({}, ...ok.map((p) => p.value.dados))
    const falhas = partes.length - ok.length
    if (falhas > 0) {
      const limites = Array.isArray(resultado.limitacoes_dos_dados) ? (resultado.limitacoes_dos_dados as string[]) : []
      resultado.limitacoes_dos_dados = [...limites, `${falhas} parte(s) da análise não foram geradas a tempo; gere novamente para completar.`]
    }
    const ai = {
      tokensIn: ok.reduce((a, p) => a + (p.value.ai.tokensIn ?? 0), 0),
      tokensOut: ok.reduce((a, p) => a + (p.value.ai.tokensOut ?? 0), 0),
    }

    const { data: saved, error } = await supabase
      .from('loja_online_ia_analises')
      .insert({
        empresa_id: empresaId,
        periodo_inicio: periodo.inicio,
        periodo_fim: periodo.fim,
        modelo: cfg.model,
        foco,
        resultado,
        metricas,
        tokens_entrada: ai.tokensIn,
        tokens_saida: ai.tokensOut,
        created_by: session.id,
      })
      .select('id, periodo_inicio, periodo_fim, modelo, foco, resultado, tokens_entrada, tokens_saida, created_at')
      .single()
    if (error) throw new Error(error.message)

    res.status(200).json({ ok: true, analise: saved, metricas })
  } catch (err) {
    console.error('[loja-online/ia-analisar]', err)
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Falha ao gerar análise.' })
  }
}

/** Remove nulos, strings vazias e listas/objetos vazios para reduzir tokens. */
function compactar(v: unknown): unknown {
  if (Array.isArray(v)) {
    const arr = v.map(compactar).filter((x) => x !== undefined)
    return arr.length ? arr : undefined
  }
  if (v && typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => [k, compactar(x)] as const)
      .filter(([, x]) => x !== undefined)
    return entries.length ? Object.fromEntries(entries) : undefined
  }
  if (v === null || v === '') return undefined
  return v
}

async function loadMetaResumo(empresaId: string, inicio: string, fim: string) {
  try {
    const { auth, adAccountId } = await loadMetaAuth(empresaId)
    if (!auth?.access_token || !adAccountId) return null
    const insights = await fetchMetaInsights({
      accessToken: auth.access_token,
      adAccountId,
      since: toMetaDate(inicio),
      until: toMetaDate(fim),
    })
    return {
      investimento: insights.spend,
      impressoes: insights.impressions,
      cliques: insights.clicks,
      ctr: insights.ctr,
      compras_pixel: insights.purchases,
      roas: insights.roas,
      idade_impressoes: insights.age,
      sexo_impressoes: insights.gender,
      campanhas: insights.campaigns.slice(0, 8),
    }
  } catch {
    return null
  }
}
