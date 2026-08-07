import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from '../_lib/supabase'
import { LOJA_ONLINE_DOMAIN } from './_lib/constants'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).end()
    return
  }

  const slugParam = req.query.slug
  const slug = (Array.isArray(slugParam) ? slugParam[0] : slugParam)?.trim()
  if (!slug) {
    res.status(400).send('Informe ?slug=')
    return
  }

  const db = getSupabaseAdmin()
  const { data: store } = await db
    .from('empresas_config')
    .select('empresa_id, loja_online_ativa')
    .eq('loja_online_slug', slug)
    .eq('loja_online_ativa', 1)
    .maybeSingle()

  if (!store?.empresa_id) {
    res.status(404).send('Loja não encontrada')
    return
  }

  const { data: produtos } = await db
    .from('produtos')
    .select('id, updated_at')
    .eq('empresa_id', store.empresa_id)
    .eq('ativo', 1)
    .eq('loja_online', 1)

  const base = `https://${slug}.${LOJA_ONLINE_DOMAIN}`
  const urls = [
    { loc: base, priority: '1.0' },
    { loc: `${base}/busca`, priority: '0.8' },
    ...(produtos ?? []).map((p) => ({
      loc: `${base}/produto/${(p as { id: string }).id}`,
      priority: '0.7',
      lastmod: (p as { updated_at?: string }).updated_at,
    })),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
  res.status(200).send(xml)
}
