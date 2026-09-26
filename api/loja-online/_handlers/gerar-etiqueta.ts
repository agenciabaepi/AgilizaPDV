import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdminSession } from '../../assinaturas/_lib/auth'
import { gerarEtiquetaPedido, sincronizarRastreioPedido } from '../_lib/etiquetas'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  const body = (req.body ?? {}) as { empresaId?: string; pedidoId?: string; apenasRastreio?: boolean }
  const empresaId = String(body.empresaId ?? '').trim()
  const pedidoId = String(body.pedidoId ?? '').trim()
  if (!empresaId || !pedidoId) {
    res.status(400).json({ ok: false, error: 'empresaId e pedidoId são obrigatórios.' })
    return
  }

  const session = requireAdminSession(req, empresaId)
  if (typeof session === 'string') {
    res.status(401).json({ ok: false, error: session })
    return
  }

  try {
    if (body.apenasRastreio) {
      const synced = await sincronizarRastreioPedido(pedidoId, empresaId)
      if (!synced.ok) throw new Error(synced.error || 'Não foi possível consultar o rastreio.')
      res.status(200).json({ ok: true, cartId: synced.cartId, tracking: synced.tracking ?? null })
      return
    }
    const result = await gerarEtiquetaPedido(pedidoId, empresaId)
    res.status(200).json({ ok: true, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(400).json({ ok: false, error: msg })
  }
}
