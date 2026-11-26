import type { VercelRequest, VercelResponse } from '@vercel/node'
import { parseSession } from '../../fiscal/_lib/auth'

/**
 * GET /api/produtos/gtin?codigo=7891234567895
 * Busca os dados do produto pelo código de barras em bases GRATUITAS, uma após a outra:
 *   1. Open Food Facts / Open Products Facts / Open Beauty Facts (bases abertas, sem conta)
 *   2. UPCitemdb (modo gratuito: 100 consultas/dia, sem conta) — forte em eletrônicos e importados
 *   3. Cosmos Bluesoft — só se houver COSMOS_TOKEN e as gratuitas não acharem (plano gratuito tem poucas consultas)
 * Devolve os dados para pré-preencher o cadastro e qual fonte encontrou.
 */

const USER_AGENT = 'AgilizaPDV/1.0 (consulta de codigo de barras)'
const TIMEOUT_MS = 6000
const IMAGEM_MAX_BYTES = 3 * 1024 * 1024

type Encontrado = {
  fonte: string
  nome: string
  marca: string | null
  ncm: string | null
  ncm_descricao: string | null
  cest: string | null
  imagem: string | null
  preco_medio: number | null
  peso_bruto: number | null
}

/** null = não achou; 'limite' = a base recusou por limite de consultas. */
type ResultadoFonte = Encontrado | null | 'limite'

function apenasDigitos(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '')
}

function texto(v: unknown): string | null {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''
  return s ? s : null
}

async function buscarJson(url: string, headers: Record<string, string> = {}): Promise<{ status: number; json: unknown }> {
  const controle = new AbortController()
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS)
  try {
    const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT, ...headers }, signal: controle.signal })
    const json = await r.json().catch(() => null)
    return { status: r.status, json }
  } catch {
    return { status: 0, json: null }
  } finally {
    clearTimeout(timer)
  }
}

/** "395 g" → 0.395 · "1,5 kg" → 1.5 · "12 oz" → 0.34 · "0.35 lb" → 0.159. Volume (ml/l) não vira peso. */
function pesoEmKg(v: unknown): number | null {
  const m = String(v ?? '').toLowerCase().replace(',', '.').match(/([\d.]+)\s*(kg|g|lb|lbs|oz)\b/)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return null
  const kg = m[2] === 'kg' ? n : m[2] === 'g' ? n / 1000 : m[2].startsWith('lb') ? n * 0.453592 : n * 0.0283495
  return Math.round(kg * 1000) / 1000
}

/** Open Food Facts e bases irmãs (mesmo formato de resposta). */
async function buscarOpenFacts(codigo: string): Promise<ResultadoFonte> {
  const bases: Array<[string, string]> = [
    ['world.openfoodfacts.org', 'Open Food Facts'],
    ['world.openproductsfacts.org', 'Open Products Facts'],
    ['world.openbeautyfacts.org', 'Open Beauty Facts'],
  ]
  const campos = 'product_name,product_name_pt,brands,image_front_url,image_url,quantity'
  const respostas = await Promise.all(
    bases.map(async ([host, nome]) => {
      const { status, json } = await buscarJson(`https://${host}/api/v2/product/${codigo}.json?fields=${campos}`)
      return { status, json: json as { status?: number; product?: Record<string, unknown> } | null, nome }
    })
  )
  for (const { json, nome } of respostas) {
    const p = json?.status === 1 ? json.product : null
    const nomeProduto = texto(p?.product_name_pt) ?? texto(p?.product_name)
    if (!p || !nomeProduto) continue
    return {
      fonte: nome,
      nome: nomeProduto,
      marca: texto(String(p.brands ?? '').split(',')[0]),
      ncm: null,
      ncm_descricao: null,
      cest: null,
      imagem: texto(p.image_front_url) ?? texto(p.image_url),
      preco_medio: null,
      peso_bruto: pesoEmKg(p.quantity),
    }
  }
  return respostas.some((r) => r.status === 429) ? 'limite' : null
}

/** UPCitemdb, modo gratuito (sem conta). */
async function buscarUpcItemDb(codigo: string): Promise<ResultadoFonte> {
  const { status, json } = await buscarJson(`https://api.upcitemdb.com/prod/trial/lookup?upc=${codigo}`)
  if (status === 429) return 'limite'
  const dados = json as { code?: string; items?: Array<Record<string, unknown>> } | null
  const item = dados?.code === 'OK' ? dados.items?.[0] : undefined
  const nome = texto(item?.title)
  if (!item || !nome) return null
  const imagens = Array.isArray(item.images) ? (item.images as unknown[]) : []
  const imagem = imagens.map((u) => texto(u)).find((u): u is string => !!u && /^https:\/\//i.test(u)) ?? null
  return {
    fonte: 'UPCitemdb',
    nome,
    marca: texto(item.brand),
    ncm: null,
    ncm_descricao: null,
    cest: null,
    imagem,
    preco_medio: null,
    peso_bruto: pesoEmKg(item.weight),
  }
}

/** Cosmos Bluesoft: só com token, e só depois das bases gratuitas (poupa a cota do plano gratuito). */
async function buscarCosmos(codigo: string, token: string): Promise<ResultadoFonte> {
  const { status, json } = await buscarJson(`https://api.cosmos.bluesoft.com.br/gtins/${codigo}.json`, {
    'X-Cosmos-Token': token,
    'User-Agent': 'Cosmos-API-Request',
    'Content-Type': 'application/json',
  })
  if (status === 429) return 'limite'
  const d = json as {
    description?: string
    thumbnail?: string | null
    avg_price?: number | null
    gross_weight?: number | null
    brand?: { name?: string | null } | null
    ncm?: { code?: string | null; description?: string | null; full_description?: string | null } | null
    cest?: { code?: string | null } | null
  } | null
  const nome = status >= 200 && status < 300 ? texto(d?.description) : null
  if (!d || !nome) return null
  const ncm = apenasDigitos(d.ncm?.code)
  return {
    fonte: 'Cosmos',
    nome,
    marca: texto(d.brand?.name),
    ncm: ncm.length === 8 ? ncm : null,
    ncm_descricao: texto(d.ncm?.full_description) ?? texto(d.ncm?.description),
    cest: apenasDigitos(d.cest?.code) || null,
    imagem: texto(d.thumbnail),
    preco_medio: typeof d.avg_price === 'number' ? d.avg_price : null,
    peso_bruto: typeof d.gross_weight === 'number' ? d.gross_weight : null,
  }
}

/** Baixa a foto do produto (até 3 MB, 8 s). Sem foto não é erro: devolve null. */
async function baixarImagem(url: string): Promise<string | null> {
  if (!/^https:\/\//i.test(url)) return null
  const controle = new AbortController()
  const timer = setTimeout(() => controle.abort(), 8000)
  try {
    const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controle.signal })
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
  const fontes: Array<() => Promise<ResultadoFonte>> = [
    () => buscarOpenFacts(codigo),
    () => buscarUpcItemDb(codigo),
    ...(token ? [() => buscarCosmos(codigo, token)] : []),
  ]

  let algumaNoLimite = false
  for (const buscar of fontes) {
    const r = await buscar()
    if (r === 'limite') {
      algumaNoLimite = true
      continue
    }
    if (!r) continue

    const imagemDataUrl = r.imagem ? await baixarImagem(r.imagem) : null
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.status(200).json({
      ok: true,
      encontrado: true,
      codigo,
      produto: { ...r, imagem_data_url: imagemDataUrl },
    })
    return
  }

  if (algumaNoLimite) {
    res.status(429).json({
      ok: false,
      error: 'As bases gratuitas atingiram o limite de consultas por hoje. Preencha manualmente ou tente amanhã.',
    })
    return
  }
  res.status(200).json({ ok: true, encontrado: false, codigo })
}
