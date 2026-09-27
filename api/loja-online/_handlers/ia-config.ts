import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from '../_lib/supabase'
import { param, requireIaAdmin } from '../_lib/ia-request'
import { loadIaConfig, maskApiKey, OPENAI_DEFAULT_MODEL, validateOpenAiKey } from '../_lib/openai'

const MODEL_RE = /^[a-z0-9][a-z0-9._:-]{1,63}$/i

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = requireIaAdmin(req, res)
  if (!auth) return
  const { empresaId } = auth
  const supabase = getSupabaseAdmin()

  try {
    if (req.method === 'GET') {
      const cfg = await loadIaConfig(supabase, empresaId)
      res.status(200).json({ ok: true, configured: !!cfg.apiKey, keyMask: maskApiKey(cfg.apiKey), model: cfg.model })
      return
    }

    if (req.method === 'POST') {
      const apiKey = param(req, 'apiKey')
      const model = param(req, 'model') || OPENAI_DEFAULT_MODEL
      if (!MODEL_RE.test(model)) {
        res.status(400).json({ ok: false, error: 'Nome de modelo inválido.' })
        return
      }
      const current = await loadIaConfig(supabase, empresaId)
      if (!apiKey && !current.apiKey) {
        res.status(400).json({ ok: false, error: 'Informe a chave da API da OpenAI.' })
        return
      }
      if (apiKey) {
        if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(apiKey)) {
          res.status(400).json({ ok: false, error: 'A chave deve começar com "sk-".' })
          return
        }
        await validateOpenAiKey(apiKey)
      }
      const { error } = await supabase.from('loja_online_ia_config').upsert({
        empresa_id: empresaId,
        openai_api_key: apiKey || current.apiKey,
        openai_model: model,
        updated_at: new Date().toISOString(),
      })
      if (error) throw new Error(error.message)
      res.status(200).json({ ok: true, configured: true, keyMask: maskApiKey(apiKey || current.apiKey), model })
      return
    }

    if (req.method === 'DELETE') {
      const { error } = await supabase.from('loja_online_ia_config').delete().eq('empresa_id', empresaId)
      if (error) throw new Error(error.message)
      res.status(200).json({ ok: true, configured: false, keyMask: null, model: OPENAI_DEFAULT_MODEL })
      return
    }

    res.status(405).json({ ok: false, error: 'Método não permitido.' })
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Falha na configuração da IA.' })
  }
}
