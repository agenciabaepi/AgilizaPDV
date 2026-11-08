export type CategoriaDespesa = {
  id: string
  empresa_id: string
  nome: string
  ativo: boolean
  sistema: boolean
  ordem: number
  created_at: string
  updated_at: string
}

export type ContaPagarFixa = {
  id: string
  empresa_id: string
  categoria_id: string | null
  fornecedor_id: string | null
  descricao: string
  valor_padrao: number
  dia_vencimento: number
  ativa: boolean
  observacao: string | null
  created_at: string
  updated_at: string
  categoria_nome?: string | null
}

export type ContaPagarStatus = 'PENDENTE' | 'PAGA' | 'CANCELADA'
export type ContaPagarTipo = 'FIXA' | 'AVULSA'

export type ContaPagar = {
  id: string
  empresa_id: string
  categoria_id: string | null
  conta_fixa_id: string | null
  descricao: string
  valor: number
  vencimento: string
  competencia: string
  tipo: ContaPagarTipo
  status: ContaPagarStatus
  pago_em: string | null
  forma_pagamento: string | null
  pagamento_caixa_id: string | null
  caixa_movimento_id: string | null
  usuario_pagamento_id: string | null
  observacao: string | null
  created_at: string
  updated_at: string
  categoria_nome?: string | null
}

export type ListContasPagarOptions = {
  status?: 'aberto' | ContaPagarStatus | 'todas'
  categoria_id?: string
  competencia?: string
  vencimento_de?: string
  vencimento_ate?: string
  busca?: string
  limit?: number
}

export type CreateCategoriaDespesaInput = {
  empresa_id: string
  nome: string
  ordem?: number
}

export type UpdateCategoriaDespesaInput = {
  nome?: string
  ordem?: number
  ativo?: boolean
}

export type CreateContaPagarFixaInput = {
  empresa_id: string
  descricao: string
  valor_padrao: number
  dia_vencimento: number
  categoria_id?: string | null
  fornecedor_id?: string | null
  observacao?: string | null
  ativa?: boolean
}

export type UpdateContaPagarFixaInput = {
  descricao?: string
  valor_padrao?: number
  dia_vencimento?: number
  categoria_id?: string | null
  fornecedor_id?: string | null
  observacao?: string | null
  ativa?: boolean
}

export type CreateContaPagarInput = {
  empresa_id: string
  descricao: string
  valor: number
  vencimento: string
  categoria_id?: string | null
  observacao?: string | null
  competencia?: string
}

export type UpdateContaPagarInput = {
  descricao?: string
  valor?: number
  vencimento?: string
  categoria_id?: string | null
  observacao?: string | null
}

export type PagarContaPagarInput = {
  conta_id: string
  empresa_id: string
  modo: 'simples' | 'caixa'
  usuario_id: string
  forma?: string
  caixa_id?: string
}

export const CATEGORIAS_DESPESA_SEED: { nome: string; ordem: number }[] = [
  { nome: 'Aluguel', ordem: 10 },
  { nome: 'Funcionários', ordem: 20 },
  { nome: 'Contador', ordem: 30 },
  { nome: 'Imposto DAS', ordem: 40 },
  { nome: 'Água', ordem: 50 },
  { nome: 'Luz', ordem: 60 },
  { nome: 'Internet', ordem: 70 },
  { nome: 'Empréstimos', ordem: 80 },
  { nome: 'Fornecedores', ordem: 90 },
  { nome: 'Outros', ordem: 100 },
]
