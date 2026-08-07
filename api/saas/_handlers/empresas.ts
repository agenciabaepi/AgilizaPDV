import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireSaasAdmin } from '../_lib/auth'
import { formatSupabaseError } from '../../assinaturas/_lib/config'
import { getSupabaseAdmin } from '../../assinaturas/_lib/supabase'
import type { SaasEmpresaResumo } from '../_lib/types'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  if (!requireSaasAdmin(req)) {
    res.status(401).json({ ok: false, error: 'Token de administrador SaaS inválido.' })
    return
  }

  const { search, status, plano, limit = 200 } = req.body ?? {}
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('saas_empresa_resumo')
    .select('*')
    .order('empresa_created_at', { ascending: false })
    .limit(Math.min(Number(limit) || 200, 500))

  if (error) {
    const hint = error.message.includes('saas_empresa_resumo')
      ? ' Execute sql/supabase-saas-resumo.sql no Supabase.'
      : ''
    res.status(500).json({ ok: false, error: formatSupabaseError(`${error.message}${hint}`) })
    return
  }

  let rows = (data ?? []) as SaasEmpresaResumo[]

  const searchTerm = String(search ?? '').trim().toLowerCase()
  if (searchTerm) {
    rows = rows.filter((r) => {
      const nome = (r.nome ?? '').toLowerCase()
      const cnpj = (r.cnpj ?? '').toLowerCase()
      const email = (r.config_email ?? '').toLowerCase()
      const codigo = String(r.codigo_acesso ?? '')
      const id = r.empresa_id.toLowerCase()
      return (
        nome.includes(searchTerm) ||
        cnpj.includes(searchTerm) ||
        email.includes(searchTerm) ||
        codigo.includes(searchTerm) ||
        id.includes(searchTerm)
      )
    })
  }

  const statusFilter = String(status ?? '').trim()
  if (statusFilter) {
    rows = rows.filter((r) => (r.assinatura_status ?? 'sem_assinatura') === statusFilter)
  }

  const planoFilter = String(plano ?? '').trim()
  if (planoFilter) {
    rows = rows.filter((r) => (r.plano ?? '') === planoFilter)
  }

  const totais = {
    empresas: rows.length,
    trial: rows.filter((r) => r.assinatura_status === 'trial').length,
    active: rows.filter((r) => r.assinatura_status === 'active').length,
    pending: rows.filter((r) => r.assinatura_status === 'pending_payment' || r.assinatura_status === 'expired').length,
    cancelled: rows.filter((r) => r.assinatura_status === 'cancelled').length,
    semAssinatura: rows.filter((r) => !r.assinatura_status).length,
    produtos: rows.reduce((acc, r) => acc + Number(r.produtos_count ?? 0), 0),
    nfce: rows.reduce((acc, r) => acc + Number(r.nfce_autorizadas_count ?? 0), 0),
    nfe: rows.reduce((acc, r) => acc + Number(r.nfe_autorizadas_count ?? 0), 0),
    registros: rows.reduce((acc, r) => acc + Number(r.registros_estimados_count ?? 0), 0),
  }

  res.status(200).json({ ok: true, empresas: rows, totais })
}
