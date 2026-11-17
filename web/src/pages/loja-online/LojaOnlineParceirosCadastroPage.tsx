import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineUgcAuth } from '../../hooks/useLojaOnlineUgcAuth'

export function LojaOnlineParceirosCadastroPage() {
  const { store, link } = useLojaOnlineStore()
  const { register, criador, loading: authLoading } = useLojaOnlineUgcAuth()
  const navigate = useNavigate()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [telefone, setTelefone] = useState('')
  const [instagram, setInstagram] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [youtube, setYoutube] = useState('')
  const [pix, setPix] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!store) return <p className="loja-catalogo-empty">Carregando…</p>
  if (Number(store.loja_online_ugc_ativo) !== 1) return <Navigate to={link('parceiros')} replace />
  if (authLoading) return <p className="loja-catalogo-empty">Carregando…</p>
  if (criador?.status === 'aprovado') return <Navigate to={link('parceiros/painel')} replace />
  if (criador?.status === 'pendente') {
    return (
      <div className="loja-store-page loja-store-auth">
        <h1>Cadastro enviado</h1>
        <p className="loja-store-auth-sub">
          Recebemos seus dados. A loja precisa aprovar o cadastro antes de você gerar links e ver comissões.
        </p>
        <p className="input-hint">Seu código provisório: <strong>{criador.codigo}</strong></p>
        <Link to={link('parceiros')} className="loja-store-btn-primary">
          Voltar
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await register({
        nome,
        email,
        senha,
        telefone: telefone || undefined,
        instagram: instagram || undefined,
        tiktok: tiktok || undefined,
        youtube: youtube || undefined,
        pix_chave: pix || undefined,
      })
      navigate(link('parceiros/cadastro'), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="loja-store-page loja-store-auth">
      <h1>Cadastro de parceiro</h1>
      <p className="loja-store-auth-sub">Preencha seus dados. A loja aprova o cadastro antes da liberação.</p>
      <form onSubmit={handleSubmit} className="loja-store-auth-form">
        <label className="input-wrap">
          <span className="input-label">Nome</span>
          <input className="input-el" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </label>
        <label className="input-wrap">
          <span className="input-label">E-mail</span>
          <input className="input-el" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="input-wrap">
          <span className="input-label">Senha</span>
          <input className="input-el" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} />
        </label>
        <label className="input-wrap">
          <span className="input-label">WhatsApp</span>
          <input className="input-el" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
        </label>
        <label className="input-wrap">
          <span className="input-label">Instagram</span>
          <input className="input-el" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@seuuser" />
        </label>
        <label className="input-wrap">
          <span className="input-label">TikTok</span>
          <input className="input-el" value={tiktok} onChange={(e) => setTiktok(e.target.value)} />
        </label>
        <label className="input-wrap">
          <span className="input-label">YouTube</span>
          <input className="input-el" value={youtube} onChange={(e) => setYoutube(e.target.value)} />
        </label>
        <label className="input-wrap">
          <span className="input-label">Chave PIX</span>
          <input className="input-el" value={pix} onChange={(e) => setPix(e.target.value)} placeholder="CPF, e-mail ou telefone" />
        </label>
        {error && <p className="loja-online-field-error">{error}</p>}
        <button type="submit" className="loja-store-btn-primary loja-store-btn-block" disabled={loading}>
          {loading ? 'Enviando…' : 'Enviar cadastro'}
        </button>
      </form>
      <p className="loja-store-auth-footer">
        Já tem conta? <Link to={link('parceiros/entrar')}>Entrar</Link>
      </p>
    </div>
  )
}
