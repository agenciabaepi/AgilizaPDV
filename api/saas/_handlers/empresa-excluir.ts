import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireSaasAdmin } from '../_lib/auth'
import { getSaasAdminPassword } from '../_lib/config'
import { excluirEmpresaCompleta } from '../_lib/delete-empresa'
import { formatSupabaseError } from '../../assinaturas/_lib/config'
import { getSupabaseAdmin } from '../../assinaturas/_lib/supabase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  if (!requireSaasAdmin(req)) {
    res.status(401).json({ ok: false, error: 'Token de administrador SaaS inválido.' })
    return
  }

  const { empresaId, password } = req.body ?? {}
  if (!empresaId) {
    res.status(400).json({ ok: false, error: 'empresaId é obrigatório.' })
    return
  }

  const senha = String(password ?? '')
  if (!senha) {
    res.status(400).json({ ok: false, error: 'Informe sua senha de administrador para confirmar.' })
    return
  }

  const expected = getSaasAdminPassword()
  if (!expected || senha !== expected) {
    res.status(401).json({ ok: false, error: 'Senha incorreta. Exclusão cancelada.' })
    return
  }

  const id = String(empresaId)
  const supabase = getSupabaseAdmin()

  const { data: empresa, error: findErr } = await supabase
    .from('empresas')
    .select('id, nome')
    .eq('id', id)
    .maybeSingle()

  if (findErr) {
    res.status(500).json({ ok: false, error: formatSupabaseError(findErr.message) })
    return
  }

  if (!empresa) {
    res.status(404).json({ ok: false, error: 'Empresa não encontrada.' })
    return
  }

  try {
    await excluirEmpresaCompleta(id)
    res.status(200).json({
      ok: true,
      message: `Empresa "${empresa.nome}" e todos os dados relacionados foram excluídos.`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: formatSupabaseError(msg) })
  }
}
