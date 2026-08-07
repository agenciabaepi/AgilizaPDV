import type { LojaOnlinePedido } from './loja-online-types'
import { pedidoAguardandoPagamentoOnline } from './loja-online-types'

export const LOJA_ONLINE_PEDIDO_STATUSES = [
  'pedido_recebido',
  'aguardando_pagamento',
  'pagamento_aprovado',
  'em_separacao',
  'em_preparacao',
  'enviado',
  'em_transporte',
  'saiu_para_entrega',
  'entregue',
  'cancelado',
  'pagamento_recusado',
  'aguardando_retirada',
  'disponivel_retirada',
  'devolucao_solicitada',
  'em_devolucao',
  'reembolsado',
  'falha_entrega',
] as const

export type LojaOnlinePedidoStatus = (typeof LOJA_ONLINE_PEDIDO_STATUSES)[number]

export type PedidoStatusTone = 'neutral' | 'warning' | 'info' | 'success' | 'danger' | 'muted'

export type PedidoStatusAdminGroup =
  | 'pagamento'
  | 'preparacao'
  | 'envio'
  | 'retirada'
  | 'finalizado'
  | 'problemas'
  | 'cancelamento'

type PedidoStatusMeta = {
  label: string
  tone: PedidoStatusTone
  adminGroup: PedidoStatusAdminGroup
}

export const PEDIDO_STATUS_ADMIN_GROUP_LABELS: Record<PedidoStatusAdminGroup, string> = {
  pagamento: 'Pagamento',
  preparacao: 'Preparação',
  envio: 'Envio e entrega',
  retirada: 'Retirada na loja',
  finalizado: 'Concluído',
  problemas: 'Problemas e devolução',
  cancelamento: 'Cancelamento',
}

export const PEDIDO_STATUS_META: Record<LojaOnlinePedidoStatus, PedidoStatusMeta> = {
  pedido_recebido: { label: 'Pedido recebido', tone: 'neutral', adminGroup: 'pagamento' },
  aguardando_pagamento: { label: 'Aguardando pagamento', tone: 'warning', adminGroup: 'pagamento' },
  pagamento_aprovado: { label: 'Pagamento aprovado', tone: 'info', adminGroup: 'pagamento' },
  em_separacao: { label: 'Em separação', tone: 'warning', adminGroup: 'preparacao' },
  em_preparacao: { label: 'Em preparação', tone: 'warning', adminGroup: 'preparacao' },
  enviado: { label: 'Enviado', tone: 'info', adminGroup: 'envio' },
  em_transporte: { label: 'Em transporte', tone: 'info', adminGroup: 'envio' },
  saiu_para_entrega: { label: 'Saiu para entrega', tone: 'info', adminGroup: 'envio' },
  entregue: { label: 'Entregue', tone: 'success', adminGroup: 'finalizado' },
  cancelado: { label: 'Cancelado', tone: 'danger', adminGroup: 'cancelamento' },
  pagamento_recusado: { label: 'Pagamento recusado', tone: 'danger', adminGroup: 'cancelamento' },
  aguardando_retirada: { label: 'Aguardando retirada', tone: 'neutral', adminGroup: 'retirada' },
  disponivel_retirada: { label: 'Disponível para retirada', tone: 'info', adminGroup: 'retirada' },
  devolucao_solicitada: { label: 'Devolução solicitada', tone: 'danger', adminGroup: 'problemas' },
  em_devolucao: { label: 'Em devolução', tone: 'danger', adminGroup: 'problemas' },
  reembolsado: { label: 'Reembolsado', tone: 'muted', adminGroup: 'cancelamento' },
  falha_entrega: { label: 'Falha na entrega', tone: 'danger', adminGroup: 'problemas' },
}

/** Status legados ainda presentes no banco antes da migração. */
const LEGACY_STATUSES = ['pendente', 'confirmado'] as const

export function isLojaOnlinePedidoStatus(value: string): value is LojaOnlinePedidoStatus {
  return (LOJA_ONLINE_PEDIDO_STATUSES as readonly string[]).includes(value)
}

export function normalizePedidoStatus(
  status: string,
  pedido?: Pick<LojaOnlinePedido, 'forma_pagamento' | 'pagamento_status' | 'status'>
): LojaOnlinePedidoStatus {
  if (isLojaOnlinePedidoStatus(status)) return status

  if (status === 'pendente') {
    const ctx = pedido ?? { status, forma_pagamento: null, pagamento_status: null }
    if (pedidoAguardandoPagamentoOnline(ctx)) return 'aguardando_pagamento'
    if (ctx.pagamento_status === 'pago') return 'pagamento_aprovado'
    return 'pedido_recebido'
  }
  if (status === 'confirmado') return 'pagamento_aprovado'
  if (status === 'entregue') return 'entregue'
  if (status === 'cancelado') return 'cancelado'

  return 'pedido_recebido'
}

export function normalizePedido<T extends LojaOnlinePedido>(pedido: T): T {
  return {
    ...pedido,
    status: normalizePedidoStatus(pedido.status, pedido),
  }
}

export function pedidoStatusLabel(
  status: string,
  pedido?: Pick<LojaOnlinePedido, 'forma_pagamento' | 'pagamento_status' | 'status'>
): string {
  const key = normalizePedidoStatus(status, pedido)
  return PEDIDO_STATUS_META[key].label
}

export function pedidoStatusTone(
  status: string,
  pedido?: Pick<LojaOnlinePedido, 'forma_pagamento' | 'pagamento_status' | 'status'>
): PedidoStatusTone {
  const key = normalizePedidoStatus(status, pedido)
  return PEDIDO_STATUS_META[key].tone
}

export function pedidoAdminStatusClass(
  status: string,
  pedido?: Pick<LojaOnlinePedido, 'forma_pagamento' | 'pagamento_status' | 'status'>
): string {
  const tone = pedidoStatusTone(status, pedido)
  return `loja-admin-pedido-status loja-admin-pedido-status--${tone}`
}

export function pedidoStoreStatusClass(pedido: LojaOnlinePedido): string {
  const tone = pedidoStatusTone(pedido.status, pedido)
  return `loja-store-status loja-store-status--${tone}`
}

export const PEDIDO_STATUSES_FINAIS: LojaOnlinePedidoStatus[] = [
  'entregue',
  'cancelado',
  'reembolsado',
  'pagamento_recusado',
]

export const PEDIDO_STATUSES_ELEGIVEIS_VENDA: LojaOnlinePedidoStatus[] = [
  'pagamento_aprovado',
  'em_separacao',
  'em_preparacao',
  'enviado',
  'em_transporte',
  'saiu_para_entrega',
  'aguardando_retirada',
  'disponivel_retirada',
  'entregue',
  'falha_entrega',
  'devolucao_solicitada',
  'em_devolucao',
]

export function pedidoElegivelParaVenda(pedido: {
  status: string
  forma_pagamento: LojaOnlinePedido['forma_pagamento'] | string | null
  pagamento_status: LojaOnlinePedido['pagamento_status'] | string | null
}): boolean {
  const status = normalizePedidoStatus(pedido.status, pedido as LojaOnlinePedido)
  if (!PEDIDO_STATUSES_ELEGIVEIS_VENDA.includes(status)) return false

  const forma = pedido.forma_pagamento ?? 'manual'
  if (forma === 'manual') {
    return pedido.pagamento_status === 'na_entrega' || pedido.pagamento_status === 'pago'
  }
  return pedido.pagamento_status === 'pago'
}

export function pedidoPrecisaAcaoAdmin(pedido: {
  status: string
  forma_pagamento?: string | null
  pagamento_status?: string | null
}): boolean {
  const status = normalizePedidoStatus(pedido.status, pedido as LojaOnlinePedido)
  if (PEDIDO_STATUSES_FINAIS.includes(status)) return false
  if (status === 'aguardando_pagamento') return false
  if (status === 'pedido_recebido') {
    const pag = pedido.pagamento_status
    const forma = pedido.forma_pagamento ?? 'manual'
    return pag === 'na_entrega' || pag === 'pago' || forma === 'manual'
  }
  return pedidoElegivelParaVenda(pedido as Parameters<typeof pedidoElegivelParaVenda>[0])
}

export function pedidoStatusEmAberto(pedido: { status: string }): boolean {
  const status = normalizePedidoStatus(pedido.status, pedido as LojaOnlinePedido)
  return !PEDIDO_STATUSES_FINAIS.includes(status)
}

export function getPedidoStatusAdminOptions(formaEntrega?: LojaOnlinePedido['forma_entrega'] | null) {
  const groupOrder: PedidoStatusAdminGroup[] =
    formaEntrega === 'retirada'
      ? ['pagamento', 'preparacao', 'retirada', 'finalizado', 'problemas', 'cancelamento']
      : formaEntrega === 'entrega'
        ? ['pagamento', 'preparacao', 'envio', 'finalizado', 'problemas', 'cancelamento']
        : ['pagamento', 'preparacao', 'envio', 'retirada', 'finalizado', 'problemas', 'cancelamento']

  return groupOrder
    .map((groupId) => ({
      id: groupId,
      label: PEDIDO_STATUS_ADMIN_GROUP_LABELS[groupId],
      options: LOJA_ONLINE_PEDIDO_STATUSES.filter((s) => PEDIDO_STATUS_META[s].adminGroup === groupId).map(
        (value) => ({
          value,
          label: PEDIDO_STATUS_META[value].label,
        })
      ),
    }))
    .filter((g) => g.options.length > 0)
}

// --- Fluxo visual para o cliente ---

export type PedidoFluxoEtapa =
  | 'aguardando_pagamento'
  | 'pedido_recebido'
  | 'preparacao'
  | 'envio'
  | 'retirada'
  | 'entregue'
  | 'problema'
  | 'cancelado'

export type PedidoFluxoStep = {
  id: PedidoFluxoEtapa
  label: string
}

const STATUS_FLUXO_ETAPA: Partial<Record<LojaOnlinePedidoStatus, PedidoFluxoEtapa>> = {
  pedido_recebido: 'pedido_recebido',
  aguardando_pagamento: 'aguardando_pagamento',
  pagamento_aprovado: 'preparacao',
  em_separacao: 'preparacao',
  em_preparacao: 'preparacao',
  enviado: 'envio',
  em_transporte: 'envio',
  saiu_para_entrega: 'envio',
  aguardando_retirada: 'retirada',
  disponivel_retirada: 'retirada',
  entregue: 'entregue',
  devolucao_solicitada: 'problema',
  em_devolucao: 'problema',
  falha_entrega: 'problema',
  reembolsado: 'cancelado',
  pagamento_recusado: 'cancelado',
  cancelado: 'cancelado',
}

export function getPedidoFluxo(pedido: LojaOnlinePedido): PedidoFluxoStep[] {
  const status = normalizePedidoStatus(pedido.status, pedido)

  if (status === 'cancelado' || status === 'pagamento_recusado' || status === 'reembolsado') {
    return [{ id: 'cancelado', label: PEDIDO_STATUS_META[status].label }]
  }

  if (status === 'devolucao_solicitada' || status === 'em_devolucao' || status === 'falha_entrega') {
    return [
      { id: 'pedido_recebido', label: 'Pedido recebido' },
      { id: 'problema', label: PEDIDO_STATUS_META[status].label },
    ]
  }

  const retirada = pedido.forma_entrega !== 'entrega'
  const steps: PedidoFluxoStep[] = []

  if (pedidoAguardandoPagamentoOnline(pedido) || status === 'aguardando_pagamento') {
    steps.push({ id: 'aguardando_pagamento', label: 'Aguardando pagamento' })
  }

  steps.push({ id: 'pedido_recebido', label: 'Pedido recebido' })
  steps.push({ id: 'preparacao', label: 'Em preparação' })

  if (retirada) {
    steps.push({ id: 'retirada', label: 'Disponível para retirada' })
    steps.push({ id: 'entregue', label: 'Retirado' })
  } else {
    steps.push({ id: 'envio', label: 'Em transporte' })
    steps.push({ id: 'entregue', label: 'Entregue' })
  }

  return steps
}

export function getPedidoFluxoAtivoIndex(pedido: LojaOnlinePedido, steps?: PedidoFluxoStep[]): number {
  const fluxo = steps ?? getPedidoFluxo(pedido)
  const status = normalizePedidoStatus(pedido.status, pedido)
  const etapa = STATUS_FLUXO_ETAPA[status]

  if (etapa === 'cancelado' || etapa === 'problema') {
    return fluxo.findIndex((s) => s.id === etapa)
  }
  if (etapa === 'entregue') {
    return fluxo.findIndex((s) => s.id === 'entregue')
  }
  if (etapa === 'envio' || etapa === 'retirada') {
    return fluxo.findIndex((s) => s.id === etapa)
  }
  if (etapa === 'preparacao') {
    return fluxo.findIndex((s) => s.id === 'preparacao')
  }
  if (etapa === 'aguardando_pagamento') {
    return fluxo.findIndex((s) => s.id === 'aguardando_pagamento')
  }

  if (pedidoAguardandoPagamentoOnline(pedido)) {
    return Math.max(0, fluxo.findIndex((s) => s.id === 'aguardando_pagamento'))
  }

  return fluxo.findIndex((s) => s.id === 'pedido_recebido')
}

export function pedidoDisplayStatusLabel(pedido: LojaOnlinePedido): string {
  return pedidoStatusLabel(pedido.status, pedido)
}

/** @deprecated Use pedidoDisplayStatusLabel */
export const PEDIDO_STATUS_STEPS = LOJA_ONLINE_PEDIDO_STATUSES.slice(0, 3).map((key) => ({
  key,
  label: PEDIDO_STATUS_META[key].label,
}))

/** @deprecated Use getPedidoFluxoAtivoIndex */
export function pedidoStatusStepIndex(status: string): number {
  if (normalizePedidoStatus(status) === 'cancelado') return -1
  const idx = ['pedido_recebido', 'pagamento_aprovado', 'entregue'].findIndex((s) => s === normalizePedidoStatus(status))
  return idx >= 0 ? idx : 0
}

/** @deprecated Use pedidoDisplayStatusLabel */
export function pedidoStatusLabelLegacy(p: LojaOnlinePedido): string {
  return pedidoDisplayStatusLabel(p)
}

/** @deprecated Use pedidoStoreStatusClass */
export function pedidoStatusClass(p: LojaOnlinePedido): string {
  return pedidoStoreStatusClass(p)
}

/** Labels para filtros e relatórios legados. */
export const PEDIDO_STATUS_LABEL: Record<LojaOnlinePedidoStatus, string> = Object.fromEntries(
  LOJA_ONLINE_PEDIDO_STATUSES.map((s) => [s, PEDIDO_STATUS_META[s].label])
) as Record<LojaOnlinePedidoStatus, string>

export function statusPagamentoAprovado(): LojaOnlinePedidoStatus {
  return 'pagamento_aprovado'
}

export function statusInicialPedido(input: {
  forma_pagamento: LojaOnlinePedido['forma_pagamento']
  pagamento_status: LojaOnlinePedido['pagamento_status']
}): LojaOnlinePedidoStatus {
  if (input.forma_pagamento === 'mercadopago' || input.forma_pagamento === 'asaas_pix') {
    return 'aguardando_pagamento'
  }
  return 'pedido_recebido'
}

export function isLegacyPedidoStatus(status: string): boolean {
  return (LEGACY_STATUSES as readonly string[]).includes(status) || status === 'entregue' || status === 'cancelado'
}
