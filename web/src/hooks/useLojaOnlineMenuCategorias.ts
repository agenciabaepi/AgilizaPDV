import { useEffect, useMemo, useState } from 'react'
import { fetchLojaOnlineCategorias, fetchLojaOnlineProdutos } from '../lib/loja-online-api'
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
    setLoading(true)
    Promise.all([
      fetchLojaOnlineCategorias(store.empresa_id),
      fetchLojaOnlineProdutos(store.empresa_id, ocultarSemEstoque),
    ])
      .then(([categorias, produtos]) => {
        const ids = produtos.map((p) => p.categoria_id)
        setMenuCategorias(buildLojaOnlineMenuCategorias(categorias, ids))
        setTemSemCategoria(produtos.some((p) => !p.categoria_id))
      })
      .finally(() => setLoading(false))
  }, [store?.empresa_id, ocultarSemEstoque])

  const hasItems = menuCategorias.length > 0 || temSemCategoria

  return useMemo(
    () => ({ menuCategorias, temSemCategoria, loading, hasItems }),
    [menuCategorias, temSemCategoria, loading, hasItems]
  )
}
