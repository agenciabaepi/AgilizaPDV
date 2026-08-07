import type { VercelRequest, VercelResponse } from '@vercel/node'
import { LOJA_ONLINE_DOMAIN } from '../_lib/constants'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).end()
    return
  }

  const slugParam = req.query.slug
  const slug = (Array.isArray(slugParam) ? slugParam[0] : slugParam)?.trim()

  const body = slug
    ? `User-agent: *
Allow: /
Sitemap: https://${slug}.${LOJA_ONLINE_DOMAIN}/api/loja-online/sitemap?slug=${encodeURIComponent(slug)}
`
    : `User-agent: *
Allow: /
`

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.status(200).send(body)
}
