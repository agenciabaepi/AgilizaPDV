import { readSaasSession } from './saas-session'
import type { ModuloId } from '../vite-env'

export type SaasEmpresaResumo = {
  empresa_id: string
  nome: string
  cnpj: string | null
  codigo_acesso: number | null
  empresa_created_at: string | null
  assinatura_status: string | null
  plano: string | null
  valor_mensal: number | null
  trial_fim: string | null
  periodo_inicio: string | null
  periodo_fim: string | null
  asaas_customer_id: string | null
  asaas_subscription_id: string | null
  assinatura_created_at: string | null
  assinatura_updated_at: string | null
  razao_social: string | null
  config_email: string | null
  config_telefone: string | null
  loja_online_ativa: number | null
  loja_online_slug: string | null
  modulos_json: string | null
  produtos_count: number
  clientes_count: number
  usuarios_count: number
  vendas_count: number
  venda_itens_count: number
  categorias_count: number
  fornecedores_count: number
  nfce_autorizadas_count: number
  nfe_autorizadas_count: number
  registros_estimados_count: number
}

export type SaasTotais = {
  empresas: number
  trial: number
  active: number
  pending: number
  cancelled: number
  semAssinatura: number
  produtos: number
  nfce: number
  nfe: number
  registros: number
}

export type SaasUsuario = {
  id: string
  nome: string
  login: string
  email: string | null
  role: string
  created_at: string
}

export type SaasPagamento = {
  id: string
  asaas_payment_id: string
  valor: number
  status: string
  pago_em: string | null
  created_at: string
}

function saasHeaders(): Record<string, string> {
  const session = readSaasSession()
  if (!session?.token) return {}
  return { 'X-Saas-Admin-Token': session.token }
}

async function saasApiPost<T extends { ok: boolean; error?: string }>(
  path: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch(`/api/saas/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...saasHeaders() },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!text.trim()) {
    return {
      ok: false,
      error: res.status === 404
        ? 'API SaaS não encontrada. Reinicie o servidor ou faça deploy.'
        : `Servidor retornou resposta vazia (HTTP ${res.status}).`,
    } as T
  }
  try {
    return JSON.parse(text) as T
  } catch {
    return { ok: false, error: 'Resposta inválida do servidor SaaS.' } as T
  }
}

export async function saasLogin(email: string, password: string): Promise<{
  ok: boolean
  token?: string
  email?: string
  error?: string
}> {
  return saasApiPost('login', { email, password })
}

export async function fetchSaasEmpresas(filters?: {
  search?: string
  status?: string
  plano?: string
}): Promise<{
  ok: boolean
  empresas?: SaasEmpresaResumo[]
  totais?: SaasTotais
  error?: string
}> {
  return saasApiPost('empresas', filters ?? {})
}

export async function fetchSaasEmpresa(empresaId: string): Promise<{
  ok: boolean
  empresa?: SaasEmpresaResumo
  usuarios?: SaasUsuario[]
  pagamentos?: SaasPagamento[]
  certificado?: { configurado: boolean; updated_at?: string }
  error?: string
}> {
  return saasApiPost('empresa', { empresaId })
}

export async function updateSaasAssinatura(
  empresaId: string,
  data: {
    status?: string
    plano?: string
    trialDias?: number
    periodoDias?: number
    valorMensal?: number
  }
): Promise<{ ok: boolean; message?: string; error?: string }> {
  return saasApiPost('assinatura-update', { empresaId, ...data })
}

export async function updateSaasRecursos(
  empresaId: string,
  data: {
    modulos?: Record<ModuloId, boolean>
    lojaOnlineAtiva?: boolean
  }
): Promise<{ ok: boolean; message?: string; error?: string }> {
  return saasApiPost('recursos-update', { empresaId, ...data })
}

export async function excluirSaasEmpresa(
  empresaId: string,
  password: string
): Promise<{ ok: boolean; message?: string; error?: string }> {
  return saasApiPost('empresa-excluir', { empresaId, password })
}

export type SaasPlanoConfig = {
  id: string
  nome: string
  valor: number
  descricao: string
  notasFiscais: boolean
  lojaOnline: boolean
  destaque: boolean
  ativo: boolean
  recursos: string[]
  ordem: number
}

export async function fetchSaasPlanos(): Promise<{
  ok: boolean
  planos?: SaasPlanoConfig[]
  error?: string
}> {
  return saasApiPost('planos')
}

export async function updateSaasPlanos(
  planos: Array<{
    id: string
    nome?: string
    valor_mensal?: number
    descricao?: string
    notas_fiscais?: boolean
    loja_online?: boolean
    destaque?: boolean
    ativo?: boolean
    recursos?: string[]
    ordem?: number
  }>
): Promise<{ ok: boolean; message?: string; error?: string }> {
  return saasApiPost('planos-update', { planos })
}

export const ASSINATURA_STATUS_LABELS: Record<string, string> = {
  trial: 'Trial',
  active: 'Ativa',
  pending_payment: 'Pagamento pendente',
  expired: 'Expirada',
  cancelled: 'Cancelada',
  sem_assinatura: 'Sem assinatura',
}

export const PLANO_LABELS: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  ultra: 'Ultra',
}
