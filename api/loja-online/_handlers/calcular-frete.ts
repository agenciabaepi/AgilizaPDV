import type { VercelRequest, VercelResponse } from '@vercel/node'
import { assertSupabaseConfigured } from '../_lib/supabase'
import { getLojaConfigBySlug } from '../_lib/config'
import { calcularFreteCorreios } from '../_lib/correios'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  const body = (req.body ?? {}) as {
    slug?: string
    cepDestino?: string
    pesoKg?: number
  }

  const slug = String(body.slug ?? '').trim()
  const cepDestino = String(body.cepDestino ?? '').trim()

  if (!slug || !cepDestino) {
    res.status(400).json({ ok: false, error: 'slug e cepDestino são obrigatórios.' })
    return
  }

  try {
    assertSupabaseConfigured()
    const cfg = await getLojaConfigBySlug(slug)
    if (!cfg) {
      res.status(404).json({ ok: false, error: 'Loja não encontrada.' })
      return
    }

    const tipo = cfg.loja_online_frete_tipo ?? 'fixo'

    if (tipo === 'gratis') {
      res.status(200).json({
        ok: true,
        tipo: 'gratis',
        opcoes: [{ servico: 'gratis', codigo: 'GRATIS', nome: 'Frete grátis', valor: 0, prazo: 0 }],
      })
      return
    }

    if (tipo === 'fixo') {
      const valor = Number(cfg.loja_online_frete_valor_fixo) || 0
      res.status(200).json({
        ok: true,
        tipo: 'fixo',
        opcoes: [{ servico: 'fixo', codigo: 'FIXO', nome: 'Frete fixo', valor, prazo: 0 }],
      })
      return
    }

    const cepOrigem = String(cfg.loja_online_frete_cep_origem ?? '').replace(/\D/g, '')
    if (cepOrigem.length !== 8) {
      res.status(400).json({ ok: false, error: 'CEP de origem da loja não configurado.' })
      return
    }

    const meToken =
      cfg.loja_online_melhor_envio_token?.trim() || process.env.MELHOR_ENVIO_TOKEN?.trim() || ''
    if (!meToken) {
      res.status(400).json({
        ok: false,
        error:
          'Token do Melhor Envio não configurado. Em Loja online → Checkout, informe o token (Área Dev do Melhor Envio) para habilitar PAC/SEDEX.',
      })
      return
    }

    const pesoKg = body.pesoKg ?? (Number(cfg.loja_online_frete_peso_padrao) || 0.3)
    const opcoes = await calcularFreteCorreios({
      cepOrigem,
      cepDestino,
      pesoKg,
      melhorEnvioToken: meToken,
      melhorEnvioSandbox:
        Number(cfg.loja_online_melhor_envio_sandbox) === 1 ||
        process.env.MELHOR_ENVIO_SANDBOX === '1' ||
        process.env.MELHOR_ENVIO_SANDBOX === 'true',
    })
    res.status(200).json({ ok: true, tipo: 'correios', opcoes })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: msg })
  }
}
