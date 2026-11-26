import type { VercelRequest, VercelResponse } from '@vercel/node'
import { parseSession } from '../../fiscal/_lib/auth'

/**
 * GET /api/produtos/gtin?codigo=7891234567895
 * Consulta o código de barras (GTIN/EAN) na base Cosmos Bluesoft e devolve os dados
 * para pré-preencher o cadastro de produto. O token fica só no servidor (COSMOS_TOKEN).
 */

const COSMOS_URL = 'https://api.cosmos.bluesoft.com.br/gtins'

type CosmosGtin = {
  description?: string
  gtin?: number | string
  thumbnail?: string | null
  avg_price?: number | null
  max_price?: number | null
  gross_weight?: number | null
  net_weight?: number | null
  brand?: { name?: string | null } | null
  ncm?: { code?: string | null; description?: string | null; full_description?: string | null } | null
  cest?: { code?: string | null } | null
}

function apenasDigitos(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '')
}

const IMAGEM_MAX_BYTES = 3 * 1024 * 1024

/** Baixa a foto do produto (até 3 MB, 8 s). Sem foto não é erro: devolve null. */
async function baixarImagem(url: string): Promise<string | null> {
  if (!/^https:\/\//i.test(url)) return null
  const controle = new AbortController()
  const timer = setTimeout(() => controle.abort(), 8000)
  try {
    const r = await fetch(url, { signal: controle.signal })
    const tipo = (r.headers.get('content-type') ?? '').split(';')[0].trim()
    if (!r.ok || !tipo.startsWith('image/')) return null
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length === 0 || buf.length > IMAGEM_MAX_BYTES) return null
    return `data:${tipo};base64,${buf.toString('base64')}`
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  if (!parseSession(req)) {
    res.status(401).json({ ok: false, error: 'Sessão inválida. Faça login novamente.' })
    return
  }

  const codigo = apenasDigitos(req.query.codigo)
  if (codigo.length < 8 || codigo.length > 14) {
    res.status(400).json({ ok: false, error: 'Código de barras inválido. Use EAN-8, EAN-13, UPC ou GTIN-14.' })
    return
  }

  const token = (process.env.COSMOS_TOKEN ?? '').trim()
  if (!token) {
    res.status(503).json({
      ok: false,
      configurado: false,
      error: 'A busca de dados pelo código de barras ainda não está configurada (falta o token do Cosmos).',
    })
    return
  }

  let resposta: Response
  try {
    resposta = await fetch(`${COSMOS_URL}/${codigo}.json`, {
      headers: {
        'X-Cosmos-Token': token,
        'User-Agent': 'Cosmos-API-Request',
        'Content-Type': 'application/json',
      },
    })
  } catch {
    res.status(502).json({ ok: false, error: 'Não foi possível consultar a base de códigos de barras agora.' })
    return
  }

  if (resposta.status === 404) {
    res.status(200).json({ ok: true, encontrado: false, codigo })
    return
  }
  if (resposta.status === 401 || resposta.status === 403) {
    res.status(502).json({ ok: false, error: 'Token do Cosmos inválido ou sem permissão.' })
    return
  }
  if (resposta.status === 429) {
    res.status(429).json({ ok: false, error: 'Limite de consultas do Cosmos atingido. Tente novamente mais tarde.' })
    return
  }
  if (!resposta.ok) {
    res.status(502).json({ ok: false, error: `A base de códigos de barras respondeu com erro (HTTP ${resposta.status}).` })
    return
  }

  const dados = (await resposta.json().catch(() => null)) as CosmosGtin | null
  if (!dados || !dados.description) {
    res.status(200).json({ ok: true, encontrado: false, codigo })
    return
  }

  const ncm = apenasDigitos(dados.ncm?.code)
  const imagemDataUrl = dados.thumbnail ? await baixarImagem(dados.thumbnail) : null
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.status(200).json({
    ok: true,
    encontrado: true,
    codigo,
    produto: {
      nome: dados.description.trim(),
      marca: dados.brand?.name?.trim() || null,
      ncm: ncm.length === 8 ? ncm : null,
      ncm_descricao: dados.ncm?.full_description || dados.ncm?.description || null,
      cest: apenasDigitos(dados.cest?.code) || null,
      imagem: dados.thumbnail || null,
      /** Foto já baixada (data URL), para o navegador não depender de buscar em outro site. */
      imagem_data_url: imagemDataUrl,
      preco_medio: typeof dados.avg_price === 'number' ? dados.avg_price : null,
      peso_bruto: typeof dados.gross_weight === 'number' ? dados.gross_weight : null,
    },
  })
}
