import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireSaasAdmin } from '../_lib/auth'
import { invalidatePlanosCache } from '../../assinaturas/_lib/planos-service'
import { getSupabaseAdmin } from '../../assinaturas/_lib/supabase'
import type { PlanoId } from '../../assinaturas/_lib/planos'

const VALID_IDS = new Set(['basic', 'pro', 'ultra'])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  if (!requireSaasAdmin(req)) {
    res.status(401).json({ ok: false, error: 'Token de administrador SaaS inválido.' })
    return
  }

  const { planos } = req.body ?? {}
  if (!Array.isArray(planos) || planos.length === 0) {
    res.status(400).json({ ok: false, error: 'Envie um array planos com os dados a atualizar.' })
    return
  }

  const supabase = getSupabaseAdmin()
  const updatedAt = new Date().toISOString()

  for (const raw of planos) {
    const id = String(raw?.id ?? '')
    if (!VALID_IDS.has(id)) {
      res.status(400).json({ ok: false, error: `Plano inválido: ${id}` })
      return
    }

    const valor = Number(raw.valor_mensal ?? raw.valor)
    if (!Number.isFinite(valor) || valor < 0) {
      res.status(400).json({ ok: false, error: `Valor inválido para plano ${id}.` })
      return
    }

    const payload: Record<string, unknown> = {
      valor_mensal: Math.round(valor * 100) / 100,
      updated_at: updatedAt,
    }

    if (raw.nome !== undefined) payload.nome = String(raw.nome).trim().slice(0, 80)
    if (raw.descricao !== undefined) payload.descricao = String(raw.descricao).trim().slice(0, 500)
    if (raw.notas_fiscais !== undefined) payload.notas_fiscais = raw.notas_fiscais ? 1 : 0
    if (raw.loja_online !== undefined) payload.loja_online = raw.loja_online ? 1 : 0
    if (raw.destaque !== undefined) payload.destaque = raw.destaque ? 1 : 0
    if (raw.ativo !== undefined) payload.ativo = raw.ativo ? 1 : 0
    if (raw.ordem !== undefined && Number.isFinite(Number(raw.ordem))) payload.ordem = Number(raw.ordem)

    if (raw.recursos !== undefined) {
      if (!Array.isArray(raw.recursos)) {
        res.status(400).json({ ok: false, error: `Recursos do plano ${id} devem ser uma lista.` })
        return
      }
      payload.recursos_json = JSON.stringify(
        raw.recursos.map((r: unknown) => String(r).trim()).filter((r: string) => r.length > 0)
      )
    }

    const { error } = await supabase.from('saas_planos').update(payload).eq('id', id)
    if (error) {
      const hint = error.message.includes('saas_planos')
        ? ' Execute sql/supabase-saas-planos.sql no Supabase.'
        : ''
      res.status(500).json({ ok: false, error: `${error.message}${hint}` })
      return
    }
  }

  invalidatePlanosCache()
  res.status(200).json({ ok: true, message: 'Planos atualizados.' })
}
