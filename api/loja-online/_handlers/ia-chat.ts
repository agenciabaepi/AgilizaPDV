import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from '../_lib/supabase'
import { param, parsePeriodo, requireIaAdmin } from '../_lib/ia-request'
import { loadInteligenciaMetricas } from '../_lib/inteligencia-metricas'
import { loadIaConfig, openAiChat, type OpenAiMessage } from '../_lib/openai'
import { IA_CHAT_SYSTEM_PROMPT } from '../_lib/ia-prompts'

const MAX_HISTORY = 12

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }
  const auth = requireIaAdmin(req, res)
  if (!auth) return
  const { empresaId } = auth
  const supabase = getSupabaseAdmin()

  const body = (req.body ?? {}) as Record<string, unknown>
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .map((m) => m as { role?: unknown; content?: unknown })
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: String(m.content).slice(0, 2000) }))
  if (!history.length || history[history.length - 1].role !== 'user') {
    res.status(400).json({ ok: false, error: 'Envie uma pergunta.' })
    return
  }

  try {
    const cfg = await loadIaConfig(supabase, empresaId)
    if (!cfg.apiKey) {
      res.status(400).json({ ok: false, error: 'Configure sua chave da API da OpenAI primeiro.' })
      return
    }

    const analiseId = param(req, 'analiseId')
    let metricas: unknown = null
    let analiseAnterior: unknown = null
    if (analiseId) {
      const { data } = await supabase
        .from('loja_online_ia_analises')
        .select('metricas, resultado')
        .eq('empresa_id', empresaId)
        .eq('id', analiseId)
        .maybeSingle()
      metricas = data?.metricas ?? null
      analiseAnterior = data?.resultado ?? null
    }
    if (!metricas) {
      const periodo = parsePeriodo(req)
      if (typeof periodo === 'string') {
        res.status(400).json({ ok: false, error: periodo })
        return
      }
      metricas = await loadInteligenciaMetricas(supabase, empresaId, periodo.inicio, periodo.fim)
    }

    const messages: OpenAiMessage[] = [
      { role: 'system', content: IA_CHAT_SYSTEM_PROMPT },
      {
        role: 'system',
        content: `Contexto (JSON): ${JSON.stringify({ metricas, analise_anterior: analiseAnterior })}`,
      },
      ...history,
    ]
    const ai = await openAiChat({ apiKey: cfg.apiKey, model: cfg.model, messages, maxTokens: 6000 })
    res.status(200).json({ ok: true, resposta: ai.content })
  } catch (err) {
    console.error('[loja-online/ia-chat]', err)
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Falha ao consultar a IA.' })
  }
}
