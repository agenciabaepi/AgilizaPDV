import { useEffect, useMemo, useState } from 'react'
import {
  fetchLojaOnlineCategorias,
  fetchLojaOnlineProdutoCategoriaIds,
} from '../lib/loja-online-api'
import {
  buildLojaOnlineMenuCategorias,
  type LojaOnlineMenuCategoria,
} from '../lib/loja-online-categorias'
import { useLojaOnlineStore } from './useLojaOnlineStore'

export function useLojaOnlineMenuCategorias() {
  const { store, ocultarSemEstoque } = useLojaOnlineStore()
  const [menuCategorias, setMenuCategorias] = useState<LojaOnlineMenuCategoria[]>([])
  const [temSemCategoria, setTemSemCategoria] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!store?.empresa_id) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchLojaOnlineCategorias(store.empresa_id),
      fetchLojaOnlineProdutoCategoriaIds(store.empresa_id, ocultarSemEstoque),
    ])
      .then(([categorias, { categoriaIds, temSemCategoria: semCat }]) => {
        if (cancelled) return
        setMenuCategorias(buildLojaOnlineMenuCategorias(categorias, categoriaIds))
        setTemSemCategoria(semCat)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [store?.empresa_id, ocultarSemEstoque])

  const hasItems = menuCategorias.length > 0 || temSemCategoria

  return useMemo(
    () => ({ menuCategorias, temSemCategoria, loading, hasItems }),
    [menuCategorias, temSemCategoria, loading, hasItems]
  )
}
