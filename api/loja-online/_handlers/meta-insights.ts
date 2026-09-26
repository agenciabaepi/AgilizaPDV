import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdminSession } from '../../assinaturas/_lib/auth'
import {
  fetchMetaInsights,
  loadMetaAuth,
  toMetaDate,
} from '../_lib/meta-ads'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  const q = req.query
  const empresaId = String(Array.isArray(q.empresaId) ? q.empresaId[0] : q.empresaId ?? '').trim()
  const sinceRaw = String(Array.isArray(q.since) ? q.since[0] : q.since ?? '').trim()
  const untilRaw = String(Array.isArray(q.until) ? q.until[0] : q.until ?? '').trim()

  if (!empresaId) {
    res.status(400).json({ ok: false, error: 'empresaId é obrigatório.' })
    return
  }

  const session = requireAdminSession(req, empresaId)
  if (typeof session === 'string') {
    res.status(401).json({ ok: false, error: session })
    return
  }

  const { auth, adAccountId } = await loadMetaAuth(empresaId)
  if (!auth?.access_token) {
    res.status(200).json({ ok: true, connected: false, insights: null })
    return
  }
  if (!adAccountId) {
    res.status(200).json({
      ok: true,
      connected: true,
      needsAccount: true,
      insights: null,
    })
    return
  }

  const now = new Date()
  const until = untilRaw || toMetaDate(now.toISOString())
  const sinceDefault = new Date(now)
  sinceDefault.setDate(now.getDate() - 7)
  const since = sinceRaw || toMetaDate(sinceDefault.toISOString())

  try {
    const insights = await fetchMetaInsights({
      accessToken: auth.access_token,
      adAccountId,
      since,
      until,
    })
    res.status(200).json({ ok: true, connected: true, insights })
  } catch (err) {
    res.status(200).json({
      ok: true,
      connected: true,
      insights: null,
      error: err instanceof Error ? err.message : 'Falha ao buscar insights.',
    })
  }
}
