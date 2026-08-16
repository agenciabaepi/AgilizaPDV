import type { VercelRequest, VercelResponse } from '@vercel/node'
import { assertSupabaseConfigured } from '../_lib/supabase'
import {
  addVercelProjectDomain,
  getEmpresaCustomDomain,
  getVercelDomainStatus,
  inspectCustomDomainDns,
  normalizeLojaOnlineCustomDomain,
  removeVercelProjectDomain,
  vercelProvisioningEnabled,
} from '../_lib/dominio'

function readDomain(req: VercelRequest): string | null {
  const fromQuery = Array.isArray(req.query.domain) ? req.query.domain[0] : req.query.domain
  const body = (req.body ?? {}) as { domain?: string }
  return normalizeLojaOnlineCustomDomain(fromQuery || body.domain)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  try {
    assertSupabaseConfigured()

    if (req.method === 'GET') {
      const domain = readDomain(req)
      if (!domain) {
        res.status(400).json({ ok: false, error: 'Informe o domínio.' })
        return
      }
      const [dnsInfo, vercel] = await Promise.all([
        inspectCustomDomainDns(domain),
        getVercelDomainStatus(domain),
      ])
      const ready = (vercel.assigned && vercel.verified && vercel.misconfigured === false) || dnsInfo.pointsToPlatform
      res.status(200).json({
        ok: true,
        domain,
        ready,
        dns: dnsInfo,
        vercel: {
          enabled: vercelProvisioningEnabled(),
          ...vercel,
        },
        cnameTarget: 'cname.vercel-dns.com',
        apexARecord: '76.76.21.21',
      })
      return
    }

    const body = (req.body ?? {}) as { empresaId?: string; previousDomain?: string | null }
    const empresaId = String(body.empresaId ?? '').trim()
    if (!empresaId) {
      res.status(400).json({ ok: false, error: 'empresaId é obrigatório.' })
      return
    }

    const current = await getEmpresaCustomDomain(empresaId)
    const previous = normalizeLojaOnlineCustomDomain(body.previousDomain)
    const provisioned: string[] = []
    const removed: string[] = []
    const errors: string[] = []

    if (previous && previous !== current) {
      await removeVercelProjectDomain(previous)
      const previousWww = previous.startsWith('www.') ? previous.slice(4) : `www.${previous}`
      if (previousWww !== current) await removeVercelProjectDomain(previousWww)
      removed.push(previous)
    }

    if (current) {
      const add = await addVercelProjectDomain(current)
      if (add.ok) provisioned.push(current)
      else if (add.error && add.error !== 'vercel_not_configured') errors.push(add.error)
      const [dnsInfo, vercel] = await Promise.all([
        inspectCustomDomainDns(current),
        getVercelDomainStatus(current),
      ])
      res.status(200).json({
        ok: errors.length === 0,
        domain: current,
        provisioned,
        removed,
        ready: (vercel.assigned && vercel.verified && vercel.misconfigured === false) || dnsInfo.pointsToPlatform,
        dns: dnsInfo,
        vercel: {
          enabled: vercelProvisioningEnabled(),
          ...vercel,
        },
        error: errors[0],
        hint: vercelProvisioningEnabled()
          ? undefined
          : 'Configure VERCEL_TOKEN no servidor para emitir HTTPS automaticamente.',
      })
      return
    }

    res.status(200).json({
      ok: true,
      domain: null,
      provisioned,
      removed,
      ready: false,
      vercel: { enabled: vercelProvisioningEnabled() },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: msg })
  }
}
