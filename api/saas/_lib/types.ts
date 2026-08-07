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
