import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useSyncDataRefresh } from '../hooks/useSyncDataRefresh'
import type { Produto, ProdutoSaldo, CategoriaTreeNode, LabelTemplate, PrinterInfo, PrinterStatus, Marca } from '../vite-env'
import {
  PageTitle,
  Button,
  Input,
  Alert,
  Select,
  Dialog,
  ConfirmDialog,
  useOperationToast,
} from '../components/ui'
import { Plus, Pencil, Tag, Barcode, Package, CheckCircle, XCircle, AlertTriangle, Upload, X, Store, Trash2, CopyPlus } from 'lucide-react'
import {
  parseLojaOnlineImagensExtras,
  serializeLojaOnlineImagensExtras,
} from '../lib/loja-online-types'

/** Limite para foto do produto (data URL no banco); alinhar com sync/performance. */
const MAX_PRODUTO_IMAGEM_BYTES = 1024 * 1024
const MAX_LOJA_ONLINE_IMAGENS_EXTRAS = 8

type ProdutoComImagensLoja = Produto & { loja_online_imagens_json?: string | null }

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

function toCaixaAlta(value: string): string {
  return value.toLocaleUpperCase('pt-BR')
}

function textoOuNulo(value: string): string | null {
  const t = value.trim()
  return t ? t : null
}

function textoCaixaAltaOuNulo(value: string): string | null {
  return textoOuNulo(toCaixaAlta(value))
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

function ProdutoListThumb({ src }: { src: string | null | undefined }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => {
    setBroken(false)
  }, [src])
  const url = src?.trim()
  if (!url || broken) {
    return (
      <div className="produtos-list-thumb produtos-list-thumb--empty" aria-hidden>
        <Package size={16} strokeWidth={1.75} />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt=""
      className="produtos-list-thumb"
      loading="lazy"
      onError={() => setBroken(true)}
    />
  )
}

export function Produtos() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''
  const syncRefreshKey = useSyncDataRefresh()
  const op = useOperationToast()
  const [catalogo, setCatalogo] = useState<Produto[]>([])
  const [saldos, setSaldos] = useState<ProdutoSaldo[]>([])
  const [fornecedores, setFornecedores] = useState<{ value: string; label: string }[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
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
    marca_id: '',
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
    loja_online: 1,
    loja_online_destaque: 0,
    loja_online_destaque_ordem: 0,
    estoque_atual: 0,
    permitir_resgate_cashback_no_produto: 1,
    cashback_observacao: '',
  })
  const [saldoInicialEdit, setSaldoInicialEdit] = useState<number | null>(null)
  const [precoManual, setPrecoManual] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formTab, setFormTab] = useState<'info' | 'loja-online' | 'fiscal' | 'imagens' | 'variacoes' | 'detalhes' | 'cashback'>('info')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [imprimindoEtiquetas, setImprimindoEtiquetas] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Produto | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [showEtiquetasDialog, setShowEtiquetasDialog] = useState(false)
  const [labelTemplates, setLabelTemplates] = useState<LabelTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [marcaModalOpen, setMarcaModalOpen] = useState(false)
  const [nomeMarcaNova, setNomeMarcaNova] = useState('')
  const [savingMarca, setSavingMarca] = useState(false)
  const [marcaModalError, setMarcaModalError] = useState('')
  const [selectedPrinter, setSelectedPrinter] = useState('')
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus | null>(null)
  const [labelQuantities, setLabelQuantities] = useState<Record<string, number>>({})
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewInfo, setPreviewInfo] = useState<{ totalLabels: number; language: string } | null>(null)
  const [ncmSuggestions, setNcmSuggestions] = useState<NcmSuggestion[]>([])
  const [ncmLoading, setNcmLoading] = useState(false)
  const [ncmDropdownOpen, setNcmDropdownOpen] = useState(false)
  const [lojaOnlineImagens, setLojaOnlineImagens] = useState<string[]>([])
  const [lojaOnlineImagemUrl, setLojaOnlineImagemUrl] = useState('')

  const list = useMemo(() => {
    const t = search.trim().toLowerCase()
    if (!t) return catalogo
    return catalogo.filter((p) => {
      const cat = p.categoria_id ? (categoriaPathMap.get(p.categoria_id) ?? '') : ''
      const marca = p.marca_id ? (marcas.find((m) => m.id === p.marca_id)?.nome ?? '') : ''
      const forn = p.fornecedor_id
        ? (fornecedores.find((f) => f.value === p.fornecedor_id)?.label ?? '')
        : ''
      return (
        p.nome.toLowerCase().includes(t) ||
        (p.sku?.toLowerCase().includes(t) ?? false) ||
        (p.codigo_barras?.toLowerCase().includes(t) ?? false) ||
        (p.codigo != null && String(p.codigo).includes(t)) ||
        (p.descricao?.toLowerCase().includes(t) ?? false) ||
        cat.toLowerCase().includes(t) ||
        marca.toLowerCase().includes(t) ||
        forn.toLowerCase().includes(t)
      )
    })
  }, [catalogo, search, categoriaPathMap, marcas, fornecedores])

  const loadImagensSeq = useRef(0)
  const editLoadSeq = useRef(0)

  const load = useCallback(() => {
    if (!empresaId) return
    const seq = ++loadImagensSeq.current
    window.electronAPI.produtos
      .list(empresaId, { apenasAtivos, completo: true })
      .then((items) => {
        if (seq !== loadImagensSeq.current) return
        setCatalogo(items)
        const api = window.electronAPI?.produtos?.getImagens
        if (!api || items.length === 0) return
        const ids = items.slice(0, 80).map((p) => p.id)
        void (async () => {
          for (let i = 0; i < ids.length; i += 16) {
            if (seq !== loadImagensSeq.current) return
            try {
              const imagens = await api(ids.slice(i, i + 16))
              if (seq !== loadImagensSeq.current) return
              setCatalogo((prev) =>
                prev.map((p) =>
                  Object.prototype.hasOwnProperty.call(imagens, p.id) ? { ...p, imagem: imagens[p.id] } : p
                )
              )
            } catch {
              break
            }
          }
        })()
      })
  }, [empresaId, apenasAtivos])

  useEffect(() => {
    load()
  }, [load, syncRefreshKey])

  useEffect(() => {
    if (!empresaId) return
    window.electronAPI.estoque.listSaldos(empresaId).then(setSaldos)
  }, [empresaId, syncRefreshKey])

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
    const api = window.electronAPI?.marcas
    if (!api?.list) {
      setMarcas([])
      return
    }
    api.list(empresaId).then(setMarcas).catch(() => setMarcas([]))
  }, [empresaId, syncRefreshKey])

  const marcaNomeMap = new Map(marcas.map((m) => [m.id, m.nome]))

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

  const marcaSelectOptions = useMemo(
    () =>
      [...marcas]
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
        .map((m) => ({
          value: m.id,
          label: m.ativo === 0 ? `${m.nome} (inativa)` : m.nome
        })),
    [marcas]
  )

  const submitMarcaNova = async (e: React.FormEvent) => {
    e.preventDefault()
    setMarcaModalError('')
    if (!nomeMarcaNova.trim()) {
      setMarcaModalError('Nome é obrigatório.')
      return
    }
    const api = window.electronAPI?.marcas
    if (!api?.create) {
      setMarcaModalError('Cadastro de marcas indisponível neste ambiente.')
      return
    }
    setSavingMarca(true)
    try {
      const m = await api.create({ empresa_id: empresaId, nome: toCaixaAlta(nomeMarcaNova.trim()) })
      setMarcas((prev) => [...prev, m].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })))
      updateForm({ marca_id: m.id })
      setMarcaModalOpen(false)
      setNomeMarcaNova('')
      op.created('Marca cadastrada.')
    } catch (err) {
      setMarcaModalError(err instanceof Error ? err.message : 'Erro ao salvar marca.')
    } finally {
      setSavingMarca(false)
    }
  }

  const openNew = () => {
    setEditing(null)
    setPrecoManual(false)
    setForm({
      nome: '',
      sku: '',
      codigo_barras: '',
      fornecedor_id: '',
      marca_id: '',
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
      loja_online: 1,
      loja_online_destaque: 0,
      loja_online_destaque_ordem: 0,
      estoque_atual: 0,
      permitir_resgate_cashback_no_produto: 1,
      cashback_observacao: '',
    })
    setSaldoInicialEdit(null)
    setError('')
    setFormTab('info')
    setNcmDropdownOpen(false)
    setNcmSuggestions([])
    setLojaOnlineImagens([])
    setLojaOnlineImagemUrl('')
    setShowForm(true)
    if (empresaId) {
      window.electronAPI.produtos.getNextCodigo(empresaId).then(setNextCodigo)
    } else {
      setNextCodigo(null)
    }
  }

  const fillFormFromProduto = (p: Produto) => {
    setEditing(p)
    setPrecoManual(false)
    setForm({
      nome: toCaixaAlta(p.nome),
      sku: toCaixaAlta(p.sku ?? ''),
      codigo_barras: toCaixaAlta(p.codigo_barras ?? ''),
      fornecedor_id: p.fornecedor_id ?? '',
      marca_id: p.marca_id ?? '',
      categoria_id: p.categoria_id ?? '',
      descricao: toCaixaAlta(p.descricao ?? ''),
      imagem: p.imagem ?? '',
      custo: p.custo,
      markup: p.markup,
      preco: p.preco,
      unidade: p.unidade,
      controla_estoque: p.controla_estoque === 1 ? 1 : 0,
      estoque_minimo: p.estoque_minimo,
      ncm: p.ncm ?? '',
      cfop: toCaixaAlta(p.cfop ?? ''),
      ativo: p.ativo,
      loja_online: p.loja_online ?? 1,
      loja_online_destaque: p.loja_online_destaque ?? 0,
      loja_online_destaque_ordem: p.loja_online_destaque_ordem ?? 0,
      estoque_atual: saldosMap.get(p.id) ?? 0,
      permitir_resgate_cashback_no_produto: p.permitir_resgate_cashback_no_produto ?? 1,
      cashback_observacao: toCaixaAlta(p.cashback_observacao ?? ''),
    })
    setSaldoInicialEdit(saldosMap.get(p.id) ?? 0)
    setNextCodigo(p.codigo ?? null)
    setLojaOnlineImagens(
      parseLojaOnlineImagensExtras(
        (p as ProdutoComImagensLoja).loja_online_imagens_json,
        p.imagem
      )
    )
    setLojaOnlineImagemUrl('')
  }

  const openEdit = (p: Produto) => {
    const seq = ++editLoadSeq.current
    const imagemLista = p.imagem ?? ''
    const extrasLista = parseLojaOnlineImagensExtras(
      (p as ProdutoComImagensLoja).loja_online_imagens_json,
      p.imagem
    )
    setError('')
    setFormTab('info')
    setNcmDropdownOpen(false)
    setNcmSuggestions([])
    fillFormFromProduto(p)
    setShowForm(true)
    void window.electronAPI.produtos.get(p.id).then((full) => {
      if (!full || editLoadSeq.current !== seq) return
      setEditing(full)
      setForm((prev) => {
        if (prev.imagem !== imagemLista) return prev
        return { ...prev, imagem: full.imagem ?? '' }
      })
      setLojaOnlineImagens((current) => {
        const unchanged =
          current.length === extrasLista.length && current.every((url, i) => url === extrasLista[i])
        if (!unchanged) return current
        return parseLojaOnlineImagensExtras(
          (full as ProdutoComImagensLoja).loja_online_imagens_json,
          full.imagem
        )
      })
    })
  }

  const handleDuplicate = async (p: Produto) => {
    if (!empresaId || duplicatingId) return
    if (p.sku === '__AGILIZA_NFE_AVULSA__') {
      op.error('Produto interno do sistema não pode ser duplicado.')
      return
    }
    setDuplicatingId(p.id)
    setError('')
    try {
      const full = (await window.electronAPI.produtos.get(p.id)) ?? p
      const created = await window.electronAPI.produtos.create({
        empresa_id: empresaId,
        nome: toCaixaAlta(`${full.nome.trim()} (cópia)`),
        fornecedor_id: full.fornecedor_id ?? undefined,
        marca_id: full.marca_id ?? undefined,
        categoria_id: full.categoria_id ?? undefined,
        descricao: full.descricao ? toCaixaAlta(full.descricao) : undefined,
        imagem: full.imagem ?? undefined,
        custo: full.custo,
        markup: full.markup,
        preco: full.preco,
        unidade: toCaixaAlta(full.unidade || 'UN'),
        controla_estoque: full.controla_estoque === 1 ? 1 : 0,
        estoque_minimo: full.estoque_minimo,
        ncm: full.ncm ?? undefined,
        cfop: full.cfop ? toCaixaAlta(full.cfop) : undefined,
        ativo: full.ativo,
        loja_online: full.loja_online ?? 1,
        loja_online_destaque: full.loja_online_destaque ?? 0,
        loja_online_destaque_ordem: full.loja_online_destaque_ordem ?? 0,
        loja_online_imagens_json:
          serializeLojaOnlineImagensExtras(
            parseLojaOnlineImagensExtras(
              (full as ProdutoComImagensLoja).loja_online_imagens_json,
              full.imagem
            ),
            full.imagem
          ) ?? undefined,
        cashback_ativo: full.cashback_ativo ?? 1,
        cashback_percentual: full.cashback_percentual ?? null,
        permitir_resgate_cashback_no_produto: full.permitir_resgate_cashback_no_produto ?? 1,
        cashback_observacao: full.cashback_observacao ? toCaixaAlta(full.cashback_observacao) : null,
      })
      op.created('Produto duplicado.')
      load()
      if (empresaId) {
        window.electronAPI.estoque.listSaldos(empresaId).then(setSaldos)
      }
      openEdit(created)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao duplicar produto.'
      op.failed(err, 'Erro ao duplicar produto.')
      setError(msg)
    } finally {
      setDuplicatingId(null)
    }
  }

  const updateForm = (updates: Partial<typeof form>) => {
    setForm((prev) => {
      const normalized: Partial<typeof form> = { ...updates }
      if (typeof normalized.nome === 'string') normalized.nome = toCaixaAlta(normalized.nome)
      if (typeof normalized.sku === 'string') normalized.sku = toCaixaAlta(normalized.sku)
      if (typeof normalized.codigo_barras === 'string') normalized.codigo_barras = toCaixaAlta(normalized.codigo_barras)
      if (typeof normalized.descricao === 'string') normalized.descricao = toCaixaAlta(normalized.descricao)
      if (typeof normalized.cfop === 'string') normalized.cfop = toCaixaAlta(normalized.cfop)
      if (typeof normalized.cashback_observacao === 'string') {
        normalized.cashback_observacao = toCaixaAlta(normalized.cashback_observacao)
      }
      const next = { ...prev, ...normalized }
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

  const readProdutoImagemFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Arquivo inválido. Use PNG, JPG ou WebP.'))
        return
      }
      if (file.size > MAX_PRODUTO_IMAGEM_BYTES) {
        reject(new Error(`Imagem muito grande. Use até ${MAX_PRODUTO_IMAGEM_BYTES / (1024 * 1024)} MB.`))
        return
      }
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Erro ao ler imagem.'))
      reader.readAsDataURL(file)
    })

  const handleProdutoImagemFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    readProdutoImagemFile(file)
      .then((data) => {
        updateForm({ imagem: data })
        setError('')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar imagem.')
      })
  }

  const handleLojaOnlineImagemFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (lojaOnlineImagens.length >= MAX_LOJA_ONLINE_IMAGENS_EXTRAS) {
      setError(`Máximo de ${MAX_LOJA_ONLINE_IMAGENS_EXTRAS} imagens extras para a loja online.`)
      return
    }
    readProdutoImagemFile(file)
      .then((data) => {
        const main = form.imagem.trim()
        if (main && data === main) {
          setError('Esta imagem já é a principal do produto.')
          return
        }
        if (lojaOnlineImagens.includes(data)) {
          setError('Esta imagem já foi adicionada.')
          return
        }
        setLojaOnlineImagens((prev) => [...prev, data])
        setError('')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar imagem.')
      })
  }

  const addLojaOnlineImagemUrl = () => {
    const url = lojaOnlineImagemUrl.trim()
    if (!url) return
    if (lojaOnlineImagens.length >= MAX_LOJA_ONLINE_IMAGENS_EXTRAS) {
      setError(`Máximo de ${MAX_LOJA_ONLINE_IMAGENS_EXTRAS} imagens extras para a loja online.`)
      return
    }
    const main = form.imagem.trim()
    if (main && url === main) {
      setError('Esta URL já é a imagem principal do produto.')
      return
    }
    if (lojaOnlineImagens.includes(url)) {
      setError('Esta imagem já foi adicionada.')
      return
    }
    setLojaOnlineImagens((prev) => [...prev, url])
    setLojaOnlineImagemUrl('')
    setError('')
  }

  const removeLojaOnlineImagem = (index: number) => {
    setLojaOnlineImagens((prev) => prev.filter((_, i) => i !== index))
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
        nome: toCaixaAlta(form.nome.trim()),
        sku: textoCaixaAltaOuNulo(form.sku),
        codigo_barras: textoCaixaAltaOuNulo(form.codigo_barras),
        fornecedor_id: textoOuNulo(form.fornecedor_id),
        marca_id: textoOuNulo(form.marca_id),
        categoria_id: textoOuNulo(form.categoria_id),
        descricao: textoCaixaAltaOuNulo(form.descricao),
        imagem: textoOuNulo(form.imagem),
        custo: form.custo,
        markup: form.markup,
        preco: form.preco,
        unidade: toCaixaAlta(form.unidade.trim() || 'UN'),
        controla_estoque: form.controla_estoque === 1 ? 1 : 0,
        estoque_minimo: form.estoque_minimo,
        ncm: textoOuNulo(form.ncm),
        cfop: textoCaixaAltaOuNulo(form.cfop),
        ativo: form.ativo,
        loja_online: form.loja_online === 1 ? 1 : 0,
        loja_online_destaque: form.loja_online === 1 && form.loja_online_destaque === 1 ? 1 : 0,
        loja_online_destaque_ordem: Number(form.loja_online_destaque_ordem) || 0,
        loja_online_imagens_json: serializeLojaOnlineImagensExtras(lojaOnlineImagens, form.imagem),
        cashback_ativo: 1,
        cashback_percentual: null,
        permitir_resgate_cashback_no_produto: form.permitir_resgate_cashback_no_produto === 1 ? 1 : 0,
        cashback_observacao: textoCaixaAltaOuNulo(form.cashback_observacao),
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
      editLoadSeq.current += 1
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
    editLoadSeq.current += 1
    setEditing(null)
    setShowForm(false)
  }

  const handleDelete = async (produto: Produto) => {
    const api = window.electronAPI?.produtos
    if (!api?.delete) return
    setDeletingId(produto.id)
    setError('')
    try {
      const result = await api.delete(produto.id)
      if (result.ok) {
        op.deleted('Produto excluído.')
        setDeleteConfirm(null)
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(produto.id)
          return next
        })
        if (editing?.id === produto.id) cancelForm()
        load()
        if (empresaId) {
          window.electronAPI.estoque.listSaldos(empresaId).then(setSaldos)
        }
      } else {
        const msg = result.error ?? 'Não foi possível excluir o produto.'
        op.error(msg)
        setError(msg)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir produto.'
      op.failed(err, 'Erro ao excluir produto.')
      setError(msg)
    } finally {
      setDeletingId(null)
    }
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
            placeholder="Buscar por nome, SKU, código, categoria, marca ou descrição"
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
        closeOnBackdropClick={false}
        closeOnEscape={false}
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
            <button type="button" className={`form-tab-btn ${formTab === 'loja-online' ? 'form-tab-btn--active' : ''}`} onClick={() => setFormTab('loja-online')}>
              <Store size={15} style={{ verticalAlign: -2, marginRight: 6 }} />
              Loja online
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
              <div className="form-produto-codigo-top">
                <Input
                  label="Código"
                  value={editing ? (editing.codigo ?? '—') : (nextCodigo ?? '...')}
                  disabled
                  hint={!editing ? 'Sequencial automático' : undefined}
                />
              </div>
              <div className="form-grid form-grid-single">
                <Input label="Nome" required value={form.nome} onChange={(e) => updateForm({ nome: e.currentTarget.value })} />
                <Input label="SKU" value={form.sku} onChange={(e) => updateForm({ sku: e.currentTarget.value })} />
                <div>
                  <div className="form-produto-inline-actions">
                    <Input
                      label="Código de barras"
                      value={form.codigo_barras}
                      onChange={(e) => updateForm({ codigo_barras: e.currentTarget.value })}
                      placeholder="EAN-13 ou outro"
                    />
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
              <div className="form-grid form-grid-single">
                <Select
                  label="Fornecedor"
                  options={[{ value: '', label: '— Nenhum —' }, ...fornecedores]}
                  value={form.fornecedor_id}
                  onChange={(e) => updateForm({ fornecedor_id: e.currentTarget.value })}
                />
              </div>
            </div>
            <div className="form-section">
              <h3 className="form-section-title">Marca</h3>
              <div className="form-produto-marca-row">
                <div className="form-produto-marca-row__select">
                  <Select
                    label="Marca"
                    options={[{ value: '', label: '— Nenhuma —' }, ...marcaSelectOptions]}
                    value={form.marca_id}
                    onChange={(e) => updateForm({ marca_id: e.currentTarget.value })}
                  />
                </div>
                <div className="form-produto-marca-row__btn">
                  <Button
                    type="button"
                    variant="secondary"
                    leftIcon={<Plus size={16} />}
                    onClick={() => {
                      setNomeMarcaNova('')
                      setMarcaModalError('')
                      setMarcaModalOpen(true)
                    }}
                  >
                    Nova marca
                  </Button>
                </div>
              </div>
              <p className="input-hint" style={{ marginTop: 8 }}>
                <Link to="/marcas" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>
                  Gerenciar marcas
                </Link>
                {' — lista completa e mapa por marca.'}
              </p>
            </div>
            <div className="form-section">
              <h3 className="form-section-title">Categoria</h3>
              <p className="input-hint" style={{ marginBottom: 12 }}>Selecione o grupo, depois a categoria e a subcategoria (quando houver).</p>
              <div className="form-grid form-grid-3">
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
              <div className="form-produto-estoque-grid">
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
              <label className="form-produto-ativo-row" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', cursor: 'pointer', margin: 0 }}>
                <input type="checkbox" checked={form.ativo === 1} onChange={(e) => updateForm({ ativo: e.currentTarget.checked ? 1 : 0 })} />
                Produto ativo (visível no PDV e listagens)
              </label>
            </div>
          </div>

          {/* Aba: Loja online */}
          <div className={`form-tab-panel ${formTab === 'loja-online' ? 'form-tab-panel--active' : ''}`}>
            <div className="form-section">
              <h3 className="form-section-title">Vitrine da loja online</h3>
              <p className="input-hint" style={{ marginBottom: 16 }}>
                Configure como este produto aparece na loja virtual. A loja precisa estar ativa em Loja online → Publicação.
              </p>
              <label className="form-produto-ativo-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 'var(--text-sm)', cursor: 'pointer', margin: 0, padding: 12, background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <input
                  type="checkbox"
                  checked={form.loja_online === 1}
                  onChange={(e) =>
                    updateForm({
                      loja_online: e.currentTarget.checked ? 1 : 0,
                      loja_online_destaque: e.currentTarget.checked ? form.loja_online_destaque : 0,
                    })
                  }
                  style={{ marginTop: 2 }}
                />
                <div>
                  <strong>Exibir na loja online</strong>
                  <p className="input-hint" style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)' }}>
                    O produto entra no catálogo público da vitrine. Desmarque para mantê-lo apenas no PDV.
                  </p>
                </div>
              </label>
              {form.loja_online === 1 && (
                <>
                  <label className="form-produto-ativo-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 'var(--text-sm)', cursor: 'pointer', margin: '12px 0 0', padding: 12, background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    <input
                      type="checkbox"
                      checked={form.loja_online_destaque === 1}
                      onChange={(e) => updateForm({ loja_online_destaque: e.currentTarget.checked ? 1 : 0 })}
                      style={{ marginTop: 2 }}
                    />
                    <div>
                      <strong>Destaque na vitrine</strong>
                      <p className="input-hint" style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)' }}>
                        Exibe no carrossel de destaques, logo abaixo do banner da loja.
                      </p>
                    </div>
                  </label>
                  {form.loja_online_destaque === 1 && (
                    <div style={{ marginTop: 12, maxWidth: 200 }}>
                      <Input
                        label="Ordem no carrossel"
                        type="number"
                        min={0}
                        step={1}
                        value={form.loja_online_destaque_ordem || ''}
                        onChange={(e) => updateForm({ loja_online_destaque_ordem: Number(e.currentTarget.value) || 0 })}
                        hint="Menor número aparece primeiro"
                      />
                    </div>
                  )}
                </>
              )}
              {form.loja_online !== 1 && (
                <p className="input-hint" style={{ marginTop: 12 }}>
                  Ative &quot;Exibir na loja online&quot; para configurar destaque e ordem no carrossel.
                </p>
              )}
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
              <h3 className="form-section-title">Imagem principal</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: '0 0 16px' }}>
                Usada no PDV, na lista de produtos e como primeira foto na loja online. Envie um arquivo (PNG, JPG, WebP) ou informe uma URL; máximo {MAX_PRODUTO_IMAGEM_BYTES / (1024 * 1024)} MB no upload.
              </p>
              <div className="form-produto-imagem-block">
                <div className="form-produto-imagem-preview">
                  {form.imagem ? (
                    <img
                      src={form.imagem}
                      alt=""
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
                      onError={(ev) => {
                        (ev.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', padding: 8, textAlign: 'center' }}>
                      Sem imagem
                    </span>
                  )}
                </div>
                <div className="form-produto-imagem-actions">
                  <label className="btn btn--secondary btn--md" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, width: 'fit-content' }}>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                      onChange={handleProdutoImagemFile}
                      style={{ display: 'none' }}
                    />
                    <Upload size={18} />
                    Enviar imagem
                  </label>
                  {form.imagem ? (
                    <Button variant="secondary" leftIcon={<X size={18} />} type="button" onClick={() => updateForm({ imagem: '' })}>
                      Remover imagem
                    </Button>
                  ) : null}
                </div>
              </div>
              <Input
                label="Ou URL da imagem"
                value={form.imagem.startsWith('data:') ? '' : form.imagem}
                onChange={(e) => updateForm({ imagem: e.currentTarget.value })}
                placeholder="https://..."
                disabled={form.imagem.startsWith('data:')}
              />
              {form.imagem.startsWith('data:') ? (
                <p className="input-hint" style={{ marginTop: 8 }}>
                  Imagem enviada por arquivo. Remova para poder usar uma URL.
                </p>
              ) : null}
            </div>

            <div className="form-section">
              <h3 className="form-section-title">Imagens da loja online</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: '0 0 16px' }}>
                Fotos extras exibidas na galeria do produto na loja online. A imagem principal acima sempre aparece em primeiro; aqui você adiciona ângulos, detalhes ou variações (até {MAX_LOJA_ONLINE_IMAGENS_EXTRAS} imagens).
              </p>

              {lojaOnlineImagens.length > 0 ? (
                <div className="form-produto-loja-imagens-grid">
                  {lojaOnlineImagens.map((src, index) => (
                    <div key={`${src.slice(0, 48)}-${index}`} className="form-produto-loja-imagem-item">
                      <div className="form-produto-loja-imagem-preview">
                        <img src={src} alt="" loading="lazy" decoding="async" />
                      </div>
                      <button
                        type="button"
                        className="form-produto-loja-imagem-remove"
                        onClick={() => removeLojaOnlineImagem(index)}
                        aria-label={`Remover imagem ${index + 1}`}
                        title="Remover"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="input-hint" style={{ margin: '0 0 16px' }}>
                  Nenhuma imagem extra cadastrada.
                </p>
              )}

              <div className="form-produto-loja-imagens-actions">
                <label
                  className={`btn btn--secondary btn--md${lojaOnlineImagens.length >= MAX_LOJA_ONLINE_IMAGENS_EXTRAS ? ' btn--disabled' : ''}`}
                  style={{
                    cursor: lojaOnlineImagens.length >= MAX_LOJA_ONLINE_IMAGENS_EXTRAS ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    width: 'fit-content',
                    opacity: lojaOnlineImagens.length >= MAX_LOJA_ONLINE_IMAGENS_EXTRAS ? 0.6 : 1,
                  }}
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                    onChange={handleLojaOnlineImagemFile}
                    disabled={lojaOnlineImagens.length >= MAX_LOJA_ONLINE_IMAGENS_EXTRAS}
                    style={{ display: 'none' }}
                  />
                  <Upload size={18} />
                  Adicionar imagem
                </label>
              </div>

              <div className="form-produto-inline-actions" style={{ marginTop: 16 }}>
                <Input
                  label="Ou URL da imagem extra"
                  value={lojaOnlineImagemUrl}
                  onChange={(e) => setLojaOnlineImagemUrl(e.currentTarget.value)}
                  placeholder="https://..."
                  disabled={lojaOnlineImagens.length >= MAX_LOJA_ONLINE_IMAGENS_EXTRAS}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addLojaOnlineImagemUrl}
                  disabled={!lojaOnlineImagemUrl.trim() || lojaOnlineImagens.length >= MAX_LOJA_ONLINE_IMAGENS_EXTRAS}
                >
                  Adicionar URL
                </Button>
              </div>
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
              <div className="input-wrap">
                <label className="input-label" htmlFor="produto-descricao">Descrição detalhada</label>
                <textarea
                  id="produto-descricao"
                  className="input-el"
                  value={form.descricao}
                  onChange={(e) => updateForm({ descricao: e.currentTarget.value })}
                  rows={5}
                  placeholder="Descrição detalhada do produto para catálogo e etiquetas"
                  style={{ width: '100%', resize: 'vertical', minHeight: 120 }}
                />
              </div>
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
              <div className="form-grid form-grid-single">
                <label className="form-produto-ativo-row" style={{ margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <input
                    type="checkbox"
                    style={{ marginTop: 2, flexShrink: 0 }}
                    checked={form.permitir_resgate_cashback_no_produto === 1}
                    onChange={(e) => updateForm({ permitir_resgate_cashback_no_produto: e.target.checked ? 1 : 0 })}
                  />
                  <span style={{ fontSize: 'var(--text-sm)' }}>Permitir usar saldo de cashback como pagamento quando este produto estiver no carrinho</span>
                </label>
                <div className="input-wrap">
                  <label className="input-label" htmlFor="produto-cashback-obs">Observação interna (regra / lembrete)</label>
                  <textarea
                    id="produto-cashback-obs"
                    className="input-el"
                    value={form.cashback_observacao}
                    onChange={(e) => updateForm({ cashback_observacao: e.currentTarget.value })}
                    rows={3}
                    placeholder="Uso interno; não aparece no PDV"
                    style={{ width: '100%', resize: 'vertical', minHeight: 80 }}
                  />
                </div>
              </div>
            </div>
          </div>

          {error && <Alert variant="error" style={{ marginTop: 16 }}>{error}</Alert>}
        </form>
      </Dialog>

      <Dialog
        open={marcaModalOpen}
        onClose={() => !savingMarca && setMarcaModalOpen(false)}
        title="Nova marca"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setMarcaModalOpen(false)} disabled={savingMarca}>
              Cancelar
            </Button>
            <Button type="submit" form="form-marca-rapida" disabled={savingMarca}>
              {savingMarca ? 'Salvando...' : 'Salvar e usar'}
            </Button>
          </>
        }
      >
        <form id="form-marca-rapida" onSubmit={submitMarcaNova}>
          <Input
            label="Nome da marca"
            value={nomeMarcaNova}
            onChange={(e) => setNomeMarcaNova(toCaixaAlta(e.currentTarget.value))}
            placeholder="Ex: SAMSUNG, NESTLÉ"
            required
            autoFocus
          />
          {marcaModalError && <Alert variant="error" style={{ marginTop: 12 }}>{marcaModalError}</Alert>}
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
        <div className="table-wrap produtos-table-wrap">
          <table className="table produtos-table">
          <thead>
            <tr>
              <th style={{ width: 44 }}>
                <input type="checkbox" checked={list.length > 0 && selectedIds.size === list.length} onChange={toggleSelectAll} title="Selecionar todos" />
              </th>
              <th className="produtos-th-thumb" scope="col" aria-label="Imagem" />
              <th>Cód.</th>
              <th className="produtos-table__th--nome">Nome</th>
              <th className="produtos-table__th--categoria">Categoria</th>
              <th className="produtos-table__th--marca">Marca</th>
              <th className="produtos-table__th--fornecedor">Fornecedor</th>
              <th>Preço</th>
              <th>Saldo</th>
              <th className="produtos-table__th--ativo">Ativo</th>
              <th className="produtos-table__th--acoes" aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const saldoLista = saldosMap.get(p.id) ?? 0
              const estoqueAlerta = isProdutoEstoqueCritico(p, saldoLista)
              return (
              <tr key={p.id} className={estoqueAlerta ? 'produtos-row--estoque-alerta' : undefined}>
                <td><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                <td className="produtos-td-thumb">
                  <ProdutoListThumb src={p.imagem} />
                </td>
                <td>{p.codigo ?? '—'}</td>
                <td className="produtos-table__nome" title={p.nome}>
                  <span className="produtos-nome-cell">
                    {Number(p.loja_online) === 1 && (
                      <span className="produtos-badge-online" title="Disponível na loja online" aria-label="Disponível na loja online">
                        <Store size={13} strokeWidth={2} />
                      </span>
                    )}
                    <span className="produtos-nome-text">{p.nome}</span>
                  </span>
                </td>
                <td className="produtos-table__categoria" title={p.categoria_id ? (categoriaPathMap.get(p.categoria_id) ?? '') : undefined}>
                  {p.categoria_id ? (categoriaPathMap.get(p.categoria_id) ?? '—') : '—'}
                </td>
                <td className="produtos-table__marca" title={p.marca_id ? (marcaNomeMap.get(p.marca_id) ?? '') : undefined}>
                  {p.marca_id ? (marcaNomeMap.get(p.marca_id) ?? '—') : '—'}
                </td>
                <td className="produtos-table__fornecedor" title={p.fornecedor_id ? getFornecedorLabel(p.fornecedor_id) : undefined}>
                  {p.fornecedor_id ? getFornecedorLabel(p.fornecedor_id) : '—'}
                </td>
                <td>R$ {p.preco.toFixed(2)}</td>
                <td className={p.controla_estoque && estoqueAlerta ? 'produtos-col-saldo-alerta' : undefined}>
                  {p.controla_estoque ? saldoLista : '—'}
                </td>
                <td>{p.ativo ? 'Sim' : 'Não'}</td>
                <td className="produtos-table__acoes">
                  <div className="produtos-acoes">
                    <button type="button" className="produtos-acao-btn" onClick={() => openEdit(p)} title="Editar">
                      <Pencil size={15} />
                      <span className="sr-only">Editar</span>
                    </button>
                    <button
                      type="button"
                      className="produtos-acao-btn"
                      onClick={() => void handleDuplicate(p)}
                      disabled={duplicatingId !== null}
                      title={duplicatingId === p.id ? 'Duplicando...' : 'Duplicar'}
                    >
                      <CopyPlus size={15} />
                      <span className="sr-only">Duplicar</span>
                    </button>
                    <button
                      type="button"
                      className="produtos-acao-btn"
                      onClick={() => openEtiquetasDialog([p.id])}
                      disabled={imprimindoEtiquetas}
                      title="Etiqueta"
                    >
                      <Tag size={15} />
                      <span className="sr-only">Etiqueta</span>
                    </button>
                    <button
                      type="button"
                      className="produtos-acao-btn produtos-acao-btn--danger"
                      onClick={() => setDeleteConfirm(p)}
                      title="Excluir"
                    >
                      <Trash2 size={15} />
                      <span className="sr-only">Excluir</span>
                    </button>
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

      <ConfirmDialog
        open={deleteConfirm !== null}
        onClose={() => !deletingId && setDeleteConfirm(null)}
        onConfirm={() => (deleteConfirm ? handleDelete(deleteConfirm) : Promise.resolve())}
        title="Excluir produto"
        message={
          deleteConfirm
            ? `Excluir "${deleteConfirm.nome}"? Esta ação não pode ser desfeita. Produtos já vendidos não podem ser excluídos — inative o cadastro nesses casos.`
            : ''
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={deletingId !== null}
      />
    </Layout>
  )
}
