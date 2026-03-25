import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useSyncDataRefresh } from '../hooks/useSyncDataRefresh'
import type { Produto, ProdutoSaldo, CategoriaTreeNode, LabelTemplate, PrinterInfo, PrinterStatus } from '../vite-env'
import {
  PageTitle,
  Button,
  Input,
  Alert,
  Select,
  Dialog,
  useOperationToast,
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

/** Normaliza NCM: só dígitos, máx. 8 (se digitar com ponto, corrige sozinho). */
function normalizeNcm(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8)
}

/** Formata NCM para exibição: 0000.00.00 quando tiver 8 dígitos. */
function formatNcmDisplay(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 4) return d
  if (d.length <= 6) return `${d.slice(0, 4)}.${d.slice(4)}`
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`
}

const NCM_API = 'https://brasilapi.com.br/api/ncm/v1'
type NcmSuggestion = { codigo: string; descricao: string }

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

/** Saldo zero, negativo ou até o mínimo (inclusive) — só quando controla estoque. */
function isProdutoEstoqueCritico(p: Produto, saldo: number): boolean {
  if (p.controla_estoque !== 1) return false
  return saldo <= 0 || saldo <= p.estoque_minimo
}

export function Produtos() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''
  const syncRefreshKey = useSyncDataRefresh()
  const op = useOperationToast()
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
    permitir_resgate_cashback_no_produto: 1,
    cashback_observacao: '',
  })
  const [saldoInicialEdit, setSaldoInicialEdit] = useState<number | null>(null)
  const [precoManual, setPrecoManual] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formTab, setFormTab] = useState<'info' | 'fiscal' | 'imagens' | 'variacoes' | 'detalhes' | 'cashback'>('info')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [imprimindoEtiquetas, setImprimindoEtiquetas] = useState(false)
  const [showEtiquetasDialog, setShowEtiquetasDialog] = useState(false)
  const [labelTemplates, setLabelTemplates] = useState<LabelTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState('')
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus | null>(null)
  const [labelQuantities, setLabelQuantities] = useState<Record<string, number>>({})
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewInfo, setPreviewInfo] = useState<{ totalLabels: number; language: string } | null>(null)
  const [ncmSuggestions, setNcmSuggestions] = useState<NcmSuggestion[]>([])
  const [ncmLoading, setNcmLoading] = useState(false)
  const [ncmDropdownOpen, setNcmDropdownOpen] = useState(false)

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

  // Busca NCM na BrasilAPI (debounce) para sugerir ao digitar
  useEffect(() => {
    const digits = normalizeNcm(form.ncm)
    if (digits.length < 2) {
      setNcmSuggestions([])
      return
    }
    const t = setTimeout(() => {
      setNcmLoading(true)
      const searchParam = encodeURIComponent(digits)
      fetch(`${NCM_API}?search=${searchParam}`)
        .then((r) => r.json())
        .then((data: NcmSuggestion[]) => {
          setNcmSuggestions(Array.isArray(data) ? data.slice(0, 15) : [])
          setNcmDropdownOpen(true)
        })
        .catch(() => setNcmSuggestions([]))
        .finally(() => setNcmLoading(false))
    }, 400)
    return () => clearTimeout(t)
  }, [form.ncm])

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
      permitir_resgate_cashback_no_produto: 1,
      cashback_observacao: '',
    })
    setSaldoInicialEdit(null)
    setError('')
    setFormTab('info')
    setNcmDropdownOpen(false)
    setNcmSuggestions([])
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
      permitir_resgate_cashback_no_produto: p.permitir_resgate_cashback_no_produto ?? 1,
      cashback_observacao: p.cashback_observacao ?? '',
    })
    setSaldoInicialEdit(saldosMap.get(p.id) ?? 0)
    setNextCodigo(p.codigo ?? null)
    setError('')
    setFormTab('info')
    setNcmDropdownOpen(false)
    setNcmSuggestions([])
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
        cashback_ativo: 1,
        cashback_percentual: null,
        permitir_resgate_cashback_no_produto: form.permitir_resgate_cashback_no_produto === 1 ? 1 : 0,
        cashback_observacao: form.cashback_observacao.trim() || null,
      }
      const estoqueAtualNum = Number(form.estoque_atual)
      const estoqueAtualValido = Number.isFinite(estoqueAtualNum)

      if (editing) {
        await window.electronAPI.produtos.update(editing.id, payload)
        if (form.controla_estoque === 1 && saldoInicialEdit !== null && estoqueAtualValido && estoqueAtualNum !== saldoInicialEdit) {
          await window.electronAPI.estoque.ajustarSaldoPara(empresaId, editing.id, estoqueAtualNum)
        }
        op.saved('Produto atualizado com sucesso.')
      } else {
        const created = await window.electronAPI.produtos.create({ empresa_id: empresaId, ...payload })
        if (form.controla_estoque === 1 && estoqueAtualValido && estoqueAtualNum !== 0) {
          await window.electronAPI.estoque.ajustarSaldoPara(empresaId, created.id, estoqueAtualNum)
        }
        op.created('Produto cadastrado com sucesso.')
      }
      setEditing(null)
      setShowForm(false)
      load()
      if (empresaId) {
        window.electronAPI.estoque.listSaldos(empresaId).then(setSaldos)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar.'
      op.failed(err, 'Erro ao salvar produto.')
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

  const openEtiquetasDialog = async (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids))
    if (uniqueIds.length === 0) return
    const initialQuantities: Record<string, number> = {}
    for (const id of uniqueIds) initialQuantities[id] = 1
    setLabelQuantities(initialQuantities)
    setShowEtiquetasDialog(true)
    setError('')
    try {
      const [templates, printersList] = await Promise.all([
        window.electronAPI.etiquetas.listTemplates(),
        window.electronAPI.etiquetas.listPrinters()
      ])
      setLabelTemplates(templates)
      setPrinters(printersList)
      const templateId = templates[0]?.id ?? ''
      if (templateId) setSelectedTemplateId(templateId)
      const defaultPrinter = printersList.find((p) => p.isDefault)?.name ?? printersList[0]?.name ?? ''
      setSelectedPrinter(defaultPrinter)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar impressoras/modelos.'
      op.failed(err, 'Erro ao carregar impressoras ou modelos de etiqueta.')
      setError(msg)
    }
  }

  const closeEtiquetasDialog = () => {
    setShowEtiquetasDialog(false)
    setPreviewHtml('')
    setPreviewInfo(null)
    setPrinterStatus(null)
  }

  const handlePrintEtiquetas = async () => {
    const items = Object.entries(labelQuantities)
      .map(([produtoId, quantidade]) => ({ produtoId, quantidade: Math.max(0, Math.floor(quantidade || 0)) }))
      .filter((item) => item.quantidade > 0)
    if (items.length === 0) {
      setError('Informe ao menos 1 etiqueta para imprimir.')
      return
    }
    if (!selectedPrinter) {
      setError('Selecione uma impressora.')
      return
    }
    setImprimindoEtiquetas(true)
    setError('')
    try {
      const result = await window.electronAPI.etiquetas.print({
        templateId: selectedTemplateId || undefined,
        printerName: selectedPrinter,
        items
      })
      if (!result.ok) {
        const errMsg = result.error ?? 'Erro ao imprimir etiquetas.'
        op.error(errMsg)
        setError(errMsg)
        return
      }
      op.saved('Etiquetas enviadas para impressão.')
      closeEtiquetasDialog()
      setSelectedIds(new Set())
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao imprimir etiquetas.'
      op.failed(err, 'Erro ao imprimir etiquetas.')
      setError(msg)
    } finally {
      setImprimindoEtiquetas(false)
    }
  }

  useEffect(() => {
    if (!showEtiquetasDialog || !selectedPrinter) return
    window.electronAPI.etiquetas.getPrinterStatus(selectedPrinter)
      .then(setPrinterStatus)
      .catch((err: unknown) => {
        setPrinterStatus({
          name: selectedPrinter,
          online: false,
          detail: err instanceof Error ? err.message : 'Não foi possível obter status.'
        })
      })
  }, [showEtiquetasDialog, selectedPrinter])

  useEffect(() => {
    if (!showEtiquetasDialog || !selectedTemplateId) return
    const items = Object.entries(labelQuantities)
      .map(([produtoId, quantidade]) => ({ produtoId, quantidade: Math.max(0, Math.floor(quantidade || 0)) }))
      .filter((item) => item.quantidade > 0)
    if (items.length === 0) {
      setPreviewHtml('')
      setPreviewInfo(null)
      return
    }
    window.electronAPI.etiquetas.preview({ templateId: selectedTemplateId, items })
      .then((result) => {
        setPreviewHtml(result.preview.html)
        setPreviewInfo({ totalLabels: result.totalLabels, language: result.language })
      })
      .catch((err: unknown) => {
        setPreviewHtml('')
        setPreviewInfo(null)
        setError(err instanceof Error ? err.message : 'Falha na pré-visualização das etiquetas.')
      })
  }, [showEtiquetasDialog, selectedTemplateId, labelQuantities])

  const getFornecedorLabel = (id: string) => fornecedores.find((f) => f.value === id)?.label ?? '—'

  const totalProdutos = list.length
  const totalAtivos = list.filter((p) => p.ativo === 1).length
  const totalInativos = list.filter((p) => p.ativo === 0).length
  const totalEstoqueBaixo = list.filter((p) => isProdutoEstoqueCritico(p, saldosMap.get(p.id) ?? 0)).length

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
            onClick={() => openEtiquetasDialog(Array.from(selectedIds))}
            disabled={imprimindoEtiquetas}
          >
            {imprimindoEtiquetas ? 'Imprimindo...' : `Imprimir etiquetas (${selectedIds.size})`}
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
            <button type="button" className={`form-tab-btn ${formTab === 'cashback' ? 'form-tab-btn--active' : ''}`} onClick={() => setFormTab('cashback')}>
              Cashback
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
                <div className="input-wrap" style={{ position: 'relative' }}>
                  <label className="input-label">NCM</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="input-el"
                    value={form.ncm ? formatNcmDisplay(form.ncm) : form.ncm}
                    onChange={(e) => {
                      const normalized = normalizeNcm(e.target.value)
                      updateForm({ ncm: normalized || '' })
                    }}
                    onFocus={() => form.ncm.length >= 2 && setNcmDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setNcmDropdownOpen(false), 200)}
                    placeholder="8 dígitos (ex.: 3305.10.00)"
                  />
                  {form.ncm && form.ncm.length < 8 && (
                    <span className="input-hint">Digite com ou sem ponto; será corrigido para 8 dígitos.</span>
                  )}
                  {ncmDropdownOpen && (ncmSuggestions.length > 0 || ncmLoading) && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: 2,
                        background: 'var(--color-bg)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-md)',
                        zIndex: 50,
                        maxHeight: 220,
                        overflow: 'auto',
                      }}
                    >
                      {ncmLoading ? (
                        <div style={{ padding: 12, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Buscando...</div>
                      ) : (
                        ncmSuggestions.map((item, idx) => {
                          const codigo8 = normalizeNcm(item.codigo)
                          return (
                            <button
                              key={`${item.codigo}-${idx}`}
                              type="button"
                              className="ncm-suggestion-item"
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '10px 12px',
                                textAlign: 'left',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                fontSize: 'var(--text-sm)',
                                color: 'var(--color-text)',
                              }}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                updateForm({ ncm: codigo8 })
                                setNcmDropdownOpen(false)
                              }}
                            >
                              <strong>{item.codigo}</strong> — <span dangerouslySetInnerHTML={{ __html: item.descricao }} />
                            </button>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
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

          {/* Aba: Cashback */}
          <div className={`form-tab-panel ${formTab === 'cashback' ? 'form-tab-panel--active' : ''}`}>
            <div className="form-section">
              <h3 className="form-section-title">Programa de cashback</h3>
              <p className="input-hint" style={{ marginBottom: 16 }}>
                O percentual de cashback é único e definido em <Link to="/cashback" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Cashback</Link>, sobre o valor total da compra, com cliente identificado.
                Aqui você só restringe o uso do saldo como pagamento neste item, se necessário.
              </p>
              <div className="form-grid">
                <label className="flex items-start gap-2" style={{ gridColumn: '1 / -1' }}>
                  <input
                    type="checkbox"
                    className="mt-1 shrink-0"
                    checked={form.permitir_resgate_cashback_no_produto === 1}
                    onChange={(e) => updateForm({ permitir_resgate_cashback_no_produto: e.target.checked ? 1 : 0 })}
                  />
                  <span>Permitir usar saldo de cashback como pagamento quando este produto estiver no carrinho</span>
                </label>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="input-label" style={{ display: 'block', marginBottom: 4 }}>Observação interna (regra / lembrete)</label>
                  <textarea
                    className="input-el"
                    value={form.cashback_observacao}
                    onChange={(e) => updateForm({ cashback_observacao: e.currentTarget.value })}
                    rows={3}
                    placeholder="Uso interno; não aparece no PDV"
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {error && <Alert variant="error" style={{ marginTop: 16 }}>{error}</Alert>}
        </form>
      </Dialog>

      <Dialog
        open={showEtiquetasDialog}
        onClose={closeEtiquetasDialog}
        title="Impressão profissional de etiquetas"
        size="large"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeEtiquetasDialog}>
              Cancelar
            </Button>
            <Button type="button" onClick={handlePrintEtiquetas} disabled={imprimindoEtiquetas}>
              {imprimindoEtiquetas ? 'Enviando para impressora...' : 'Imprimir'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          <div>
            <Select
              label="Modelo de etiqueta"
              options={labelTemplates.map((template) => ({ value: template.id, label: template.name }))}
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.currentTarget.value)}
            />
            <Select
              label="Impressora"
              options={printers.map((p) => ({ value: p.name, label: p.isDefault ? `${p.name} (padrão)` : p.name }))}
              value={selectedPrinter}
              onChange={(e) => setSelectedPrinter(e.currentTarget.value)}
            />
            <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: printerStatus?.online ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {printerStatus ? `Status: ${printerStatus.online ? 'online' : 'offline'} — ${printerStatus.detail}` : 'Status da impressora não carregado.'}
            </div>

            <div style={{ marginTop: 16 }}>
              <h4 style={{ margin: '0 0 8px 0' }}>Quantidade por produto</h4>
              <div style={{ display: 'grid', gap: 8, maxHeight: 260, overflow: 'auto', paddingRight: 4 }}>
                {Object.keys(labelQuantities).map((id) => {
                  const product = list.find((p) => p.id === id)
                  return (
                    <div key={id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8, alignItems: 'center' }}>
                      <div style={{ fontSize: 'var(--text-sm)' }}>{product?.nome ?? id}</div>
                      <input
                        className="input-el"
                        type="number"
                        min={0}
                        step={1}
                        value={labelQuantities[id]}
                        onChange={(e) => {
                          const value = Number(e.currentTarget.value)
                          setLabelQuantities((prev) => ({ ...prev, [id]: Number.isFinite(value) ? value : 0 }))
                        }}
                        style={{ margin: 0 }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div>
            <h4 style={{ margin: '0 0 8px 0' }}>Pré-visualização</h4>
            {previewInfo && (
              <p style={{ margin: '0 0 8px 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                {previewInfo.totalLabels} etiqueta(s) - Linguagem: {previewInfo.language}
              </p>
            )}
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'auto', maxHeight: 360, background: '#fff' }}>
              {previewHtml ? (
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : (
                <div style={{ padding: 12, color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                  Pré-visualização indisponível para os itens atuais.
                </div>
              )}
            </div>
          </div>
        </div>
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
            {list.map((p) => {
              const saldoLista = saldosMap.get(p.id) ?? 0
              const estoqueAlerta = isProdutoEstoqueCritico(p, saldoLista)
              return (
              <tr key={p.id} className={estoqueAlerta ? 'produtos-row--estoque-alerta' : undefined}>
                <td><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                <td>{p.codigo ?? '—'}</td>
                <td>{p.nome}</td>
                <td>{p.categoria_id ? (categoriaPathMap.get(p.categoria_id) ?? '—') : '—'}</td>
                <td>{p.fornecedor_id ? getFornecedorLabel(p.fornecedor_id) : '—'}</td>
                <td>R$ {p.custo.toFixed(2)}</td>
                <td>R$ {p.preco.toFixed(2)}</td>
                <td className={p.controla_estoque && estoqueAlerta ? 'produtos-col-saldo-alerta' : undefined}>
                  {p.controla_estoque ? saldoLista : '—'}
                </td>
                <td>{p.unidade}</td>
                <td>{p.ativo ? 'Sim' : 'Não'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="ghost" size="sm" leftIcon={<Pencil size={14} />} onClick={() => openEdit(p)}>Editar</Button>
                    <Button variant="ghost" size="sm" leftIcon={<Tag size={14} />} onClick={() => openEtiquetasDialog([p.id])} disabled={imprimindoEtiquetas}>Etiqueta</Button>
                  </div>
                </td>
              </tr>
              )
            })}
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
