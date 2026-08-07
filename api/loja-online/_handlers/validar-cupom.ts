import type { VercelRequest, VercelResponse } from '@vercel/node'
import { assertSupabaseConfigured, getSupabaseAdmin } from '../_lib/supabase'
import { getLojaConfigBySlug } from '../_lib/config'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  const body = (req.body ?? {}) as { slug?: string; codigo?: string; subtotal?: number }
  const slug = String(body.slug ?? '').trim()
  const codigo = String(body.codigo ?? '').trim().toUpperCase()
  const subtotal = Number(body.subtotal) || 0

  if (!slug || !codigo) {
    res.status(400).json({ ok: false, error: 'slug e codigo são obrigatórios.' })
    return
  }

  try {
    assertSupabaseConfigured()
    const cfg = await getLojaConfigBySlug(slug)
    if (!cfg) {
      res.status(404).json({ ok: false, error: 'Loja não encontrada.' })
      return
    }

    const sb = getSupabaseAdmin()
    const { data: cupom, error } = await sb
      .from('loja_online_cupons')
      .select('*')
      .eq('empresa_id', cfg.empresa_id)
      .eq('ativo', 1)
      .ilike('codigo', codigo)
      .maybeSingle()

    if (error) throw error
    if (!cupom) {
      res.status(404).json({ ok: false, error: 'Cupom inválido ou expirado.' })
      return
    }

    if (cupom.valido_ate && new Date(cupom.valido_ate as string) < new Date()) {
      res.status(400).json({ ok: false, error: 'Este cupom expirou.' })
      return
    }

    const usoMax = cupom.uso_maximo != null ? Number(cupom.uso_maximo) : null
    const usosAtual = Number(cupom.usos_atual) || 0
    if (usoMax != null && usosAtual >= usoMax) {
      res.status(400).json({ ok: false, error: 'Este cupom atingiu o limite de usos.' })
      return
    }

    const valorMinimo = Number(cupom.valor_minimo) || 0
    if (subtotal < valorMinimo) {
      res.status(400).json({
        ok: false,
        error: `Pedido mínimo de R$ ${valorMinimo.toFixed(2).replace('.', ',')} para este cupom.`,
      })
      return
    }

    const tipo = cupom.tipo as 'percentual' | 'fixo'
    const valorCupom = Number(cupom.valor) || 0
    let desconto = tipo === 'percentual' ? (subtotal * valorCupom) / 100 : valorCupom
    desconto = Math.min(desconto, subtotal)
    desconto = Math.round(desconto * 100) / 100

    res.status(200).json({
      ok: true,
      cupom: {
        id: cupom.id,
        codigo: cupom.codigo,
        tipo,
        valor: valorCupom,
        desconto,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: msg })
  }
}
