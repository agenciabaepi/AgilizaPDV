export type PlanoId = 'basic' | 'pro' | 'ultra'

export type PlanoDef = {
  id: PlanoId
  nome: string
  valor: number
  notasFiscais: boolean
  lojaOnline: boolean
}

export const PLANOS: Record<PlanoId, PlanoDef> = {
  basic: { id: 'basic', nome: 'Basic', valor: 89.9, notasFiscais: false, lojaOnline: false },
  pro: { id: 'pro', nome: 'Pro', valor: 189.9, notasFiscais: true, lojaOnline: false },
  ultra: { id: 'ultra', nome: 'Ultra', valor: 249.9, notasFiscais: true, lojaOnline: true },
}

export const PLANO_DEFAULT: PlanoId = 'basic'

export function normalizePlanoId(raw: string | null | undefined): PlanoId {
  if (raw === 'pro' || raw === 'ultra' || raw === 'basic') return raw
  return PLANO_DEFAULT
}

export function getPlano(planoId: string | null | undefined): PlanoDef {
  return PLANOS[normalizePlanoId(planoId)]
}
