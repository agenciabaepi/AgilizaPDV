import type { VercelRequest, VercelResponse } from '@vercel/node'
import { assertSupabaseConfigured } from '../_lib/supabase'
import { sincronizarPagamentosEmpresa, sincronizarPagamentosPendentes } from '../_lib/pagamentos'
import { cancelarTodosPedidosPagamentoExpirado } from '../_lib/pedidos-expirados'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  const cron = req.query.cron === '1' || req.query.cron === 'true'

  if (cron) {
    try {
      assertSupabaseConfigured()
      const pedidosExpiradosCancelados = await cancelarTodosPedidosPagamentoExpirado()
      res.status(200).json({ ok: true, pedidosExpiradosCancelados })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      res.status(500).json({ ok: false, error: msg })
    }
    return
  }

  const slug = String(req.query.slug ?? (req.body as { slug?: string })?.slug ?? '').trim()
  const empresaId = String(req.query.empresaId ?? (req.body as { empresaId?: string })?.empresaId ?? '').trim()

  if (!slug && !empresaId) {
    res.status(400).json({ ok: false, error: 'Informe slug ou empresaId.' })
    return
  }

  try {
    assertSupabaseConfigured()
    const result = slug
      ? await sincronizarPagamentosPendentes(slug)
      : await sincronizarPagamentosEmpresa(empresaId)
    res.status(200).json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: msg })
  }
}
