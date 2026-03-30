import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useSyncDataRefresh } from '../../hooks/useSyncDataRefresh'
import { Input } from '../../components/ui'
import type { Marca, Produto, ProdutoSaldo } from '../../vite-env'
import { MapaProdutoTable } from '../categorias/MapaProdutosCategoria'
import { ChevronRight, ChevronDown, Medal, Package } from 'lucide-react'

function productMatchesQuery(p: Produto, q: string): boolean {
  if (!q.trim()) return true
  const s = q.trim().toLowerCase()
  const codigo = p.codigo != null ? String(p.codigo) : ''
  return (
    p.nome.toLowerCase().includes(s) ||
    (p.sku?.toLowerCase().includes(s) ?? false) ||
    (p.codigo_barras?.toLowerCase().includes(s) ?? false) ||
    codigo.includes(s)
  )
}

function sortProdutos(list: Produto[]): Produto[] {
  return [...list].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
}

export function MapaMarcasProdutos() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''
  const syncRefreshKey = useSyncDataRefresh()
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [saldos, setSaldos] = useState<ProdutoSaldo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [semMarcaExpanded, setSemMarcaExpanded] = useState(true)

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const load = useCallback(() => {
    if (!empresaId) {
      setMarcas([])
      setProdutos([])
      setSaldos([])
      setLoading(false)
      return
    }
    setLoading(true)
    const mApi = window.electronAPI?.marcas
    const pApi = window.electronAPI?.produtos
    const eApi = window.electronAPI?.estoque
    const pM = mApi?.list ? mApi.list(empresaId) : Promise.resolve([] as Marca[])
    const pP = pApi?.list ? pApi.list(empresaId, { apenasAtivos: false }) : Promise.resolve([] as Produto[])
    const pS = eApi?.listSaldos ? eApi.listSaldos(empresaId) : Promise.resolve([] as ProdutoSaldo[])
    Promise.all([pM, pP, pS])
      .then(([m, pr, sd]) => {
        setMarcas(Array.isArray(m) ? m : [])
        setProdutos(Array.isArray(pr) ? pr : [])
        setSaldos(Array.isArray(sd) ? sd : [])
      })
      .catch(() => {
        setMarcas([])
        setProdutos([])
        setSaldos([])
      })
      .finally(() => setLoading(false))
  }, [empresaId])

  useEffect(() => {
    load()
  }, [load, syncRefreshKey])

  const saldosMap = useMemo(() => new Map(saldos.map((s) => [s.produto_id, s.saldo])), [saldos])

  const { byMarca, semMarca } = useMemo(() => {
    const by = new Map<string, Produto[]>()
    const sem: Produto[] = []
    const marcaIds = new Set(marcas.map((m) => m.id))
    for (const p of produtos) {
      const mid = p.marca_id?.trim() ?? ''
      if (!mid) {
        sem.push(p)
        continue
      }
      if (!marcaIds.has(mid)) {
        sem.push(p)
        continue
      }
      const arr = by.get(mid) ?? []
      arr.push(p)
      by.set(mid, arr)
    }
    for (const [k, arr] of by) {
      by.set(k, sortProdutos(arr))
    }
    return { byMarca: by, semMarca: sortProdutos(sem) }
  }, [produtos, marcas])

  const marcasOrdenadas = useMemo(
    () => [...marcas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })),
    [marcas]
  )

  const q = search.trim()
  const semMarcaFiltered = useMemo(() => semMarca.filter((p) => productMatchesQuery(p, search)), [semMarca, search])

  const totalVisiveis = useMemo(() => {
    let n = semMarcaFiltered.length
    for (const m of marcasOrdenadas) {
      const rows = (byMarca.get(m.id) ?? []).filter((p) => productMatchesQuery(p, search))
      n += rows.length
    }
    return n
  }, [marcasOrdenadas, byMarca, semMarcaFiltered, search])

  if (loading) {
    return <p style={{ color: 'var(--color-text-secondary)' }}>Carregando mapa...</p>
  }

  return (
    <>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
        Produtos agrupados pela marca cadastrada.{' '}
        <Link to="/produtos" style={{ color: 'var(--color-primary)', fontWeight: 500, textDecoration: 'none' }}>
          Ir para produtos
        </Link>
      </p>

      <div style={{ marginBottom: 'var(--space-4)', maxWidth: 420 }}>
        <Input
          label="Filtrar produtos"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          placeholder="Nome, SKU, código ou código de barras"
        />
      </div>

      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
        {totalVisiveis} produto(s) {q ? 'combinando com o filtro' : 'no total'}.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {semMarcaFiltered.length > 0 && (
          <section
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              background: 'var(--color-surface)'
            }}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 'var(--space-3) var(--space-4)',
                borderBottom: semMarcaExpanded ? '1px solid var(--color-border)' : 'none',
                background: 'var(--color-bg)',
                fontWeight: 600
              }}
            >
              <button
                type="button"
                aria-expanded={semMarcaExpanded}
                title={semMarcaExpanded ? 'Recolher' : 'Expandir'}
                onClick={() => setSemMarcaExpanded((v) => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  flexShrink: 0
                }}
              >
                {semMarcaExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
              <Package size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              Sem marca
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                {semMarcaFiltered.length} produto(s)
              </span>
            </header>
            {semMarcaExpanded && <MapaProdutoTable produtos={semMarcaFiltered} saldosMap={saldosMap} />}
          </section>
        )}

        {marcasOrdenadas.map((m) => {
          const listRaw = byMarca.get(m.id) ?? []
          const list = q ? listRaw.filter((p) => productMatchesQuery(p, search)) : listRaw
          if (!q && listRaw.length === 0) return null
          if (q && list.length === 0) return null
          const hasExpandable = list.length > 0
          const isExpanded = !hasExpandable || expandedIds.has(m.id)
          return (
            <section
              key={m.id}
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                background: 'var(--color-surface)'
              }}
            >
              <header
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: 'var(--space-3) var(--space-4)',
                  borderBottom: isExpanded && hasExpandable ? '1px solid var(--color-border)' : 'none',
                  background: 'var(--color-bg)'
                }}
              >
                {hasExpandable ? (
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    title={isExpanded ? 'Recolher' : 'Expandir'}
                    onClick={() => toggleExpanded(m.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      borderRadius: 4,
                      cursor: 'pointer',
                      color: 'var(--color-text-muted)',
                      flexShrink: 0
                    }}
                  >
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                ) : (
                  <span style={{ width: 28, flexShrink: 0 }} aria-hidden />
                )}
                <Medal size={20} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontWeight: 700 }}>{m.nome}</span>
                {m.ativo === 0 && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Inativa</span>
                )}
                {list.length > 0 && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{list.length} produto(s)</span>
                )}
              </header>
              {isExpanded && hasExpandable && <MapaProdutoTable produtos={list} saldosMap={saldosMap} />}
            </section>
          )
        })}
      </div>
    </>
  )
}
