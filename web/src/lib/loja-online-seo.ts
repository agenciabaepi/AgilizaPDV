import { getLojaOnlinePublicBaseUrl } from './loja-online'

export type LojaOnlineSeoMeta = {
  title?: string
  description?: string
  image?: string | null
  url?: string
  type?: 'website' | 'product'
  price?: number
  currency?: string
  availability?: 'InStock' | 'OutOfStock'
}

function upsertMeta(name: string, content: string, property = false) {
  const attr = property ? 'property' : 'name'
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.content = content
}

function removeMeta(name: string, property = false) {
  const attr = property ? 'property' : 'name'
  document.querySelector(`meta[${attr}="${name}"]`)?.remove()
}

function upsertJsonLd(id: string, data: Record<string, unknown>) {
  let el = document.getElementById(id) as HTMLScriptElement | null
  if (!el) {
    el = document.createElement('script')
    el.id = id
    el.type = 'application/ld+json'
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

export function getLojaOnlineCanonicalUrl(
  slug: string,
  path = '',
  customDomain?: string | null
): string {
  const p = path.startsWith('/') ? path : path ? `/${path}` : ''
  return `${getLojaOnlinePublicBaseUrl({ loja_online_slug: slug, loja_online_dominio_custom: customDomain })}${p}`
}

export function applyLojaOnlineSeo(meta: LojaOnlineSeoMeta) {
  const title = meta.title?.trim() || 'Loja online'
  const description = meta.description?.trim() || ''
  const url = meta.url || window.location.href
  const image = meta.image?.trim() || undefined

  document.title = title

  if (description) upsertMeta('description', description)
  else removeMeta('description')

  upsertMeta('og:title', title, true)
  upsertMeta('og:type', meta.type === 'product' ? 'product' : 'website', true)
  upsertMeta('og:url', url, true)
  if (description) upsertMeta('og:description', description, true)
  else removeMeta('og:description', true)
  if (image) upsertMeta('og:image', image, true)
  else removeMeta('og:image', true)

  upsertMeta('twitter:card', image ? 'summary_large_image' : 'summary')
  upsertMeta('twitter:title', title)
  if (description) upsertMeta('twitter:description', description)
  if (image) upsertMeta('twitter:image', image)

  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.appendChild(link)
  }
  link.href = url

  if (meta.type === 'product' && meta.price != null) {
    upsertJsonLd('loja-jsonld-product', {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: title.split(' | ')[0],
      description,
      image: image ? [image] : undefined,
      offers: {
        '@type': 'Offer',
        price: meta.price,
        priceCurrency: meta.currency || 'BRL',
        availability: `https://schema.org/${meta.availability || 'InStock'}`,
        url,
      },
    })
  } else {
    upsertJsonLd('loja-jsonld-store', {
      '@context': 'https://schema.org',
      '@type': 'Store',
      name: title.split(' | ')[0],
      description,
      url,
      image,
    })
    document.getElementById('loja-jsonld-product')?.remove()
  }
}

export function resetLojaOnlineSeo() {
  document.title = 'Agiliza PDV'
  ;['description', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'].forEach((n) =>
    removeMeta(n)
  )
  ;['og:title', 'og:type', 'og:url', 'og:description', 'og:image'].forEach((n) => removeMeta(n, true))
  document.querySelector('link[rel="canonical"]')?.remove()
  document.getElementById('loja-jsonld-product')?.remove()
  document.getElementById('loja-jsonld-store')?.remove()
}
