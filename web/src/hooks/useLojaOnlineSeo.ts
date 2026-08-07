import { useEffect } from 'react'
import { applyLojaOnlineSeo, resetLojaOnlineSeo, type LojaOnlineSeoMeta } from '../lib/loja-online-seo'

export function useLojaOnlineSeo(meta: LojaOnlineSeoMeta | null) {
  useEffect(() => {
    if (!meta) return
    applyLojaOnlineSeo(meta)
    return () => resetLojaOnlineSeo()
  }, [
    meta?.title,
    meta?.description,
    meta?.image,
    meta?.url,
    meta?.type,
    meta?.price,
    meta?.availability,
  ])
}
