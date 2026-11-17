import { Link, Navigate } from 'react-router-dom'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineUgcAuth } from '../../hooks/useLojaOnlineUgcAuth'

export function LojaOnlineParceirosPage() {
  const { store, link, titulo } = useLojaOnlineStore()
  const { criador, loading } = useLojaOnlineUgcAuth()

  if (!store) return <p className="loja-catalogo-empty">Carregando…</p>
  if (Number(store.loja_online_ugc_ativo) !== 1) {
    return (
      <div className="loja-store-page">
        <h1>Parceiros</h1>
        <p className="loja-store-auth-sub">O programa de parceiros não está ativo nesta loja no momento.</p>
        <Link to={link('')} className="loja-store-btn-primary">
          Voltar à loja
        </Link>
      </div>
    )
  }

  if (loading) return <p className="loja-catalogo-empty">Carregando…</p>
  if (criador?.status === 'aprovado') return <Navigate to={link('parceiros/painel')} replace />

  return (
    <div className="loja-store-page loja-parceiros-landing">
      <h1>Seja parceiro {titulo}</h1>
      <p className="loja-store-auth-sub">
        Crie conteúdo, compartilhe links dos produtos e receba comissão nas vendas feitas pelo seu link — com
        rastreamento profissional de cliques e pedidos.
      </p>
      <ul className="loja-parceiros-bullets" style={{ lineHeight: 1.7, margin: '20px 0 28px', paddingLeft: 20 }}>
        <li>Gere links exclusivos com o seu código</li>
        <li>Acompanhe cliques, pedidos e comissões</li>
        <li>Solicite saque via PIX quando o saldo for liberado</li>
      </ul>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <Link to={link('parceiros/cadastro')} className="loja-store-btn-primary">
          Quero me cadastrar
        </Link>
        <Link to={link('parceiros/entrar')} className="loja-store-btn-outline">
          Já sou parceiro — entrar
        </Link>
      </div>
      {criador?.status === 'pendente' && (
        <p className="loja-online-field-error" style={{ marginTop: 20 }}>
          Seu cadastro está em análise. Assim que a loja aprovar, o painel será liberado.
        </p>
      )}
    </div>
  )
}
