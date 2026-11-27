import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { isCapaCustomProduto } from '../capa-custom/lib/capa-catalogo'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useEmpresaTheme } from '../hooks/useEmpresaTheme'
import { isCapaPersonalizadaAtiva } from '../lib/modulos'
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
import { Plus, Pencil, Tag, Package, CheckCircle, XCircle, AlertTriangle, Store, Trash2, CopyPlus, ChevronRight, ChevronDown, ArrowUpDown, Eye } from 'lucide-react'
import {
  parseLojaOnlineMidiasExtras,
  serializeLojaOnlineMidiasExtras,
} from '../lib/loja-online-types'
import {
  filtrarFilhosDaGrade,
  labelCombinacao,
  parseVariacaoEixos,
  parseVariacaoValores,
} from '../lib/produto-variacoes'
import {
  fetchProdutoVariacoesFilhos,
  copyProdutoVariacoes,
  type ProdutoVariacaoRow,
} from '../lib/produto-variacoes-api'

type ProdutoComImagensLoja = Produto & {
  loja_online_imagens_json?: string | null
  loja_online_card_json?: string | null
  loja_online_preco_de?: number | null
  loja_online_selo_preco_pct?: number | null
  produto_pai_id?: string | null
  variacao_eixos_json?: string | null
  variacao_valores_json?: string | null
}

function produtoTemEixosVariacao(p: Produto): boolean {
  return parseVariacaoEixos((p as ProdutoComImagensLoja).variacao_eixos_json).length > 0
}

function filhosVisiveisDoPai<T extends { variacao_chave?: string | null }>(pai: Produto, filhos: T[]): T[] {
  return filtrarFilhosDaGrade(parseVariacaoEixos((pai as ProdutoComImagensLoja).variacao_eixos_json), filhos)
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

function toCaixaAlta(value: string): string {
  return value.toLocaleUpperCase('pt-BR')
}

/** Saldo zero, negativo ou até o mínimo (inclusive) — só quando controla estoque. */
function isProdutoEstoqueCritico(p: Produto, saldo: number): boolean {
  if (p.controla_estoque !== 1) return false
  if (p.alerta_estoque_minimo !== 1) return false
  return saldo <= p.estoque_minimo
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
  const { config: empresaConfig } = useEmpresaTheme()
  const empresaId = session?.empresa_id ?? ''
  const capaPersonalizadaAtiva = isCapaPersonalizadaAtiva(empresaId, empresaConfig?.modulos_json ?? null)
  const syncRefreshKey = useSyncDataRefresh()
  const op = useOperationToast()
  const navigate = useNavigate()
  const [catalogo, setCatalogo] = useState<Produto[]>([])
  const [saldos, setSaldos] = useState<ProdutoSaldo[]>([])
  const [fornecedores, setFornecedores] = useState<{ value: string; label: string }[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [categoriaPathMap, setCategoriaPathMap] = useState<Map<string, string>>(new Map())
  const [search, setSearch] = useState('')
  const [apenasAtivos, setApenasAtivos] = useState(true)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [imprimindoEtiquetas, setImprimindoEtiquetas] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Produto | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [showEtiquetasDialog, setShowEtiquetasDialog] = useState(false)
  const [movEstoque, setMovEstoque] = useState<{
    produto: { id: string; nome: string; unidade?: string | null }
    saldoAtual: number
  } | null>(null)
  const [movTipo, setMovTipo] = useState<'ENTRADA' | 'SAIDA' | 'AJUSTE' | 'DEVOLUCAO'>('ENTRADA')
  const [movQuantidade, setMovQuantidade] = useState('')
  const [movCusto, setMovCusto] = useState('')
  const [movErro, setMovErro] = useState('')
  const [movSalvando, setMovSalvando] = useState(false)
  const [labelTemplates, setLabelTemplates] = useState<LabelTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState('')
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus | null>(null)
  const [labelQuantities, setLabelQuantities] = useState<Record<string, number>>({})
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewInfo, setPreviewInfo] = useState<{ totalLabels: number; language: string } | null>(null)
  const [expandedVariacaoIds, setExpandedVariacaoIds] = useState<Set<string>>(new Set())
  const [filhosByParent, setFilhosByParent] = useState<Record<string, ProdutoVariacaoRow[]>>({})
  const [filhosLoadingIds, setFilhosLoadingIds] = useState<Set<string>>(new Set())
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
      const filhos = filhosVisiveisDoPai(p, filhosByParent[p.id] ?? filhosNoCatalogo.get(p.id) ?? [])
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
  }, [catalogo, search, categoriaPathMap, marcas, fornecedores, filhosByParent, filhosNoCatalogo])

  const loadImagensSeq = useRef(0)

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
        // Pacotes de 16 em paralelo (antes um depois do outro: ~0,3 s cada ida ao banco).
        const lotes: string[][] = []
        for (let i = 0; i < ids.length; i += 16) lotes.push(ids.slice(i, i + 16))
        for (const lote of lotes) {
          void api(lote)
            .then((imagens: Record<string, string | null>) => {
              if (seq !== loadImagensSeq.current) return
              setCatalogo((prev) =>
                prev.map((p) =>
                  Object.prototype.hasOwnProperty.call(imagens, p.id) ? { ...p, imagem: imagens[p.id] } : p
                )
              )
            })
            .catch(() => {})
        }
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
      setCategoriaPathMap(new Map())
      return
    }
    api.listTree(empresaId).then((tree: CategoriaTreeNode[]) => {
      const pathMap = new Map<string, string>()
      function walk(nodes: CategoriaTreeNode[], prefix: string) {
        for (const node of nodes) {
          const path = prefix ? `${prefix} → ${node.nome}` : node.nome
          pathMap.set(node.id, path)
          walk(node.children, path)
        }
      }
      walk(tree ?? [], '')
      setCategoriaPathMap(pathMap)
    }).catch(() => {
      setCategoriaPathMap(new Map())
    })
  }, [empresaId, syncRefreshKey])


  const saldosMap = new Map(saldos.map((s) => [s.produto_id, s.saldo]))


  const openNew = () => {
    navigate('/produtos/novo')
  }

  const openEdit = (p: Produto) => {
    navigate(`/produtos/${p.id}`)
  }

  const handleDuplicate = async (p: Produto) => {
    if (!empresaId || duplicatingId) return
    if (p.sku === '__AGILIZA_NFE_AVULSA__') {
      op.error('Produto interno do sistema não pode ser duplicado.')
      return
    }
    if (capaPersonalizadaAtiva && isCapaCustomProduto(p as ProdutoComImagensLoja)) {
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
        alerta_estoque_minimo: full.alerta_estoque_minimo === 0 ? 0 : 1,
        ncm: full.ncm ?? undefined,
        cfop: full.cfop ? toCaixaAlta(full.cfop) : undefined,
        ativo: full.ativo,
        loja_online: full.loja_online ?? 1,
        loja_online_destaque: full.loja_online_destaque ?? 0,
        loja_online_destaque_ordem: full.loja_online_destaque_ordem ?? 0,
        loja_online_preco_de: (full as ProdutoComImagensLoja).loja_online_preco_de ?? null,
        loja_online_selo_preco_pct: (full as ProdutoComImagensLoja).loja_online_selo_preco_pct ?? null,
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
      navigate(`/produtos/${created.id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao duplicar produto.'
      op.failed(err, 'Erro ao duplicar produto.')
      setError(msg)
    } finally {
      setDuplicatingId(null)
    }
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

  const abrirMovEstoque = (produto: { id: string; nome: string; unidade?: string | null }, saldoAtual: number) => {
    setMovEstoque({ produto, saldoAtual })
    setMovTipo('ENTRADA')
    setMovQuantidade('')
    setMovCusto('')
    setMovErro('')
  }

  const movQtdNumero = Number(movQuantidade.replace(',', '.')) || 0
  const movDelta =
    movTipo === 'AJUSTE' ? movQtdNumero : movTipo === 'SAIDA' ? -Math.abs(movQtdNumero) : Math.abs(movQtdNumero)

  /** Registra o movimento na tabela de movimentos (é o histórico do estoque) e atualiza o saldo. */
  const salvarMovEstoque = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!movEstoque || movSalvando) return
    setMovErro('')
    if (movQtdNumero === 0) {
      setMovErro('Informe a quantidade.')
      return
    }
    const custo = Number(movCusto.replace(',', '.')) || 0
    setMovSalvando(true)
    try {
      await window.electronAPI.estoque.registrarMovimento({
        empresa_id: empresaId,
        produto_id: movEstoque.produto.id,
        tipo: movTipo,
        quantidade: movTipo === 'AJUSTE' ? movQtdNumero : Math.abs(movQtdNumero),
        custo_unitario: custo > 0 ? custo : undefined,
        usuario_id: session?.id ?? undefined,
      })
      op.saved('Movimento de estoque registrado.')
      setMovEstoque(null)
      window.electronAPI.estoque.listSaldos(empresaId).then(setSaldos).catch(() => {})
    } catch (err) {
      op.failed(err, 'Erro ao registrar movimento de estoque.')
      setMovErro(err instanceof Error ? err.message : 'Erro ao registrar movimento.')
    } finally {
      setMovSalvando(false)
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

      <Dialog
        open={movEstoque !== null}
        onClose={() => !movSalvando && setMovEstoque(null)}
        title="Movimentar estoque"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setMovEstoque(null)} disabled={movSalvando}>
              Cancelar
            </Button>
            <Button type="submit" form="form-produtos-mov-estoque" disabled={movSalvando}>
              {movSalvando ? 'Salvando...' : 'Registrar'}
            </Button>
          </>
        }
      >
        {movEstoque && (
          <form id="form-produtos-mov-estoque" onSubmit={salvarMovEstoque}>
            <p style={{ margin: '0 0 var(--space-4)', fontWeight: 600 }}>{movEstoque.produto.nome}</p>
            <div className="form-grid form-grid-2">
              <Select
                label="Tipo"
                value={movTipo}
                onChange={(e) => {
                  const v = e.currentTarget?.value
                  if (v) setMovTipo(v as typeof movTipo)
                }}
                options={[
                  { value: 'ENTRADA', label: 'Entrada' },
                  { value: 'SAIDA', label: 'Saída' },
                  { value: 'AJUSTE', label: 'Ajuste (+ ou -)' },
                  { value: 'DEVOLUCAO', label: 'Devolução' },
                ]}
              />
              <Input
                label={movTipo === 'AJUSTE' ? 'Quantidade (+ ou -)' : 'Quantidade'}
                type="number"
                step="0.01"
                inputMode="decimal"
                autoFocus
                required
                value={movQuantidade}
                onChange={(e) => setMovQuantidade(e.currentTarget.value)}
              />
              {(movTipo === 'ENTRADA' || movTipo === 'DEVOLUCAO') && (
                <Input
                  label="Custo unitário (R$) — opcional"
                  type="number"
                  step="0.01"
                  min={0}
                  inputMode="decimal"
                  value={movCusto}
                  onChange={(e) => setMovCusto(e.currentTarget.value)}
                />
              )}
            </div>
            <p style={{ margin: 'var(--space-4) 0 0', color: 'var(--color-text-secondary)' }}>
              Estoque atual: <strong>{movEstoque.saldoAtual}</strong>
              {movDelta !== 0 && (
                <>
                  {' '}→ depois: <strong>{movEstoque.saldoAtual + movDelta}</strong>
                </>
              )}
              {movEstoque.produto.unidade ? ` ${movEstoque.produto.unidade}` : ''}
            </p>
            <p style={{ margin: 'var(--space-2) 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Fica registrado no histórico de movimentações do estoque.
            </p>
            {movErro && (
              <Alert variant="error" style={{ marginTop: 16 }}>
                {movErro}
              </Alert>
            )}
          </form>
        )}
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
              const filhosGrade = filhosVisiveisDoPai(
                p,
                filhosByParent[p.id] ?? filhosNoCatalogo.get(p.id) ?? []
              )
              const temVariacoes = produtoTemEixosVariacao(p) || filhosGrade.length > 0
              const expanded = expandedVariacaoIds.has(p.id)
              const filhos = expanded ? filhosGrade : []
              const loadingFilhos = filhosLoadingIds.has(p.id)
              const filhosCount = filhosGrade.length

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
                        {capaPersonalizadaAtiva && isCapaCustomProduto(p as ProdutoComImagensLoja) ? (
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
                        <button
                          type="button"
                          className="produtos-acao-btn"
                          onClick={() => navigate(`/produtos/${p.id}/visao`)}
                          title="Visualizar (vendas, margem e estoque)"
                        >
                          <Eye size={15} />
                          <span className="sr-only">Visualizar</span>
                        </button>
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
                          onClick={() => abrirMovEstoque(p, saldoLista)}
                          disabled={p.controla_estoque !== 1}
                          title={p.controla_estoque === 1 ? 'Movimentar estoque' : 'Este produto não controla estoque'}
                        >
                          <ArrowUpDown size={15} />
                          <span className="sr-only">Movimentar estoque</span>
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
                                  p.alerta_estoque_minimo === 1 &&
                                  saldoFilho <= (p.estoque_minimo ?? 0)
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
                                        onClick={() => abrirMovEstoque(filho, saldoFilho)}
                                        disabled={filho.controla_estoque !== 1}
                                        title={filho.controla_estoque === 1 ? 'Movimentar estoque desta variação' : 'Esta variação não controla estoque'}
                                      >
                                        <ArrowUpDown size={14} />
                                        <span className="sr-only">Movimentar estoque</span>
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
