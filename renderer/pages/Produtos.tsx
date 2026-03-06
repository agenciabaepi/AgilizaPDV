import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useSyncDataRefresh } from '../hooks/useSyncDataRefresh'
import type { Produto, ProdutoSaldo, CategoriaTreeNode } from '../vite-env'
import {
  PageTitle,
  Button,
  Input,
  Alert,
  Select,
  Dialog,
} from '../components/ui'
import { Plus, Pencil, Tag, Barcode, Package, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

/** Gera código de barras EAN-13 válido (13 dígitos, último é dígito verificador) */
function generateEAN13(): string {
  let base = ''
  for (let i = 0; i < 12; i++) {
    base += Math.floor(Math.random() * 10).toString()
  }
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i], 10) * (i % 2 === 0 ? 1 : 3)
  }
  const check = (10 - (sum % 10)) % 10
  return base + check
}

const UNIDADES = [
  { value: 'UN', label: 'UN - Unidade' },
  { value: 'CX', label: 'CX - Caixa' },
  { value: 'KG', label: 'KG - Quilograma' },
  { value: 'G', label: 'G - Grama' },
  { value: 'L', label: 'L - Litro' },
  { value: 'ML', label: 'ML - Mililitro' },
  { value: 'MT', label: 'MT - Metro' },
  { value: 'PC', label: 'PC - Peça' },
  { value: 'PCT', label: 'PCT - Pacote' },
]

function calcPrecoFromMarkup(custo: number, markup: number): number {
  if (custo <= 0) return 0
  return Math.round(custo * (1 + markup / 100) * 100) / 100
}

function calcMarkupFromPreco(custo: number, preco: number): number {
  if (custo <= 0) return 0
  return Math.round(((preco / custo) - 1) * 100 * 100) / 100
}

export function Produtos() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''
  const syncRefreshKey = useSyncDataRefresh()
  const [list, setList] = useState<Produto[]>([])
  const [saldos, setSaldos] = useState<ProdutoSaldo[]>([])
  const [fornecedores, setFornecedores] = useState<{ value: string; label: string }[]>([])
  const [categoriaTree, setCategoriaTree] = useState<CategoriaTreeNode[]>([])
  const [categoriaPathMap, setCategoriaPathMap] = useState<Map<string, string>>(new Map())
  const [pathIdsMap, setPathIdsMap] = useState<Map<string, string[]>>(new Map())
  const [nextCodigo, setNextCodigo] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [apenasAtivos, setApenasAtivos] = useState(true)
  const [editing, setEditing] = useState<Produto | null>(null)
  const [form, setForm] = useState({
    nome: '',
    sku: '',
    codigo_barras: '',
    fornecedor_id: '',
    categoria_id: '',
    descricao: '',
    imagem: '',
    custo: 0,
    markup: 0,
    preco: 0,
    unidade: 'UN',
    controla_estoque: 1,
    estoque_minimo: 0,
    ncm: '',
    cfop: '',
    ativo: 1,
    estoque_atual: 0,
  })
  const [saldoInicialEdit, setSaldoInicialEdit] = useState<number | null>(null)
  const [precoManual, setPrecoManual] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formTab, setFormTab] = useState<'info' | 'fiscal' | 'imagens' | 'variacoes' | 'detalhes'>('info')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [imprimindoEtiquetas, setImprimindoEtiquetas] = useState(false)

  const load = useCallback(() => {
    if (!empresaId) return
    window.electronAPI.produtos.list(empresaId, { search: search || undefined, apenasAtivos }).then(setList)
  }, [empresaId, search, apenasAtivos])

  useEffect(() => {
    load()
  }, [load, syncRefreshKey])

  useEffect(() => {
    if (!empresaId) return
    window.electronAPI.estoque.listSaldos(empresaId).then(setSaldos)
  }, [empresaId, list, syncRefreshKey])

  useEffect(() => {
    if (!empresaId) return
    window.electronAPI.fornecedores.list(empresaId).then((arr) => {
      setFornecedores(arr.map((f) => ({ value: f.id, label: f.razao_social })))
    })
  }, [empresaId, syncRefreshKey])

  useEffect(() => {
    if (!empresaId) return
    const api = window.electronAPI?.categorias
    if (!api?.listTree) {
      setCategoriaTree([])
      setCategoriaPathMap(new Map())
      setPathIdsMap(new Map())
      return
    }
    api.listTree(empresaId).then((tree: CategoriaTreeNode[]) => {
      const pathMap = new Map<string, string>()
      const pathIds = new Map<string, string[]>()
      function walk(nodes: CategoriaTreeNode[], prefix: string, ids: string[]) {
        for (const node of nodes) {
          const path = prefix ? `${prefix} → ${node.nome}` : node.nome
          const nodeIds = [...ids, node.id]
          pathMap.set(node.id, path)
          pathIds.set(node.id, nodeIds)
          walk(node.children, path, nodeIds)
        }
      }
      walk(tree ?? [], '', [])
      setCategoriaTree(tree ?? [])
      setCategoriaPathMap(pathMap)
      setPathIdsMap(pathIds)
    }).catch(() => {
      setCategoriaTree([])
      setCategoriaPathMap(new Map())
      setPathIdsMap(new Map())
    })
  }, [empresaId, syncRefreshKey])

  function findNodeInTree(nodes: CategoriaTreeNode[], id: string): CategoriaTreeNode | null {
    for (const node of nodes) {
      if (node.id === id) return node
      const found = findNodeInTree(node.children, id)
      if (found) return found
    }
    return null
  }

  const pathIds = pathIdsMap.get(form.categoria_id) ?? []
  const grupoId = pathIds[0] ?? ''
  const categoriaId = pathIds[1] ?? ''
  const subcategoriaId = pathIds.length >= 3 ? pathIds[2] : ''
  const selectedGrupo = grupoId ? findNodeInTree(categoriaTree, grupoId) : null
  const selectedCategoria = categoriaId ? findNodeInTree(categoriaTree, categoriaId) : null
  const grupoOptions = categoriaTree.map((n) => ({ value: n.id, label: n.nome }))
  const categoriaOptionsFromTree = selectedGrupo ? selectedGrupo.children.map((n) => ({ value: n.id, label: n.nome })) : []
  const subcategoriaOptionsFromTree = selectedCategoria ? selectedCategoria.children.map((n) => ({ value: n.id, label: n.nome })) : []

  const saldosMap = new Map(saldos.map((s) => [s.produto_id, s.saldo]))

  const openNew = () => {
    setEditing(null)
    setPrecoManual(false)
    setForm({
      nome: '',
      sku: '',
      codigo_barras: '',
      fornecedor_id: '',
      categoria_id: '',
      descricao: '',
      imagem: '',
      custo: 0,
      markup: 0,
      preco: 0,
      unidade: 'UN',
      controla_estoque: 1,
      estoque_minimo: 0,
      ncm: '',
      cfop: '',
      ativo: 1,
      estoque_atual: 0,
    })
    setSaldoInicialEdit(null)
    setError('')
    setFormTab('info')
    setShowForm(true)
    if (empresaId) {
      window.electronAPI.produtos.getNextCodigo(empresaId).then(setNextCodigo)
    } else {
      setNextCodigo(null)
    }
  }

  const openEdit = (p: Produto) => {
    setEditing(p)
    setPrecoManual(false)
    setForm({
      nome: p.nome,
      sku: p.sku ?? '',
      codigo_barras: p.codigo_barras ?? '',
      fornecedor_id: p.fornecedor_id ?? '',
      categoria_id: p.categoria_id ?? '',
      descricao: p.descricao ?? '',
      imagem: p.imagem ?? '',
      custo: p.custo,
      markup: p.markup,
      preco: p.preco,
      unidade: p.unidade,
      controla_estoque: p.controla_estoque === 1 ? 1 : 0,
      estoque_minimo: p.estoque_minimo,
      ncm: p.ncm ?? '',
      cfop: p.cfop ?? '',
      ativo: p.ativo,
      estoque_atual: saldosMap.get(p.id) ?? 0,
    })
    setSaldoInicialEdit(saldosMap.get(p.id) ?? 0)
    setNextCodigo(p.codigo ?? null)
    setError('')
    setFormTab('info')
    setShowForm(true)
  }

  const updateForm = (updates: Partial<typeof form>) => {
    setForm((prev) => {
      const next = { ...prev, ...updates }
      if (!precoManual && ('custo' in updates || 'markup' in updates)) {
        next.preco = calcPrecoFromMarkup(next.custo, next.markup)
      }
      if ('preco' in updates) {
        setPrecoManual(true)
        next.markup = calcMarkupFromPreco(next.custo, next.preco)
      }
      return next
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.nome.trim()) {
      setError('Nome é obrigatório.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        nome: form.nome.trim(),
        sku: form.sku.trim() || undefined,
        codigo_barras: form.codigo_barras.trim() || undefined,
        fornecedor_id: form.fornecedor_id.trim() || undefined,
        categoria_id: form.categoria_id.trim() || undefined,
        descricao: form.descricao.trim() || undefined,
        imagem: form.imagem.trim() || undefined,
        custo: form.custo,
        markup: form.markup,
        preco: form.preco,
        unidade: form.unidade.trim() || 'UN',
        controla_estoque: form.controla_estoque === 1 ? 1 : 0,
        estoque_minimo: form.estoque_minimo,
        ncm: form.ncm.trim() || undefined,
        cfop: form.cfop.trim() || undefined,
        ativo: form.ativo,
      }
      const estoqueAtualNum = Number(form.estoque_atual)
      const estoqueAtualValido = Number.isFinite(estoqueAtualNum)

      if (editing) {
        await window.electronAPI.produtos.update(editing.id, payload)
        if (form.controla_estoque === 1 && saldoInicialEdit !== null && estoqueAtualValido && estoqueAtualNum !== saldoInicialEdit) {
          await window.electronAPI.estoque.ajustarSaldoPara(empresaId, editing.id, estoqueAtualNum)
        }
      } else {
        const created = await window.electronAPI.produtos.create({ empresa_id: empresaId, ...payload })
        if (form.controla_estoque === 1 && estoqueAtualValido && estoqueAtualNum !== 0) {
          await window.electronAPI.estoque.ajustarSaldoPara(empresaId, created.id, estoqueAtualNum)
        }
      }
      setEditing(null)
      setShowForm(false)
      load()
      if (empresaId) {
        window.electronAPI.estoque.listSaldos(empresaId).then(setSaldos)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar.'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const cancelForm = () => {
    setEditing(null)
    setShowForm(false)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === list.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(list.map((p) => p.id)))
  }

  const handleImprimirEtiquetas = async (ids: string[]) => {
    if (ids.length === 0) return
    setImprimindoEtiquetas(true)
    setError('')
    try {
      const result = await window.electronAPI.etiquetas.imprimir(ids)
      if (!result.ok) setError(result.error ?? 'Erro ao imprimir')
    } finally {
      setImprimindoEtiquetas(false)
    }
  }

  const getFornecedorLabel = (id: string) => fornecedores.find((f) => f.value === id)?.label ?? '—'

  const totalProdutos = list.length
  const totalAtivos = list.filter((p) => p.ativo === 1).length
  const totalInativos = list.filter((p) => p.ativo === 0).length
  const totalEstoqueBaixo = list.filter((p) => {
    if (p.controla_estoque !== 1) return false
    const saldo = saldosMap.get(p.id) ?? 0
    return saldo <= p.estoque_minimo
  }).length

  return (
    <Layout>
      <PageTitle title="Produtos" subtitle="Cadastro completo com código, fornecedor, categoria, preços e parte fiscal" />

      <div className="produtos-cards-resumo">
        <div className="produtos-card-resumo produtos-card-resumo--total">
          <div className="produtos-card-resumo__icon">
            <Package size={22} strokeWidth={1.8} />
          </div>
          <div className="produtos-card-resumo__content">
            <span className="produtos-card-resumo__label">Produtos</span>
            <span className="produtos-card-resumo__value">{totalProdutos}</span>
          </div>
        </div>
        <div className="produtos-card-resumo produtos-card-resumo--ativos">
          <div className="produtos-card-resumo__icon">
            <CheckCircle size={22} strokeWidth={1.8} />
          </div>
          <div className="produtos-card-resumo__content">
            <span className="produtos-card-resumo__label">Ativos</span>
            <span className="produtos-card-resumo__value">{totalAtivos}</span>
          </div>
        </div>
        <div className="produtos-card-resumo produtos-card-resumo--inativos">
          <div className="produtos-card-resumo__icon">
            <XCircle size={22} strokeWidth={1.8} />
          </div>
          <div className="produtos-card-resumo__content">
            <span className="produtos-card-resumo__label">Inativos</span>
            <span className="produtos-card-resumo__value">{totalInativos}</span>
          </div>
        </div>
        <div className="produtos-card-resumo produtos-card-resumo--estoque-baixo">
          <div className="produtos-card-resumo__icon">
            <AlertTriangle size={22} strokeWidth={1.8} />
          </div>
          <div className="produtos-card-resumo__content">
            <span className="produtos-card-resumo__label">Estoque baixo</span>
            <span className="produtos-card-resumo__value">{totalEstoqueBaixo}</span>
          </div>
        </div>
      </div>

      <div className="mb-section" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 200, flex: '1 1 300px' }}>
          <input
            className="input-el"
            placeholder="Buscar por nome, SKU, código, categoria ou descrição"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ margin: 0 }}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={apenasAtivos} onChange={(e) => setApenasAtivos(e.currentTarget.checked)} />
          Apenas ativos
        </label>
        <Button leftIcon={<Plus size={18} />} onClick={openNew}>
          Novo produto
        </Button>
        {selectedIds.size > 0 && (
          <Button
            variant="secondary"
            leftIcon={<Tag size={18} />}
            onClick={() => handleImprimirEtiquetas(Array.from(selectedIds))}
            disabled={imprimindoEtiquetas}
          >
            {imprimindoEtiquetas ? 'Abrindo impressão...' : `Imprimir etiquetas (${selectedIds.size})`}
          </Button>
        )}
      </div>

      {/* Padrão de cadastro em modal: Dialog size="large" + form com id + footer com Salvar/Cancelar (reutilizar em Clientes, Fornecedores, etc.) */}
      <Dialog
        open={showForm}
        onClose={cancelForm}
        title={editing ? 'Editar produto' : 'Novo produto'}
        size="large"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={cancelForm}>
              Cancelar
            </Button>
            <Button type="submit" form="form-produto" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </>
        }
      >
        <form id="form-produto" onSubmit={submit} className="form-tabs form-produto-modal">
          <div className="form-tabs-list">
            <button type="button" className={`form-tab-btn ${formTab === 'info' ? 'form-tab-btn--active' : ''}`} onClick={() => setFormTab('info')}>
              Informações do produto
            </button>
            <button type="button" className={`form-tab-btn ${formTab === 'fiscal' ? 'form-tab-btn--active' : ''}`} onClick={() => setFormTab('fiscal')}>
              Fiscal
            </button>
            <button type="button" className={`form-tab-btn ${formTab === 'imagens' ? 'form-tab-btn--active' : ''}`} onClick={() => setFormTab('imagens')}>
              Imagens
            </button>
            <button type="button" className={`form-tab-btn ${formTab === 'variacoes' ? 'form-tab-btn--active' : ''}`} onClick={() => setFormTab('variacoes')}>
              Variações
            </button>
            <button type="button" className={`form-tab-btn ${formTab === 'detalhes' ? 'form-tab-btn--active' : ''}`} onClick={() => setFormTab('detalhes')}>
              Detalhes
            </button>
          </div>

          {/* Aba: Informações do produto */}
          <div className={`form-tab-panel ${formTab === 'info' ? 'form-tab-panel--active' : ''}`}>
            <div className="form-section">
              <h3 className="form-section-title">Identificação</h3>
              <div className="form-grid">
                <Input
                  label="Código"
                  value={editing ? (editing.codigo ?? '—') : (nextCodigo ?? '...')}
                  disabled
                  hint={!editing ? 'Sequencial automático' : undefined}
                />
                <Input label="Nome" required value={form.nome} onChange={(e) => updateForm({ nome: e.currentTarget.value })} />
                <Input label="SKU" value={form.sku} onChange={(e) => updateForm({ sku: e.currentTarget.value })} />
                <div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <Input
                        label="Código de barras"
                        value={form.codigo_barras}
                        onChange={(e) => updateForm({ codigo_barras: e.currentTarget.value })}
                        placeholder="EAN-13 ou outro"
                      />
                    </div>
                    <Button type="button" variant="secondary" size="sm" leftIcon={<Barcode size={16} />} onClick={() => updateForm({ codigo_barras: generateEAN13() })}>
                      Gerar EAN-13
                    </Button>
                  </div>
                  <p className="input-hint" style={{ marginTop: 4 }}>Clique em &quot;Gerar EAN-13&quot; para criar um código válido automaticamente.</p>
                </div>
              </div>
            </div>
            <div className="form-section">
              <h3 className="form-section-title">Fornecedor</h3>
              <div className="form-grid">
                <Select
                  label="Fornecedor"
                  options={[{ value: '', label: '— Nenhum —' }, ...fornecedores]}
                  value={form.fornecedor_id}
                  onChange={(e) => updateForm({ fornecedor_id: e.currentTarget.value })}
                />
              </div>
            </div>
            <div className="form-section">
              <h3 className="form-section-title">Categoria</h3>
              <p className="input-hint" style={{ marginBottom: 12 }}>Selecione o grupo, depois a categoria e a subcategoria (quando houver).</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
                <Select
                  label="Grupo"
                  options={[{ value: '', label: '— Nenhum —' }, ...grupoOptions]}
                  value={grupoId}
                  onChange={(e) => updateForm({ categoria_id: e.currentTarget.value || '' })}
                />
                <Select
                  label="Categoria"
                  options={[{ value: '', label: '— Nenhuma —' }, ...categoriaOptionsFromTree]}
                  value={categoriaId}
                  onChange={(e) => updateForm({ categoria_id: e.currentTarget.value || '' })}
                  disabled={!grupoId}
                />
                <Select
                  label="Subcategoria"
                  options={[{ value: '', label: '— Nenhuma —' }, ...subcategoriaOptionsFromTree]}
                  value={subcategoriaId}
                  onChange={(e) => updateForm({ categoria_id: e.currentTarget.value || '' })}
                  disabled={!categoriaId}
                />
              </div>
              <p className="input-hint" style={{ marginTop: 8 }}>
                <Link to="/categorias" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>
                  Gerenciar categorias
                </Link>
                {' — criar ou editar grupos, categorias e subcategorias.'}
              </p>
            </div>
            <div className="form-section">
              <h3 className="form-section-title">Preços</h3>
              <div className="form-grid form-grid-3">
                <Input
                  label="Custo (R$)"
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.custo || ''}
                  onChange={(e) => updateForm({ custo: Number(e.currentTarget.value) || 0 })}
                />
                <Input
                  label="Markup (%)"
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.markup || ''}
                  onChange={(e) => updateForm({ markup: Number(e.currentTarget.value) || 0 })}
                />
                <Input
                  label="Preço de venda (R$)"
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.preco || ''}
                  onChange={(e) => updateForm({ preco: Number(e.currentTarget.value) || 0 })}
                  hint="Calculado pelo markup ou edite manualmente"
                />
              </div>
            </div>
            <div className="form-section">
              <h3 className="form-section-title">Controle de estoque</h3>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 'var(--text-sm)', cursor: 'pointer', marginBottom: 16, padding: 12, background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <input
                  type="checkbox"
                  checked={form.controla_estoque === 1}
                  onChange={(e) => updateForm({ controla_estoque: e.target.checked ? 1 : 0 })}
                  style={{ marginTop: 2 }}
                />
                <div>
                  <strong>Controla estoque</strong>
                  <p className="input-hint" style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)' }}>
                    Quando marcado, as vendas no PDV descontam o saldo e é possível registrar entradas/saídas em Movimentação → Estoque. Desmarque apenas para itens sem controle (ex.: serviços).
                  </p>
                </div>
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'flex-end' }}>
                <Input
                  label="Estoque atual"
                  type="number"
                  step="0.01"
                  value={form.estoque_atual ?? ''}
                  onChange={(e) => updateForm({ estoque_atual: Number(e.currentTarget.value) || 0 })}
                  disabled={form.controla_estoque !== 1}
                  hint={form.controla_estoque !== 1 ? 'Ative "Controla estoque" para informar' : 'Ao salvar, o saldo será ajustado para este valor'}
                />
                <Select
                  label="Unidade"
                  options={UNIDADES}
                  value={form.unidade}
                  onChange={(e) => updateForm({ unidade: e.currentTarget.value })}
                />
                <Input
                  label="Estoque mínimo"
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.estoque_minimo || ''}
                  onChange={(e) => updateForm({ estoque_minimo: Number(e.currentTarget.value) || 0 })}
                  disabled={form.controla_estoque !== 1}
                  hint={form.controla_estoque !== 1 ? 'Ative "Controla estoque" para usar' : undefined}
                />
              </div>
            </div>
            <div className="form-section">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.ativo === 1} onChange={(e) => updateForm({ ativo: e.currentTarget.checked ? 1 : 0 })} />
                Produto ativo (visível no PDV e listagens)
              </label>
            </div>
          </div>

          {/* Aba: Fiscal */}
          <div className={`form-tab-panel ${formTab === 'fiscal' ? 'form-tab-panel--active' : ''}`}>
            <div className="form-section">
              <h3 className="form-section-title">Dados fiscais</h3>
              <div className="form-grid form-grid-2">
                <Input label="NCM" value={form.ncm} onChange={(e) => updateForm({ ncm: e.currentTarget.value })} placeholder="Código NCM" />
                <Input label="CFOP" value={form.cfop} onChange={(e) => updateForm({ cfop: e.currentTarget.value })} placeholder="Código CFOP" />
              </div>
            </div>
          </div>

          {/* Aba: Imagens */}
          <div className={`form-tab-panel ${formTab === 'imagens' ? 'form-tab-panel--active' : ''}`}>
            <div className="form-section">
              <h3 className="form-section-title">Imagem do produto</h3>
              <Input
                label="URL ou caminho da imagem"
                value={form.imagem}
                onChange={(e) => updateForm({ imagem: e.currentTarget.value })}
                placeholder="https://... ou caminho local"
              />
              {form.imagem && (
                <div style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', maxWidth: 200, maxHeight: 200, background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                  <img src={form.imagem} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                </div>
              )}
            </div>
          </div>

          {/* Aba: Variações */}
          <div className={`form-tab-panel ${formTab === 'variacoes' ? 'form-tab-panel--active' : ''}`}>
            <div className="form-section">
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
                Variações (tamanho, cor, etc.) podem ser implementadas em uma próxima versão. Por enquanto, cadastre cada variação como um produto separado se necessário.
              </p>
            </div>
          </div>

          {/* Aba: Detalhes */}
          <div className={`form-tab-panel ${formTab === 'detalhes' ? 'form-tab-panel--active' : ''}`}>
            <div className="form-section">
              <h3 className="form-section-title">Descrição</h3>
              <label className="input-label" style={{ display: 'block', marginBottom: 4 }}>Descrição detalhada</label>
              <textarea
                className="input-el"
                value={form.descricao}
                onChange={(e) => updateForm({ descricao: e.currentTarget.value })}
                rows={5}
                placeholder="Descrição detalhada do produto para catálogo e etiquetas"
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
          </div>

          {error && <Alert variant="error" style={{ marginTop: 16 }}>{error}</Alert>}
        </form>
      </Dialog>

      <div className="page-list-area">
        <div className="table-wrap">
          <table className="table">
          <thead>
            <tr>
              <th style={{ width: 44 }}>
                <input type="checkbox" checked={list.length > 0 && selectedIds.size === list.length} onChange={toggleSelectAll} title="Selecionar todos" />
              </th>
              <th>Cód.</th>
              <th>Nome</th>
              <th>Categoria</th>
              <th>Fornecedor</th>
              <th>Custo</th>
              <th>Preço</th>
              <th>Saldo</th>
              <th>Un.</th>
              <th>Ativo</th>
              <th style={{ width: 140 }}></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                <td>{p.codigo ?? '—'}</td>
                <td>{p.nome}</td>
                <td>{p.categoria_id ? (categoriaPathMap.get(p.categoria_id) ?? '—') : '—'}</td>
                <td>{p.fornecedor_id ? getFornecedorLabel(p.fornecedor_id) : '—'}</td>
                <td>R$ {p.custo.toFixed(2)}</td>
                <td>R$ {p.preco.toFixed(2)}</td>
                <td>{p.controla_estoque ? (saldosMap.get(p.id) ?? 0) : '—'}</td>
                <td>{p.unidade}</td>
                <td>{p.ativo ? 'Sim' : 'Não'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="ghost" size="sm" leftIcon={<Pencil size={14} />} onClick={() => openEdit(p)}>Editar</Button>
                    <Button variant="ghost" size="sm" leftIcon={<Tag size={14} />} onClick={() => handleImprimirEtiquetas([p.id])} disabled={imprimindoEtiquetas}>Etiqueta</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {list.length === 0 && (
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-6)', fontSize: 'var(--text-sm)', flex: 1 }}>
            Nenhum produto encontrado.
          </p>
        )}
      </div>
    </Layout>
  )
}
