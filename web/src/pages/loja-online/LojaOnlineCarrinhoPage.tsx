import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineCart } from '../../hooks/useLojaOnlineCart'

/** Rota /carrinho abre o drawer lateral e volta para a vitrine. */
export function LojaOnlineCarrinhoPage() {
  const { link } = useLojaOnlineStore()
  const { openCart } = useLojaOnlineCart()
  const navigate = useNavigate()

  useEffect(() => {
    openCart()
    navigate(link(), { replace: true })
  }, [openCart, navigate, link])

  return null
}
