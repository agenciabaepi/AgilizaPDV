import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useSyncDataRefresh } from '../../hooks/useSyncDataRefresh'
import { Input } from '../../components/ui'
import type { CategoriaTreeNode, Produto, ProdutoSaldo } from '../../vite-env'
import { ChevronRight, ChevronDown, FolderOpen, Package, Tag } from 'lucide-react'

const NIVEL_LABEL: Record<number, string> = {
  1: 'Grupo',
  2: 'Categoria',
  3: 'Subcategoria'
}

function collectCategoryIds(nodes: CategoriaTreeNode[]): Set<string> {
  const ids = new Set<string>()
  const walk = (list: CategoriaTreeNode[]) => {
    for (const n of list) {
      ids.add(n.id)
      walk(n.children)
    }
  }
  walk(nodes)
  return ids
}

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

function subtreeHasMatch(
  node: CategoriaTreeNode,
  byCat: Map<string, Produto[]>,
  q: string
): boolean {
  const direct = (byCat.get(node.id) ?? []).some((p) => productMatchesQuery(p, q))
  if (direct) return true
  return node.children.some((c) => subtreeHasMatch(c, byCat, q))
}

function sortProdutos(list: Produto[]): Produto[] {
  return [...list].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
}

function groupProducts(products: Produto[], validIds: Set<string>) {
  const byCat = new Map<string, Produto[]>()
  const sem: Produto[] = []
  const invalid: Produto[] = []
  for (const p of products) {
    const cid = p.categoria_id?.trim() ?? ''
    if (!cid) {
      sem.push(p)
      continue
    }
    if (!validIds.has(cid)) {
      invalid.push(p)
      continue
    }
    const arr = byCat.get(cid) ?? []
    arr.push(p)
    byCat.set(cid, arr)
  }
  for (const [k, arr] of byCat) {
    byCat.set(k, sortProdutos(arr))
  }
  return { byCat, sem: sortProdutos(sem), invalid: sortProdutos(invalid) }
}

const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function isProdutoEstoqueCritico(p: Produto, saldo: number): boolean {
  if (p.controla_estoque !== 1) return false
  return saldo <= 0 || saldo <= p.estoque_minimo
}

export function MapaProdutosCategoria() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''
  const syncRefreshKey = useSyncDataRefresh()
  const [tree, setTree] = useState<CategoriaTreeNode[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [saldos, setSaldos] = useState<ProdutoSaldo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [semExpanded, setSemExpanded] = useState(true)
  const [invalidExpanded, setInvalidExpanded] = useState(true)

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
      setTree([])
      setProdutos([])
      setSaldos([])
      setLoading(false)
      return
    }
    setLoading(true)
    const catApi = window.electronAPI?.categorias
    const prodApi = window.electronAPI?.produtos
    const estApi = window.electronAPI?.estoque
    const pTree = catApi?.listTree ? catApi.listTree(empresaId) : Promise.resolve([] as CategoriaTreeNode[])
    const pProd = prodApi?.list ? prodApi.list(empresaId, { apenasAtivos: false }) : Promise.resolve([] as Produto[])
    const pSaldo = estApi?.listSaldos ? estApi.listSaldos(empresaId) : Promise.resolve([] as ProdutoSaldo[])
    Promise.all([pTree, pProd, pSaldo])
      .then(([t, pr, sd]) => {
        setTree(Array.isArray(t) ? t : [])
        setProdutos(Array.isArray(pr) ? pr : [])
        setSaldos(Array.isArray(sd) ? sd : [])
      })
      .catch(() => {
        setTree([])
        setProdutos([])
        setSaldos([])
      })
      .finally(() => setLoading(false))
  }, [empresaId])

  useEffect(() => {
    load()
  }, [load, syncRefreshKey])

  const validIds = useMemo(() => collectCategoryIds(tree), [tree])
  const saldosMap = useMemo(() => new Map(saldos.map((s) => [s.produto_id, s.saldo])), [saldos])
  const { byCat, sem, invalid } = useMemo(() => groupProducts(produtos, validIds), [produtos, validIds])

  const semFiltered = useMemo(() => sem.filter((p) => productMatchesQuery(p, search)), [sem, search])
  const invalidFiltered = useMemo(() => invalid.filter((p) => productMatchesQuery(p, search)), [invalid, search])

  const totalVisiveis = useMemo(() => {
    let n = semFiltered.length + invalidFiltered.length
    const countInTree = (nodes: CategoriaTreeNode[]) => {
      for (const node of nodes) {
        n += (byCat.get(node.id) ?? []).filter((p) => productMatchesQuery(p, search)).length
        countInTree(node.children)
      }
    }
    countInTree(tree)
    return n
  }, [tree, byCat, semFiltered, invalidFiltered, search])

  if (loading) {
    return <p style={{ color: 'var(--color-text-secondary)' }}>Carregando mapa...</p>
  }

  return (
    <>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
        Todos os produtos classificados pela mesma hierarquia do cadastro (grupo → categoria → subcategoria).{' '}
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
        {totalVisiveis} produto(s) {search.trim() ? 'combinando com o filtro' : 'no total'}.
      </p>

      {tree.length === 0 && sem.length === 0 && invalid.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>Não há categorias nem produtos para exibir.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {semFiltered.length > 0 && (
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
                  borderBottom: semExpanded ? '1px solid var(--color-border)' : 'none',
                  background: 'var(--color-bg)',
                  fontWeight: 600
                }}
              >
                <button
                  type="button"
                  aria-expanded={semExpanded}
                  aria-label={semExpanded ? 'Recolher lista' : 'Expandir lista'}
                  title={semExpanded ? 'Recolher' : 'Expandir'}
                  onClick={() => setSemExpanded((v) => !v)}
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
                  {semExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
                <Package size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                Sem categoria
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  {semFiltered.length} produto(s)
                </span>
              </header>
              {semExpanded && <MapaProdutoTable produtos={semFiltered} saldosMap={saldosMap} />}
            </section>
          )}

          {invalidFiltered.length > 0 && (
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
                  borderBottom: invalidExpanded ? '1px solid var(--color-border)' : 'none',
                  background: 'var(--color-bg)',
                  fontWeight: 600
                }}
              >
                <button
                  type="button"
                  aria-expanded={invalidExpanded}
                  aria-label={invalidExpanded ? 'Recolher lista' : 'Expandir lista'}
                  title={invalidExpanded ? 'Recolher' : 'Expandir'}
                  onClick={() => setInvalidExpanded((v) => !v)}
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
                  {invalidExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
                <Package size={18} style={{ color: 'var(--color-warning, #ca8a04)', flexShrink: 0 }} />
                Categoria inválida ou removida
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  {invalidFiltered.length} produto(s) — reclassifique no cadastro de produtos
                </span>
              </header>
              {invalidExpanded && <MapaProdutoTable produtos={invalidFiltered} saldosMap={saldosMap} />}
            </section>
          )}

          {tree.map((node) => (
            <MapaBranch
              key={node.id}
              node={node}
              byCat={byCat}
              search={search}
              depth={0}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpanded}
              saldosMap={saldosMap}
            />
          ))}
        </div>
      )}
    </>
  )
}

export function MapaProdutoTable({ produtos: rows, saldosMap }: { produtos: Produto[]; saldosMap: Map<string, number> }) {
  if (rows.length === 0) return null
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table" style={{ width: '100%', margin: 0 }}>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nome</th>
            <th>SKU</th>
            <th>Estoque</th>
            <th>Un.</th>
            <th>Preço</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const saldo = saldosMap.get(p.id) ?? 0
            const estoqueAlerta = isProdutoEstoqueCritico(p, saldo)
            return (
              <tr key={p.id} className={estoqueAlerta ? 'produtos-row--estoque-alerta' : undefined}>
                <td>{p.codigo ?? '—'}</td>
                <td>{p.nome}</td>
                <td>{p.sku?.trim() || '—'}</td>
                <td className={p.controla_estoque === 1 && estoqueAlerta ? 'produtos-col-saldo-alerta' : undefined}>
                  {p.controla_estoque === 1 ? saldo : '—'}
                </td>
                <td>{p.unidade}</td>
                <td>{money(p.preco)}</td>
                <td>{p.ativo === 1 ? 'Ativo' : 'Inativo'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MapaBranch({
  node,
  byCat,
  search,
  depth,
  expandedIds,
  onToggleExpand,
  saldosMap
}: {
  node: CategoriaTreeNode
  byCat: Map<string, Produto[]>
  search: string
  depth: number
  expandedIds: Set<string>
  onToggleExpand: (id: string) => void
  saldosMap: Map<string, number>
}) {
  const q = search.trim()
  const listRaw = byCat.get(node.id) ?? []
  const list = q ? listRaw.filter((p) => productMatchesQuery(p, q)) : listRaw

  const childBranches = node.children.map((c) => (
    <MapaBranch
      key={c.id}
      node={c}
      byCat={byCat}
      search={search}
      depth={depth + 1}
      expandedIds={expandedIds}
      onToggleExpand={onToggleExpand}
      saldosMap={saldosMap}
    />
  ))
  const visibleChildren = q ? childBranches.filter((_, i) => subtreeHasMatch(node.children[i], byCat, q)) : childBranches

  if (q && list.length === 0 && visibleChildren.length === 0) {
    return null
  }

  const hasExpandable = list.length > 0 || visibleChildren.length > 0
  const isExpanded = !hasExpandable || expandedIds.has(node.id)
  const showBody = isExpanded

  const Icon = node.nivel === 1 ? FolderOpen : Tag
  const iconColor = node.nivel === 1 ? 'var(--color-primary)' : 'var(--color-text-secondary)'

  return (
    <section
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        background: 'var(--color-surface)',
        marginLeft: depth > 0 ? Math.min(depth * 12, 48) : 0
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: showBody && hasExpandable ? '1px solid var(--color-border)' : 'none',
          background: depth % 2 === 0 ? 'var(--color-bg)' : 'var(--color-surface)'
        }}
      >
        {hasExpandable ? (
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Recolher' : 'Expandir'}
            title={isExpanded ? 'Recolher' : 'Expandir'}
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand(node.id)
            }}
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
        <Icon size={node.nivel === 1 ? 20 : 16} style={{ color: iconColor, flexShrink: 0 }} />
        <span style={{ flex: 1, fontWeight: node.nivel === 1 ? 700 : 600, fontSize: node.nivel === 1 ? 'var(--text-base)' : 'var(--text-sm)' }}>
          {node.nome}
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{NIVEL_LABEL[node.nivel]}</span>
        {node.ativo === 0 && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: 4 }}>
            Inativo
          </span>
        )}
        {list.length > 0 && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{list.length} produto(s)</span>
        )}
      </header>
      {showBody && list.length > 0 && <MapaProdutoTable produtos={list} saldosMap={saldosMap} />}
      {showBody && visibleChildren.length > 0 && (
        <div style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>{visibleChildren}</div>
      )}
    </section>
  )
}
