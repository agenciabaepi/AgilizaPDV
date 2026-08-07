import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireSaasAdmin } from '../_lib/auth'
import { getSupabaseAdmin } from '../../assinaturas/_lib/supabase'
import { getPlanoAsync } from '../../assinaturas/_lib/planos-service'
import { normalizePlanoId, type PlanoId } from '../../assinaturas/_lib/planos'

async function syncPlanoFeatures(empresaId: string, planoId: PlanoId): Promise<void> {
  const plan = await getPlanoAsync(planoId)
  await getSupabaseAdmin()
    .from('empresas_config')
    .update({ loja_online_ativa: plan.lojaOnline ? 1 : 0 })
    .eq('empresa_id', empresaId)
}

const VALID_STATUS = new Set(['trial', 'active', 'pending_payment', 'expired', 'cancelled'])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  if (!requireSaasAdmin(req)) {
    res.status(401).json({ ok: false, error: 'Token de administrador SaaS inválido.' })
    return
  }

  const { empresaId, status, plano, trialDias, periodoDias, valorMensal } = req.body ?? {}
  if (!empresaId) {
    res.status(400).json({ ok: false, error: 'empresaId é obrigatório.' })
    return
  }

  const supabase = getSupabaseAdmin()
  const id = String(empresaId)
  const now = new Date()
  const updatedAt = now.toISOString()
  const payload: Record<string, unknown> = { updated_at: updatedAt }

  if (status !== undefined) {
    const s = String(status)
    if (!VALID_STATUS.has(s)) {
      res.status(400).json({ ok: false, error: 'Status de assinatura inválido.' })
      return
    }
    payload.status = s
  }

  if (plano !== undefined) {
    const planId = normalizePlanoId(String(plano)) as PlanoId
    const plan = await getPlanoAsync(planId)
    payload.plano = plan.id
    payload.valor_mensal = plan.valor
  }

  if (valorMensal !== undefined && Number.isFinite(Number(valorMensal))) {
    payload.valor_mensal = Number(valorMensal)
  }

  if (trialDias !== undefined && Number.isFinite(Number(trialDias))) {
    const dias = Math.max(0, Math.min(365, Number(trialDias)))
    const trialFim = new Date(now)
    trialFim.setDate(trialFim.getDate() + dias)
    payload.status = 'trial'
    payload.trial_fim = trialFim.toISOString()
    if (!payload.periodo_inicio) payload.periodo_inicio = updatedAt
    payload.periodo_fim = null
  }

  if (periodoDias !== undefined && Number.isFinite(Number(periodoDias))) {
    const dias = Math.max(1, Math.min(365, Number(periodoDias)))
    const periodoFim = new Date(now)
    periodoFim.setDate(periodoFim.getDate() + dias)
    payload.status = 'active'
    payload.periodo_inicio = updatedAt
    payload.periodo_fim = periodoFim.toISOString()
  }

  const { data: existing } = await supabase
    .from('empresa_assinaturas')
    .select('empresa_id, plano')
    .eq('empresa_id', id)
    .maybeSingle()

  if (!existing) {
    const plan = await getPlanoAsync(normalizePlanoId(String(plano ?? 'basic')))
    const trialFim = new Date(now)
    trialFim.setDate(trialFim.getDate() + 7)
    const { error: insertErr } = await supabase.from('empresa_assinaturas').insert({
      empresa_id: id,
      status: payload.status ?? 'trial',
      plano: payload.plano ?? plan.id,
      valor_mensal: payload.valor_mensal ?? plan.valor,
      periodo_inicio: payload.periodo_inicio ?? updatedAt,
      periodo_fim: payload.periodo_fim ?? null,
      trial_fim: payload.trial_fim ?? trialFim.toISOString(),
      created_at: updatedAt,
      updated_at: updatedAt,
    })
    if (insertErr) {
      res.status(500).json({ ok: false, error: insertErr.message })
      return
    }
    await syncPlanoFeatures(id, (payload.plano as PlanoId) ?? plan.id)
    res.status(200).json({ ok: true, message: 'Assinatura criada.' })
    return
  }

  const { error } = await supabase.from('empresa_assinaturas').update(payload).eq('empresa_id', id)
  if (error) {
    res.status(500).json({ ok: false, error: error.message })
    return
  }

  const finalPlano = (payload.plano as PlanoId | undefined) ?? normalizePlanoId(existing.plano)
  await syncPlanoFeatures(id, finalPlano)

  res.status(200).json({ ok: true, message: 'Assinatura atualizada.' })
}
