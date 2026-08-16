import { getSupabaseAdmin } from './supabase'

export type LojaPagamentoConfig = {
  empresa_id: string
  loja_online_slug: string | null
  loja_online_pag_manual: number
  loja_online_pag_asaas: number
  loja_online_asaas_api_key: string | null
  loja_online_asaas_sandbox: number
  loja_online_pag_mercadopago: number
  loja_online_mercadopago_public_key: string | null
  loja_online_mercadopago_access_token: string | null
  loja_online_frete_tipo: string | null
  loja_online_frete_valor_fixo: number | null
  loja_online_frete_cep_origem: string | null
  loja_online_frete_peso_padrao: number | null
  loja_online_frete_gratis_ativo?: number | null
  loja_online_frete_gratis_minimo?: number | null
  loja_online_melhor_envio_token: string | null
  loja_online_melhor_envio_sandbox: number | null
}

export type LojaPagamentosPublicos = {
  manual: boolean
  asaasPix: boolean
  mercadopago: boolean
  mercadopagoPublicKey: string | null
}

export async function getLojaConfigBySlug(slug: string): Promise<LojaPagamentoConfig | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('empresas_config')
    .select(
      'empresa_id, loja_online_slug, loja_online_pag_manual, loja_online_pag_asaas, loja_online_asaas_api_key, loja_online_asaas_sandbox, loja_online_asaas_pronto, loja_online_pag_mercadopago, loja_online_mercadopago_public_key, loja_online_mercadopago_access_token, loja_online_mp_pronto, loja_online_frete_tipo, loja_online_frete_valor_fixo, loja_online_frete_cep_origem, loja_online_frete_peso_padrao, loja_online_frete_gratis_ativo, loja_online_frete_gratis_minimo, loja_online_melhor_envio_token, loja_online_melhor_envio_sandbox'
    )
    .eq('loja_online_slug', slug)
    .eq('loja_online_ativa', 1)
    .maybeSingle()
  if (error) throw error
  return data as LojaPagamentoConfig | null
}

export async function getLojaConfigByEmpresaId(empresaId: string): Promise<LojaPagamentoConfig | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('empresas_config')
    .select(
      'empresa_id, loja_online_slug, loja_online_pag_manual, loja_online_pag_asaas, loja_online_asaas_api_key, loja_online_asaas_sandbox, loja_online_asaas_pronto, loja_online_pag_mercadopago, loja_online_mercadopago_public_key, loja_online_mercadopago_access_token, loja_online_mp_pronto, loja_online_frete_tipo, loja_online_frete_valor_fixo, loja_online_frete_cep_origem, loja_online_frete_peso_padrao, loja_online_frete_gratis_ativo, loja_online_frete_gratis_minimo, loja_online_melhor_envio_token, loja_online_melhor_envio_sandbox'
    )
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (error) throw error
  return data as LojaPagamentoConfig | null
}

export function toPagamentosPublicos(cfg: LojaPagamentoConfig): LojaPagamentosPublicos {
  const asaasOk =
    Number((cfg as { loja_online_asaas_pronto?: number }).loja_online_asaas_pronto) === 1 ||
    !!cfg.loja_online_asaas_api_key?.trim()
  const mpOk =
    Number((cfg as { loja_online_mp_pronto?: number }).loja_online_mp_pronto) === 1 ||
    !!cfg.loja_online_mercadopago_access_token?.trim()
  return {
    manual: Number(cfg.loja_online_pag_manual) === 1,
    asaasPix: Number(cfg.loja_online_pag_asaas) === 1 && asaasOk,
    mercadopago: Number(cfg.loja_online_pag_mercadopago) === 1 && mpOk,
    mercadopagoPublicKey: cfg.loja_online_mercadopago_public_key?.trim() || null,
  }
}

export function getAppBaseUrl(): string {
  return (
    process.env.VERCEL_URL?.trim()
      ? `https://${process.env.VERCEL_URL}`
      : process.env.VITE_APP_URL?.trim() || 'https://agilizapdv.app'
  )
}
