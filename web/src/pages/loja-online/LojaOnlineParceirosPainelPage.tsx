import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineUgcAuth } from '../../hooks/useLojaOnlineUgcAuth'
import { formatCurrency } from '../../lib/loja-online'
import {
  buildLojaOnlineUgcProductUrl,
  ensureLojaOnlineUgcLink,
  fetchLojaOnlineUgcComissoes,
  fetchLojaOnlineUgcConfig,
  fetchLojaOnlineUgcLinksCriador,
  fetchLojaOnlineUgcProdutosElegiveis,
  fetchLojaOnlineUgcSaldo,
  fetchLojaOnlineUgcSaques,
  solicitarLojaOnlineUgcSaque,
  updateLojaOnlineUgcCriadorPerfil,
} from '../../lib/loja-online-ugc-api'
import type {
  LojaOnlineProduto,
  LojaOnlineUgcComissao,
  LojaOnlineUgcLink,
  LojaOnlineUgcSaldo,
  LojaOnlineUgcSaque,
} from '../../lib/loja-online-types'

function useParceiroGate() {
  const { store, link, mode, slug } = useLojaOnlineStore()
  const { criador, loading, logout, updateLocal } = useLojaOnlineUgcAuth()
  return { store, link, mode, slug, criador, loading, logout, updateLocal }
}

export function LojaOnlineParceirosPainelLayout() {
  const { store, link, criador, loading, logout } = useParceiroGate()
  const location = useLocation()

  if (!store) return <p className="loja-catalogo-empty">Carregando…</p>
  if (Number(store.loja_online_ugc_ativo) !== 1) return <Navigate to={link('parceiros')} replace />
  if (loading) return <p className="loja-catalogo-empty">Carregando…</p>
  if (!criador) return <Navigate to={link('parceiros/entrar')} replace />
  if (criador.status === 'pendente') {
    return (
      <div className="loja-store-page">
        <h1>Aguardando aprovação</h1>
        <p className="loja-store-auth-sub">Seu cadastro ainda está em análise pela loja.</p>
        <button type="button" className="loja-store-btn-outline" onClick={logout}>
          Sair
        </button>
      </div>
    )
  }
  if (criador.status !== 'aprovado') {
    return (
      <div className="loja-store-page">
        <h1>Acesso indisponível</h1>
        <p className="loja-store-auth-sub">Status da conta: {criador.status}.</p>
        <button type="button" className="loja-store-btn-outline" onClick={logout}>
          Sair
        </button>
      </div>
    )
  }

  const nav = [
    { to: link('parceiros/painel'), label: 'Resumo', end: true },
    { to: link('parceiros/painel/links'), label: 'Links' },
    { to: link('parceiros/painel/comissoes'), label: 'Comissões' },
    { to: link('parceiros/painel/saques'), label: 'Saques' },
  ]

  return (
    <div className="loja-store-page loja-parceiros-painel">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Olá, {criador.nome.split(' ')[0]}</h1>
          <p className="loja-store-auth-sub" style={{ margin: 0 }}>
            Seu código: <strong>{criador.codigo}</strong>
          </p>
        </div>
        <button type="button" className="loja-store-btn-outline" onClick={logout}>
          Sair
        </button>
      </div>
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '20px 0' }}>
        {nav.map((item) => {
          const active = item.end
            ? location.pathname.replace(/\/$/, '') === item.to.replace(/\/$/, '')
            : location.pathname.includes(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              className={active ? 'loja-store-btn-primary' : 'loja-store-btn-outline'}
              style={{ fontSize: 14, padding: '8px 14px' }}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
      <Outlet />
    </div>
  )
}

export function LojaOnlineParceirosPainelHome() {
  const { store, criador } = useParceiroGate()
  const [saldo, setSaldo] = useState<LojaOnlineUgcSaldo | null>(null)
  const [links, setLinks] = useState<LojaOnlineUgcLink[]>([])

  useEffect(() => {
    if (!store?.empresa_id || !criador) return
    void Promise.all([
      fetchLojaOnlineUgcSaldo(store.empresa_id, criador.id),
      fetchLojaOnlineUgcLinksCriador(store.empresa_id, criador.id),
    ]).then(([s, l]) => {
      setSaldo(s)
      setLinks(l)
    })
  }, [store?.empresa_id, criador])

  const cliques = useMemo(() => links.reduce((s, l) => s + (l.cliques || 0), 0), [links])
  const pedidos = useMemo(() => links.reduce((s, l) => s + (l.pedidos || 0), 0), [links])

  if (!saldo) return <p className="loja-catalogo-empty">Carregando resumo…</p>

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <Kpi label="Disponível p/ saque" value={formatCurrency(saldo.disponivel)} />
        <Kpi label="Pendente" value={formatCurrency(saldo.pendente)} />
        <Kpi label="Aprovado" value={formatCurrency(saldo.aprovado)} />
        <Kpi label="Já pago" value={formatCurrency(saldo.pago)} />
        <Kpi label="Cliques" value={String(cliques)} />
        <Kpi label="Pedidos" value={String(pedidos)} />
        <Kpi label="Links" value={String(links.length)} />
      </div>
      <p className="input-hint" style={{ marginTop: 16 }}>
        Comissões ficam pendentes até o pedido ser entregue. Depois entram no saldo aprovado para saque.
      </p>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid var(--color-border, #ddd)', borderRadius: 12, padding: 14 }}>
      <div className="input-hint" style={{ marginBottom: 4 }}>
        {label}
      </div>
      <strong style={{ fontSize: 18 }}>{value}</strong>
    </div>
  )
}

export function LojaOnlineParceirosPainelLinks() {
  const { store, criador, mode, slug, link } = useParceiroGate()
  const [produtos, setProdutos] = useState<
    Pick<LojaOnlineProduto, 'id' | 'nome' | 'imagem' | 'preco' | 'comissao_ugc_percentual'>[]
  >([])
  const [links, setLinks] = useState<LojaOnlineUgcLink[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!store?.empresa_id || !criador) return
    setLoading(true)
    try {
      const [prods, ls] = await Promise.all([
        fetchLojaOnlineUgcProdutosElegiveis(store.empresa_id),
        fetchLojaOnlineUgcLinksCriador(store.empresa_id, criador.id),
      ])
      setProdutos(prods)
      setLinks(ls)
    } finally {
      setLoading(false)
    }
  }, [store?.empresa_id, criador])

  useEffect(() => {
    void reload()
  }, [reload])

  const linkByProduto = useMemo(() => new Map(links.map((l) => [l.produto_id, l])), [links])

  const copiar = async (e: React.MouseEvent, produtoId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!store?.empresa_id || !criador || !slug) return
    try {
      const ensured = await ensureLojaOnlineUgcLink({
        empresaId: store.empresa_id,
        criadorId: criador.id,
        produtoId,
      })
      const url = buildLojaOnlineUgcProductUrl({
        mode: mode === 'path' ? 'path' : 'subdomain',
        slug,
        produtoId,
        codigo: criador.codigo,
      })
      await navigator.clipboard.writeText(url)
      setLinks((prev) => {
        const exists = prev.some((l) => l.id === ensured.id)
        if (exists) return prev.map((l) => (l.id === ensured.id ? { ...l, ...ensured } : l))
        return [ensured, ...prev]
      })
      setCopied(produtoId)
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      /* ignore */
    }
  }

  if (loading) return <p className="loja-catalogo-empty">Carregando produtos…</p>

  if (produtos.length === 0) {
    return (
      <p className="loja-store-auth-sub">
        Nenhum produto com comissão UGC cadastrada ainda. Peça à loja para definir o % nos produtos.
      </p>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {produtos.map((p) => {
        const l = linkByProduto.get(p.id)
        const produtoHref = link(`produto/${p.id}`)
        const pct = Number(p.comissao_ugc_percentual) || 0
        const comissaoReais = Math.round(Number(p.preco) * pct) / 100
        return (
          <div
            key={p.id}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              border: '1px solid var(--color-border, #ddd)',
              borderRadius: 12,
              padding: 12,
              flexWrap: 'wrap',
            }}
          >
            <Link
              to={produtoHref}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                flex: '1 1 200px',
                minWidth: 0,
                textDecoration: 'none',
                color: 'inherit',
              }}
              title="Ver detalhes do produto"
            >
              {p.imagem ? (
                <img
                  src={p.imagem}
                  alt=""
                  width={56}
                  height={56}
                  style={{ objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 8, background: '#eee', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: 'block' }}>{p.nome}</strong>
                <div className="input-hint">
                  {formatCurrency(p.preco)} · Você ganha{' '}
                  <strong style={{ color: 'inherit' }}>{formatCurrency(comissaoReais)}</strong> ({pct}%)
                  {l ? ` · ${l.cliques} cliques · ${l.pedidos} pedidos` : ''}
                </div>
                <span className="input-hint" style={{ color: 'var(--color-primary, #1d4ed8)' }}>
                  Ver detalhes do produto →
                </span>
              </div>
            </Link>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Link to={produtoHref} className="loja-store-btn-outline loja-store-btn-sm">
                Ver produto
              </Link>
              <button
                type="button"
                className="loja-store-btn-primary loja-store-btn-sm"
                onClick={(e) => void copiar(e, p.id)}
              >
                {copied === p.id ? 'Copiado!' : 'Copiar link'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function LojaOnlineParceirosPainelComissoes() {
  const { store, criador } = useParceiroGate()
  const [rows, setRows] = useState<LojaOnlineUgcComissao[]>([])

  useEffect(() => {
    if (!store?.empresa_id || !criador) return
    void fetchLojaOnlineUgcComissoes({ empresaId: store.empresa_id, criadorId: criador.id }).then(setRows)
  }, [store?.empresa_id, criador])

  if (rows.length === 0) return <p className="loja-store-auth-sub">Nenhuma comissão ainda.</p>

  return (
    <div className="loja-admin-table-wrap" style={{ overflowX: 'auto' }}>
      <table className="loja-admin-table" style={{ width: '100%', fontSize: 14 }}>
        <thead>
          <tr>
            <th>Data</th>
            <th>Produto</th>
            <th>Base</th>
            <th>%</th>
            <th>Valor</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
              <td>{c.produto_nome || '—'}</td>
              <td>{formatCurrency(c.base_calculo)}</td>
              <td>{c.percentual}%</td>
              <td>{formatCurrency(c.valor)}</td>
              <td>{c.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function LojaOnlineParceirosPainelSaques() {
  const { store, criador, updateLocal } = useParceiroGate()
  const [saldo, setSaldo] = useState<LojaOnlineUgcSaldo | null>(null)
  const [saques, setSaques] = useState<LojaOnlineUgcSaque[]>([])
  const [minimo, setMinimo] = useState(50)
  const [valor, setValor] = useState('')
  const [pix, setPix] = useState(criador?.pix_chave ?? '')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    if (!store?.empresa_id || !criador) return
    const [s, list, cfg] = await Promise.all([
      fetchLojaOnlineUgcSaldo(store.empresa_id, criador.id),
      fetchLojaOnlineUgcSaques({ empresaId: store.empresa_id, criadorId: criador.id }),
      fetchLojaOnlineUgcConfig(store.empresa_id),
    ])
    setSaldo(s)
    setSaques(list)
    setMinimo(cfg.saqueMinimo)
  }, [store?.empresa_id, criador])

  useEffect(() => {
    void reload()
  }, [reload])

  const solicitar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!store?.empresa_id || !criador) return
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      if (pix.trim() && pix.trim() !== (criador.pix_chave || '')) {
        const updated = await updateLojaOnlineUgcCriadorPerfil(criador.id, store.empresa_id, {
          pix_chave: pix.trim(),
        })
        updateLocal(updated)
      }
      await solicitarLojaOnlineUgcSaque({
        empresaId: store.empresa_id,
        criadorId: criador.id,
        valor: Number(valor.replace(',', '.')) || 0,
        pix_chave: pix.trim(),
      })
      setValor('')
      setOk('Saque solicitado. Aguarde a loja processar o pagamento.')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao solicitar saque.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <p className="loja-store-auth-sub">
        Disponível: <strong>{formatCurrency(saldo?.disponivel ?? 0)}</strong> · mínimo{' '}
        {formatCurrency(minimo)}
      </p>
      <form onSubmit={solicitar} className="loja-store-auth-form" style={{ maxWidth: 420, marginBottom: 24 }}>
        <label className="input-wrap">
          <span className="input-label">Valor (R$)</span>
          <input className="input-el" value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" required />
        </label>
        <label className="input-wrap">
          <span className="input-label">Chave PIX</span>
          <input className="input-el" value={pix} onChange={(e) => setPix(e.target.value)} required />
        </label>
        {error && <p className="loja-online-field-error">{error}</p>}
        {ok && <p className="input-hint">{ok}</p>}
        <button type="submit" className="loja-store-btn-primary" disabled={saving}>
          {saving ? 'Enviando…' : 'Solicitar saque'}
        </button>
      </form>

      <h3>Histórico</h3>
      {saques.length === 0 ? (
        <p className="input-hint">Nenhum saque ainda.</p>
      ) : (
        <div className="loja-admin-table-wrap" style={{ overflowX: 'auto' }}>
          <table className="loja-admin-table" style={{ width: '100%', fontSize: 14 }}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Valor</th>
                <th>PIX</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {saques.map((s) => (
                <tr key={s.id}>
                  <td>{new Date(s.created_at).toLocaleString('pt-BR')}</td>
                  <td>{formatCurrency(s.valor)}</td>
                  <td>{s.pix_chave}</td>
                  <td>{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Mantém tipagem usada pelo router; navigate disponível se precisar no futuro */
export function LojaOnlineParceirosPainelRedirect() {
  const navigate = useNavigate()
  const { link } = useLojaOnlineStore()
  useEffect(() => {
    navigate(link('parceiros/painel'), { replace: true })
  }, [navigate, link])
  return null
}
