import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useEmpresaTheme } from '../hooks/useEmpresaTheme'
import { useSyncDataRefresh } from '../hooks/useSyncDataRefresh'
import {
  filtrarUsuariosVendedores,
  usuarioLogadoPodeVender,
  usuarioPodeSerVendedor,
} from '../lib/usuario-vendedor'
import { deveEmitirCupomFiscalAutomatico } from '../lib/cupom-fiscal-auto'
import type { Produto, Caixa, Cliente, Usuario, CaixaResumoFechamento, VendaComNfce, VendaDetalhes, EmpresaConfig } from '../vite-env'
import { PageTitle, Button, Alert, Select, Dialog, ConfirmDialog, useOperationToast, Input } from '../components/ui'
import {
  Printer, Search, Package, User, CreditCard, Banknote, QrCode, CircleDollarSign,
  FileCheck, Gift, Calendar, MoreVertical, Plus, X, ShoppingCart, ArrowDownCircle, Receipt,
  Trash2, Pencil, Percent, Lock, Unlock, Eye, Wallet, Check,
} from 'lucide-react'

type ItemEditTipo = 'preco' | 'desconto_pct' | 'desconto_val'

type CartItem = {
  produto_id: string
  codigo_barras: string | null
  descricao: string
  preco_unitario: number
  quantidade: number
  desconto: number
  imagem: string | null
}

type PaymentRow = {
  forma: 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'OUTROS' | 'CASHBACK' | 'A_PRAZO'
  valor: number
}

function addDaysLocal(days: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function getHojeRange(): { dataInicio: string; dataFim: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { dataInicio: start.toISOString(), dataFim: end.toISOString() }
}

function formatMoney(value: number): string {
  return `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`
}

function labelHoje(): string {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

const FORMAS: {
  value: PaymentRow['forma']
  label: string
  icon: React.ReactNode
  shortcut?: string
  tone: 'dinheiro' | 'pix' | 'credito' | 'debito' | 'outros' | 'prazo' | 'cashback'
}[] = [
  { value: 'DINHEIRO', label: 'Dinheiro', icon: <Banknote size={18} strokeWidth={1.75} />, shortcut: 'Alt+1', tone: 'dinheiro' },
  { value: 'PIX', label: 'Pix', icon: <QrCode size={18} strokeWidth={1.75} />, shortcut: 'Alt+2', tone: 'pix' },
  { value: 'CREDITO', label: 'Crédito', icon: <CreditCard size={18} strokeWidth={1.75} />, shortcut: 'Alt+3', tone: 'credito' },
  { value: 'DEBITO', label: 'Débito', icon: <Wallet size={18} strokeWidth={1.75} />, shortcut: 'Alt+4', tone: 'debito' },
  { value: 'OUTROS', label: 'Outros', icon: <CircleDollarSign size={18} strokeWidth={1.75} />, tone: 'outros' },
  { value: 'A_PRAZO', label: 'A prazo', icon: <Calendar size={18} strokeWidth={1.75} />, tone: 'prazo' },
  { value: 'CASHBACK', label: 'Cashback', icon: <Gift size={18} strokeWidth={1.75} />, tone: 'cashback' },
]

const FORMAS_PRINCIPAIS = FORMAS.filter((f) =>
  ['DINHEIRO', 'PIX', 'CREDITO', 'DEBITO'].includes(f.value)
)

function formatCpfCnpj(v: string | null | undefined): string {
  const d = (v ?? '').replace(/\D/g, '')
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return v ?? ''
}

function formatEnderecoCliente(c: Cliente): string {
  const parts = [
    c.endereco_logradouro,
    c.endereco_numero,
    c.endereco_bairro,
    c.endereco_municipio,
  ].filter(Boolean)
  if (parts.length > 0) return parts.join(', ')
  return c.endereco ?? ''
}

function ProdutoPlaceholder({ loading = false }: { loading?: boolean }) {
  return (
    <div className={`pdv-produto-placeholder${loading ? ' pdv-produto-placeholder--loading' : ''}`}>
      <Package size={32} strokeWidth={1.5} />
    </div>
  )
}

function filtrarProdutosCatalogo(list: Produto[], term: string): Produto[] {
  const t = term.trim().toLowerCase()
  if (!t) return list
  return list.filter(
    (p) =>
      p.nome.toLowerCase().includes(t) ||
      (p.sku?.toLowerCase().includes(t) ?? false) ||
      (p.codigo_barras?.includes(t) ?? false) ||
      (p.codigo != null && String(p.codigo).includes(t))
  )
}

const PDV_PANEL_PRODUTOS_LIMITE = 80
const PDV_IMAGEM_LOTE = 16
const PDV_IMAGEM_PREFETCH = 48

export function Pdv() {
  const { session } = useAuth()
  const { config: empresaConfig } = useEmpresaTheme()
  const navigate = useNavigate()
  const empresaId = session?.empresa_id ?? ''
  const userId = session?.id ?? ''
  const sessionRole = session && 'role' in session ? String(session.role) : ''
  const podeOperarVendas = usuarioLogadoPodeVender(sessionRole)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const syncRefreshKey = useSyncDataRefresh()
  const op = useOperationToast()

  const [caixaAberto, setCaixaAberto] = useState<Caixa | null>(null)
  const [catalogo, setCatalogo] = useState<Produto[]>([])
  const [catalogoLoading, setCatalogoLoading] = useState(false)
  const [produtoImagens, setProdutoImagens] = useState<Record<string, string | null>>({})
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [vendedores, setVendedores] = useState<Usuario[]>([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [descontoTotal, setDescontoTotal] = useState(0)
  const [acrescimoTotal, setAcrescimoTotal] = useState(0)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [trocoVenda, setTrocoVenda] = useState(0)
  const [clienteId, setClienteId] = useState<string>('')
  const [vendedorId, setVendedorId] = useState<string>('')
  const [formaPag, setFormaPag] = useState<PaymentRow['forma']>('PIX')
  const [valorPag, setValorPag] = useState('')
  const [clienteSearch, setClienteSearch] = useState('')
  const [cpfBusca, setCpfBusca] = useState('')
  const [observacaoVenda, setObservacaoVenda] = useState('')
  const [mostrarEndereco, setMostrarEndereco] = useState(true)
  const [mostrarObservacao, setMostrarObservacao] = useState(true)
  const [tipoDescAcres, setTipoDescAcres] = useState('desconto_pct')
  const [valorDescAcres, setValorDescAcres] = useState('')
  const [formasExtrasAberto, setFormasExtrasAberto] = useState(false)
  const [pagamentoDrawerAberto, setPagamentoDrawerAberto] = useState(false)
  const clienteSearchRef = useRef<HTMLInputElement>(null)
  const valorPagRef = useRef<HTMLInputElement>(null)
  const vendedorSelectRef = useRef<HTMLSelectElement>(null)
  const [qtyLancar, setQtyLancar] = useState(1)
  const [produtoFoco, setProdutoFoco] = useState<Produto | null>(null)
  const [painelProdutosAberto, setPainelProdutosAberto] = useState(false)
  const [sangriaModalAberto, setSangriaModalAberto] = useState(false)
  const [sangriaValor, setSangriaValor] = useState('')
  const [sangriaMotivo, setSangriaMotivo] = useState('')
  const [sangriaLoading, setSangriaLoading] = useState(false)
  const [sangriaErro, setSangriaErro] = useState('')
  const [vendasDiaModalAberto, setVendasDiaModalAberto] = useState(false)
  const [vendasDia, setVendasDia] = useState<VendaComNfce[]>([])
  const [vendasDiaLoading, setVendasDiaLoading] = useState(false)
  const [searchVendasDia, setSearchVendasDia] = useState('')
  const [vendaDetalheId, setVendaDetalheId] = useState<string | null>(null)
  const [vendaDetalhe, setVendaDetalhe] = useState<VendaDetalhes | null>(null)
  const [vendaDetalheLoading, setVendaDetalheLoading] = useState(false)
  const [itemMenuAbertoId, setItemMenuAbertoId] = useState<string | null>(null)
  const [itemEdit, setItemEdit] = useState<{ produtoId: string; tipo: ItemEditTipo; descricao: string } | null>(null)
  const [itemEditValor, setItemEditValor] = useState('')
  const [searchProdutosPanel, setSearchProdutosPanel] = useState('')

  const produtos = useMemo(
    () => filtrarProdutosCatalogo(catalogo, search),
    [catalogo, search]
  )

  const produtosPanel = useMemo(() => {
    const filtrados = filtrarProdutosCatalogo(catalogo, searchProdutosPanel)
    if (searchProdutosPanel.trim()) return filtrados
    return filtrados.slice(0, PDV_PANEL_PRODUTOS_LIMITE)
  }, [catalogo, searchProdutosPanel])

  const [finalizando, setFinalizando] = useState(false)
  const [erro, setErro] = useState('')
  const [imprimindoId, setImprimindoId] = useState<string | null>(null)
  const [ultimaVendaId, setUltimaVendaId] = useState<string | null>(null)
  const [cupomPreviewModalAberto, setCupomPreviewModalAberto] = useState(false)
  const [ultimaVendaNfceEmitida, setUltimaVendaNfceEmitida] = useState(false)
  const [cupomPreviewHtml, setCupomPreviewHtml] = useState<string | null>(null)
  const [cupomPreviewLoading, setCupomPreviewLoading] = useState(false)
  const [emitindoNfceId, setEmitindoNfceId] = useState<string | null>(null)
  const [nfceModalMessage, setNfceModalMessage] = useState<{
    type: 'success' | 'error' | 'info'
    text: string
  } | null>(null)
  const [fecharCaixaModalAberto, setFecharCaixaModalAberto] = useState(false)
  const [fecharCaixaLoading, setFecharCaixaLoading] = useState(false)
  const [resumoFechamento, setResumoFechamento] = useState<CaixaResumoFechamento | null>(null)
  const [valorCaixaContado, setValorCaixaContado] = useState<string>('')
  const [valorManterProximoCaixa, setValorManterProximoCaixa] = useState<string>('')
  const [usuarioCaixaNome, setUsuarioCaixaNome] = useState<string>('')
  const [confirmarFechamentoCaixa, setConfirmarFechamentoCaixa] = useState(false)
  const [htmlFechamentoCaixa, setHtmlFechamentoCaixa] = useState<string | null>(null)
  const [previewFechamentoAberto, setPreviewFechamentoAberto] = useState(false)
  const [imprimindoFechamento, setImprimindoFechamento] = useState(false)
  const [ultimoCaixaFechadoId, setUltimoCaixaFechadoId] = useState<string | null>(null)
  const [abrirCaixaModalAberto, setAbrirCaixaModalAberto] = useState(false)
  const [valorAberturaPdv, setValorAberturaPdv] = useState<string>('')
  const [abrindoCaixaPdv, setAbrindoCaixaPdv] = useState(false)
  const [confirmarAberturaCaixa, setConfirmarAberturaCaixa] = useState(false)
  const [prazoTipo, setPrazoTipo] = useState<'d15' | 'd30' | 'custom'>('d15')
  const [dataVencimentoCustom, setDataVencimentoCustom] = useState(() => addDaysLocal(15))
  const [configPrazoAberto, setConfigPrazoAberto] = useState(false)
  const [cashbackSaldo, setCashbackSaldo] = useState<{
    saldo_disponivel: number
    prestes_expirar: number
    bloqueado: boolean
  } | null>(null)
  const [cashbackSaldoLoading, setCashbackSaldoLoading] = useState(false)
  /** Após venda OK: ao fechar o modal do cupom, limpa vendedor para a próxima venda. */
  const abrirVendedorAposFecharCupomRef = useRef(false)
  const produtoImagensCarregadasRef = useRef<Set<string>>(new Set())
  const produtoImagensCarregandoRef = useRef<Set<string>>(new Set())

  const carregarImagensProdutos = useCallback((ids: string[]) => {
    const api = window.electronAPI?.produtos?.getImagens
    if (!api) return

    const pendentes = ids.filter(
      (id) =>
        !produtoImagensCarregadasRef.current.has(id) && !produtoImagensCarregandoRef.current.has(id)
    )
    if (pendentes.length === 0) return

    const lotes: string[][] = []
    for (let i = 0; i < pendentes.length; i += PDV_IMAGEM_LOTE) {
      lotes.push(pendentes.slice(i, i + PDV_IMAGEM_LOTE))
    }

    const fetchLote = async (lote: string[]) => {
      lote.forEach((id) => produtoImagensCarregandoRef.current.add(id))
      try {
        const map = await api(lote)
        lote.forEach((id) => {
          produtoImagensCarregadasRef.current.add(id)
          produtoImagensCarregandoRef.current.delete(id)
        })
        setProdutoImagens((prev) => {
          const next = { ...prev }
          for (const id of lote) {
            next[id] = map[id] ?? null
          }
          return next
        })
      } catch {
        lote.forEach((id) => produtoImagensCarregandoRef.current.delete(id))
      }
    }

    void (async () => {
      await fetchLote(lotes[0])
      for (let i = 1; i < lotes.length; i += 2) {
        await Promise.all(lotes.slice(i, i + 2).map((lote) => fetchLote(lote)))
      }
    })()
  }, [])

  const abrirPainelProdutos = useCallback(() => {
    carregarImagensProdutos(
      produtosPanel.length > 0
        ? produtosPanel.map((p) => p.id)
        : catalogo.slice(0, PDV_IMAGEM_PREFETCH).map((p) => p.id)
    )
    setPainelProdutosAberto(true)
  }, [carregarImagensProdutos, produtosPanel, catalogo])

  useEffect(() => {
    if (!empresaId || !window.electronAPI?.caixa) return
    window.electronAPI.caixa.getAberto(empresaId).then(setCaixaAberto).catch(() => setCaixaAberto(null))
  }, [empresaId, syncRefreshKey])

  useEffect(() => {
    const loadUsuarioCaixa = async () => {
      if (!caixaAberto || !window.electronAPI?.usuarios) {
        setUsuarioCaixaNome('')
        return
      }
      try {
        const u = await window.electronAPI.usuarios.get(caixaAberto.usuario_id)
        setUsuarioCaixaNome(u?.nome ?? '')
      } catch {
        setUsuarioCaixaNome('')
      }
    }
    loadUsuarioCaixa()
  }, [caixaAberto])

  // Sugere valor de abertura usando o mesmo valor salvo no fechamento anterior
  useEffect(() => {
    if (!empresaId) return
    try {
      const saved = window.localStorage?.getItem(
        `agiliza:caixa:proximoValorAbertura:${empresaId}`
      )
      const num = saved != null ? Number(saved) : NaN
      if (!Number.isNaN(num) && num > 0) {
        setValorAberturaPdv(num.toFixed(2))
      } else {
        setValorAberturaPdv('')
      }
    } catch {
      setValorAberturaPdv('')
    }
  }, [empresaId])

  useEffect(() => {
    if (!empresaId || !window.electronAPI?.produtos) return
    let cancelled = false
    setCatalogoLoading(true)
    produtoImagensCarregadasRef.current.clear()
    produtoImagensCarregandoRef.current.clear()
    setProdutoImagens({})
    window.electronAPI.produtos
      .list(empresaId, { apenasAtivos: true })
      .then((items) => {
        if (!cancelled) {
          setCatalogo(items)
          carregarImagensProdutos(items.slice(0, PDV_IMAGEM_PREFETCH).map((p) => p.id))
        }
      })
      .catch(() => {
        if (!cancelled) setCatalogo([])
      })
      .finally(() => {
        if (!cancelled) setCatalogoLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [empresaId, syncRefreshKey, carregarImagensProdutos])

  useEffect(() => {
    if (!painelProdutosAberto) return
    carregarImagensProdutos(produtosPanel.map((p) => p.id))
  }, [painelProdutosAberto, produtosPanel, carregarImagensProdutos])

  useEffect(() => {
    if (!vendasDiaModalAberto || !empresaId || !window.electronAPI?.vendas) return
    setVendasDiaLoading(true)
    const { dataInicio, dataFim } = getHojeRange()
    window.electronAPI.vendas
      .list(empresaId, { dataInicio, dataFim, limit: 500 })
      .then(setVendasDia)
      .catch(() => setVendasDia([]))
      .finally(() => setVendasDiaLoading(false))
  }, [vendasDiaModalAberto, empresaId, syncRefreshKey])

  useEffect(() => {
    if (!vendaDetalheId || !window.electronAPI?.cupom?.getDetalhes) {
      setVendaDetalhe(null)
      setVendaDetalheLoading(false)
      return
    }
    setVendaDetalhe(null)
    setVendaDetalheLoading(true)
    window.electronAPI.cupom
      .getDetalhes(vendaDetalheId)
      .then((det) => setVendaDetalhe(det ?? null))
      .catch(() => setVendaDetalhe(null))
      .finally(() => setVendaDetalheLoading(false))
  }, [vendaDetalheId])

  useEffect(() => {
    if (!empresaId) return
    const api = window.electronAPI?.clientes
    if (api) api.list(empresaId).then(setClientes).catch(() => setClientes([]))
    else setClientes([])
  }, [empresaId, syncRefreshKey])

  useEffect(() => {
    if (!empresaId) return
    const api = window.electronAPI?.usuarios
    if (!api?.list) {
      setVendedores([])
      return
    }
    api
      .list(empresaId)
      .then((arr: unknown) => {
        const raw = Array.isArray(arr) ? arr : []
        const items = filtrarUsuariosVendedores(
          raw.filter((u): u is Usuario => u != null && typeof u === 'object') as Usuario[]
        )
        setVendedores(items)
      })
      .catch(() => setVendedores([]))
  }, [empresaId, syncRefreshKey])

  useEffect(() => {
    if (!userId || vendedorId) return
    const eu = vendedores.find((v) => v.id === userId)
    if (eu) setVendedorId(eu.id)
  }, [userId, vendedores, vendedorId])

  const addToCart = useCallback((p: Produto, qty = 1) => {
    const qtyInt = Math.max(1, Math.floor(qty))
    setProdutoFoco(p)
    setCart((prev) => {
      const exist = prev.find((i) => i.produto_id === p.id)
      if (exist) {
        return prev.map((i) =>
          i.produto_id === p.id ? { ...i, quantidade: i.quantidade + qtyInt } : i
        )
      }
      return [
        ...prev,
        {
          produto_id: p.id,
          codigo_barras: p.codigo_barras,
          descricao: p.nome,
          preco_unitario: Number(p.preco) || 0,
          quantidade: qtyInt,
          desconto: 0,
          imagem: p.imagem,
        },
      ]
    })
    setQtyLancar(1)
  }, [])

  const lancarPorBusca = useCallback(() => {
    const termo = search.trim()
    if (!termo || !caixaAberto) return
    const p = produtos[0]
    if (p) {
      addToCart(p, qtyLancar)
      setSearch('')
      searchInputRef.current?.focus()
    }
  }, [search, produtos, qtyLancar, caixaAberto, addToCart])

  const subtotal = cart.reduce(
    (acc, i) => acc + (Number(i.preco_unitario) || 0) * i.quantidade - (Number(i.desconto) || 0),
    0
  )
  const total = subtotal - descontoTotal + acrescimoTotal
  const totalPagamentos = payments.reduce((acc, p) => acc + p.valor, 0)
  const valorRestante = total - totalPagamentos
  const vendaQuitada = valorRestante <= 0.009
  const vendaTemPrazo = payments.some((p) => p.forma === 'A_PRAZO')
  const placeholderValorCampo =
    formaPag === 'DINHEIRO'
      ? 'Quanto o cliente entregou? Ex: 150,00'
      : `R$ ${Math.max(0, valorRestante).toFixed(2).replace('.', ',')}`

  const valorDigitado = Number(String(valorPag).replace(',', '.')) || 0
  const formaPagAtual = FORMAS.find((f) => f.value === formaPag)
  const podeLancarPagamento =
    !vendaQuitada &&
    !vendaTemPrazo &&
    (formaPag === 'A_PRAZO'
      ? !!clienteId && payments.length === 0
      : formaPag === 'DINHEIRO'
        ? valorDigitado > 0
        : valorDigitado > 0)
  const labelLancarPagamento = (() => {
    if (formaPag === 'A_PRAZO') {
      return clienteId
        ? `Registrar venda a prazo — ${formatMoney(total)}`
        : 'Selecione o cliente para venda a prazo'
    }
    if (formaPag === 'DINHEIRO') {
      return valorDigitado > 0
        ? `Confirmar recebimento de ${formatMoney(valorDigitado)}`
        : 'Informe o valor recebido em dinheiro'
    }
    const valorExibir = valorDigitado > 0 ? valorDigitado : Math.max(0, valorRestante)
    return valorDigitado > 0
      ? `Lançar ${formatMoney(valorExibir)} em ${formaPagAtual?.label ?? 'pagamento'}`
      : `Informe o valor para lançar em ${formaPagAtual?.label ?? 'pagamento'}`
  })()

  const descAcresEhPercentual = tipoDescAcres.includes('pct')

  const diferencaCaixa = (() => {
    const esperado = resumoFechamento?.saldo_atual ?? 0
    const contado = Number(String(valorCaixaContado).replace(',', '.')) || 0
    return contado - esperado
  })()

  useEffect(() => {
    if (valorRestante > 0) setValorPag(valorRestante.toFixed(2))
    else setValorPag('')
  }, [total, totalPagamentos])

  useEffect(() => {
    if (!empresaId || !clienteId || !window.electronAPI?.cashback?.getSaldoCliente) {
      setCashbackSaldo(null)
      return
    }
    setCashbackSaldoLoading(true)
    window.electronAPI.cashback
      .getSaldoCliente(empresaId, clienteId)
      .then((r) => {
        const row = r as {
          saldo_disponivel?: number
          prestes_expirar?: number
          bloqueado?: boolean
        } | null
        if (!row) {
          setCashbackSaldo(null)
          return
        }
        setCashbackSaldo({
          saldo_disponivel: Number(row.saldo_disponivel) || 0,
          prestes_expirar: Number(row.prestes_expirar) || 0,
          bloqueado: Boolean(row.bloqueado),
        })
      })
      .catch(() => setCashbackSaldo(null))
      .finally(() => setCashbackSaldoLoading(false))
  }, [empresaId, clienteId])

  useEffect(() => {
    if (!cupomPreviewModalAberto || !ultimaVendaId) return
    let cancelled = false
    setCupomPreviewLoading(true)
    setCupomPreviewHtml(null)
    const load = async () => {
      try {
        let html: string | null | undefined = null
        let nfce = false
        if (window.electronAPI?.cupom?.getHtmlNfce) {
          html = await window.electronAPI.cupom.getHtmlNfce(ultimaVendaId)
          nfce = Boolean(html)
        }
        if (!html && window.electronAPI?.cupom?.getHtml) {
          html = await window.electronAPI.cupom.getHtml(ultimaVendaId)
        }
        if (!cancelled) {
          setCupomPreviewHtml(html ?? '')
          setUltimaVendaNfceEmitida(nfce)
        }
      } finally {
        if (!cancelled) setCupomPreviewLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [cupomPreviewModalAberto, ultimaVendaId, ultimaVendaNfceEmitida])

  const updateCartItem = (produtoId: string, upd: Partial<CartItem>) => {
    setCart((prev) =>
      prev
        .map((i) => (i.produto_id === produtoId ? { ...i, ...upd } : i))
        .filter((i) => i.quantidade > 0)
    )
  }

  const removeFromCart = (produtoId: string) => {
    setCart((prev) => prev.filter((i) => i.produto_id !== produtoId))
    if (itemMenuAbertoId === produtoId) setItemMenuAbertoId(null)
  }

  const abrirEditItem = (item: CartItem, tipo: ItemEditTipo) => {
    setItemMenuAbertoId(null)
    setItemEdit({ produtoId: item.produto_id, tipo, descricao: item.descricao })
    if (tipo === 'preco') {
      setItemEditValor(item.preco_unitario.toFixed(2))
    } else if (tipo === 'desconto_val') {
      setItemEditValor(item.desconto > 0 ? item.desconto.toFixed(2) : '')
    } else {
      setItemEditValor('')
    }
  }

  const confirmarEditItem = () => {
    if (!itemEdit) return
    const item = cart.find((c) => c.produto_id === itemEdit.produtoId)
    if (!item) return
    const v = Number(String(itemEditValor).replace(',', '.')) || 0
    const linhaTotal = item.preco_unitario * item.quantidade

    if (itemEdit.tipo === 'preco') {
      if (v <= 0) return
      updateCartItem(itemEdit.produtoId, { preco_unitario: v })
    } else if (itemEdit.tipo === 'desconto_pct') {
      if (v <= 0) return
      const desconto = Math.round(linhaTotal * v) / 100
      updateCartItem(itemEdit.produtoId, { desconto: Math.min(desconto, linhaTotal) })
    } else if (itemEdit.tipo === 'desconto_val') {
      if (v <= 0) return
      updateCartItem(itemEdit.produtoId, { desconto: Math.min(v, linhaTotal) })
    }

    setItemEdit(null)
    setItemEditValor('')
  }

  useEffect(() => {
    if (!itemMenuAbertoId) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.pdv-item-menu-wrap')) setItemMenuAbertoId(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [itemMenuAbertoId])

  const cancelarVenda = useCallback(() => {
    setCart([])
    setPayments([])
    setDescontoTotal(0)
    setAcrescimoTotal(0)
    setTrocoVenda(0)
    setValorPag('')
    setObservacaoVenda('')
    setClienteId('')
    setClienteSearch('')
    setCpfBusca('')
    setErro('')
    setPagamentoDrawerAberto(false)
  }, [])

  const fecharPagamentoDrawer = useCallback(() => {
    setPagamentoDrawerAberto(false)
    setFormasExtrasAberto(false)
    setErro('')
  }, [])

  const focarVendedor = useCallback(() => {
    vendedorSelectRef.current?.focus()
    vendedorSelectRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [])

  const abrirPagamentoDrawer = useCallback(() => {
    if (cart.length === 0) return
    if (!vendedorId) {
      setErro('Selecione o vendedor antes de finalizar a compra.')
      focarVendedor()
      return
    }
    setErro('')
    setValorPag(valorRestante > 0 ? valorRestante.toFixed(2) : total > 0 ? total.toFixed(2) : '')
    setPagamentoDrawerAberto(true)
  }, [cart.length, vendedorId, valorRestante, total, focarVendedor])

  const insertDescontoAcrescimo = useCallback(() => {
    const v = Number(String(valorDescAcres).replace(',', '.')) || 0
    if (v <= 0) return
    if (tipoDescAcres.startsWith('desconto')) {
      setDescontoTotal(tipoDescAcres.includes('pct') ? Math.round(subtotal * v) / 100 : v)
    } else {
      setAcrescimoTotal(tipoDescAcres.includes('pct') ? Math.round(subtotal * v) / 100 : v)
    }
    setValorDescAcres('')
  }, [valorDescAcres, tipoDescAcres, subtotal])

  const limparDescontoAcrescimo = useCallback(() => {
    setDescontoTotal(0)
    setAcrescimoTotal(0)
    setValorDescAcres('')
  }, [])

  const closeCupomPreviewModal = useCallback(() => {
    setCupomPreviewModalAberto(false)
    setNfceModalMessage(null)
    if (abrirVendedorAposFecharCupomRef.current && caixaAberto) {
      abrirVendedorAposFecharCupomRef.current = false
      setVendedorId('')
      focarVendedor()
    }
  }, [caixaAberto, focarVendedor])

  const dataVencimentoCalculada = (): string => {
    if (prazoTipo === 'd15') return addDaysLocal(15)
    if (prazoTipo === 'd30') return addDaysLocal(30)
    return dataVencimentoCustom
  }

  const addPayment = (forma?: PaymentRow['forma']) => {
    const v = Number(String(valorPag).replace(',', '.')) || 0
    const formaToUse = forma ?? formaPag
    let valorAdicionar = v

    if (formaToUse === 'A_PRAZO') {
      if (!clienteId) {
        setErro('Selecione o cliente no cupom para venda a prazo.')
        return
      }
      if (payments.length > 0) {
        setErro('Remova os lançamentos ativos para usar apenas «A prazo» pelo valor total.')
        return
      }
      valorAdicionar = total
      if (valorAdicionar <= 0) return
    } else if (vendaTemPrazo) {
      setErro('Remova o pagamento «A prazo» para usar outras formas.')
      return
    }

    if (formaToUse === 'DINHEIRO') {
      const recebido = v
      if (recebido <= 0) {
        setErro('Informe o valor recebido em dinheiro.')
        return
      }
      const restante = Math.max(0, total - totalPagamentos)
      if (restante <= 0.009) {
        setErro('Não há valor restante para receber em dinheiro.')
        return
      }
      valorAdicionar = Math.min(recebido, restante)
      setTrocoVenda(recebido > restante ? Math.round((recebido - restante) * 100) / 100 : 0)
    } else if (formaToUse === 'CASHBACK') {
      if (!clienteId) {
        setErro('Selecione o cliente na venda para usar cashback.')
        return
      }
      const c = clientes.find((x) => x.id === clienteId)
      const doc = (c?.cpf_cnpj ?? '').replace(/\D/g, '')
      if (doc.length !== 11 && doc.length !== 14) {
        setErro('Cliente precisa ter CPF/CNPJ válido cadastrado para usar cashback.')
        return
      }
      if (cashbackSaldo?.bloqueado) {
        setErro('Cliente bloqueado no programa de cashback.')
        return
      }
      const disp = cashbackSaldo?.saldo_disponivel ?? 0
      const restanteApos = total - totalPagamentos
      const maxCashbackAplicavel = Math.max(0, Math.min(disp, restanteApos))
      if (maxCashbackAplicavel <= 0.009) {
        setErro('Sem valor disponível para abater com cashback nesta venda.')
        return
      }
      if (valorAdicionar > maxCashbackAplicavel + 0.01) {
        // Ajusta automaticamente para o máximo possível (saldo disponível x restante da venda).
        valorAdicionar = Math.round(maxCashbackAplicavel * 100) / 100
        setValorPag(valorAdicionar.toFixed(2))
      }
    }
    setErro('')
    setPayments((prev) => [...prev, { forma: formaToUse, valor: valorAdicionar }])
    setValorPag('')
    setFormaPag(formaToUse)
  }

  const removePayment = (index: number) => {
    const removed = payments[index]
    setPayments((prev) => prev.filter((_, i) => i !== index))
    if (removed?.forma === 'DINHEIRO') setTrocoVenda(0)
  }

  const selecionarFormaPag = (forma: PaymentRow['forma']) => {
    setFormaPag(forma)
    const restante = Math.max(0, total - payments.reduce((acc, p) => acc + p.valor, 0))
    if (
      forma !== 'DINHEIRO' &&
      forma !== 'A_PRAZO' &&
      !String(valorPag).trim() &&
      restante > 0
    ) {
      setValorPag(restante.toFixed(2))
    }
  }

  const emitirNfceAutomaticoSeAplicavel = async (
    vendaId: string,
    pagamentos: { forma: string; valor: number }[]
  ): Promise<boolean> => {
    let config: EmpresaConfig | null | undefined = empresaConfig
    if (empresaId && window.electronAPI?.empresas?.getConfig) {
      try {
        config = (await window.electronAPI.empresas.getConfig(empresaId)) ?? config
      } catch {
        // mantém config em cache
      }
    }
    if (!deveEmitirCupomFiscalAutomatico(config, pagamentos)) return false

    setEmitindoNfceId(vendaId)
    setNfceModalMessage({ type: 'info', text: 'Emitindo NFC-e. Aguarde...' })
    try {
      const result = await window.electronAPI.vendas.emitirNfce(vendaId)
      if (!result.ok) {
        const em = result.error ?? 'Erro ao emitir NFC-e.'
        op.error(em)
        setNfceModalMessage({ type: 'error', text: em })
        return false
      }
      op.saved('NFC-e emitida automaticamente.')
      setNfceModalMessage({ type: 'success', text: 'NFC-e emitida automaticamente.' })
      setUltimaVendaNfceEmitida(true)
      const printResult = await window.electronAPI.cupom.imprimirNfce(vendaId)
      if (!printResult.ok) {
        setNfceModalMessage({ type: 'error', text: printResult.error ?? 'Erro ao imprimir cupom fiscal.' })
      }
      if (empresaId && window.electronAPI?.vendas) {
        const { dataInicio, dataFim } = getHojeRange()
        window.electronAPI.vendas
          .list(empresaId, { dataInicio, dataFim, limit: 500 })
          .then(setVendasDia)
          .catch(() => {})
      }
      return true
    } catch (err) {
      op.failed(err, 'Erro ao emitir NFC-e.')
      setNfceModalMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao emitir NFC-e.',
      })
      return false
    } finally {
      setEmitindoNfceId(null)
    }
  }

  const finalizar = async () => {
    setErro('')
    if (!caixaAberto) {
      setErro('Abra o caixa antes de vender.')
      return
    }
    if (cart.length === 0) {
      setErro('Adicione itens ao carrinho.')
      return
    }
    if (!vendedorId) {
      setErro('Selecione o vendedor antes de finalizar.')
      focarVendedor()
      return
    }
    const vendedorSelecionado = vendedores.find((v) => v.id === vendedorId)
    if (!vendedorSelecionado || !usuarioPodeSerVendedor(vendedorSelecionado.role)) {
      setErro('Somente vendedores (caixa) ou administradores podem ser vinculados à venda.')
      focarVendedor()
      return
    }
    const totalPag = payments.reduce((a, p) => a + p.valor, 0)
    if (Math.abs(totalPag - total) > 0.01) {
      setErro(
        `Total dos pagamentos (R$ ${totalPag.toFixed(2)}) deve ser igual ao total (R$ ${total.toFixed(2)}).`
      )
      return
    }
    setFinalizando(true)
    const pagamentosFinalizados = payments.map((p) => ({ forma: p.forma, valor: p.valor }))
    try {
      const temPrazo = pagamentosFinalizados.some((p) => p.forma === 'A_PRAZO')
      const venda = await window.electronAPI.vendas.finalizar({
        empresa_id: empresaId,
        usuario_id: vendedorId,
        cliente_id: clienteId || undefined,
        itens: cart.map((i) => ({
          produto_id: i.produto_id,
          descricao: i.descricao,
          preco_unitario: i.preco_unitario,
          quantidade: i.quantidade,
          desconto: i.desconto,
        })),
        pagamentos: pagamentosFinalizados.map((p) => ({ forma: p.forma, valor: p.valor })),
        desconto_total: descontoTotal - acrescimoTotal,
        troco: temPrazo ? 0 : trocoVenda,
        data_vencimento: temPrazo ? dataVencimentoCalculada() : undefined,
      })
      op.saved(`Venda #${venda.numero} registrada com sucesso.`)
      setUltimaVendaId(venda.id)
      setUltimaVendaNfceEmitida(false)
      setCart([])
      setDescontoTotal(0)
      setAcrescimoTotal(0)
      setPayments([])
      setTrocoVenda(0)
      setObservacaoVenda('')
      setClienteSearch('')
      setCpfBusca('')
      fecharPagamentoDrawer()
      abrirVendedorAposFecharCupomRef.current = true
      setCupomPreviewModalAberto(true)
      void emitirNfceAutomaticoSeAplicavel(venda.id, pagamentosFinalizados)
    } catch (err) {
      op.failed(err, 'Erro ao finalizar venda.')
      setErro(err instanceof Error ? err.message : 'Erro ao finalizar venda.')
    } finally {
      setFinalizando(false)
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement
      const isInput = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).getAttribute('contenteditable') === 'true')
      if (e.key === 'Escape' && !isInput) {
        if (formasExtrasAberto) {
          e.preventDefault()
          setFormasExtrasAberto(false)
        } else if (pagamentoDrawerAberto) {
          e.preventDefault()
          fecharPagamentoDrawer()
        } else if (itemMenuAbertoId) {
          e.preventDefault()
          setItemMenuAbertoId(null)
        } else if (itemEdit) {
          e.preventDefault()
          setItemEdit(null)
          setItemEditValor('')
        }
        return
      }
      if (e.key === 'F2' && !isInput) {
        e.preventDefault()
        abrirPagamentoDrawer()
        return
      }
      if (pagamentoDrawerAberto && e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        if (Math.abs(valorRestante) <= 0.015 && total > 0 && cart.length > 0) {
          finalizar()
        }
        return
      }
      if (e.key === 'F9' && !isInput) {
        e.preventDefault()
        cancelarVenda()
        return
      }
      if (e.key === 'F11') {
        e.preventDefault()
        document.documentElement.requestFullscreen?.().catch(() => {})
        return
      }
      if (e.altKey && /^[1-5]$/.test(e.key) && pagamentoDrawerAberto) {
        e.preventDefault()
        const idx = Number(e.key) - 1
        if (idx < 4) {
          addPayment(FORMAS_PRINCIPAIS[idx]?.value)
        } else {
          setFormasExtrasAberto((v) => !v)
        }
        return
      }
      if (e.ctrlKey && e.key === '1' && !isInput && pagamentoDrawerAberto) {
        e.preventDefault()
        clienteSearchRef.current?.focus()
        return
      }
      if (e.ctrlKey && e.key === '2' && !isInput && pagamentoDrawerAberto) {
        e.preventDefault()
        document.getElementById('pdv-cpf-busca')?.focus()
        return
      }
      if (e.ctrlKey && e.key === '3' && !isInput && pagamentoDrawerAberto) {
        e.preventDefault()
        valorPagRef.current?.focus()
        return
      }
      if (e.ctrlKey && e.key === '4' && !isInput && pagamentoDrawerAberto) {
        e.preventDefault()
        document.getElementById('pdv-tipo-desc-acres')?.focus()
        return
      }
      if (e.key === ' ' && !isInput) {
        e.preventDefault()
        if (painelProdutosAberto) setPainelProdutosAberto(false)
        else abrirPainelProdutos()
        return
      }
      if (e.ctrlKey && e.key === 'v' && !isInput) {
        e.preventDefault()
        focarVendedor()
        return
      }
      if (e.key === 'F5') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.key === 'Enter' && (e.target as HTMLElement).getAttribute('data-pdv-search') === 'true') {
        e.preventDefault()
        lancarPorBusca()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lancarPorBusca, vendedores, navigate, cancelarVenda, pagamentoDrawerAberto, fecharPagamentoDrawer, abrirPagamentoDrawer, valorRestante, total, cart.length, finalizar, addPayment, focarVendedor, painelProdutosAberto, abrirPainelProdutos])

  const handleSangria = async () => {
    setSangriaErro('')
    if (!caixaAberto) {
      setSangriaErro('Abra o caixa antes de registrar sangria.')
      return
    }
    const valor = Number(String(sangriaValor).replace(',', '.')) || 0
    if (valor <= 0) {
      setSangriaErro('Informe um valor maior que zero.')
      return
    }
    setSangriaLoading(true)
    try {
      await window.electronAPI.caixa.registrarMovimento({
        caixa_id: caixaAberto.id,
        empresa_id: empresaId,
        tipo: 'SANGRIA',
        valor,
        motivo: sangriaMotivo.trim() || undefined,
        usuario_id: userId,
      })
      op.saved('Sangria registrada.')
      setSangriaValor('')
      setSangriaMotivo('')
      setSangriaModalAberto(false)
    } catch (err) {
      setSangriaErro(err instanceof Error ? err.message : 'Erro ao registrar sangria.')
    } finally {
      setSangriaLoading(false)
    }
  }

  const abrirFecharCaixaModal = useCallback(async () => {
    if (!caixaAberto || !window.electronAPI?.caixa?.getResumoFechamento) return
    if (cart.length > 0) {
      op.error('Finalize ou cancele a venda em andamento antes de fechar o caixa.')
      return
    }
    if (pagamentoDrawerAberto) {
      op.error('Feche a finalização da venda antes de fechar o caixa.')
      return
    }
    setFecharCaixaLoading(true)
    try {
      const resumo = await window.electronAPI.caixa.getResumoFechamento(caixaAberto.id)
      setResumoFechamento(resumo)
      setValorCaixaContado(Number(resumo.saldo_atual).toFixed(2))
      try {
        const saved = window.localStorage?.getItem(`agiliza:caixa:proximoValorAbertura:${empresaId}`)
        const num = saved != null ? Number(saved) : NaN
        setValorManterProximoCaixa(!Number.isNaN(num) && num > 0 ? num.toFixed(2) : '')
      } catch {
        setValorManterProximoCaixa('')
      }
      setFecharCaixaModalAberto(true)
    } catch (err) {
      op.failed(err, 'Erro ao carregar resumo para fechamento de caixa.')
    } finally {
      setFecharCaixaLoading(false)
    }
  }, [caixaAberto, cart.length, pagamentoDrawerAberto, empresaId, op])

  const abrirAberturaCaixaModal = useCallback(() => {
    if (caixaAberto) return
    setErro('')
    try {
      const saved = window.localStorage?.getItem(`agiliza:caixa:proximoValorAbertura:${empresaId}`)
      const num = saved != null ? Number(saved) : NaN
      setValorAberturaPdv(!Number.isNaN(num) && num > 0 ? num.toFixed(2) : '')
    } catch {
      setValorAberturaPdv('')
    }
    setAbrirCaixaModalAberto(true)
  }, [caixaAberto, empresaId])

  const handleImprimir = async (vendaId: string) => {
    setImprimindoId(vendaId)
    setErro('')
    try {
      const result = await window.electronAPI.cupom.imprimir(vendaId)
      if (!result.ok) {
        const em = result.error ?? 'Erro ao imprimir cupom.'
        op.error(em)
        setErro(em)
      } else {
        op.saved('Cupom enviado para impressão.')
      }
    } finally {
      setImprimindoId(null)
    }
  }

  /** Imprime o cupom fiscal completo (com chave, QR code, tributos) — usado após emitir NFC-e. */
  const handleImprimirCupomFiscal = async (vendaId: string) => {
    setImprimindoId(vendaId)
    setNfceModalMessage(null)
    try {
      const result = await window.electronAPI.cupom.imprimirNfce(vendaId)
      if (result.ok) {
        setNfceModalMessage({ type: 'success', text: 'Cupom fiscal enviado para impressão.' })
      } else {
        setNfceModalMessage({ type: 'error', text: result.error ?? 'Erro ao imprimir cupom fiscal.' })
      }
    } finally {
      setImprimindoId(null)
    }
  }

  const handleEmitirNfce = async (vendaId: string) => {
    setEmitindoNfceId(vendaId)
    setNfceModalMessage(null)
    try {
      const result = await window.electronAPI.vendas.emitirNfce(vendaId)
      if (result.ok) {
        op.saved('NFC-e emitida com sucesso.')
        setNfceModalMessage({ type: 'success', text: 'NFC-e emitida com sucesso.' })
        setUltimaVendaNfceEmitida(true)
        await handleImprimirCupomFiscal(vendaId)
        if (empresaId && window.electronAPI?.vendas) {
          const { dataInicio, dataFim } = getHojeRange()
          window.electronAPI.vendas
            .list(empresaId, { dataInicio, dataFim, limit: 500 })
            .then(setVendasDia)
            .catch(() => {})
        }
      } else {
        const em = result.error ?? 'Erro ao emitir NFC-e.'
        op.error(em)
        setNfceModalMessage({ type: 'error', text: em })
      }
    } catch (err) {
      op.failed(err, 'Erro ao emitir NFC-e.')
      setNfceModalMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao emitir NFC-e.' })
    } finally {
      setEmitindoNfceId(null)
    }
  }

  const abrirDetalhesVenda = useCallback((vendaId: string) => {
    setVendaDetalheId(vendaId)
  }, [])

  const abrirCupomVenda = useCallback((vendaId: string) => {
    setUltimaVendaId(vendaId)
    setCupomPreviewHtml(null)
    setNfceModalMessage(null)
    setCupomPreviewModalAberto(true)
  }, [])

  const handleReimprimirVenda = async (v: VendaComNfce) => {
    if (v.status !== 'CONCLUIDA') return
    if (v.nfce_emitida) await handleImprimirCupomFiscal(v.id)
    else await handleImprimir(v.id)
  }

  const valorUnitarioFoco = Number(produtoFoco?.preco) || 0
  const valorTotalFoco = valorUnitarioFoco * qtyLancar
  const totalItens = cart.reduce((acc, i) => acc + i.quantidade, 0)

  const clienteSelecionado = useMemo(
    () => clientes.find((c) => c.id === clienteId) ?? null,
    [clientes, clienteId]
  )

  const clientesFiltrados = useMemo(() => {
    const termo = clienteSearch.trim().toLowerCase()
    if (!termo) return clientes.slice(0, 8)
    return clientes
      .filter(
        (c) =>
          c.nome.toLowerCase().includes(termo) ||
          (c.cpf_cnpj ?? '').replace(/\D/g, '').includes(termo.replace(/\D/g, ''))
      )
      .slice(0, 8)
  }, [clientes, clienteSearch])

  const enderecoCliente = clienteSelecionado ? formatEnderecoCliente(clienteSelecionado) : ''

  const selecionarCliente = (c: Cliente) => {
    setClienteId(c.id)
    setClienteSearch(c.nome)
    setCpfBusca(formatCpfCnpj(c.cpf_cnpj))
    setMostrarEndereco(true)
    setMostrarObservacao(true)
  }

  const buscarClientePorCpf = () => {
    const doc = cpfBusca.replace(/\D/g, '')
    if (!doc) return
    const found = clientes.find((c) => (c.cpf_cnpj ?? '').replace(/\D/g, '') === doc)
    if (found) selecionarCliente(found)
  }

  const clienteOptions = [
    { value: '', label: 'Consumidor final' },
    ...clientes.map((c) => ({ value: c.id, label: c.nome })),
  ]
  const vendedorOptions = [
    { value: '', label: 'Selecione o vendedor (1, 2, 3...)' },
    ...vendedores.map((v, idx) => ({
      value: v.id,
      label: `${idx + 1} — ${v.nome}`,
    })),
  ]

  const vendasDiaFiltradas = useMemo(() => {
    const term = searchVendasDia.trim()
    const base = term
      ? vendasDia.filter((v) => {
          const digits = term.replace(/\D/g, '')
          if (String(v.numero).includes(term)) return true
          if (digits && String(v.numero).includes(digits)) return true
          return false
        })
      : vendasDia
    return [...base].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }, [vendasDia, searchVendasDia])

  const vendasDiaResumo = useMemo(() => {
    const concluidas = vendasDiaFiltradas.filter((v) => v.status === 'CONCLUIDA')
    return {
      total: vendasDiaFiltradas.length,
      concluidas: concluidas.length,
      soma: concluidas.reduce((acc, v) => acc + (Number(v.total) || 0), 0),
    }
  }, [vendasDiaFiltradas])

  const vendaDetalheLista = useMemo(
    () => (vendaDetalheId ? vendasDia.find((v) => v.id === vendaDetalheId) ?? null : null),
    [vendaDetalheId, vendasDia]
  )

  if (!empresaId) {
    return (
      <Layout>
        <div className="pdv-pro pdv-pro--empty">
          <PageTitle title="PDV" subtitle="Sessão inválida." />
        </div>
      </Layout>
    )
  }

  if (!podeOperarVendas) {
    return (
      <Layout>
        <div className="pdv-pro pdv-pro--empty">
          <PageTitle
            title="PDV"
            subtitle="Somente vendedores (caixa) e administradores podem realizar vendas."
          />
          <Alert variant="warning">
            Seu perfil não tem permissão para operar vendas no PDV. Peça a um administrador para
            ajustar seu acesso ou use um usuário vendedor.
          </Alert>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="pdv-pro pdv-pro--minimal">
        <div className="pdv-page pdv-page--pro">
            <div className="pdv-main-grid-wrap">
              <div className="pdv-grid pdv-grid--design">
                <section className="pdv-entrada pdv-entrada--design">
                  <div className="pdv-pdv-toolbar card">
                    <div className="pdv-pdv-toolbar-main">
                      <div className="pdv-field pdv-vendedor-row pdv-vendedor-row--inline">
                        <label className="pdv-field-label" htmlFor="pdv-vendedor-select">
                          <User size={16} /> Vendedor <span className="pdv-kbd">Ctrl+V</span>
                        </label>
                        <Select
                          ref={vendedorSelectRef}
                          id="pdv-vendedor-select"
                          options={vendedorOptions}
                          value={vendedorId}
                          onChange={(e) => {
                            setVendedorId(e.target.value)
                            setErro('')
                          }}
                        />
                      </div>
                      <div className="pdv-pdv-toolbar-meta">
                        {!caixaAberto && (
                          <span className="pdv-caixa-fechado-badge">Caixa fechado</span>
                        )}
                        {!vendedorId && cart.length > 0 && (
                          <span className="pdv-vendedor-aviso">Selecione o vendedor para finalizar</span>
                        )}
                      </div>
                    </div>
                    <div className="pdv-quick-actions">
                      <button
                        type="button"
                        className="pdv-quick-action pdv-quick-action--success"
                        onClick={abrirAberturaCaixaModal}
                        disabled={!!caixaAberto || abrindoCaixaPdv}
                      >
                        <Unlock size={16} strokeWidth={1.75} />
                        Abrir caixa
                      </button>
                      <button
                        type="button"
                        className="pdv-quick-action"
                        onClick={() => {
                          setSangriaErro('')
                          setSangriaValor('')
                          setSangriaMotivo('')
                          setSangriaModalAberto(true)
                        }}
                        disabled={!caixaAberto}
                      >
                        <ArrowDownCircle size={16} strokeWidth={1.75} />
                        Sangria
                      </button>
                      <button
                        type="button"
                        className="pdv-quick-action pdv-quick-action--danger"
                        onClick={() => void abrirFecharCaixaModal()}
                        disabled={!caixaAberto || fecharCaixaLoading}
                      >
                        <Lock size={16} strokeWidth={1.75} />
                        {fecharCaixaLoading ? 'Carregando...' : 'Fechar caixa'}
                      </button>
                      <button
                        type="button"
                        className="pdv-quick-action"
                        onClick={() => {
                          setSearchVendasDia('')
                          setVendasDiaModalAberto(true)
                        }}
                      >
                        <Receipt size={16} strokeWidth={1.75} />
                        Vendas de hoje
                      </button>
                      <button
                        type="button"
                        className="pdv-quick-action"
                        onClick={abrirPainelProdutos}
                      >
                        <Search size={16} strokeWidth={1.75} />
                        Buscar produto
                      </button>
                    </div>
                  </div>

                  <div className="pdv-lancamento-card card">
                    <div className="pdv-lancamento-grid">
                      <div className="pdv-field pdv-field--produto">
                        <label className="pdv-field-label">Produto/Código</label>
                        <div className="pdv-search-wrap">
                          <Search size={16} className="pdv-search-icon" />
                          <input
                            ref={searchInputRef}
                            type="text"
                            data-pdv-search="true"
                            className="input-el pdv-search"
                            placeholder="Buscar produto ou código..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && lancarPorBusca()}
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="pdv-field pdv-field--qty">
                        <label className="pdv-field-label">Quantidade</label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={qtyLancar}
                          onChange={(e) => {
                            const v = Math.floor(Number(e.target.value) || 1)
                            setQtyLancar(v < 1 ? 1 : v)
                          }}
                          className="input-el"
                        />
                      </div>
                      <div className="pdv-field pdv-field--unit">
                        <label className="pdv-field-label">Valor unitário</label>
                        <input
                          type="text"
                          readOnly
                          value={valorUnitarioFoco > 0 ? `R$ ${valorUnitarioFoco.toFixed(2).replace('.', ',')}` : 'R$ 0,00'}
                          className="input-el pdv-valor-readonly"
                        />
                      </div>
                      <div className="pdv-field pdv-field--total-item">
                        <label className="pdv-field-label">Valor total</label>
                        <input
                          type="text"
                          readOnly
                          value={valorTotalFoco > 0 ? `R$ ${valorTotalFoco.toFixed(2).replace('.', ',')}` : 'R$ 0,00'}
                          className="input-el pdv-valor-readonly pdv-valor-total"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        onClick={lancarPorBusca}
                        disabled={!caixaAberto || !search.trim() || produtos.length === 0 || catalogoLoading}
                        className="pdv-btn-inserir"
                      >
                        Inserir
                      </Button>
                    </div>
                  </div>

                  <div className="pdv-cupom-card card">
                    <div className={`pdv-cupom-tabela-wrap pdv-cupom-tabela-wrap--design ${caixaAberto && cart.length === 0 ? 'pdv-cupom-tabela-wrap--idle' : ''}`}>
                      {caixaAberto && cart.length === 0 ? (
                        <div className="pdv-caixa-livre">
                          <span className="pdv-caixa-livre-badge">Caixa livre</span>
                          {empresaConfig?.logo ? (
                            <img src={empresaConfig.logo} alt="" className="pdv-caixa-livre-logo" />
                          ) : (
                            <div className="pdv-caixa-livre-placeholder">
                              <Package size={40} strokeWidth={1.2} />
                              <span>{empresaConfig?.nome?.trim() || 'Sua loja'}</span>
                            </div>
                          )}
                        </div>
                      ) : cart.length === 0 ? (
                        <p className="pdv-cart-empty">Nenhum item. Escaneie ou busque um produto.</p>
                      ) : (
                        <table className="table pdv-cupom-table pdv-cupom-table--design">
                          <thead>
                            <tr>
                              <th>Item</th>
                              <th>Qt.</th>
                              <th>Valor unit.</th>
                              <th>Desconto</th>
                              <th>Acréscimo</th>
                              <th>Valor total</th>
                              <th>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cart.map((i) => (
                              <tr key={i.produto_id}>
                                <td className="pdv-cupom-desc">{i.descricao}</td>
                                <td className="pdv-cupom-qtd-cell">
                                  <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={i.quantidade}
                                    onChange={(e) => {
                                      const v = Math.floor(Number(e.target.value) || 0)
                                      updateCartItem(i.produto_id, { quantidade: v < 1 ? 0 : v })
                                    }}
                                    className="input-el pdv-cart-qty"
                                  />
                                </td>
                                <td className="pdv-cupom-unit">R$ {(Number(i.preco_unitario) || 0).toFixed(2).replace('.', ',')}</td>
                                <td className="pdv-cupom-desc-val">R$ {(Number(i.desconto) || 0).toFixed(2).replace('.', ',')}</td>
                                <td className="pdv-cupom-desc-val">R$ 0,00</td>
                                <td className="pdv-cupom-total">
                                  R$ {((Number(i.preco_unitario) || 0) * i.quantidade - (Number(i.desconto) || 0)).toFixed(2).replace('.', ',')}
                                </td>
                                <td className="pdv-cupom-acoes-cell">
                                  <div className="pdv-item-menu-wrap">
                                    <button
                                      type="button"
                                      className="pdv-item-acao-btn"
                                      onClick={() =>
                                        setItemMenuAbertoId(itemMenuAbertoId === i.produto_id ? null : i.produto_id)
                                      }
                                      aria-expanded={itemMenuAbertoId === i.produto_id}
                                      aria-haspopup="menu"
                                      aria-label={`Ações para ${i.descricao}`}
                                    >
                                      <MoreVertical size={16} />
                                    </button>
                                    {itemMenuAbertoId === i.produto_id && (
                                      <ul className="pdv-item-menu" role="menu">
                                        <li role="none">
                                          <button
                                            type="button"
                                            role="menuitem"
                                            className="pdv-item-menu-btn"
                                            onClick={() => abrirEditItem(i, 'preco')}
                                          >
                                            <Pencil size={14} />
                                            Alterar valor unitário
                                          </button>
                                        </li>
                                        <li role="none">
                                          <button
                                            type="button"
                                            role="menuitem"
                                            className="pdv-item-menu-btn"
                                            onClick={() => abrirEditItem(i, 'desconto_pct')}
                                          >
                                            <Percent size={14} />
                                            Desconto em %
                                          </button>
                                        </li>
                                        <li role="none">
                                          <button
                                            type="button"
                                            role="menuitem"
                                            className="pdv-item-menu-btn"
                                            onClick={() => abrirEditItem(i, 'desconto_val')}
                                          >
                                            <Banknote size={14} />
                                            Desconto em R$
                                          </button>
                                        </li>
                                        {i.desconto > 0 && (
                                          <li role="none">
                                            <button
                                              type="button"
                                              role="menuitem"
                                              className="pdv-item-menu-btn"
                                              onClick={() => {
                                                updateCartItem(i.produto_id, { desconto: 0 })
                                                setItemMenuAbertoId(null)
                                              }}
                                            >
                                              <X size={14} />
                                              Limpar desconto
                                            </button>
                                          </li>
                                        )}
                                        <li role="separator" className="pdv-item-menu-divider" />
                                        <li role="none">
                                          <button
                                            type="button"
                                            role="menuitem"
                                            className="pdv-item-menu-btn pdv-item-menu-btn--danger"
                                            onClick={() => removeFromCart(i.produto_id)}
                                          >
                                            <Trash2 size={14} />
                                            Remover item
                                          </button>
                                        </li>
                                      </ul>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  <div className="pdv-rodape-venda">
                    <div className="pdv-resumo-cards">
                      <div className="pdv-resumo-card">
                        <span className="pdv-resumo-card-label">Itens</span>
                        <strong className="pdv-resumo-card-valor">{totalItens}</strong>
                      </div>
                      <div className="pdv-resumo-card">
                        <span className="pdv-resumo-card-label">Subtotal</span>
                        <strong className="pdv-resumo-card-valor">R$ {subtotal.toFixed(2).replace('.', ',')}</strong>
                      </div>
                      <div className="pdv-resumo-card">
                        <span className="pdv-resumo-card-label">Descontos</span>
                        <strong className="pdv-resumo-card-valor">R$ {descontoTotal.toFixed(2).replace('.', ',')}</strong>
                      </div>
                      <div className="pdv-resumo-card">
                        <span className="pdv-resumo-card-label">Acréscimos</span>
                        <strong className="pdv-resumo-card-valor">R$ {acrescimoTotal.toFixed(2).replace('.', ',')}</strong>
                      </div>
                    </div>

                    <div className="pdv-rodape-finalizar">
                      <div className="pdv-total-bar">
                        <span className="pdv-total-bar-sub">Total da compra</span>
                        <span className="pdv-total-bar-label">R$ {total.toFixed(2).replace('.', ',')}</span>
                      </div>
                      <Button
                        type="button"
                        variant="primary"
                        size="lg"
                        fullWidth
                        className="pdv-btn-finalizar"
                        onClick={abrirPagamentoDrawer}
                        disabled={!caixaAberto || cart.length === 0}
                      >
                        <ShoppingCart size={20} strokeWidth={1.75} />
                        Finalizar compra
                        <span className="pdv-kbd">F2</span>
                      </Button>
                    </div>
                  </div>
                </section>
              </div>

              {pagamentoDrawerAberto && (
                <div className="pdv-drawer-root" role="presentation">
                  <button
                    type="button"
                    className="pdv-drawer-backdrop"
                    onClick={fecharPagamentoDrawer}
                    aria-label="Fechar painel de pagamento"
                  />
                  <aside className="pdv-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="pdv-drawer-title">
                    <div className="pdv-drawer-detalhe pdv-drawer-detalhe--v2">
                      <header className="pdv-drawer-header pdv-drawer-header--v2">
                        <div className="pdv-drawer-header-row">
                          <h2 id="pdv-drawer-title">Finalizar recebimento</h2>
                          <button
                            type="button"
                            className="pdv-drawer-fechar pdv-drawer-fechar--icon"
                            onClick={fecharPagamentoDrawer}
                            aria-label="Fechar"
                          >
                            <X size={18} strokeWidth={1.75} />
                          </button>
                        </div>
                        <div className="pdv-drawer-hero">
                          <div className="pdv-drawer-hero-main">
                            <span className="pdv-drawer-hero-label">Total da venda</span>
                            <strong className="pdv-drawer-hero-valor">{formatMoney(total)}</strong>
                          </div>
                          <div
                            className={`pdv-drawer-hero-status ${
                              vendaQuitada ? 'pdv-drawer-hero-status--ok' : 'pdv-drawer-hero-status--pendente'
                            }`}
                          >
                            {vendaQuitada ? (
                              <>
                                <span>Quitado</span>
                                {trocoVenda > 0 && <strong>Troco {formatMoney(trocoVenda)}</strong>}
                              </>
                            ) : (
                              <>
                                <span>Falta pagar</span>
                                <strong>{formatMoney(Math.max(0, valorRestante))}</strong>
                              </>
                            )}
                          </div>
                        </div>
                      </header>

                      <div className="pdv-drawer-detalhe-body">
                        <section className="pdv-drawer-block pdv-drawer-block--desc">
                          <div className="pdv-drawer-desc-row">
                            <label className="pdv-drawer-desc-label" htmlFor="pdv-tipo-desc-acres">
                              Desconto ou acréscimo
                            </label>
                            <div className="pdv-drawer-desc-controls">
                              <Select
                                id="pdv-tipo-desc-acres"
                                aria-label="Desconto ou acréscimo"
                                options={[
                                  { value: 'desconto_pct', label: 'Desc. %' },
                                  { value: 'desconto_val', label: 'Desc. R$' },
                                  { value: 'acrescimo_pct', label: 'Acr. %' },
                                  { value: 'acrescimo_val', label: 'Acr. R$' },
                                ]}
                                value={tipoDescAcres}
                                onChange={(e) => {
                                  setTipoDescAcres(e.target.value)
                                  setValorDescAcres('')
                                }}
                              />
                              <div
                                className={`pdv-drawer-desc-input ${descAcresEhPercentual ? 'pdv-drawer-desc-input--pct' : 'pdv-drawer-desc-input--money'}`}
                              >
                                {!descAcresEhPercentual && <span className="pdv-drawer-desc-prefix">R$</span>}
                                <input
                                  id="pdv-valor-desc-acres"
                                  type="text"
                                  inputMode="decimal"
                                  className="input-el"
                                  placeholder={descAcresEhPercentual ? '0' : '0,00'}
                                  value={valorDescAcres}
                                  onChange={(e) => setValorDescAcres(e.target.value.replace(/[^\d,.-]/g, ''))}
                                  onKeyDown={(e) => e.key === 'Enter' && insertDescontoAcrescimo()}
                                />
                                {descAcresEhPercentual && <span className="pdv-drawer-desc-suffix">%</span>}
                              </div>
                              <Button type="button" variant="secondary" size="sm" onClick={insertDescontoAcrescimo}>
                                Aplicar
                              </Button>
                            </div>
                            {(descontoTotal > 0 || acrescimoTotal > 0) && (
                              <div className="pdv-drawer-desc-aplicado">
                                {descontoTotal > 0 && (
                                  <span className="pdv-drawer-desc-badge pdv-drawer-desc-badge--desconto">
                                    − {formatMoney(descontoTotal)}
                                  </span>
                                )}
                                {acrescimoTotal > 0 && (
                                  <span className="pdv-drawer-desc-badge pdv-drawer-desc-badge--acrescimo">
                                    + {formatMoney(acrescimoTotal)}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="pdv-drawer-desc-limpar"
                                  onClick={limparDescontoAcrescimo}
                                  aria-label="Remover desconto ou acréscimo"
                                >
                                  Remover
                                </button>
                              </div>
                            )}
                          </div>
                        </section>

                        <section className="pdv-drawer-block pdv-drawer-block--cliente">
                          <h3 className="pdv-drawer-block-title">Cliente</h3>
                          <div className="pdv-cliente-row-design">
                            <div className="pdv-field pdv-field--cliente">
                              <label className="pdv-field-label">
                                Nome ou código <span className="pdv-kbd">Ctrl+1</span>
                              </label>
                              <div className="pdv-search-wrap">
                                <Search size={16} className="pdv-search-icon" />
                                <input
                                  ref={clienteSearchRef}
                                  type="text"
                                  className="input-el pdv-search"
                                  placeholder="Buscar cliente..."
                                  value={clienteSearch}
                                  onChange={(e) => {
                                    setClienteSearch(e.target.value)
                                    if (!e.target.value.trim()) setClienteId('')
                                  }}
                                />
                                {clienteSearch.trim() && clientesFiltrados.length > 0 && !clienteId && (
                                  <ul className="pdv-cliente-sugestoes">
                                    {clientesFiltrados.map((c) => (
                                      <li key={c.id}>
                                        <button type="button" onClick={() => selecionarCliente(c)}>
                                          {c.nome}
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                            <div className="pdv-field pdv-field--cpf">
                              <label className="pdv-field-label" htmlFor="pdv-cpf-busca">
                                CPF/CNPJ <span className="pdv-kbd">Ctrl+2</span>
                              </label>
                              <input
                                id="pdv-cpf-busca"
                                type="text"
                                className="input-el"
                                placeholder="000.000.000-00"
                                value={cpfBusca}
                                onChange={(e) => setCpfBusca(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && buscarClientePorCpf()}
                              />
                            </div>
                          </div>

                          {mostrarEndereco && enderecoCliente && (
                            <div className="pdv-tag-chip">
                              <span>{enderecoCliente}</span>
                              <button type="button" onClick={() => setMostrarEndereco(false)} aria-label="Ocultar endereço">
                                <X size={14} />
                              </button>
                            </div>
                          )}

                          {mostrarObservacao && (
                            <div className="pdv-tag-chip pdv-tag-chip--obs">
                              <input
                                type="text"
                                className="pdv-tag-input"
                                placeholder="Observação da venda"
                                value={observacaoVenda}
                                onChange={(e) => setObservacaoVenda(e.target.value)}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setObservacaoVenda('')
                                  setMostrarObservacao(false)
                                }}
                                aria-label="Limpar observação"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          )}
                        </section>

                        {clienteId && cashbackSaldo && !cashbackSaldo.bloqueado && cashbackSaldo.saldo_disponivel > 0 && (
                          <p className="pdv-cashback-hint">
                            Cashback disponível: {formatMoney(cashbackSaldo.saldo_disponivel)}
                          </p>
                        )}

                        <section className="pdv-drawer-block">
                          <h3 className="pdv-drawer-block-title">Forma de pagamento</h3>
                          {!vendaQuitada && (
                            <p className="pdv-drawer-formas-hint">
                              Informe o valor, escolha como o cliente pagou e confirme o lançamento.
                            </p>
                          )}

                          {!vendaQuitada && (
                            <div className="pdv-drawer-valor-box">
                              <label className="pdv-drawer-valor-label" htmlFor="pdv-valor-pagamento">
                                {formaPag === 'DINHEIRO' ? 'Valor recebido' : 'Valor a lançar'}
                                <span className="pdv-kbd">Ctrl+3</span>
                              </label>
                              <input
                                id="pdv-valor-pagamento"
                                ref={valorPagRef}
                                type="text"
                                inputMode="decimal"
                                className="input-el pdv-drawer-valor-input"
                                value={valorPag ? `R$ ${valorPag}` : ''}
                                placeholder={placeholderValorCampo}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/[^\d,.-]/g, '')
                                  setValorPag(raw)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && podeLancarPagamento) addPayment(formaPag)
                                }}
                              />
                              {formaPag === 'DINHEIRO' && (
                                <p className="pdv-drawer-valor-hint">Informe quanto o cliente entregou em dinheiro</p>
                              )}
                            </div>
                          )}

                          <div className="pdv-drawer-formas-grid">
                            {!vendaTemPrazo &&
                              FORMAS_PRINCIPAIS.map((f) => (
                                <button
                                  key={f.value}
                                  type="button"
                                  className={`pdv-drawer-forma-card${formaPag === f.value ? ' pdv-drawer-forma-card--ativa' : ''}`}
                                  onClick={() => selecionarFormaPag(f.value)}
                                  aria-pressed={formaPag === f.value}
                                >
                                  <span className="pdv-drawer-forma-card-icon">{f.icon}</span>
                                  <span className="pdv-drawer-forma-card-label">{f.label}</span>
                                  {formaPag === f.value && (
                                    <span className="pdv-drawer-forma-card-check" aria-hidden="true">
                                      <Check size={14} strokeWidth={2.5} />
                                    </span>
                                  )}
                                </button>
                              ))}
                            <button
                              type="button"
                              className={`pdv-drawer-forma-card pdv-drawer-forma-card--outras${formasExtrasAberto ? ' pdv-drawer-forma-card--ativa' : ''}`}
                              onClick={() => setFormasExtrasAberto((v) => !v)}
                              aria-expanded={formasExtrasAberto}
                            >
                              <span className="pdv-drawer-forma-card-icon">
                                <Plus size={18} strokeWidth={1.75} />
                              </span>
                              <span className="pdv-drawer-forma-card-label">Outras</span>
                            </button>
                          </div>

                          {formasExtrasAberto && !vendaTemPrazo && (
                            <div className="pdv-drawer-formas-extras">
                              {FORMAS.filter((f) => !FORMAS_PRINCIPAIS.some((p) => p.value === f.value)).map((f) => (
                                <button
                                  key={f.value}
                                  type="button"
                                  className={`pdv-drawer-forma-extra-btn${formaPag === f.value ? ' pdv-drawer-forma-extra-btn--ativa' : ''}`}
                                  onClick={() => {
                                    selecionarFormaPag(f.value)
                                    setFormasExtrasAberto(false)
                                  }}
                                  aria-pressed={formaPag === f.value}
                                >
                                  <span className="pdv-drawer-forma-card-icon">{f.icon}</span>
                                  {f.label}
                                </button>
                              ))}
                            </div>
                          )}

                          {!vendaQuitada && !vendaTemPrazo && (
                            <button
                              type="button"
                              className="pdv-drawer-lancar-btn"
                              onClick={() => addPayment(formaPag)}
                              disabled={!podeLancarPagamento}
                            >
                              <Check size={18} strokeWidth={2} />
                              {labelLancarPagamento}
                            </button>
                          )}

                          <div className="pdv-drawer-pagamentos-box">
                            <div className="pdv-drawer-pagamentos-head">
                              <span>Pagamentos lançados</span>
                              {payments.length > 0 && (
                                <span className="pdv-drawer-pagamentos-count">{payments.length}</span>
                              )}
                            </div>
                            {payments.length === 0 ? (
                              <p className="pdv-drawer-pagamentos-vazio">
                                Nenhum pagamento lançado ainda. Confirme acima para registrar.
                              </p>
                            ) : (
                              <ul className="pdv-drawer-pagamentos-lista">
                                {payments.map((p, idx) => (
                                  <li key={idx} className="pdv-drawer-pagamento-item">
                                    <span className="pdv-drawer-pagamento-forma">
                                      {FORMAS.find((x) => x.value === p.forma)?.label ?? p.forma}
                                    </span>
                                    <span className="pdv-drawer-pagamento-valor">{formatMoney(p.valor)}</span>
                                    <button
                                      type="button"
                                      className="pdv-drawer-pagamento-remover"
                                      onClick={() => removePayment(idx)}
                                      aria-label="Remover pagamento"
                                    >
                                      <X size={14} />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </section>
                      </div>

                      <div className="pdv-drawer-footer-sticky">
                        <div className={`pdv-drawer-resumo-bar ${trocoVenda > 0 ? 'pdv-drawer-resumo-bar--troco' : ''}`}>
                          <div className="pdv-drawer-resumo-item">
                            <span>Pago</span>
                            <strong>{formatMoney(totalPagamentos)}</strong>
                          </div>
                          <div className="pdv-drawer-resumo-item">
                            <span>Falta</span>
                            <strong>{formatMoney(Math.max(0, valorRestante))}</strong>
                          </div>
                          {trocoVenda > 0 && (
                            <div className="pdv-drawer-resumo-item pdv-drawer-resumo-item--troco">
                              <span>Troco</span>
                              <strong>{formatMoney(trocoVenda)}</strong>
                            </div>
                          )}
                        </div>

                        {erro ? <p className="pdv-drawer-erro">{erro}</p> : null}

                        <div className="pdv-drawer-footer-actions">
                          <Button type="button" variant="secondary" size="lg" onClick={fecharPagamentoDrawer}>
                            Cancelar
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            size="lg"
                            className="pdv-drawer-btn-finalizar"
                            onClick={finalizar}
                            disabled={finalizando || Math.abs(valorRestante) > 0.015 || total <= 0}
                          >
                            {finalizando ? 'Finalizando...' : 'Finalizar venda'}
                          </Button>
                        </div>
                        <p className="pdv-drawer-footer-hint">
                          <span className="pdv-kbd">Ctrl+Enter</span> finalizar · <span className="pdv-kbd">Enter</span> lançar · Alt+1–4 atalho rápido · Esc fecha
                        </p>
                      </div>
                    </div>
                  </aside>
                </div>
              )}
            </div>
        </div>

      <Dialog
        className="pdv-dialog"
        open={fecharCaixaModalAberto}
        onClose={() => setFecharCaixaModalAberto(false)}
        title="Fechamento de caixa pelo PDV"
        showCloseButton={true}
      >
        <div className="pdv-modal-pagamento">
          {resumoFechamento && caixaAberto && (
            <div className="pdv-fechamento-section">
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                Caixa aberto por{' '}
                <strong style={{ color: 'var(--color-text)' }}>{usuarioCaixaNome || '—'}</strong> em{' '}
                {new Date(caixaAberto.aberto_em).toLocaleString('pt-BR')}
              </p>
              <div className="pdv-fechamento-resumo-grid" style={{ marginTop: 'var(--space-2)' }}>
                <div className="pdv-fechamento-resumo-card">
                  <span>Valor de abertura do caixa</span>
                  <strong>R$ {caixaAberto.valor_inicial.toFixed(2)}</strong>
                </div>
                <div className="pdv-fechamento-resumo-card">
                  <span>Total em vendas (todas as formas)</span>
                  <strong>
                    R${' '}
                    {resumoFechamento.totais_por_forma
                      .reduce((acc, p) => acc + p.total, 0)
                      .toFixed(2)}
                  </strong>
                </div>
                <div className="pdv-fechamento-resumo-card">
                  <span>Saldo esperado em caixa (sistema)</span>
                  <strong>R$ {resumoFechamento.saldo_atual.toFixed(2)}</strong>
                </div>
              </div>
            </div>
          )}

          {resumoFechamento && (
            <div className="pdv-fechamento-section">
              <h4 className="pdv-section-label">
                <CreditCard size={18} /> Vendas por forma de pagamento (vendas deste caixa)
              </h4>
              <div className="pdv-fechamento-formas-grid">
                {resumoFechamento.totais_por_forma.map((p) => (
                  <div key={p.forma} className="pdv-fechamento-forma-card">
                    <span className="pdv-fechamento-forma-label">{p.forma}</span>
                    <span className="pdv-fechamento-forma-valor">R$ {p.total.toFixed(2)}</span>
                  </div>
                ))}
                {resumoFechamento.totais_por_forma.length === 0 && (
                  <p className="pdv-empty">Nenhuma venda concluída vinculada a este caixa.</p>
                )}
              </div>
            </div>
          )}

          <div className="pdv-fechamento-section">
            <h4 className="pdv-section-label">
              <Banknote size={18} /> Conferência do caixa
            </h4>
            <div className="pdv-modal-field">
              <label className="pdv-field-label">Valor contado em caixa (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={valorCaixaContado}
                onChange={(e) => setValorCaixaContado(e.target.value)}
                className="input-el"
              />
              {resumoFechamento && (
                <p
                  className="pdv-troco-value"
                  style={{
                    marginTop: 8,
                    color:
                      Math.abs(diferencaCaixa) < 0.01
                        ? 'var(--color-text-secondary)'
                        : diferencaCaixa > 0
                        ? 'var(--color-success)'
                        : 'var(--color-error)',
                  }}
                >
                  Diferença:{' '}
                  <strong>
                    {diferencaCaixa >= 0 ? '+' : '-'} R$ {Math.abs(diferencaCaixa).toFixed(2)}
                  </strong>{' '}
                  —{' '}
                  {Math.abs(diferencaCaixa) < 0.01
                    ? 'Caixa batendo'
                    : diferencaCaixa > 0
                    ? 'Caixa positivo (sobrando dinheiro)'
                    : 'Caixa negativo (faltando dinheiro)'}
                </p>
              )}
            </div>

            <div className="pdv-modal-field">
              <label className="pdv-field-label">Valor a manter no caixa para a próxima abertura (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={valorManterProximoCaixa}
                onChange={(e) => setValorManterProximoCaixa(e.target.value)}
                className="input-el"
              />
            </div>
          </div>

          <Button
            type="button"
            variant="danger"
            fullWidth
            size="lg"
            onClick={() => {
              if (!caixaAberto) return
              setConfirmarFechamentoCaixa(true)
            }}
            className="pdv-btn-finalizar"
          >
            Fechar caixa agora
          </Button>
        </div>
      </Dialog>

      {/* Confirmação antes de fechar o caixa */}
      <ConfirmDialog
        className="pdv-dialog"
        open={confirmarFechamentoCaixa}
        onClose={() => setConfirmarFechamentoCaixa(false)}
        title="Confirmar fechamento de caixa"
        message="Tem certeza que deseja fechar o caixa agora? Após o fechamento, será gerado o relatório para conferência e impressão."
        confirmLabel="Fechar caixa e gerar relatório"
        loading={false}
        onConfirm={async () => {
          if (!caixaAberto) {
            setConfirmarFechamentoCaixa(false)
            return
          }
          try {
            const fechado = await window.electronAPI.caixa.fechar(caixaAberto.id)
            const idFechado = fechado?.id ?? caixaAberto.id
            setUltimoCaixaFechadoId(idFechado)

            // Guarda o valor informado para manter no caixa como sugestão para a próxima abertura (por terminal)
            const manterStr = (valorManterProximoCaixa || '').toString().replace(',', '.').trim()
            const manterNum = Number(manterStr)
            if (!Number.isNaN(manterNum) && manterNum > 0 && empresaId) {
              try {
                window.localStorage?.setItem(
                  `agiliza:caixa:proximoValorAbertura:${empresaId}`,
                  manterNum.toString()
                )
              } catch {
                // ignore storage errors
              }
            }

            // Carrega HTML para pré-visualização, incluindo o valor a manter (se houver)
            const html = await window.electronAPI.caixa.getHtmlFechamento(
              idFechado,
              !Number.isNaN(manterNum) && manterNum > 0 ? manterNum : undefined
            )
            if (html) {
              setHtmlFechamentoCaixa(html)
              setPreviewFechamentoAberto(true)
            }

            setCaixaAberto(null)
            setFecharCaixaModalAberto(false)
            setResumoFechamento(null)
            setValorCaixaContado('')
            setValorManterProximoCaixa('')
            setErro('')
            op.saved('Caixa fechado com sucesso.')
          } catch (err) {
            setErro(err instanceof Error ? err.message : 'Erro ao fechar o caixa.')
          } finally {
            setConfirmarFechamentoCaixa(false)
          }
        }}
      />

      {/* Pré-visualização do relatório de fechamento de caixa */}
      <Dialog
        className="pdv-dialog"
        open={previewFechamentoAberto && !!htmlFechamentoCaixa}
        onClose={() => {
          if (!imprimindoFechamento) setPreviewFechamentoAberto(false)
        }}
        title="Relatório de fechamento de caixa"
        showCloseButton={!imprimindoFechamento}
      >
        <div
          style={{
            maxHeight: 400,
            overflowY: 'auto',
            padding: 12,
            background: '#f9fafb',
          }}
        >
          {htmlFechamentoCaixa && (
            <div
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: htmlFechamentoCaixa }}
            />
          )}
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPreviewFechamentoAberto(false)}
            disabled={imprimindoFechamento}
          >
            Fechar visualização
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={async () => {
              if (!ultimoCaixaFechadoId) return
              try {
                setImprimindoFechamento(true)
                // Ao imprimir, também repassa o valor de troco sugerido (se ainda estiver no localStorage)
                let manterNum: number | undefined
                if (empresaId) {
                  try {
                    const saved = window.localStorage?.getItem(
                      `agiliza:caixa:proximoValorAbertura:${empresaId}`
                    )
                    const parsed = saved != null ? Number(saved) : NaN
                    if (!Number.isNaN(parsed) && parsed > 0) {
                      manterNum = parsed
                    }
                  } catch {
                    manterNum = undefined
                  }
                }
                await window.electronAPI.caixa.imprimirFechamento(
                  ultimoCaixaFechadoId,
                  manterNum
                )
              } finally {
                setImprimindoFechamento(false)
              }
            }}
            disabled={imprimindoFechamento}
          >
            {imprimindoFechamento ? 'Imprimindo...' : 'Imprimir'}
          </Button>
        </div>
      </Dialog>

      {/* Abertura de caixa pelo PDV */}
      <Dialog
        className="pdv-dialog"
        open={abrirCaixaModalAberto}
        onClose={() => {
          if (!abrindoCaixaPdv) setAbrirCaixaModalAberto(false)
        }}
        title="Abertura de caixa pelo PDV"
        showCloseButton={!abrindoCaixaPdv}
      >
        <div className="pdv-modal-pagamento">
          <div className="pdv-modal-field">
            <label className="pdv-field-label">Valor de abertura do caixa (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={valorAberturaPdv}
              onChange={(e) => setValorAberturaPdv(e.target.value)}
              className="input-el"
            />
          </div>
          <Button
            type="button"
            variant="primary"
            fullWidth
            size="lg"
            onClick={() => {
              const v = Number(String(valorAberturaPdv).replace(',', '.'))
              if (!v || v <= 0) {
                setErro('Informe um valor maior que zero para abrir o caixa.')
                return
              }
              setConfirmarAberturaCaixa(true)
            }}
            disabled={abrindoCaixaPdv}
          >
            Avançar para confirmação
          </Button>
        </div>
      </Dialog>

      {/* Confirmação da abertura de caixa pelo PDV */}
      <ConfirmDialog
        className="pdv-dialog"
        open={confirmarAberturaCaixa}
        onClose={() => setConfirmarAberturaCaixa(false)}
        title="Confirmar abertura de caixa"
        message={`Confirmar abertura do caixa com o valor de R$ ${Number(
          String(valorAberturaPdv).replace(',', '.')
        ).toFixed(2)}?`}
        confirmLabel="Confirmar abertura"
        loading={abrindoCaixaPdv}
        onConfirm={async () => {
          if (!empresaId || !userId) {
            setConfirmarAberturaCaixa(false)
            return
          }
          const v = Number(String(valorAberturaPdv).replace(',', '.'))
          if (!v || v <= 0) {
            setErro('Informe um valor maior que zero para abrir o caixa.')
            setConfirmarAberturaCaixa(false)
            return
          }
          try {
            setAbrindoCaixaPdv(true)
            const aberto = await window.electronAPI.caixa.abrir(empresaId, userId, v)
            setCaixaAberto(aberto)
            op.saved('Caixa aberto com sucesso.')
            setErro('')
            // Garante sugestão futura igual à abertura atual
            try {
              window.localStorage?.setItem(
                `agiliza:caixa:proximoValorAbertura:${empresaId}`,
                v.toString()
              )
            } catch {
              // ignore
            }
            setAbrirCaixaModalAberto(false)
          } catch (err) {
            setErro(err instanceof Error ? err.message : 'Erro ao abrir o caixa.')
          } finally {
            setAbrindoCaixaPdv(false)
            setConfirmarAberturaCaixa(false)
          }
        }}
      />

      <Dialog
        className="pdv-dialog"
        open={cupomPreviewModalAberto}
        onClose={closeCupomPreviewModal}
        title="Cupom — Pré-visualização"
        showCloseButton={true}
      >
        <div className="pdv-cupom-preview-modal">
          {emitindoNfceId === ultimaVendaId || cupomPreviewLoading ? (
            <p className="pdv-cupom-preview-loading">
              {emitindoNfceId === ultimaVendaId
                ? 'Emitindo NFC-e e preparando cupom fiscal...'
                : 'Carregando cupom...'}
            </p>
          ) : cupomPreviewHtml ? (
            <div
              className="pdv-cupom-preview-content"
              dangerouslySetInnerHTML={{ __html: cupomPreviewHtml }}
            />
          ) : (
            <p className="pdv-cupom-preview-empty">Cupom não encontrado.</p>
          )}
          {nfceModalMessage && (
            <Alert variant={nfceModalMessage.type} style={{ marginTop: 12, marginBottom: 0 }}>
              {nfceModalMessage.text}
            </Alert>
          )}
          <div className="pdv-cupom-preview-actions">
            <Button
              type="button"
              variant="primary"
              size="md"
              leftIcon={<Printer size={18} />}
              onClick={() =>
                ultimaVendaId &&
                (ultimaVendaNfceEmitida
                  ? handleImprimirCupomFiscal(ultimaVendaId)
                  : handleImprimir(ultimaVendaId))
              }
              disabled={
                !ultimaVendaId ||
                imprimindoId === ultimaVendaId ||
                emitindoNfceId === ultimaVendaId
              }
            >
              {imprimindoId === ultimaVendaId
                ? 'Abrindo impressora...'
                : ultimaVendaNfceEmitida
                  ? 'Imprimir cupom fiscal'
                  : 'Imprimir cupom'}
            </Button>
            {!ultimaVendaNfceEmitida && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                leftIcon={<FileCheck size={18} />}
                onClick={() => ultimaVendaId && handleEmitirNfce(ultimaVendaId)}
                disabled={!ultimaVendaId || emitindoNfceId === ultimaVendaId}
              >
                {emitindoNfceId === ultimaVendaId ? 'Emitindo...' : 'Emitir NFC-e'}
              </Button>
            )}
            <Button type="button" variant="secondary" size="md" onClick={closeCupomPreviewModal}>
              Fechar
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        className="pdv-dialog"
        open={!!itemEdit}
        onClose={() => {
          setItemEdit(null)
          setItemEditValor('')
        }}
        title={
          itemEdit?.tipo === 'preco'
            ? 'Alterar valor unitário'
            : itemEdit?.tipo === 'desconto_pct'
              ? 'Desconto em %'
              : 'Desconto em R$'
        }
        showCloseButton={true}
      >
        {itemEdit && (
          <div className="pdv-modal-compact">
            <p className="pdv-modal-hint">{itemEdit.descricao}</p>
            <Input
              label={
                itemEdit.tipo === 'preco'
                  ? 'Novo valor unitário (R$)'
                  : itemEdit.tipo === 'desconto_pct'
                    ? 'Percentual de desconto'
                    : 'Valor do desconto (R$)'
              }
              type="text"
              inputMode="decimal"
              value={itemEditValor}
              onChange={(e) => setItemEditValor(e.currentTarget.value.replace(/[^\d,.-]/g, ''))}
              placeholder={itemEdit.tipo === 'desconto_pct' ? 'Ex: 10' : '0,00'}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && confirmarEditItem()}
            />
            <div className="pdv-modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setItemEdit(null)
                  setItemEditValor('')
                }}
              >
                Cancelar
              </Button>
              <Button type="button" variant="primary" onClick={confirmarEditItem}>
                Aplicar
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        className="pdv-dialog"
        open={sangriaModalAberto}
        onClose={() => !sangriaLoading && setSangriaModalAberto(false)}
        title="Sangria"
        showCloseButton={true}
      >
        <div className="pdv-modal-compact">
          <p className="pdv-modal-hint">Retirada de dinheiro do caixa aberto.</p>
          {!caixaAberto ? (
            <Alert variant="warning">Não há caixa aberto.</Alert>
          ) : (
            <>
              <Input
                label="Valor (R$)"
                type="text"
                inputMode="decimal"
                value={sangriaValor}
                onChange={(e) => setSangriaValor(e.currentTarget.value.replace(/[^\d,.-]/g, ''))}
                placeholder="0,00"
                autoFocus
              />
              <Input
                label="Motivo (opcional)"
                type="text"
                value={sangriaMotivo}
                onChange={(e) => setSangriaMotivo(e.currentTarget.value)}
                placeholder="Ex: pagamento fornecedor"
              />
              {sangriaErro ? <Alert variant="error">{sangriaErro}</Alert> : null}
              <div className="pdv-modal-actions">
                <Button type="button" variant="secondary" onClick={() => setSangriaModalAberto(false)} disabled={sangriaLoading}>
                  Cancelar
                </Button>
                <Button type="button" variant="primary" onClick={handleSangria} disabled={sangriaLoading}>
                  {sangriaLoading ? 'Registrando...' : 'Confirmar sangria'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Dialog>

      <Dialog
        className="pdv-dialog"
        open={vendasDiaModalAberto}
        onClose={() => {
          setVendasDiaModalAberto(false)
          setVendaDetalheId(null)
        }}
        title="Vendas de hoje"
        size="large"
        showCloseButton={true}
      >
        <div className="pdv-vendas-dia">
          <div className="pdv-vendas-dia-header">
            <p className="pdv-vendas-dia-data">{labelHoje()}</p>
            {!vendasDiaLoading && vendasDia.length > 0 && (
              <p className="pdv-vendas-dia-resumo">
                {vendasDiaResumo.concluidas} venda{vendasDiaResumo.concluidas !== 1 ? 's' : ''} concluída{vendasDiaResumo.concluidas !== 1 ? 's' : ''}
                {vendasDiaResumo.concluidas > 0 ? ` · ${formatMoney(vendasDiaResumo.soma)}` : ''}
              </p>
            )}
          </div>
          <div className="pdv-search-wrap">
            <Search size={16} className="pdv-search-icon" />
            <input
              type="text"
              className="input-el pdv-search"
              placeholder="Filtrar por número da venda..."
              value={searchVendasDia}
              onChange={(e) => setSearchVendasDia(e.target.value)}
              autoFocus
            />
          </div>
          {vendasDiaLoading ? (
            <p className="pdv-empty">Carregando vendas de hoje...</p>
          ) : vendasDiaFiltradas.length === 0 ? (
            <p className="pdv-empty">
              {searchVendasDia.trim() ? 'Nenhuma venda encontrada.' : 'Nenhuma venda registrada hoje.'}
            </p>
          ) : (
            <ul className="pdv-vendas-dia-lista">
              {vendasDiaFiltradas.map((v) => (
                <li key={v.id} className="pdv-vendas-dia-item">
                  <div className="pdv-vendas-dia-info">
                    <div className="pdv-vendas-dia-top">
                      <strong>Venda #{v.numero}</strong>
                      <span
                        className={`pdv-vendas-dia-status pdv-vendas-dia-status--${
                          v.status === 'CONCLUIDA' ? 'ok' : 'cancel'
                        }`}
                      >
                        {v.status === 'CONCLUIDA' ? 'Concluída' : 'Cancelada'}
                      </span>
                      {v.status === 'CONCLUIDA' && (
                        <span
                          className={`pdv-vendas-dia-nfce ${v.nfce_emitida ? 'pdv-vendas-dia-nfce--sim' : ''}`}
                        >
                          {v.nfce_emitida ? 'NFC-e' : 'Sem NFC-e'}
                        </span>
                      )}
                    </div>
                    <span>
                      {new Date(v.created_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="pdv-vendas-dia-total">{formatMoney(v.total)}</span>
                  </div>
                  <div className="pdv-vendas-dia-acoes">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      leftIcon={<Eye size={14} />}
                      onClick={() => abrirDetalhesVenda(v.id)}
                    >
                      Detalhes
                    </Button>
                    {v.status === 'CONCLUIDA' && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        leftIcon={<Printer size={14} />}
                        onClick={() => void handleReimprimirVenda(v)}
                        disabled={imprimindoId === v.id}
                      >
                        {imprimindoId === v.id ? 'Imprimindo...' : 'Reimprimir'}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Dialog>

      <Dialog
        className="pdv-dialog"
        open={vendaDetalheId !== null}
        onClose={() => setVendaDetalheId(null)}
        title="Detalhes da venda"
        size="large"
        showCloseButton={true}
      >
        {vendaDetalheLoading ? (
          <p className="pdv-empty">Carregando detalhes...</p>
        ) : !vendaDetalhe ? (
          <p className="pdv-empty">Não foi possível carregar os detalhes da venda.</p>
        ) : (
          <div className="vendas-detalhes">
            <div className="vendas-detalhes-header">
              <div>
                <div className="vendas-detalhes-empresa">{vendaDetalhe.empresa_nome}</div>
                <div className="vendas-detalhes-info">
                  <span>Venda #{vendaDetalhe.venda.numero}</span>
                  <span>
                    {new Date(vendaDetalhe.venda.created_at).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span
                    className={`pdv-vendas-dia-status pdv-vendas-dia-status--${
                      vendaDetalhe.venda.status === 'CONCLUIDA' ? 'ok' : 'cancel'
                    }`}
                  >
                    {vendaDetalhe.venda.status === 'CONCLUIDA' ? 'Concluída' : 'Cancelada'}
                  </span>
                </div>
                {(vendaDetalhe.cliente_nome_cupom || vendaDetalhe.cupom_empresa?.vendedor_nome) && (
                  <div className="pdv-venda-detalhe-meta">
                    {vendaDetalhe.cliente_nome_cupom ? (
                      <span>Cliente: {vendaDetalhe.cliente_nome_cupom}</span>
                    ) : null}
                    {vendaDetalhe.cupom_empresa?.vendedor_nome ? (
                      <span>Vendedor: {vendaDetalhe.cupom_empresa.vendedor_nome}</span>
                    ) : null}
                  </div>
                )}
              </div>
              <div className="vendas-detalhes-totais">
                <div>
                  <span className="label">Subtotal</span>
                  <span className="value">{formatMoney(vendaDetalhe.venda.subtotal)}</span>
                </div>
                <div>
                  <span className="label">Desconto</span>
                  <span className="value">{formatMoney(vendaDetalhe.venda.desconto_total)}</span>
                </div>
                <div>
                  <span className="label">Total</span>
                  <span className="value destaque">{formatMoney(vendaDetalhe.venda.total)}</span>
                </div>
              </div>
            </div>

            <div className="vendas-detalhes-grid">
              <div className="vendas-detalhes-card">
                <h4>Itens</h4>
                {vendaDetalhe.itens.length === 0 ? (
                  <p className="vendas-detalhes-empty">Nenhum item.</p>
                ) : (
                  <table className="table table--compact">
                    <thead>
                      <tr>
                        <th>Descrição</th>
                        <th>Qtd</th>
                        <th>V. unit.</th>
                        <th>Desc.</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendaDetalhe.itens.map((i, idx) => (
                        <tr key={`${i.descricao}-${idx}`}>
                          <td>{i.descricao}</td>
                          <td>{i.quantidade}</td>
                          <td>{formatMoney(i.preco_unitario)}</td>
                          <td>{i.desconto ? formatMoney(i.desconto) : '-'}</td>
                          <td>{formatMoney(i.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="vendas-detalhes-card">
                <h4>Pagamentos</h4>
                {vendaDetalhe.pagamentos.length === 0 ? (
                  <p className="vendas-detalhes-empty">Nenhum pagamento registrado.</p>
                ) : (
                  <table className="table table--compact">
                    <thead>
                      <tr>
                        <th>Forma</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendaDetalhe.pagamentos.map((p, idx) => (
                        <tr key={`${p.forma}-${idx}`}>
                          <td>{p.forma}</td>
                          <td>{formatMoney(p.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="vendas-detalhes-resumo-pag">
                  <span>Total pago</span>
                  <span>
                    {formatMoney(vendaDetalhe.pagamentos.reduce((acc, p) => acc + p.valor, 0))}
                  </span>
                </div>
                {vendaDetalhe.venda.troco > 0 && (
                  <div className="vendas-detalhes-resumo-pag troco">
                    <span>Troco</span>
                    <span>{formatMoney(vendaDetalhe.venda.troco)}</span>
                  </div>
                )}
              </div>
            </div>

            {vendaDetalhe.venda.status === 'CONCLUIDA' && vendaDetalheId && (
              <div className="pdv-venda-detalhe-acoes">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  leftIcon={<FileCheck size={14} />}
                  onClick={() => abrirCupomVenda(vendaDetalheId)}
                >
                  Ver cupom
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  leftIcon={<Printer size={14} />}
                  onClick={() => vendaDetalheLista && void handleReimprimirVenda(vendaDetalheLista)}
                  disabled={!vendaDetalheLista || imprimindoId === vendaDetalheId}
                >
                  {imprimindoId === vendaDetalheId ? 'Imprimindo...' : 'Reimprimir'}
                </Button>
                {vendaDetalheLista && !vendaDetalheLista.nfce_emitida && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<FileCheck size={14} />}
                    onClick={() => vendaDetalheId && void handleEmitirNfce(vendaDetalheId)}
                    disabled={emitindoNfceId === vendaDetalheId}
                  >
                    {emitindoNfceId === vendaDetalheId ? 'Emitindo...' : 'Emitir NFC-e'}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </Dialog>

      <Dialog
        className="pdv-dialog"
        open={painelProdutosAberto}
        onClose={() => setPainelProdutosAberto(false)}
        title="Buscar produto"
        size="large"
        showCloseButton={true}
      >
        <div className="pdv-panel-produtos">
          <div className="pdv-search-wrap">
            <Search size={20} className="pdv-search-icon" />
            <input
              type="text"
              className="input-el pdv-search"
              placeholder="Buscar por nome, SKU ou código..."
              value={searchProdutosPanel}
              onChange={(e) => setSearchProdutosPanel(e.target.value)}
              autoFocus
            />
          </div>
          <div className="pdv-produtos-grid pdv-panel-grid">
            {catalogoLoading && catalogo.length === 0 ? (
              <p className="pdv-empty">Carregando produtos...</p>
            ) : (
              produtosPanel.map((p, index) => {
                const imagem = produtoImagens[p.id]
                const aguardandoImagem = imagem === undefined
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="pdv-produto-card"
                    onClick={() => {
                      addToCart({ ...p, imagem: imagem ?? null }, qtyLancar)
                      setPainelProdutosAberto(false)
                    }}
                    disabled={!caixaAberto}
                  >
                    <div className="pdv-produto-card-img">
                      {imagem ? (
                        <img
                          src={imagem}
                          alt=""
                          loading={index < PDV_IMAGEM_LOTE ? 'eager' : 'lazy'}
                          decoding="async"
                        />
                      ) : (
                        <ProdutoPlaceholder loading={aguardandoImagem} />
                      )}
                    </div>
                    <div className="pdv-produto-card-body">
                      <span className="pdv-produto-card-nome">{p.nome}</span>
                      <span className="pdv-produto-card-preco">R$ {(Number(p.preco) || 0).toFixed(2).replace('.', ',')}</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
          {!catalogoLoading && produtosPanel.length === 0 && (
            <p className="pdv-empty">
              {searchProdutosPanel.trim() ? `Nenhum produto para "${searchProdutosPanel}"` : 'Nenhum produto cadastrado.'}
            </p>
          )}
        </div>
      </Dialog>
      </div>
    </Layout>
  )
}
