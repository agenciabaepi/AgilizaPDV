import { useEffect } from 'react'
import { applyLojaOnlineSeo, resetLojaOnlineSeo, type LojaOnlineSeoMeta } from '../lib/loja-online-seo'

export function useLojaOnlineSeo(meta: LojaOnlineSeoMeta | null, opts?: { keepStorefrontBrand?: boolean }) {
  const keepStorefrontBrand = opts?.keepStorefrontBrand ?? true
  useEffect(() => {
    if (!meta) return
    applyLojaOnlineSeo(meta)
    return () => resetLojaOnlineSeo({ keepStorefrontBrand })
  }, [
    meta?.title,
    meta?.description,
    meta?.image,
    meta?.favicon,
    meta?.url,
    meta?.type,
    meta?.price,
    meta?.availability,
    keepStorefrontBrand,
  ])
}
