import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from '../_lib/supabase'
import { LOJA_ONLINE_DOMAIN } from '../_lib/constants'
import { lojaOnlineCustomDomainVariants, normalizeLojaOnlineCustomDomain } from '../_lib/dominio'

type StoreRow = {
  empresa_id: string
  loja_online_slug: string | null
  loja_online_titulo: string | null
  loja_online_descricao: string | null
  loja_online_seo_titulo: string | null
  loja_online_seo_descricao: string | null
  loja_online_logo_header: string | null
  loja_online_dominio_custom: string | null
}

type ProdutoRow = {
  id: string
  nome: string
  descricao: string | null
  imagem: string | null
  loja_online_imagens_json: string | null
  preco: number | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function firstPublicImage(...candidates: Array<string | null | undefined>): string | null {
  for (const raw of candidates) {
    const url = raw?.trim()
    if (!url) continue
    if (url.startsWith('data:')) continue
    if (url.startsWith('https://') || url.startsWith('http://')) return url
  }
  return null
}

function imageFromMidiasJson(json: string | null | undefined): string | null {
  if (!json?.trim()) return null
  try {
    const parsed = JSON.parse(json) as unknown
    if (!Array.isArray(parsed)) return null
    for (const item of parsed) {
      if (typeof item === 'string') {
        const img = firstPublicImage(item)
        if (img) return img
        continue
      }
      if (!item || typeof item !== 'object') continue
      const row = item as { tipo?: string; url?: string }
      if (row.tipo === 'video') continue
      const img = firstPublicImage(row.url)
      if (img) return img
    }
  } catch {
    /* ignore */
  }
  return null
}

function parseHostAndPath(req: VercelRequest): { host: string; path: string; pageUrl: string } {
  const qHost = Array.isArray(req.query.host) ? req.query.host[0] : req.query.host
  const qPath = Array.isArray(req.query.path) ? req.query.path[0] : req.query.path
  const headerHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim()
  const host = (qHost || headerHost || LOJA_ONLINE_DOMAIN).replace(/:\d+$/, '').toLowerCase()
  const pathRaw = (qPath || '/').toString()
  const path = pathRaw.startsWith('/') ? pathRaw : `/${pathRaw}`
  const proto = (req.headers['x-forwarded-proto'] || 'https').toString().split(',')[0].trim() || 'https'
  const pageUrl = `${proto}://${host}${path.split('?')[0] || '/'}`
  return { host, path: path.split('?')[0] || '/', pageUrl }
}

function extractSlugFromHost(host: string): string | null {
  const domain = LOJA_ONLINE_DOMAIN.toLowerCase()
  if (host === domain || host === `www.${domain}`) return null
  if (host.endsWith(`.${domain}`)) {
    const sub = host.slice(0, -(domain.length + 1)).split('.')[0]?.trim()
    if (sub && sub !== 'www') return sub
  }
  return null
}

function extractFromPath(pathname: string): { slug: string | null; produtoId: string | null } {
  const parts = pathname.split('/').filter(Boolean)
  let slug: string | null = null
  let rest = parts
  if (parts[0] === 'loja' && parts[1]) {
    slug = parts[1]
    rest = parts.slice(2)
  }
  let produtoId: string | null = null
  const prodIdx = rest.indexOf('produto')
  if (prodIdx >= 0 && rest[prodIdx + 1]) {
    produtoId = rest[prodIdx + 1]
  }
  return { slug, produtoId }
}

async function resolveStore(host: string, pathSlug: string | null): Promise<StoreRow | null> {
  const db = getSupabaseAdmin()
  const select =
    'empresa_id, loja_online_slug, loja_online_titulo, loja_online_descricao, loja_online_seo_titulo, loja_online_seo_descricao, loja_online_logo_header, loja_online_dominio_custom'

  if (pathSlug) {
    const { data } = await db
      .from('empresas_config')
      .select(select)
      .eq('loja_online_slug', pathSlug)
      .eq('loja_online_ativa', 1)
      .maybeSingle()
    if (data) return data as StoreRow
  }

  const hostSlug = extractSlugFromHost(host)
  if (hostSlug) {
    const { data } = await db
      .from('empresas_config')
      .select(select)
      .eq('loja_online_slug', hostSlug)
      .eq('loja_online_ativa', 1)
      .maybeSingle()
    if (data) return data as StoreRow
  }

  const variants = lojaOnlineCustomDomainVariants(host)
  if (variants.length > 0) {
    const { data } = await db
      .from('empresas_config')
      .select(select)
      .in('loja_online_dominio_custom', variants)
      .eq('loja_online_ativa', 1)
      .limit(1)
      .maybeSingle()
    if (data) return data as StoreRow
  }

  return null
}

function buildHtml(opts: {
  title: string
  siteName: string
  description: string
  image: string | null
  url: string
  type: 'website' | 'product'
}): string {
  const title = escapeHtml(opts.title)
  const siteName = escapeHtml(opts.siteName)
  const description = escapeHtml(opts.description)
  const url = escapeHtml(opts.url)
  const image = opts.image ? escapeHtml(opts.image) : ''
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:site_name" content="${siteName}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:type" content="${opts.type === 'product' ? 'product' : 'website'}" />
  <meta property="og:url" content="${url}" />
  ${image ? `<meta property="og:image" content="${image}" />` : ''}
  <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  ${image ? `<meta name="twitter:image" content="${image}" />` : ''}
  <meta http-equiv="refresh" content="0;url=${url}" />
</head>
<body>
  <p><a href="${url}">${title}</a></p>
</body>
</html>`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).end()
    return
  }

  try {
    const { host, path, pageUrl } = parseHostAndPath(req)
    const { slug: pathSlug, produtoId } = extractFromPath(path)
    const store = await resolveStore(host, pathSlug)

    if (!store) {
      const html = buildHtml({
        title: 'Loja online',
        siteName: 'Loja online',
        description: 'Loja online',
        image: null,
        url: pageUrl,
        type: 'website',
      })
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
      res.status(200).send(html)
      return
    }

    const storeName =
      store.loja_online_seo_titulo?.trim() ||
      store.loja_online_titulo?.trim() ||
      store.loja_online_slug?.trim() ||
      'Loja online'
    const storeDesc =
      store.loja_online_seo_descricao?.trim() ||
      store.loja_online_descricao?.trim() ||
      storeName
    const storeImage = firstPublicImage(store.loja_online_logo_header)

    let title = storeName
    let description = storeDesc
    let image = storeImage
    let type: 'website' | 'product' = 'website'

    if (produtoId) {
      const db = getSupabaseAdmin()
      const { data: produto } = await db
        .from('produtos')
        .select('id, nome, descricao, imagem, loja_online_imagens_json, preco')
        .eq('empresa_id', store.empresa_id)
        .eq('id', produtoId)
        .eq('ativo', 1)
        .maybeSingle()

      if (produto) {
        const p = produto as ProdutoRow
        title = `${p.nome} | ${storeName}`
        description = (p.descricao?.trim() || p.nome)
          .replace(/^##\s+/gm, '')
          .replace(/\*\*/g, '')
          .slice(0, 160)
        image =
          firstPublicImage(imageFromMidiasJson(p.loja_online_imagens_json), p.imagem) || storeImage
        type = 'product'
      }
    }

    const custom = normalizeLojaOnlineCustomDomain(store.loja_online_dominio_custom)
    const canonicalHost = custom || (store.loja_online_slug ? `${store.loja_online_slug}.${LOJA_ONLINE_DOMAIN}` : host)
    const canonicalPath = path.startsWith('/loja/')
      ? `/${path.split('/').filter(Boolean).slice(2).join('/')}` || '/'
      : path
    const canonicalUrl = `https://${canonicalHost}${canonicalPath === '/' ? '' : canonicalPath}`

    const html = buildHtml({
      title,
      siteName: storeName,
      description,
      image,
      url: canonicalUrl || pageUrl,
      type,
    })

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')
    res.status(200).send(html)
  } catch (err) {
    console.error('[og-preview]', err)
    res.status(500).send('Erro ao gerar preview')
  }
}
