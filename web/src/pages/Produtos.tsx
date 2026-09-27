import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { isCapaCustomProduto } from '../capa-custom/lib/capa-catalogo'
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
import { Plus, Pencil, Tag, Barcode, Package, CheckCircle, XCircle, AlertTriangle, Upload, X, Store, Trash2, CopyPlus, ChevronRight, ChevronDown, GripVertical, Bold, Heading2 } from 'lucide-react'
import {
  isLojaOnlineVideoUrl,
  mergeLojaOnlineCardMeta,
  parseLojaOnlineCardMeta,
  parseLojaOnlineMidiasExtras,
  serializeLojaOnlineMidiasExtras,
  type LojaOnlineColecao,
  type LojaOnlineMidia,
} from '../lib/loja-online-types'
import {
  LOJA_ONLINE_PRODUTO_TAGS,
  type LojaOnlineProdutoTagId,
} from '../lib/loja-online-produto-tags'
import {
  fetchLojaOnlineColecaoIdsByProduto,
  fetchLojaOnlineColecoes,
  setLojaOnlineProdutoColecoes,
} from '../lib/loja-online-api'
import { isVideoFile, MAX_PRODUTO_VIDEO_BYTES, uploadProdutoVideo } from '../lib/produto-midias-storage'
import {
  MAX_PRODUTO_IMAGEM_BYTES,
  PRODUTO_IMAGEM_ACCEPT,
  PRODUTO_MIDIA_ACCEPT,
  readProdutoImagemFile,
} from '../lib/produto-imagem'
import { wrapDescricaoAsBold, wrapDescricaoAsTitle } from '../lib/produto-descricao'
import {
  labelCombinacao,
  mergeSkusComCombinacoes,
  parseVariacaoEixos,
  parseVariacaoValores,
  type VariacaoEixo,
  type VariacaoSkuDraft,
} from '../lib/produto-variacoes'
import {
  fetchProdutoVariacoesFilhos,
  filhosParaSkus,
  saveProdutoVariacoes,
  copyProdutoVariacoes,
  type ProdutoVariacaoRow,
} from '../lib/produto-variacoes-api'
import { ProdutoVariacoesEditor } from '../components/ProdutoVariacoesEditor'

const MAX_LOJA_ONLINE_MIDIAS_EXTRAS = 8

type LojaOnlineMidiaDraft = LojaOnlineMidia & { id: string }

function newMidiaDraftId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function toMidiaDrafts(items: LojaOnlineMidia[]): LojaOnlineMidiaDraft[] {
  return items.map((item) => ({ ...item, id: newMidiaDraftId() }))
}

type ProdutoComImagensLoja = Produto & {
  loja_online_imagens_json?: string | null
  loja_online_card_json?: string | null
  loja_online_preco_de?: number | null
  produto_pai_id?: string | null
  variacao_eixos_json?: string | null
  variacao_valores_json?: string | null
}

function produtoTemEixosVariacao(p: Produto): boolean {
  return parseVariacaoEixos((p as ProdutoComImagensLoja).variacao_eixos_json).length > 0
}

function labelVariacaoFilho(pai: Produto, filho: ProdutoVariacaoRow): string {
  const eixos = parseVariacaoEixos((pai as ProdutoComImagensLoja).variacao_eixos_json)
  const valores = parseVariacaoValores(filho.variacao_valores_json)
  const label = eixos.length > 0 ? labelCombinacao(eixos, valores) : ''
  if (label) return label
  const nomePai = pai.nome.trim()
  const nomeFilho = filho.nome.trim()
  if (nomePai && nomeFilho.startsWith(nomePai)) {
    const rest = nomeFilho.slice(nomePai.length).replace(/^[\s—\-–:]+/, '').trim()
    if (rest) return rest
  }
  return nomeFilho || 'Variação'
}

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
  const editandoCapa = Boolean(editing && isCapaCustomProduto(editing as ProdutoComImagensLoja))
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
    loja_online: 0,
    loja_online_destaque: 0,
    loja_online_destaque_ordem: 0,
    loja_online_preco_de: '',
    peso_kg: '',
    altura_cm: '',
    largura_cm: '',
    comprimento_cm: '',
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
  const [lojaOnlineMidias, setLojaOnlineMidias] = useState<LojaOnlineMidiaDraft[]>([])
  const [lojaOnlineTags, setLojaOnlineTags] = useState<LojaOnlineProdutoTagId[]>([])
  const [lojaOnlineAviso, setLojaOnlineAviso] = useState('')
  const [lojaOnlineAvisoTitulo, setLojaOnlineAvisoTitulo] = useState('Atenção')
  const [lojaOnlineCardJson, setLojaOnlineCardJson] = useState<string | null>(null)
  const [lojaOnlineColecoes, setLojaOnlineColecoes] = useState<LojaOnlineColecao[]>([])
  const [lojaOnlineColecaoIds, setLojaOnlineColecaoIds] = useState<string[]>([])
  const [midiaDraggingId, setMidiaDraggingId] = useState<string | null>(null)
  const midiaDragFromIdRef = useRef<string | null>(null)
  const midiaDragOverIdRef = useRef<string | null>(null)
  const [lojaOnlineMidiaUrl, setLojaOnlineMidiaUrl] = useState('')
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [variacaoEixos, setVariacaoEixos] = useState<VariacaoEixo[]>([])
  const [variacaoSkus, setVariacaoSkus] = useState<VariacaoSkuDraft[]>([])
  const [expandedVariacaoIds, setExpandedVariacaoIds] = useState<Set<string>>(new Set())
  const [filhosByParent, setFilhosByParent] = useState<Record<string, ProdutoVariacaoRow[]>>({})
  const [filhosLoadingIds, setFilhosLoadingIds] = useState<Set<string>>(new Set())
  const midiasSnapshotRef = useRef('')
  const variacoesSnapshotRef = useRef('')
  const descricaoTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  const snapshotMidias = (imagem: string, midias: Array<Pick<LojaOnlineMidia, 'tipo' | 'url'>>) =>
    JSON.stringify({
      imagem: imagem.trim(),
      midias: serializeLojaOnlineMidiasExtras(midias, imagem) ?? '',
    })

  const snapshotVariacoes = (eixos: VariacaoEixo[], skus: VariacaoSkuDraft[]) =>
    JSON.stringify({
      eixos,
      skus: skus.map((s) => ({
        chave: s.chave,
        ativo: s.ativo,
        sku: s.sku,
        codigo_barras: s.codigo_barras,
        preco: s.preco,
        estoque: s.estoque,
        valores: s.valores,
      })),
    })

  const list = useMemo(() => {
    // SKUs filhos ficam aninhados sob o pai (expansível), não na lista principal
    const roots = catalogo.filter((p) => !(p as ProdutoComImagensLoja).produto_pai_id)
    const t = search.trim().toLowerCase()
    if (!t) return roots
    return roots.filter((p) => {
      const cat = p.categoria_id ? (categoriaPathMap.get(p.categoria_id) ?? '') : ''
      const marca = p.marca_id ? (marcas.find((m) => m.id === p.marca_id)?.nome ?? '') : ''
      const forn = p.fornecedor_id
        ? (fornecedores.find((f) => f.value === p.fornecedor_id)?.label ?? '')
        : ''
      const filhos = filhosByParent[p.id] ?? []
      const filhoMatch = filhos.some(
        (f) =>
          f.nome.toLowerCase().includes(t) ||
          (f.sku?.toLowerCase().includes(t) ?? false) ||
          labelVariacaoFilho(p, f).toLowerCase().includes(t)
      )
      return (
        filhoMatch ||
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
  }, [catalogo, search, categoriaPathMap, marcas, fornecedores, filhosByParent])

  const filhosNoCatalogo = useMemo(() => {
    const map = new Map<string, Produto[]>()
    for (const p of catalogo) {
      const paiId = (p as ProdutoComImagensLoja).produto_pai_id
      if (!paiId) continue
      const arr = map.get(paiId) ?? []
      arr.push(p)
      map.set(paiId, arr)
    }
    return map
  }, [catalogo])

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
        setFilhosByParent({})
        setExpandedVariacaoIds(new Set())
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

  useEffect(() => {
    if (!empresaId) {
      setLojaOnlineColecoes([])
      return
    }
    let cancelled = false
    fetchLojaOnlineColecoes(empresaId)
      .then((list) => {
        if (!cancelled) setLojaOnlineColecoes(list)
      })
      .catch(() => {
        if (!cancelled) setLojaOnlineColecoes([])
      })
    return () => {
      cancelled = true
    }
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
      loja_online: 0,
      loja_online_destaque: 0,
      loja_online_destaque_ordem: 0,
      loja_online_preco_de: '',
      peso_kg: '',
      altura_cm: '',
      largura_cm: '',
      comprimento_cm: '',
      estoque_atual: 0,
      permitir_resgate_cashback_no_produto: 1,
      cashback_observacao: '',
    })
    setSaldoInicialEdit(null)
    setError('')
    setFormTab('info')
    setNcmDropdownOpen(false)
    setNcmSuggestions([])
    setLojaOnlineMidias([])
    setLojaOnlineTags([])
    setLojaOnlineAviso('')
    setLojaOnlineAvisoTitulo('Atenção')
    setLojaOnlineCardJson(null)
    setLojaOnlineColecaoIds([])
    setLojaOnlineMidiaUrl('')
    setVariacaoEixos([])
    setVariacaoSkus([])
    midiasSnapshotRef.current = snapshotMidias('', [])
    variacoesSnapshotRef.current = snapshotVariacoes([], [])
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
      descricao: p.descricao ?? '',
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
      loja_online_preco_de:
        (p as ProdutoComImagensLoja).loja_online_preco_de != null &&
        Number((p as ProdutoComImagensLoja).loja_online_preco_de) > 0
          ? String((p as ProdutoComImagensLoja).loja_online_preco_de)
          : '',
      peso_kg: p.peso_kg != null && p.peso_kg > 0 ? String(p.peso_kg) : '',
      altura_cm: p.altura_cm != null && p.altura_cm > 0 ? String(p.altura_cm) : '',
      largura_cm: p.largura_cm != null && p.largura_cm > 0 ? String(p.largura_cm) : '',
      comprimento_cm: p.comprimento_cm != null && p.comprimento_cm > 0 ? String(p.comprimento_cm) : '',
      estoque_atual: saldosMap.get(p.id) ?? 0,
      permitir_resgate_cashback_no_produto: p.permitir_resgate_cashback_no_produto ?? 1,
      cashback_observacao: toCaixaAlta(p.cashback_observacao ?? ''),
    })
    setSaldoInicialEdit(saldosMap.get(p.id) ?? 0)
    setNextCodigo(p.codigo ?? null)
    setLojaOnlineMidias(
      toMidiaDrafts(
        parseLojaOnlineMidiasExtras(
          (p as ProdutoComImagensLoja).loja_online_imagens_json,
          p.imagem
        )
      )
    )
    const cardJson = (p as ProdutoComImagensLoja).loja_online_card_json ?? null
    const cardMeta = parseLojaOnlineCardMeta(cardJson)
    setLojaOnlineCardJson(cardJson)
    setLojaOnlineTags(cardMeta?.tags ?? [])
    setLojaOnlineAviso(cardMeta?.aviso ?? '')
    setLojaOnlineAvisoTitulo(cardMeta?.avisoTitulo?.trim() || 'Atenção')
    setLojaOnlineColecaoIds([])
    setLojaOnlineMidiaUrl('')
    setVariacaoEixos(parseVariacaoEixos((p as ProdutoComImagensLoja).variacao_eixos_json))
    setVariacaoSkus([])
    midiasSnapshotRef.current = snapshotMidias(
      p.imagem ?? '',
      parseLojaOnlineMidiasExtras((p as ProdutoComImagensLoja).loja_online_imagens_json, p.imagem)
    )
    variacoesSnapshotRef.current = snapshotVariacoes(
      parseVariacaoEixos((p as ProdutoComImagensLoja).variacao_eixos_json),
      []
    )
    void fetchLojaOnlineColecaoIdsByProduto(p.id)
      .then(setLojaOnlineColecaoIds)
      .catch(() => setLojaOnlineColecaoIds([]))
  }

  const openEdit = (p: Produto) => {
    const seq = ++editLoadSeq.current
    const imagemLista = p.imagem ?? ''
    const extrasLista = parseLojaOnlineMidiasExtras(
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
      setLojaOnlineMidias((current) => {
        const unchanged =
          current.length === extrasLista.length &&
          current.every((item, i) => item.url === extrasLista[i]?.url && item.tipo === extrasLista[i]?.tipo)
        if (!unchanged) return current
        const next = toMidiaDrafts(
          parseLojaOnlineMidiasExtras(
            (full as ProdutoComImagensLoja).loja_online_imagens_json,
            full.imagem
          )
        )
        midiasSnapshotRef.current = snapshotMidias(full.imagem ?? '', next)
        return next
      })
      {
        const cardJson = (full as ProdutoComImagensLoja).loja_online_card_json ?? null
        const cardMeta = parseLojaOnlineCardMeta(cardJson)
        setLojaOnlineCardJson(cardJson)
        setLojaOnlineTags(cardMeta?.tags ?? [])
        setLojaOnlineAviso(cardMeta?.aviso ?? '')
        setLojaOnlineAvisoTitulo(cardMeta?.avisoTitulo?.trim() || 'Atenção')
        const precoDe = (full as ProdutoComImagensLoja).loja_online_preco_de
        setForm((prev) => ({
          ...prev,
          loja_online_preco_de:
            precoDe != null && Number(precoDe) > 0 ? String(precoDe) : prev.loja_online_preco_de,
        }))
      }
      setVariacaoEixos(parseVariacaoEixos((full as ProdutoComImagensLoja).variacao_eixos_json))
      void fetchProdutoVariacoesFilhos(full.id)
        .then((filhos) => {
          if (editLoadSeq.current !== seq) return
          const eixos = parseVariacaoEixos((full as ProdutoComImagensLoja).variacao_eixos_json)
          const skus = mergeSkusComCombinacoes(eixos, filhosParaSkus(filhos), full.preco)
          setVariacaoSkus(skus)
          variacoesSnapshotRef.current = snapshotVariacoes(eixos, skus)
        })
        .catch(() => {})
    })
  }

  const handleDuplicate = async (p: Produto) => {
    if (!empresaId || duplicatingId) return
    if (p.sku === '__AGILIZA_NFE_AVULSA__') {
      op.error('Produto interno do sistema não pode ser duplicado.')
      return
    }
    if (isCapaCustomProduto(p as ProdutoComImagensLoja)) {
      op.error('A capa personalizada não pode ser duplicada. Gerencie em Loja online → Capa personalizada.')
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
        descricao: full.descricao || undefined,
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
          serializeLojaOnlineMidiasExtras(
            parseLojaOnlineMidiasExtras(
              (full as ProdutoComImagensLoja).loja_online_imagens_json,
              full.imagem
            ),
            full.imagem
          ) ?? undefined,
        cashback_ativo: full.cashback_ativo ?? 1,
        cashback_percentual: full.cashback_percentual ?? null,
        permitir_resgate_cashback_no_produto: full.permitir_resgate_cashback_no_produto ?? 1,
        cashback_observacao: full.cashback_observacao ? toCaixaAlta(full.cashback_observacao) : null,
        peso_kg: full.peso_kg ?? null,
        altura_cm: full.altura_cm ?? null,
        largura_cm: full.largura_cm ?? null,
        comprimento_cm: full.comprimento_cm ?? null,
      })

      const eixosJson = (full as ProdutoComImagensLoja).variacao_eixos_json
      const temEixos = parseVariacaoEixos(eixosJson).length > 0
      let qtdVariacoes = 0
      if (temEixos || (await fetchProdutoVariacoesFilhos(full.id)).length > 0) {
        qtdVariacoes = await copyProdutoVariacoes({
          fromParentId: full.id,
          eixosJson,
          toParent: {
            id: created.id,
            empresa_id: empresaId,
            nome: created.nome,
            custo: created.custo,
            markup: created.markup,
            unidade: created.unidade,
            controla_estoque: created.controla_estoque === 1 ? 1 : 0,
            estoque_minimo: created.estoque_minimo,
            ncm: created.ncm ?? null,
            cfop: created.cfop ?? null,
            fornecedor_id: created.fornecedor_id ?? null,
            categoria_id: created.categoria_id ?? null,
            marca_id: created.marca_id ?? null,
            descricao: created.descricao ?? null,
            imagem: created.imagem ?? null,
            permitir_resgate_cashback_no_produto: created.permitir_resgate_cashback_no_produto ?? 1,
            cashback_observacao: created.cashback_observacao ?? null,
          },
        })
      }

      op.created(
        qtdVariacoes > 0
          ? `Produto duplicado com ${qtdVariacoes} variação${qtdVariacoes === 1 ? '' : 'ões'}.`
          : 'Produto duplicado.'
      )
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

  const handleProdutoImagemFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget ?? e.target
    const file = input?.files?.[0]
    if (input && 'value' in input) input.value = ''
    if (!file) return
    void readProdutoImagemFile(file)
      .then((data) => {
        updateForm({ imagem: data })
        setError('')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar imagem.')
      })
  }

  const handleLojaOnlineMidiaFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget ?? e.target
    const file = input?.files?.[0]
    if (input && 'value' in input) input.value = ''
    if (!file) return
    if (lojaOnlineMidias.length >= MAX_LOJA_ONLINE_MIDIAS_EXTRAS) {
      setError(`Máximo de ${MAX_LOJA_ONLINE_MIDIAS_EXTRAS} mídias extras para a loja online.`)
      return
    }

    if (isVideoFile(file)) {
      if (!empresaId) {
        setError('Empresa não identificada.')
        return
      }
      setUploadingVideo(true)
      setError('')
      void uploadProdutoVideo({ empresaId, file })
        .then((url) => {
          if (lojaOnlineMidias.some((m) => m.url === url)) {
            setError('Este vídeo já foi adicionado.')
            return
          }
          setLojaOnlineMidias((prev) => [...prev, { id: newMidiaDraftId(), tipo: 'video', url }])
          setError('')
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Erro ao enviar vídeo.')
        })
        .finally(() => setUploadingVideo(false))
      return
    }

    void readProdutoImagemFile(file)
      .then((data) => {
        const main = form.imagem.trim()
        if (main && data === main) {
          setError('Esta imagem já é a principal do produto.')
          return
        }
        if (lojaOnlineMidias.some((m) => m.url === data)) {
          setError('Esta imagem já foi adicionada.')
          return
        }
        setLojaOnlineMidias((prev) => [...prev, { id: newMidiaDraftId(), tipo: 'image', url: data }])
        setError('')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar imagem.')
      })
  }

  const addLojaOnlineMidiaUrl = () => {
    const url = lojaOnlineMidiaUrl.trim()
    if (!url) return
    if (lojaOnlineMidias.length >= MAX_LOJA_ONLINE_MIDIAS_EXTRAS) {
      setError(`Máximo de ${MAX_LOJA_ONLINE_MIDIAS_EXTRAS} mídias extras para a loja online.`)
      return
    }
    const main = form.imagem.trim()
    if (main && url === main) {
      setError('Esta URL já é a imagem principal do produto.')
      return
    }
    if (lojaOnlineMidias.some((m) => m.url === url)) {
      setError('Esta mídia já foi adicionada.')
      return
    }
    setLojaOnlineMidias((prev) => [
      ...prev,
      { id: newMidiaDraftId(), tipo: isLojaOnlineVideoUrl(url) ? 'video' : 'image', url },
    ])
    setLojaOnlineMidiaUrl('')
    setError('')
  }

  const removeLojaOnlineMidia = (id: string) => {
    setLojaOnlineMidias((prev) => prev.filter((item) => item.id !== id))
  }

  const moveMidiaBefore = (fromId: string, toId: string) => {
    if (fromId === toId) return
    setLojaOnlineMidias((prev) => {
      const from = prev.findIndex((item) => item.id === fromId)
      if (from < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      if (!moved) return prev
      const to = next.findIndex((item) => item.id === toId)
      if (to < 0) return prev
      next.splice(to, 0, moved)
      return next
    })
  }

  const onMidiaDragStart = (id: string) => (e: React.DragEvent<HTMLDivElement>) => {
    midiaDragFromIdRef.current = id
    midiaDragOverIdRef.current = id
    setMidiaDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/midia-id', id)
    // Evita o browser “clonar” a imagem inteira no ghost (causa visual de duplicata)
    const ghost = document.createElement('div')
    ghost.style.width = '1px'
    ghost.style.height = '1px'
    ghost.style.opacity = '0'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    requestAnimationFrame(() => ghost.remove())
  }

  const onMidiaDragOver = (id: string) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    const fromId = midiaDragFromIdRef.current
    if (!fromId || fromId === id) return
    if (midiaDragOverIdRef.current === id) return
    midiaDragOverIdRef.current = id
    moveMidiaBefore(fromId, id)
  }

  const onMidiaDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    midiaDragFromIdRef.current = null
    midiaDragOverIdRef.current = null
    setMidiaDraggingId(null)
  }

  const onMidiaDragEnd = () => {
    midiaDragFromIdRef.current = null
    midiaDragOverIdRef.current = null
    setMidiaDraggingId(null)
  }

  const applyDescricaoFormat = (mode: 'title' | 'bold') => {
    const el = descricaoTextareaRef.current
    const value = form.descricao
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const result = mode === 'title' ? wrapDescricaoAsTitle(value, start, end) : wrapDescricaoAsBold(value, start, end)
    updateForm({ descricao: result.next })
    requestAnimationFrame(() => {
      const ta = descricaoTextareaRef.current
      if (!ta) return
      ta.focus()
      ta.setSelectionRange(result.cursor, result.cursor)
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
      const midiasJson = serializeLojaOnlineMidiasExtras(lojaOnlineMidias, form.imagem)
      const payload: Record<string, unknown> = {
        nome: toCaixaAlta(form.nome.trim()),
        sku: textoCaixaAltaOuNulo(form.sku),
        codigo_barras: textoCaixaAltaOuNulo(form.codigo_barras),
        fornecedor_id: textoOuNulo(form.fornecedor_id),
        marca_id: textoOuNulo(form.marca_id),
        categoria_id: textoOuNulo(form.categoria_id),
        descricao: textoOuNulo(form.descricao),
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
        loja_online_preco_de: (() => {
          const raw = form.loja_online_preco_de.trim()
          if (!raw) return null
          const n = Number(raw.replace(',', '.'))
          return Number.isFinite(n) && n > 0 ? n : null
        })(),
        loja_online_card_json: mergeLojaOnlineCardMeta(lojaOnlineCardJson, {
          tags: lojaOnlineTags,
          aviso: lojaOnlineAviso,
          avisoTitulo: lojaOnlineAvisoTitulo,
        }),
        peso_kg: form.peso_kg.trim() ? Number(String(form.peso_kg).replace(',', '.')) : null,
        altura_cm: form.altura_cm.trim() ? Number(String(form.altura_cm).replace(',', '.')) : null,
        largura_cm: form.largura_cm.trim() ? Number(String(form.largura_cm).replace(',', '.')) : null,
        comprimento_cm: form.comprimento_cm.trim()
          ? Number(String(form.comprimento_cm).replace(',', '.'))
          : null,
        cashback_ativo: 1,
        cashback_percentual: null,
        permitir_resgate_cashback_no_produto: form.permitir_resgate_cashback_no_produto === 1 ? 1 : 0,
        cashback_observacao: textoCaixaAltaOuNulo(form.cashback_observacao),
      }

      const midiasAtuais = snapshotMidias(form.imagem, lojaOnlineMidias)
      const midiasMudaram = !editing || midiasAtuais !== midiasSnapshotRef.current
      // Em create sempre envia; em edit só reenvia mídia se mudou (base64 deixa o save lento).
      if (!editing || midiasMudaram) {
        payload.imagem = textoOuNulo(form.imagem)
        payload.loja_online_imagens_json = midiasJson
      }

      const estoqueAtualNum = Number(form.estoque_atual)
      const estoqueAtualValido = Number.isFinite(estoqueAtualNum)
      const temVariacoesCadastro =
        variacaoEixos.some((e) => e.nome.trim() && e.valores.some((v) => v.nome.trim())) ||
        variacaoSkus.some((s) => s.ativo)
      const snapshotAtual = snapshotVariacoes(variacaoEixos, variacaoSkus)
      const variacoesMudaram = !editing || snapshotAtual !== variacoesSnapshotRef.current

      const parentSnapshot = (id: string) => ({
        id,
        empresa_id: empresaId,
        nome: String(payload.nome),
        custo: Number(payload.custo) || 0,
        markup: Number(payload.markup) || 0,
        unidade: String(payload.unidade || 'UN'),
        controla_estoque: Number(payload.controla_estoque) || 0,
        estoque_minimo: Number(payload.estoque_minimo) || 0,
        ncm: (payload.ncm as string | null) ?? null,
        cfop: (payload.cfop as string | null) ?? null,
        fornecedor_id: (payload.fornecedor_id as string | null) ?? null,
        categoria_id: (payload.categoria_id as string | null) ?? null,
        marca_id: (payload.marca_id as string | null) ?? null,
        descricao: (payload.descricao as string | null) ?? null,
        imagem: midiasMudaram ? ((payload.imagem as string | null) ?? null) : (editing?.imagem ?? null),
        permitir_resgate_cashback_no_produto: Number(payload.permitir_resgate_cashback_no_produto) || 0,
        cashback_observacao: (payload.cashback_observacao as string | null) ?? null,
      })

      if (editing && editandoCapa) {
        // Modelos, preços e estoque da capa são gravados só pela tela Loja online → Capa personalizada.
        delete payload.preco
        delete payload.controla_estoque
        await window.electronAPI.produtos.update(editing.id, payload as Parameters<typeof window.electronAPI.produtos.update>[1])
        if (form.loja_online === 1) {
          await setLojaOnlineProdutoColecoes(editing.id, lojaOnlineColecaoIds)
        }
        op.saved('Produto atualizado com sucesso.')
      } else if (editing) {
        await window.electronAPI.produtos.update(editing.id, payload as Parameters<typeof window.electronAPI.produtos.update>[1])
        if (form.controla_estoque === 1 && variacaoSkus.length === 0 && saldoInicialEdit !== null && estoqueAtualValido && estoqueAtualNum !== saldoInicialEdit) {
          await window.electronAPI.estoque.ajustarSaldoPara(empresaId, editing.id, estoqueAtualNum)
        }
        // Inclui o caso de zerar todas as variações (antes o save era pulado e elas voltavam).
        if (variacoesMudaram) {
          await saveProdutoVariacoes({
            parent: parentSnapshot(editing.id),
            eixos: variacaoEixos,
            skus: variacaoSkus,
          })
        }
        if (form.loja_online === 1) {
          await setLojaOnlineProdutoColecoes(editing.id, lojaOnlineColecaoIds)
        }
        op.saved('Produto atualizado com sucesso.')
      } else {
        const created = await window.electronAPI.produtos.create({
          empresa_id: empresaId,
          ...(payload as Omit<Parameters<typeof window.electronAPI.produtos.create>[0], 'empresa_id'>),
        })
        if (form.controla_estoque === 1 && variacaoSkus.length === 0 && estoqueAtualValido && estoqueAtualNum !== 0) {
          await window.electronAPI.estoque.ajustarSaldoPara(empresaId, created.id, estoqueAtualNum)
        }
        if (temVariacoesCadastro) {
          await saveProdutoVariacoes({
            parent: parentSnapshot(created.id),
            eixos: variacaoEixos,
            skus: variacaoSkus,
          })
        }
        if (form.loja_online === 1 && lojaOnlineColecaoIds.length > 0) {
          await setLojaOnlineProdutoColecoes(created.id, lojaOnlineColecaoIds)
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
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Erro ao salvar.'
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

  const toggleExpandVariacoes = async (pai: Produto) => {
    const id = pai.id
    const closing = expandedVariacaoIds.has(id)
    setExpandedVariacaoIds((prev) => {
      const next = new Set(prev)
      if (closing) next.delete(id)
      else next.add(id)
      return next
    })
    if (closing || filhosByParent[id]) return

    const fromCatalog = filhosNoCatalogo.get(id)
    if (fromCatalog && fromCatalog.length > 0) {
      setFilhosByParent((prev) => ({
        ...prev,
        [id]: fromCatalog.map((f) => ({
          id: f.id,
          nome: f.nome,
          sku: f.sku,
          preco: f.preco,
            estoque_atual: saldosMap.get(f.id) ?? (Number((f as Produto & { estoque_atual?: number }).estoque_atual) || 0),
          ativo: f.ativo,
          imagem: f.imagem,
          controla_estoque: f.controla_estoque,
          unidade: f.unidade,
          variacao_chave: (f as ProdutoComImagensLoja & { variacao_chave?: string | null }).variacao_chave ?? null,
          variacao_valores_json: (f as ProdutoComImagensLoja).variacao_valores_json ?? null,
          produto_pai_id: id,
        })),
      }))
      return
    }

    setFilhosLoadingIds((prev) => new Set(prev).add(id))
    try {
      const filhos = await fetchProdutoVariacoesFilhos(id)
      setFilhosByParent((prev) => ({ ...prev, [id]: filhos }))
    } catch (err: unknown) {
      setExpandedVariacaoIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      op.failed(err, 'Erro ao carregar variações.')
    } finally {
      setFilhosLoadingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
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
            {!editandoCapa && (
              <button type="button" className={`form-tab-btn ${formTab === 'variacoes' ? 'form-tab-btn--active' : ''}`} onClick={() => setFormTab('variacoes')}>
                Variações
              </button>
            )}
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
            {editandoCapa ? (
              <div className="form-section">
                <Alert variant="info">
                  Esta é a <strong>capa personalizada</strong>. Os modelos visíveis, preços e estoque de cada modelo são editados em{' '}
                  <Link to="/loja-online/capas">Loja online → Capa personalizada</Link>. Aqui você edita nome, fotos, categoria, dados da
                  loja e fiscais.
                </Alert>
              </div>
            ) : (
            <>
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
                  disabled={form.controla_estoque !== 1 || variacaoSkus.length > 0}
                  hint={
                    variacaoSkus.length > 0
                      ? 'O saldo fica na aba Variações, por combinação (marca/modelo/cor).'
                      : form.controla_estoque !== 1
                        ? 'Ative "Controla estoque" para informar'
                        : 'Ao salvar, o saldo será ajustado para este valor'
                  }
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
            </>
            )}
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

                  <h3 className="form-section-title" style={{ marginTop: 28 }}>Coleções</h3>
                  <p className="input-hint" style={{ marginBottom: 12 }}>
                    Escolha em quais coleções este produto aparece na loja. Gerencie as coleções em{' '}
                    <Link to="/loja-online/colecoes">Loja online → Coleções</Link>.
                  </p>
                  {lojaOnlineColecoes.length === 0 ? (
                    <p className="input-hint">
                      Nenhuma coleção cadastrada ainda. Crie em Loja online → Coleções.
                    </p>
                  ) : (
                    <div className="form-produto-loja-tags" role="group" aria-label="Coleções do produto">
                      {lojaOnlineColecoes.map((colecao) => {
                        const checked = lojaOnlineColecaoIds.includes(colecao.id)
                        return (
                          <label
                            key={colecao.id}
                            className={`form-produto-loja-tag${checked ? ' is-active' : ''}${Number(colecao.ativo) !== 1 ? ' is-inactive' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setLojaOnlineColecaoIds((prev) =>
                                  checked
                                    ? prev.filter((id) => id !== colecao.id)
                                    : [...prev, colecao.id]
                                )
                              }}
                            />
                            <span>
                              {colecao.nome}
                              {Number(colecao.ativo) !== 1 ? ' (inativa)' : ''}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}

                  <h3 className="form-section-title" style={{ marginTop: 28 }}>Tags do card</h3>
                  <p className="input-hint" style={{ marginBottom: 12 }}>
                    Selos na foto do produto na vitrine (mais vendido, novo, promoção…). Máximo recomendado: 2–3.
                  </p>
                  <div className="form-produto-loja-tags" role="group" aria-label="Tags do card">
                    {LOJA_ONLINE_PRODUTO_TAGS.map((tag) => {
                      const checked = lojaOnlineTags.includes(tag.id)
                      return (
                        <label
                          key={tag.id}
                          className={`form-produto-loja-tag${checked ? ' is-active' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setLojaOnlineTags((prev) =>
                                checked ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                              )
                            }}
                          />
                          <span className={`loja-galaxy-card-tag loja-galaxy-card-tag--${tag.tone}`}>
                            {tag.label}
                          </span>
                        </label>
                      )
                    })}
                  </div>

                  <div style={{ marginTop: 20, maxWidth: 240 }}>
                    <Input
                      label="Preço anterior (de/por)"
                      inputMode="decimal"
                      value={form.loja_online_preco_de}
                      onChange={(e) => updateForm({ loja_online_preco_de: e.currentTarget.value })}
                      placeholder="Ex.: 199,90"
                      hint="Se maior que o preço de venda, aparece riscado e a tag Promoção."
                    />
                  </div>

                  <h3 className="form-section-title" style={{ marginTop: 28 }}>Aviso na página do produto</h3>
                  <p className="input-hint" style={{ marginBottom: 12 }}>
                    Banner em destaque na página do produto (ex.: personalização, prazo, contato após a compra). Deixe em branco para ocultar.
                  </p>
                  <div style={{ maxWidth: 420, marginBottom: 12 }}>
                    <Input
                      label="Título do aviso"
                      value={lojaOnlineAvisoTitulo}
                      onChange={(e) => setLojaOnlineAvisoTitulo(e.currentTarget.value)}
                      placeholder="Atenção"
                    />
                  </div>
                  <div className="input-wrap" style={{ maxWidth: 560 }}>
                    <label className="input-label" htmlFor="produto-loja-aviso">Texto do aviso</label>
                    <textarea
                      id="produto-loja-aviso"
                      className="input-el"
                      rows={3}
                      value={lojaOnlineAviso}
                      onChange={(e) => setLojaOnlineAviso(e.currentTarget.value)}
                      placeholder="Após a compra, nossa equipe entrará em contato para enviar a imagem e personalizar a capa."
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                  </div>

                  <h3 className="form-section-title" style={{ marginTop: 28 }}>Frete e embalagem</h3>
                  <p className="input-hint" style={{ marginBottom: 12 }}>
                    Usado na cotação PAC/SEDEX (Melhor Envio). Se vazio, a loja usa o peso e as medidas padrão de Entrega e frete.
                  </p>
                  <div className="form-grid form-grid-2">
                    <Input
                      label="Peso do pacote (kg)"
                      inputMode="decimal"
                      value={form.peso_kg}
                      onChange={(e) => updateForm({ peso_kg: e.currentTarget.value })}
                      placeholder="Ex.: 0.3"
                      hint="Peso com embalagem"
                    />
                    <Input
                      label="Altura (cm)"
                      inputMode="decimal"
                      value={form.altura_cm}
                      onChange={(e) => updateForm({ altura_cm: e.currentTarget.value })}
                      placeholder="Ex.: 5"
                    />
                    <Input
                      label="Largura (cm)"
                      inputMode="decimal"
                      value={form.largura_cm}
                      onChange={(e) => updateForm({ largura_cm: e.currentTarget.value })}
                      placeholder="Ex.: 15"
                    />
                    <Input
                      label="Comprimento (cm)"
                      inputMode="decimal"
                      value={form.comprimento_cm}
                      onChange={(e) => updateForm({ comprimento_cm: e.currentTarget.value })}
                      placeholder="Ex.: 20"
                    />
                  </div>
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
                Usada no PDV, na lista de produtos e como primeira foto na loja online. Envie PNG, JPG, WebP ou HEIC (até {MAX_PRODUTO_IMAGEM_BYTES / (1024 * 1024)} MB) ou informe uma URL.
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
                      accept={PRODUTO_IMAGEM_ACCEPT}
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
              <h3 className="form-section-title">Galeria da loja online</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: '0 0 16px' }}>
                Fotos e vídeos extras na página do produto. A imagem principal acima sempre aparece em primeiro;
                aqui você adiciona ângulos, detalhes ou vídeos (MP4, MOV, WebM etc., até {MAX_PRODUTO_VIDEO_BYTES / (1024 * 1024)} MB;
                no máximo {MAX_LOJA_ONLINE_MIDIAS_EXTRAS} mídias). Arraste para mudar a ordem de exibição no site.
              </p>

              {lojaOnlineMidias.length > 0 ? (
                <div className="form-produto-loja-imagens-grid" role="list" aria-label="Galeria — arraste para reordenar">
                  {lojaOnlineMidias.map((item, index) => (
                    <div
                      key={item.id}
                      role="listitem"
                      className={`form-produto-loja-imagem-item${midiaDraggingId === item.id ? ' is-dragging' : ''}`}
                      draggable
                      onDragStart={onMidiaDragStart(item.id)}
                      onDragOver={onMidiaDragOver(item.id)}
                      onDrop={onMidiaDrop}
                      onDragEnd={onMidiaDragEnd}
                      title="Arraste para reordenar"
                    >
                      <span className="form-produto-loja-imagem-drag" aria-hidden>
                        <GripVertical size={14} />
                      </span>
                      <span className="form-produto-loja-imagem-ordem" aria-hidden>
                        {index + 1}
                      </span>
                      <div className="form-produto-loja-imagem-preview">
                        {item.tipo === 'video' ? (
                          <video src={item.url} muted playsInline preload="metadata" draggable={false} />
                        ) : (
                          <img src={item.url} alt="" loading="lazy" decoding="async" draggable={false} />
                        )}
                        {item.tipo === 'video' ? (
                          <span className="form-produto-loja-imagem-badge">Vídeo</span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="form-produto-loja-imagem-remove"
                        onClick={() => removeLojaOnlineMidia(item.id)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onDragStart={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        aria-label={`Remover ${item.tipo === 'video' ? 'vídeo' : 'imagem'} ${index + 1}`}
                        title="Remover"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="input-hint" style={{ margin: '0 0 16px' }}>
                  Nenhuma mídia extra cadastrada.
                </p>
              )}

              <div className="form-produto-loja-imagens-actions">
                <label
                  className={`btn btn--secondary btn--md${lojaOnlineMidias.length >= MAX_LOJA_ONLINE_MIDIAS_EXTRAS || uploadingVideo ? ' btn--disabled' : ''}`}
                  style={{
                    cursor:
                      lojaOnlineMidias.length >= MAX_LOJA_ONLINE_MIDIAS_EXTRAS || uploadingVideo
                        ? 'not-allowed'
                        : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    width: 'fit-content',
                    opacity: lojaOnlineMidias.length >= MAX_LOJA_ONLINE_MIDIAS_EXTRAS || uploadingVideo ? 0.6 : 1,
                  }}
                >
                  <input
                    type="file"
                    accept={PRODUTO_MIDIA_ACCEPT}
                    onChange={handleLojaOnlineMidiaFile}
                    disabled={lojaOnlineMidias.length >= MAX_LOJA_ONLINE_MIDIAS_EXTRAS || uploadingVideo}
                    style={{ display: 'none' }}
                  />
                  <Upload size={18} />
                  {uploadingVideo ? 'Enviando vídeo...' : 'Adicionar foto ou vídeo'}
                </label>
              </div>

              <div className="form-produto-inline-actions" style={{ marginTop: 16 }}>
                <Input
                  label="Ou URL da foto/vídeo"
                  value={lojaOnlineMidiaUrl}
                  onChange={(e) => setLojaOnlineMidiaUrl(e.currentTarget.value)}
                  placeholder="https://..."
                  disabled={lojaOnlineMidias.length >= MAX_LOJA_ONLINE_MIDIAS_EXTRAS || uploadingVideo}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addLojaOnlineMidiaUrl}
                  disabled={
                    !lojaOnlineMidiaUrl.trim() ||
                    lojaOnlineMidias.length >= MAX_LOJA_ONLINE_MIDIAS_EXTRAS ||
                    uploadingVideo
                  }
                >
                  Adicionar URL
                </Button>
              </div>
            </div>
          </div>

          {/* Aba: Variações */}
          <div className={`form-tab-panel ${formTab === 'variacoes' ? 'form-tab-panel--active' : ''}`}>
            <div className="form-section">
              <h3 className="form-section-title">Opções e estoque por combinação</h3>
              {formTab === 'variacoes' && (
                <ProdutoVariacoesEditor
                  eixos={variacaoEixos}
                  skus={variacaoSkus}
                  precoPadrao={form.preco}
                  onChange={({ eixos, skus }) => {
                    setVariacaoEixos(eixos)
                    setVariacaoSkus(skus)
                  }}
                />
              )}
            </div>
          </div>

          {/* Aba: Detalhes */}
          <div className={`form-tab-panel ${formTab === 'detalhes' ? 'form-tab-panel--active' : ''}`}>
            <div className="form-section">
              <h3 className="form-section-title">Descrição</h3>
              <div className="input-wrap">
                <label className="input-label" htmlFor="produto-descricao">Descrição detalhada</label>
                <div className="form-produto-descricao-toolbar" role="toolbar" aria-label="Formatação da descrição">
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyDescricaoFormat('title')}
                    title="Transforma a linha (ou o texto selecionado) em título em negrito"
                  >
                    <Heading2 size={16} />
                    Título
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyDescricaoFormat('bold')}
                    title="Deixa o trecho selecionado em negrito"
                  >
                    <Bold size={16} />
                    Negrito
                  </button>
                </div>
                <textarea
                  id="produto-descricao"
                  ref={descricaoTextareaRef}
                  className="input-el"
                  value={form.descricao}
                  onChange={(e) => updateForm({ descricao: e.currentTarget.value })}
                  rows={8}
                  placeholder={'Exemplo:\n## Características\nTecido leve e confortável.\n\n## Medidas\nAltura 30 cm.'}
                  style={{ width: '100%', resize: 'vertical', minHeight: 160 }}
                />
                <p className="input-hint" style={{ marginTop: 8 }}>
                  Use o botão <strong>Título</strong> para criar um subtítulo em negrito na loja. Você também pode escrever <code>## Meu título</code> ou <code>**negrito**</code>.
                </p>
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
        <div className="grid-mobile-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
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
              const temVariacoes = produtoTemEixosVariacao(p) || (filhosNoCatalogo.get(p.id)?.length ?? 0) > 0
              const expanded = expandedVariacaoIds.has(p.id)
              const filhos = filhosByParent[p.id] ?? []
              const loadingFilhos = filhosLoadingIds.has(p.id)
              const filhosCount = filhos.length || filhosNoCatalogo.get(p.id)?.length || 0

              return (
                <Fragment key={p.id}>
                  <tr className={estoqueAlerta && !temVariacoes ? 'produtos-row--estoque-alerta' : undefined}>
                    <td><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                    <td className="produtos-td-thumb">
                      <ProdutoListThumb src={p.imagem} />
                    </td>
                    <td>{p.codigo ?? '—'}</td>
                    <td className="produtos-table__nome" title={p.nome}>
                      <span className="produtos-nome-cell">
                        {temVariacoes && (
                          <button
                            type="button"
                            className="produtos-variacao-toggle"
                            onClick={() => void toggleExpandVariacoes(p)}
                            aria-expanded={expanded}
                            title={expanded ? 'Ocultar variações' : 'Mostrar variações'}
                          >
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        )}
                        {Number(p.loja_online) === 1 && (
                          <span className="produtos-badge-online" title="Disponível na loja online" aria-label="Disponível na loja online">
                            <Store size={13} strokeWidth={2} />
                          </span>
                        )}
                        <span className="produtos-nome-text">{p.nome}</span>
                        {isCapaCustomProduto(p as ProdutoComImagensLoja) ? (
                          <span
                            className="produtos-badge-variacoes"
                            title="Modelos, preços e estoque são editados em Loja online → Capa personalizada"
                          >
                            Capa personalizada
                          </span>
                        ) : temVariacoes && (
                          <span className="produtos-badge-variacoes" title="Produto com variações">
                            {filhosCount > 0 ? `${filhosCount} var.` : 'Variações'}
                          </span>
                        )}
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
                    <td className={p.controla_estoque && estoqueAlerta && !temVariacoes ? 'produtos-col-saldo-alerta' : undefined}>
                      {temVariacoes
                        ? (expanded && filhos.length > 0
                          ? filhos.reduce((sum, f) => sum + (Number(f.estoque_atual) || 0), 0)
                          : 'Por SKU')
                        : p.controla_estoque
                          ? saldoLista
                          : '—'}
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

                  {expanded && (
                    <tr className="produtos-row--variacao-panel">
                      <td colSpan={11}>
                        {loadingFilhos ? (
                          <div className="produtos-variacao-panel produtos-variacao-panel--msg">
                            Carregando variações…
                          </div>
                        ) : filhos.length === 0 ? (
                          <div className="produtos-variacao-panel produtos-variacao-panel--msg">
                            Nenhuma variação cadastrada. Abra o produto na aba Variações para criar.
                          </div>
                        ) : (
                          <div className="produtos-variacao-panel">
                            <ul className="produtos-variacao-list">
                              {filhos.map((filho) => {
                                const saldoFilho = saldosMap.get(filho.id) ?? (Number(filho.estoque_atual) || 0)
                                const alertaFilho =
                                  Number(filho.controla_estoque) === 1 &&
                                  (saldoFilho <= 0 || saldoFilho <= (p.estoque_minimo ?? 0))
                                const label = labelVariacaoFilho(p, filho)
                                return (
                                  <li key={filho.id} className="produtos-variacao-item">
                                    <label className="produtos-variacao-check">
                                      <input
                                        type="checkbox"
                                        checked={selectedIds.has(filho.id)}
                                        onChange={() => toggleSelect(filho.id)}
                                      />
                                    </label>
                                    <span className="produtos-variacao-item-nome" title={filho.sku ? `${label} · ${filho.sku}` : label}>
                                      {label}
                                      {filho.sku?.trim() ? (
                                        <span className="produtos-variacao-item-sku">{filho.sku.trim()}</span>
                                      ) : null}
                                    </span>
                                    <span className="produtos-variacao-item-preco">
                                      R$ {Number(filho.preco).toFixed(2)}
                                    </span>
                                    <span
                                      className={`produtos-variacao-item-saldo${alertaFilho ? ' is-alerta' : ''}`}
                                      title="Saldo"
                                    >
                                      {Number(filho.controla_estoque) === 1 ? saldoFilho : '—'}
                                    </span>
                                    <span
                                      className={`produtos-variacao-item-ativo${Number(filho.ativo) === 1 ? '' : ' is-off'}`}
                                    >
                                      {Number(filho.ativo) === 1 ? 'Ativo' : 'Inativo'}
                                    </span>
                                    <span className="produtos-variacao-item-acoes">
                                      <button
                                        type="button"
                                        className="produtos-acao-btn"
                                        onClick={() => openEdit(p)}
                                        title="Editar no produto pai"
                                      >
                                        <Pencil size={14} />
                                        <span className="sr-only">Editar</span>
                                      </button>
                                      <button
                                        type="button"
                                        className="produtos-acao-btn"
                                        onClick={() => openEtiquetasDialog([filho.id])}
                                        disabled={imprimindoEtiquetas}
                                        title="Etiqueta desta variação"
                                      >
                                        <Tag size={14} />
                                        <span className="sr-only">Etiqueta</span>
                                      </button>
                                    </span>
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
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
