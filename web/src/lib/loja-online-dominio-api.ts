import { LOJA_ONLINE_CNAME_TARGET, LOJA_ONLINE_APEX_A_RECORD } from './loja-online'

export type LojaOnlineDominioStatus = {
  ok: boolean
  domain: string | null
  ready?: boolean
  provisioned?: string[]
  removed?: string[]
  dns?: { cname: string[]; a: string[]; pointsToPlatform: boolean }
  vercel?: {
    enabled: boolean
    assigned?: boolean
    verified?: boolean
    misconfigured?: boolean | null
  }
  error?: string
  hint?: string
  cnameTarget?: string
  apexARecord?: string
}

export async function fetchLojaOnlineDominioStatus(domain: string): Promise<LojaOnlineDominioStatus> {
  const res = await fetch(`/api/loja-online/dominio?domain=${encodeURIComponent(domain)}`)
  const data = (await res.json()) as LojaOnlineDominioStatus
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || 'Não foi possível verificar o domínio.')
  }
  return data
}

export async function syncLojaOnlineCustomDomain(input: {
  empresaId: string
  previousDomain?: string | null
}): Promise<LojaOnlineDominioStatus> {
  const res = await fetch('/api/loja-online/dominio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as LojaOnlineDominioStatus
  if (!res.ok) {
    throw new Error(data.error || 'Não foi possível configurar o HTTPS do domínio.')
  }
  return {
    ...data,
    cnameTarget: data.cnameTarget || LOJA_ONLINE_CNAME_TARGET,
    apexARecord: data.apexARecord || LOJA_ONLINE_APEX_A_RECORD,
  }
}
