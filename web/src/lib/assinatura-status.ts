import { supabase } from './supabase'
import { getPlano, normalizePlanoId, PLANO_DEFAULT, type PlanoId } from './planos'
import type { AssinaturaPagamento, AssinaturaPublicStatus, AssinaturaStatus } from '../vite-env'

const TRIAL_DIAS = 7

export type EmpresaAssinaturaRow = {
  empresa_id: string
  status: AssinaturaStatus
  plano: string
  valor_mensal: number
  asaas_customer_id: string | null
  asaas_subscription_id: string | null
  asaas_payment_id: string | null
  periodo_inicio: string | null
  periodo_fim: string | null
  trial_fim: string | null
  created_at: string | null
  updated_at: string | null
}

function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null
  const end = new Date(isoDate)
  if (Number.isNaN(end.getTime())) return null
  return Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function isPast(isoDate: string | null): boolean {
  if (!isoDate) return false
  const d = new Date(isoDate)
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now()
}

function withPlano(row: EmpresaAssinaturaRow, base: Omit<AssinaturaPublicStatus, 'plano' | 'planoNome' | 'notasFiscais' | 'lojaOnline' | 'valorMensal'> & { valorMensal?: number }): AssinaturaPublicStatus {
  const plan = getPlano(row.plano)
  return {
    ...base,
    plano: plan.id,
    planoNome: plan.nome,
    valorMensal: base.valorMensal ?? plan.valor,
    notasFiscais: plan.notasFiscais,
    lojaOnline: plan.lojaOnline,
  }
}

export function computeAssinaturaStatus(row: EmpresaAssinaturaRow): AssinaturaPublicStatus {
  const plan = getPlano(row.plano)
  const valorMensal = row.valor_mensal || plan.valor

  if (row.status === 'cancelled') {
    return withPlano(row, {
      status: 'cancelled',
      bloqueado: true,
      valorMensal,
      trialFim: row.trial_fim,
      periodoFim: row.periodo_fim,
      diasRestantes: 0,
      mensagem: 'Assinatura cancelada. Renove para continuar usando o sistema.',
    })
  }

  if (row.status === 'trial') {
    if (!isPast(row.trial_fim)) {
      return withPlano(row, {
        status: 'trial',
        bloqueado: false,
        valorMensal,
        trialFim: row.trial_fim,
        periodoFim: row.periodo_fim,
        diasRestantes: daysUntil(row.trial_fim),
        mensagem: `Período de teste ativo — plano ${plan.nome}.`,
      })
    }
    return withPlano(row, {
      status: 'pending_payment',
      bloqueado: true,
      valorMensal,
      trialFim: row.trial_fim,
      periodoFim: row.periodo_fim,
      diasRestantes: 0,
      mensagem: 'Seu período de teste expirou. Escolha um plano e efetue o pagamento.',
    })
  }

  if (row.status === 'active') {
    if (!isPast(row.periodo_fim)) {
      return withPlano(row, {
        status: 'active',
        bloqueado: false,
        valorMensal,
        trialFim: row.trial_fim,
        periodoFim: row.periodo_fim,
        diasRestantes: daysUntil(row.periodo_fim),
        mensagem: `Assinatura ${plan.nome} ativa.`,
      })
    }
    return withPlano(row, {
      status: 'pending_payment',
      bloqueado: true,
      valorMensal,
      trialFim: row.trial_fim,
      periodoFim: row.periodo_fim,
      diasRestantes: 0,
      mensagem: 'Sua mensalidade venceu. Renove seu plano para continuar.',
    })
  }

  if (row.status === 'pending_payment' || row.status === 'expired') {
    return withPlano(row, {
      status: row.status,
      bloqueado: true,
      valorMensal,
      trialFim: row.trial_fim,
      periodoFim: row.periodo_fim,
      diasRestantes: 0,
      mensagem: 'Pagamento pendente. Efetue o PIX para liberar o acesso.',
    })
  }

  return withPlano(row, {
    status: row.status,
    bloqueado: true,
    valorMensal,
    trialFim: row.trial_fim,
    periodoFim: row.periodo_fim,
    diasRestantes: daysUntil(row.periodo_fim),
    mensagem: 'Verifique o status da sua assinatura.',
  })
}

export async function syncPlanoFeatures(empresaId: string, planoId: PlanoId): Promise<void> {
  const plan = getPlano(planoId)
  await supabase
    .from('empresas_config')
    .update({ loja_online_ativa: plan.lojaOnline ? 1 : 0 })
    .eq('empresa_id', empresaId)
}

async function ensureAssinaturaRow(empresaId: string): Promise<EmpresaAssinaturaRow> {
  const { data, error } = await supabase
    .from('empresa_assinaturas')
    .select('*')
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (error) {
    if (error.message.includes('does not exist') || error.code === '42P01') {
      throw new Error('Tabela de assinaturas não encontrada. Execute sql/supabase-assinaturas.sql no Supabase.')
    }
    throw new Error(`Falha ao buscar assinatura: ${error.message}`)
  }

  if (data) return data as EmpresaAssinaturaRow

  const createdAt = new Date().toISOString()
  const trialFim = new Date()
  trialFim.setDate(trialFim.getDate() + TRIAL_DIAS)
  const plan = getPlano(PLANO_DEFAULT)

  const row: EmpresaAssinaturaRow = {
    empresa_id: empresaId,
    status: 'trial',
    plano: plan.id,
    valor_mensal: plan.valor,
    asaas_customer_id: null,
    asaas_subscription_id: null,
    asaas_payment_id: null,
    periodo_inicio: createdAt,
    periodo_fim: null,
    trial_fim: trialFim.toISOString(),
    created_at: createdAt,
    updated_at: createdAt,
  }

  const { error: insertErr } = await supabase.from('empresa_assinaturas').insert(row)
  if (insertErr) throw new Error(`Falha ao criar assinatura: ${insertErr.message}`)
  await syncPlanoFeatures(empresaId, plan.id)
  return row
}

export async function loadAssinaturaStatus(empresaId: string): Promise<AssinaturaPublicStatus> {
  let row = await ensureAssinaturaRow(empresaId)
  const computed = computeAssinaturaStatus(row)

  const shouldMarkPending =
    (row.status === 'trial' || row.status === 'active') &&
    computed.bloqueado &&
    computed.status === 'pending_payment'

  if (shouldMarkPending && row.status !== 'pending_payment') {
    const updatedAt = new Date().toISOString()
    await supabase
      .from('empresa_assinaturas')
      .update({ status: 'pending_payment', updated_at: updatedAt })
      .eq('empresa_id', empresaId)
    row = { ...row, status: 'pending_payment', updated_at: updatedAt }
  }

  await syncPlanoFeatures(empresaId, normalizePlanoId(row.plano))
  return computeAssinaturaStatus(row)
}

export async function updateAssinaturaPlano(empresaId: string, planoId: PlanoId): Promise<void> {
  const plan = getPlano(planoId)
  const updatedAt = new Date().toISOString()
  await supabase
    .from('empresa_assinaturas')
    .update({
      plano: plan.id,
      valor_mensal: plan.valor,
      asaas_payment_id: null,
      updated_at: updatedAt,
    })
    .eq('empresa_id', empresaId)
  await syncPlanoFeatures(empresaId, plan.id)
}

export async function loadAssinaturaPagamentos(empresaId: string): Promise<AssinaturaPagamento[]> {
  const { data, error } = await supabase
    .from('assinatura_pagamentos')
    .select('id, empresa_id, asaas_payment_id, valor, status, pago_em, created_at')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    if (error.message.includes('does not exist') || error.code === '42P01') return []
    throw new Error(`Falha ao buscar pagamentos: ${error.message}`)
  }

  return (data ?? []) as AssinaturaPagamento[]
}
