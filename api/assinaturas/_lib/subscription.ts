import {
  addDays,
  addMonths,
  createCustomer,
  createPayment,
  createSubscription,
  findCustomerByReference,
  formatDateYmd,
  getPayment,
  getPixQrCode,
  listSubscriptionPayments,
  PAYMENT_PENDING_STATUSES,
  PAYMENT_RECEIVED_STATUSES,
  type AsaasPayment,
  type AsaasPixQrCode,
} from './asaas'
import { getAssinaturaTrialDias } from './config'
import { isValidCNPJ, normalizeCnpj } from './validators'
import { getPlano, normalizePlanoId, PLANO_DEFAULT, type PlanoDef, type PlanoId } from './planos'
import { getPlanoAsync, getPlanoDefaultAsync, loadPlanosMap } from './planos-service'
import { getSupabaseAdmin } from './supabase'

export type AssinaturaStatus = 'trial' | 'active' | 'pending_payment' | 'expired' | 'cancelled'

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

export type AssinaturaPublicStatus = {
  status: AssinaturaStatus
  bloqueado: boolean
  plano: PlanoId
  planoNome: string
  valorMensal: number
  notasFiscais: boolean
  lojaOnline: boolean
  trialFim: string | null
  periodoFim: string | null
  diasRestantes: number | null
  mensagem: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null
  const end = new Date(isoDate)
  if (Number.isNaN(end.getTime())) return null
  const diff = end.getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function isPast(isoDate: string | null): boolean {
  if (!isoDate) return false
  const d = new Date(isoDate)
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now()
}

function resolvePlan(row: EmpresaAssinaturaRow, planosMap?: Record<PlanoId, PlanoDef>): PlanoDef {
  if (planosMap) return planosMap[normalizePlanoId(row.plano)]
  return getPlano(row.plano)
}

function withPlano(
  row: EmpresaAssinaturaRow,
  base: Omit<AssinaturaPublicStatus, 'plano' | 'planoNome' | 'notasFiscais' | 'lojaOnline' | 'valorMensal'> & { valorMensal?: number },
  planosMap?: Record<PlanoId, PlanoDef>
): AssinaturaPublicStatus {
  const plan = resolvePlan(row, planosMap)
  return {
    ...base,
    plano: plan.id,
    planoNome: plan.nome,
    valorMensal: base.valorMensal ?? plan.valor,
    notasFiscais: plan.notasFiscais,
    lojaOnline: plan.lojaOnline,
  }
}

export function computePublicStatus(row: EmpresaAssinaturaRow, planosMap?: Record<PlanoId, PlanoDef>): AssinaturaPublicStatus {
  const plan = resolvePlan(row, planosMap)
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
    }, planosMap)
  }

  if (row.status === 'trial') {
    const trialExpired = isPast(row.trial_fim)
    if (!trialExpired) {
      return withPlano(row, {
        status: 'trial',
        bloqueado: false,
        valorMensal,
        trialFim: row.trial_fim,
        periodoFim: row.periodo_fim,
        diasRestantes: daysUntil(row.trial_fim),
        mensagem: `Período de teste ativo — plano ${plan.nome}.`,
      }, planosMap)
    }
    return withPlano(row, {
      status: 'pending_payment',
      bloqueado: true,
      valorMensal,
      trialFim: row.trial_fim,
      periodoFim: row.periodo_fim,
      diasRestantes: 0,
      mensagem: 'Seu período de teste expirou. Escolha um plano e efetue o pagamento.',
    }, planosMap)
  }

  if (row.status === 'active') {
    const periodExpired = isPast(row.periodo_fim)
    if (!periodExpired) {
      return withPlano(row, {
        status: 'active',
        bloqueado: false,
        valorMensal,
        trialFim: row.trial_fim,
        periodoFim: row.periodo_fim,
        diasRestantes: daysUntil(row.periodo_fim),
        mensagem: `Assinatura ${plan.nome} ativa.`,
      }, planosMap)
    }
    return withPlano(row, {
      status: 'pending_payment',
      bloqueado: true,
      valorMensal,
      trialFim: row.trial_fim,
      periodoFim: row.periodo_fim,
      diasRestantes: 0,
      mensagem: 'Sua mensalidade venceu. Renove seu plano para continuar.',
    }, planosMap)
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
    }, planosMap)
  }

  return withPlano(row, {
    status: row.status,
    bloqueado: true,
    valorMensal,
    trialFim: row.trial_fim,
    periodoFim: row.periodo_fim,
    diasRestantes: daysUntil(row.periodo_fim),
    mensagem: 'Verifique o status da sua assinatura.',
  }, planosMap)
}

async function applyPlanoToEmpresa(empresaId: string, planoId: PlanoId): Promise<void> {
  const plan = await getPlanoAsync(planoId)
  const supabase = getSupabaseAdmin()
  await supabase
    .from('empresa_assinaturas')
    .update({
      plano: plan.id,
      valor_mensal: plan.valor,
      updated_at: nowIso(),
    })
    .eq('empresa_id', empresaId)
  await supabase
    .from('empresas_config')
    .update({ loja_online_ativa: plan.lojaOnline ? 1 : 0 })
    .eq('empresa_id', empresaId)
}

export async function getOrCreateAssinatura(empresaId: string): Promise<EmpresaAssinaturaRow> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('empresa_assinaturas')
    .select('*')
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (error) throw new Error(`Falha ao buscar assinatura: ${error.message}`)
  if (data) return data as EmpresaAssinaturaRow

  const createdAt = nowIso()
  const trialFim = addDays(new Date(), getAssinaturaTrialDias()).toISOString()
  const plan = await getPlanoDefaultAsync()
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
    trial_fim: trialFim,
    created_at: createdAt,
    updated_at: createdAt,
  }

  const { error: insertErr } = await supabase.from('empresa_assinaturas').insert(row)
  if (insertErr) throw new Error(`Falha ao criar assinatura: ${insertErr.message}`)
  await applyPlanoToEmpresa(empresaId, plan.id)
  return row
}

export async function refreshAssinaturaStatus(empresaId: string): Promise<AssinaturaPublicStatus> {
  const supabase = getSupabaseAdmin()
  const planosMap = await loadPlanosMap()
  let row = await getOrCreateAssinatura(empresaId)
  const publicBefore = computePublicStatus(row, planosMap)

  let newStatus: AssinaturaStatus | null = null
  if (row.status === 'trial' && publicBefore.bloqueado) {
    newStatus = 'pending_payment'
  } else if (row.status === 'active' && publicBefore.bloqueado) {
    newStatus = 'pending_payment'
  }

  if (row.asaas_payment_id) {
    try {
      const payment = await getPayment(row.asaas_payment_id)
      if (PAYMENT_RECEIVED_STATUSES.has(payment.status)) {
        await activateFromPayment(empresaId, payment)
        row = await getOrCreateAssinatura(empresaId)
      }
    } catch {
      // Ignora falha de consulta pontual ao Asaas
    }
  }

  if (newStatus && row.status !== 'active') {
    await supabase
      .from('empresa_assinaturas')
      .update({ status: newStatus, updated_at: nowIso() })
      .eq('empresa_id', empresaId)
    row = { ...row, status: newStatus }
  }

  return computePublicStatus(row, planosMap)
}

type EmpresaContext = {
  id: string
  nome: string
  cnpj: string | null
  email: string | null
}

async function loadEmpresaContext(empresaId: string): Promise<EmpresaContext> {
  const supabase = getSupabaseAdmin()
  const { data: empresa, error: empresaErr } = await supabase
    .from('empresas')
    .select('id, nome, cnpj')
    .eq('id', empresaId)
    .maybeSingle()
  if (empresaErr) throw new Error(`Falha ao buscar empresa: ${empresaErr.message}`)
  if (!empresa) throw new Error('Empresa não encontrada.')

  const { data: config } = await supabase
    .from('empresas_config')
    .select('email, razao_social')
    .eq('empresa_id', empresaId)
    .maybeSingle()

  return {
    id: empresa.id,
    nome: (config?.razao_social as string | null)?.trim() || empresa.nome,
    cnpj: empresa.cnpj,
    email: (config?.email as string | null)?.trim() || null,
  }
}

async function ensureAsaasCustomer(row: EmpresaAssinaturaRow, ctx: EmpresaContext): Promise<string> {
  if (row.asaas_customer_id) return row.asaas_customer_id

  if (!ctx.cnpj) {
    throw new Error('CNPJ da empresa não cadastrado. Complete os dados em Configurações → Dados da loja.')
  }
  const cnpjDigits = normalizeCnpj(ctx.cnpj)
  if (!isValidCNPJ(cnpjDigits)) {
    throw new Error('O CPF/CNPJ informado é inválido. Atualize o CNPJ em Configurações → Dados da loja.')
  }
  if (!ctx.email) {
    throw new Error('E-mail da empresa não cadastrado. Complete os dados em Configurações → Dados da loja.')
  }

  const existing = await findCustomerByReference(ctx.id)
  let customerId = existing.data[0]?.id

  if (!customerId) {
    const created = await createCustomer({
      name: ctx.nome,
      cpfCnpj: cnpjDigits,
      email: ctx.email,
      externalReference: ctx.id,
    })
    customerId = created.id
  }

  const supabase = getSupabaseAdmin()
  await supabase
    .from('empresa_assinaturas')
    .update({ asaas_customer_id: customerId, updated_at: nowIso() })
    .eq('empresa_id', ctx.id)

  return customerId
}

function paymentMatchesValor(payment: AsaasPayment, valor: number): boolean {
  return Math.abs(payment.value - valor) < 0.01
}

function pickPendingPayment(payments: AsaasPayment[], valor: number): AsaasPayment | null {
  const pending = payments.find(
    (p) => PAYMENT_PENDING_STATUSES.has(p.status) && paymentMatchesValor(p, valor)
  )
  return pending ?? null
}

export type CheckoutResult = {
  status: AssinaturaPublicStatus
  paymentId: string
  valor: number
  pix: AsaasPixQrCode
}

export const CHECKOUT_ASSINATURA_ATIVA_MSG =
  'Sua assinatura já está ativa. Aguarde o vencimento do período atual para renovar via PIX.'

export async function createCheckout(empresaId: string, planoId?: PlanoId): Promise<CheckoutResult> {
  let row = await getOrCreateAssinatura(empresaId)
  const planosMap = await loadPlanosMap()
  const publicBefore = computePublicStatus(row, planosMap)

  if (publicBefore.status === 'active' && !publicBefore.bloqueado) {
    throw new Error(CHECKOUT_ASSINATURA_ATIVA_MSG)
  }

  const supabase = getSupabaseAdmin()
  if (planoId) {
    await applyPlanoToEmpresa(empresaId, planoId)
    await supabase
      .from('empresa_assinaturas')
      .update({ asaas_payment_id: null, updated_at: nowIso() })
      .eq('empresa_id', empresaId)
    row = await getOrCreateAssinatura(empresaId)
  }

  const plan = planosMap[normalizePlanoId(row.plano)]
  const ctx = await loadEmpresaContext(empresaId)
  const customerId = await ensureAsaasCustomer(row, ctx)
  const valor = plan.valor
  const today = formatDateYmd(new Date())
  const paymentDescription = `Agiliza PDV — Plano ${plan.nome}`

  let payment: AsaasPayment | null = null

  if (row.asaas_payment_id) {
    try {
      const existing = await getPayment(row.asaas_payment_id)
      if (
        PAYMENT_PENDING_STATUSES.has(existing.status) &&
        paymentMatchesValor(existing, valor)
      ) {
        payment = existing
      } else if (PAYMENT_RECEIVED_STATUSES.has(existing.status)) {
        await activateFromPayment(empresaId, existing)
        const refreshed = await refreshAssinaturaStatus(empresaId)
        if (!refreshed.bloqueado) {
          throw new Error('Pagamento já confirmado. Atualize a página.')
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('já confirmado')) throw err
    }
  }

  if (!payment && row.asaas_subscription_id) {
    const list = await listSubscriptionPayments(row.asaas_subscription_id)
    payment = pickPendingPayment(list.data, valor)
  }

  if (!payment) {
    if (!row.asaas_subscription_id) {
      const subscription = await createSubscription({
        customer: customerId,
        billingType: 'PIX',
        value: valor,
        nextDueDate: today,
        cycle: 'MONTHLY',
        description: paymentDescription,
        externalReference: empresaId,
      })

      await supabase
        .from('empresa_assinaturas')
        .update({
          asaas_subscription_id: subscription.id,
          updated_at: nowIso(),
        })
        .eq('empresa_id', empresaId)

      const list = await listSubscriptionPayments(subscription.id)
      payment = pickPendingPayment(list.data, valor)
    }

    if (!payment) {
      payment = await createPayment({
        customer: customerId,
        billingType: 'PIX',
        value: valor,
        dueDate: today,
        description: paymentDescription,
        externalReference: empresaId,
      })
    }
  }

  const pix = await getPixQrCode(payment.id)

  await supabase
    .from('empresa_assinaturas')
    .update({
      asaas_payment_id: payment.id,
      status: 'pending_payment',
      updated_at: nowIso(),
    })
    .eq('empresa_id', empresaId)

  const status = computePublicStatus({
    ...row,
    status: 'pending_payment',
    asaas_payment_id: payment.id,
    asaas_customer_id: customerId,
  }, planosMap)

  return { status, paymentId: payment.id, valor: payment.value, pix }
}

export async function activateFromPayment(empresaId: string, payment: AsaasPayment): Promise<void> {
  const supabase = getSupabaseAdmin()
  const row = await getOrCreateAssinatura(empresaId)
  const paidAt = payment.confirmedDate || payment.paymentDate || payment.dueDate
  const baseDate = paidAt ? new Date(paidAt) : new Date()
  const periodoFim = addMonths(baseDate, 1).toISOString()
  const updatedAt = nowIso()

  await supabase
    .from('empresa_assinaturas')
    .update({
      status: 'active',
      periodo_inicio: row.periodo_inicio ?? updatedAt,
      periodo_fim: periodoFim,
      asaas_payment_id: payment.id,
      updated_at: updatedAt,
    })
    .eq('empresa_id', empresaId)

  await applyPlanoToEmpresa(empresaId, normalizePlanoId(row.plano))

  const pagamentoId = crypto.randomUUID()
  await supabase.from('assinatura_pagamentos').upsert(
    {
      id: pagamentoId,
      empresa_id: empresaId,
      asaas_payment_id: payment.id,
      valor: payment.value,
      status: payment.status,
      pago_em: payment.confirmedDate || payment.paymentDate || updatedAt,
      created_at: updatedAt,
    },
    { onConflict: 'asaas_payment_id' }
  )
}

export async function resolveEmpresaFromPayment(paymentId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('empresa_assinaturas')
    .select('empresa_id')
    .eq('asaas_payment_id', paymentId)
    .maybeSingle()
  if (data?.empresa_id) return data.empresa_id

  try {
    const payment = await getPayment(paymentId)
    if (payment.externalReference) return payment.externalReference

    const { data: byCustomer } = await supabase
      .from('empresa_assinaturas')
      .select('empresa_id')
      .eq('asaas_customer_id', payment.customer)
      .maybeSingle()
    return byCustomer?.empresa_id ?? null
  } catch {
    return null
  }
}

export async function handlePaymentWebhook(paymentId: string, event: string): Promise<void> {
  const empresaId = await resolveEmpresaFromPayment(paymentId)
  if (!empresaId) return

  const payment = await getPayment(paymentId)

  if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
    if (PAYMENT_RECEIVED_STATUSES.has(payment.status)) {
      await activateFromPayment(empresaId, payment)
    }
    return
  }

  if (event === 'PAYMENT_OVERDUE') {
    const supabase = getSupabaseAdmin()
    await supabase
      .from('empresa_assinaturas')
      .update({ status: 'pending_payment', updated_at: nowIso() })
      .eq('empresa_id', empresaId)
  }
}
