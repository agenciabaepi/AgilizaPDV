import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireSaasAdmin } from '../_lib/auth'
import { getSupabaseAdmin } from '../../assinaturas/_lib/supabase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  if (!requireSaasAdmin(req)) {
    res.status(401).json({ ok: false, error: 'Token de administrador SaaS inválido.' })
    return
  }

  const { empresaId, modulos, lojaOnlineAtiva } = req.body ?? {}
  if (!empresaId) {
    res.status(400).json({ ok: false, error: 'empresaId é obrigatório.' })
    return
  }

  const supabase = getSupabaseAdmin()
  const id = String(empresaId)
  const updatedAt = new Date().toISOString()
  const payload: Record<string, unknown> = { updated_at: updatedAt }

  if (modulos !== undefined) {
    if (typeof modulos !== 'object' || modulos === null) {
      res.status(400).json({ ok: false, error: 'modulos deve ser um objeto.' })
      return
    }
    payload.modulos_json = JSON.stringify(modulos)
  }

  if (lojaOnlineAtiva !== undefined) {
    payload.loja_online_ativa = lojaOnlineAtiva ? 1 : 0
  }

  const { data: existing } = await supabase
    .from('empresas_config')
    .select('empresa_id')
    .eq('empresa_id', id)
    .maybeSingle()

  if (!existing) {
    const { error: insertErr } = await supabase.from('empresas_config').insert({
      empresa_id: id,
      ...payload,
    })
    if (insertErr) {
      res.status(500).json({ ok: false, error: insertErr.message })
      return
    }
    res.status(200).json({ ok: true, message: 'Configuração criada.' })
    return
  }

  const { error } = await supabase.from('empresas_config').update(payload).eq('empresa_id', id)
  if (error) {
    res.status(500).json({ ok: false, error: error.message })
    return
  }

  res.status(200).json({ ok: true, message: 'Recursos atualizados.' })
}
