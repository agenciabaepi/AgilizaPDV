import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireSaasAdmin } from '../_lib/auth'
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

  const { empresaId } = req.body ?? {}
  if (!empresaId) {
    res.status(400).json({ ok: false, error: 'empresaId é obrigatório.' })
    return
  }

  const supabase = getSupabaseAdmin()
  const id = String(empresaId)

  const { data: resumo, error: resumoErr } = await supabase
    .from('saas_empresa_resumo')
    .select('*')
    .eq('empresa_id', id)
    .maybeSingle()

  if (resumoErr) {
    res.status(500).json({ ok: false, error: resumoErr.message })
    return
  }

  if (!resumo) {
    res.status(404).json({ ok: false, error: 'Empresa não encontrada.' })
    return
  }

  const { data: usuarios, error: usuariosErr } = await supabase
    .from('usuarios')
    .select('id, nome, login, email, role, created_at')
    .eq('empresa_id', id)
    .order('created_at', { ascending: true })

  if (usuariosErr) {
    res.status(500).json({ ok: false, error: usuariosErr.message })
    return
  }

  const { data: pagamentos, error: pagamentosErr } = await supabase
    .from('assinatura_pagamentos')
    .select('id, asaas_payment_id, valor, status, pago_em, created_at')
    .eq('empresa_id', id)
    .order('created_at', { ascending: false })
    .limit(30)

  if (pagamentosErr && !pagamentosErr.message.includes('does not exist')) {
    res.status(500).json({ ok: false, error: pagamentosErr.message })
    return
  }

  const { data: certificado } = await supabase
    .from('empresa_certificado')
    .select('updated_at')
    .eq('empresa_id', id)
    .maybeSingle()

  res.status(200).json({
    ok: true,
    empresa: resumo as SaasEmpresaResumo,
    usuarios: usuarios ?? [],
    pagamentos: pagamentos ?? [],
    certificado: certificado ? { configurado: true, updated_at: certificado.updated_at } : { configurado: false },
  })
}
