import type { PlanoId } from './planos'
import { PLANOS_LIST, type PlanoDef } from './planos'

export type PlanoPublic = PlanoDef & {
  descricao: string
  destaque: boolean
  ativo: boolean
  recursos: string[]
  ordem: number
}

export async function fetchPlanosPublic(): Promise<{
  ok: boolean
  planos?: PlanoPublic[]
  error?: string
}> {
  try {
    const res = await fetch('/api/assinaturas/planos', { method: 'POST' })
    const text = await res.text()
    if (!text.trim()) {
      return { ok: false, error: 'Resposta vazia ao buscar planos.' }
    }
    return JSON.parse(text) as { ok: boolean; planos?: PlanoPublic[]; error?: string }
  } catch {
    return { ok: false, error: 'Falha ao buscar planos.' }
  }
}

export function planosPublicToList(planos: PlanoPublic[]): PlanoDef[] {
  return planos.map((p) => ({
    id: p.id,
    nome: p.nome,
    valor: p.valor,
    descricao: p.descricao,
    notasFiscais: p.notasFiscais,
    lojaOnline: p.lojaOnline,
    destaque: p.destaque,
    recursos: p.recursos,
  }))
}

export const PLANOS_FALLBACK: PlanoPublic[] = PLANOS_LIST.map((p, idx) => ({
  ...p,
  destaque: p.destaque ?? false,
  ativo: true,
  ordem: idx + 1,
}))
