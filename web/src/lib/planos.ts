export type PlanoId = 'basic' | 'pro' | 'ultra'

export type PlanoDef = {
  id: PlanoId
  nome: string
  valor: number
  descricao: string
  notasFiscais: boolean
  lojaOnline: boolean
  destaque?: boolean
  recursos: string[]
}

export const PLANOS: Record<PlanoId, PlanoDef> = {
  basic: {
    id: 'basic',
    nome: 'Basic',
    valor: 89.9,
    descricao: 'PDV completo para o dia a dia da loja.',
    notasFiscais: false,
    lojaOnline: false,
    recursos: [
      'Dashboard, PDV e vendas',
      'Produtos, estoque e caixa',
      'Clientes, fornecedores e usuários',
      'Financeiro e cashback',
    ],
  },
  pro: {
    id: 'pro',
    nome: 'Pro',
    valor: 189.9,
    descricao: 'Tudo do Basic com emissão fiscal integrada.',
    notasFiscais: true,
    lojaOnline: false,
    destaque: true,
    recursos: [
      'Tudo do plano Basic',
      'Emissão de NFC-e e NF-e',
      'Configuração fiscal completa',
    ],
  },
  ultra: {
    id: 'ultra',
    nome: 'Ultra',
    valor: 249.9,
    descricao: 'Pacote completo com loja virtual.',
    notasFiscais: true,
    lojaOnline: true,
    recursos: [
      'Tudo do plano Pro',
      'Loja online com catálogo',
      'Subdomínio personalizado',
    ],
  },
}

export const PLANOS_LIST: PlanoDef[] = [PLANOS.basic, PLANOS.pro, PLANOS.ultra]

export const PLANO_DEFAULT: PlanoId = 'basic'

export function normalizePlanoId(raw: string | null | undefined): PlanoId {
  if (raw === 'pro' || raw === 'ultra' || raw === 'basic') return raw
  return PLANO_DEFAULT
}

export function getPlano(planoId: string | null | undefined): PlanoDef {
  return PLANOS[normalizePlanoId(planoId)]
}

export function planoFromValor(valor: number): PlanoId {
  const match = PLANOS_LIST.find((p) => Math.abs(p.valor - valor) < 0.01)
  return match?.id ?? PLANO_DEFAULT
}
