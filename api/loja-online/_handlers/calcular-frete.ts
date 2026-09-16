import type { VercelRequest, VercelResponse } from '@vercel/node'
import { assertSupabaseConfigured } from '../_lib/supabase'
import { getLojaConfigBySlug } from '../_lib/config'
import { calcularFreteCorreios } from '../_lib/correios'
import { resolveMelhorEnvioAuth } from '../_lib/melhor-envio'
import type { MelhorEnvioProductInput } from '../_lib/melhor-envio'

type FreteItemInput = {
  id?: string
  quantidade?: number
  preco?: number
  pesoKg?: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  const body = (req.body ?? {}) as {
    slug?: string
    cepDestino?: string
    pesoKg?: number
    subtotal?: number
    itens?: FreteItemInput[]
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
    const minimo = Number(cfg.loja_online_frete_gratis_minimo) || 0
    const promoAtiva = Number(cfg.loja_online_frete_gratis_ativo) === 1 && minimo > 0 && tipo !== 'gratis'
    const subtotal = Number(body.subtotal) || 0
    if (promoAtiva && subtotal >= minimo) {
      res.status(200).json({
        ok: true,
        tipo: 'gratis',
        opcoes: [{ servico: 'gratis', codigo: 'GRATIS', nome: 'Frete grátis', valor: 0, prazo: 0 }],
      })
      return
    }

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

    const { auth } = resolveMelhorEnvioAuth(
      cfg.loja_online_melhor_envio_token,
      Number(cfg.loja_online_melhor_envio_sandbox) === 1
    )
    if (!auth) {
      res.status(400).json({
        ok: false,
        error:
          'Melhor Envio não conectado. Em Loja online → Entrega e frete, cole o token (Integrações → Permissões de Acesso → Gerar novo token).',
      })
      return
    }

    const pesoPadrao = Number(cfg.loja_online_frete_peso_padrao) || 0.3
    const pesoKg = body.pesoKg ?? pesoPadrao
    const itens = Array.isArray(body.itens) ? body.itens : []
    const products: MelhorEnvioProductInput[] = itens
      .filter((item) => Number(item.quantidade) > 0)
      .map((item, i) => ({
        id: String(item.id || `item-${i + 1}`).slice(0, 60),
        width: 15,
        height: 5,
        length: 20,
        weight: Math.max(0.1, Number(item.pesoKg) || pesoPadrao),
        insurance_value: Math.max(1, Number(item.preco) || 0),
        quantity: Math.max(1, Math.round(Number(item.quantidade) || 1)),
      }))

    const opcoes = await calcularFreteCorreios({
      cepOrigem,
      cepDestino,
      pesoKg,
      melhorEnvioToken: cfg.loja_online_melhor_envio_token,
      melhorEnvioSandbox: Number(cfg.loja_online_melhor_envio_sandbox) === 1,
      valorSeguro: subtotal || undefined,
      products: products.length > 0 ? products : undefined,
      empresaId: cfg.empresa_id,
    })
    res.status(200).json({ ok: true, tipo: 'correios', opcoes })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: msg })
  }
}
