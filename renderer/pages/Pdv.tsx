import { useState, useEffect, useCallback, useRef } from 'react'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useSyncDataRefresh } from '../hooks/useSyncDataRefresh'
import type { Produto, Caixa, Cliente, Usuario, CaixaResumoFechamento } from '../vite-env'
import { PageTitle, Button, Alert, Select, Dialog, ConfirmDialog } from '../components/ui'
import { Printer, Search, Package, User, CreditCard, Banknote, QrCode, CircleDollarSign, FileCheck, Wallet } from 'lucide-react'

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
  forma: 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'OUTROS'
  valor: number
}

const FORMAS: { value: PaymentRow['forma']; label: string; icon: React.ReactNode }[] = [
  { value: 'DINHEIRO', label: 'Dinheiro', icon: <Banknote size={18} strokeWidth={1.5} /> },
  { value: 'CREDITO', label: 'Cartão de Crédito', icon: <CreditCard size={18} strokeWidth={1.5} /> },
  { value: 'DEBITO', label: 'Cartão de Débito', icon: <CreditCard size={18} strokeWidth={1.5} /> },
  { value: 'PIX', label: 'PIX', icon: <QrCode size={18} strokeWidth={1.5} /> },
  { value: 'OUTROS', label: 'Outros', icon: <CircleDollarSign size={18} strokeWidth={1.5} /> },
]

function ProdutoPlaceholder() {
  return (
    <div className="pdv-produto-placeholder">
      <Package size={32} strokeWidth={1.5} />
    </div>
  )
}

export function Pdv() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''
  const userId = session?.id ?? ''
  const searchInputRef = useRef<HTMLInputElement>(null)
  const syncRefreshKey = useSyncDataRefresh()

  const [caixaAberto, setCaixaAberto] = useState<Caixa | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [vendedores, setVendedores] = useState<Usuario[]>([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [descontoTotal, setDescontoTotal] = useState(0)
  const [acrescimoTotal, setAcrescimoTotal] = useState(0)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [valorRecebido, setValorRecebido] = useState(0)
  const [clienteId, setClienteId] = useState<string>('')
  const [vendedorId, setVendedorId] = useState<string>('')
  const [formaPag, setFormaPag] = useState<PaymentRow['forma']>('DINHEIRO')
  const [valorPag, setValorPag] = useState('')
  const [pagamentoModalAberto, setPagamentoModalAberto] = useState(false)
  const [vendedorModalAberto, setVendedorModalAberto] = useState(true)
  const [qtyLancar, setQtyLancar] = useState(1)
  const [produtoFoco, setProdutoFoco] = useState<Produto | null>(null)
  const [painelProdutosAberto, setPainelProdutosAberto] = useState(false)
  const [searchProdutosPanel, setSearchProdutosPanel] = useState('')
  const [produtosPanel, setProdutosPanel] = useState<Produto[]>([])

  const [finalizando, setFinalizando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [imprimindoId, setImprimindoId] = useState<string | null>(null)
  const [ultimaVendaId, setUltimaVendaId] = useState<string | null>(null)
  const [cupomPreviewModalAberto, setCupomPreviewModalAberto] = useState(false)
  const [cupomPreviewHtml, setCupomPreviewHtml] = useState<string | null>(null)
  const [cupomPreviewLoading, setCupomPreviewLoading] = useState(false)
  const [emitindoNfceId, setEmitindoNfceId] = useState<string | null>(null)
  const [nfceModalMessage, setNfceModalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [fecharCaixaModalAberto, setFecharCaixaModalAberto] = useState(false)
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
    window.electronAPI.produtos.list(empresaId, { search: search || undefined, apenasAtivos: true }).then(setProdutos).catch(() => setProdutos([]))
  }, [empresaId, search, syncRefreshKey])

  useEffect(() => {
    if (!painelProdutosAberto || !empresaId || !window.electronAPI?.produtos) return
    const opts = searchProdutosPanel.trim()
      ? { search: searchProdutosPanel, apenasAtivos: true }
      : { apenasAtivos: true, ordenarPorMaisVendidos: true }
    window.electronAPI.produtos.list(empresaId, opts).then(setProdutosPanel).catch(() => setProdutosPanel([]))
  }, [painelProdutosAberto, empresaId, searchProdutosPanel, syncRefreshKey])

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
        const items = raw.filter((u): u is Usuario => u != null && typeof u === 'object') as Usuario[]
        setVendedores(items)
      })
      .catch(() => setVendedores([]))
  }, [empresaId, syncRefreshKey])

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
          preco_unitario: p.preco,
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement
      const isInput = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).getAttribute('contenteditable') === 'true')
      if (e.key === ' ' && !isInput && !vendedorModalAberto) {
        e.preventDefault()
        setPainelProdutosAberto((open) => !open)
        return
      }
      if (vendedorModalAberto && /^[1-9]$/.test(e.key)) {
        e.preventDefault()
        const idx = Number(e.key) - 1
        const vendedor = vendedores[idx]
        if (vendedor) {
          setVendedorId(vendedor.id)
          setVendedorModalAberto(false)
        }
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
  }, [lancarPorBusca, vendedorModalAberto, vendedores])

  const subtotal = cart.reduce((acc, i) => acc + i.preco_unitario * i.quantidade - i.desconto, 0)
  const total = subtotal - descontoTotal + acrescimoTotal
  const totalPagamentos = payments.reduce((acc, p) => acc + p.valor, 0)
  const troco = valorRecebido > total ? valorRecebido - total : 0
  const valorRestante = total - totalPagamentos

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
    if (!cupomPreviewModalAberto || !ultimaVendaId || !window.electronAPI?.cupom?.getHtml) return
    setCupomPreviewLoading(true)
    setCupomPreviewHtml(null)
    window.electronAPI.cupom
      .getHtml(ultimaVendaId)
      .then((html) => {
        setCupomPreviewHtml(html ?? '')
      })
      .finally(() => setCupomPreviewLoading(false))
  }, [cupomPreviewModalAberto, ultimaVendaId])

  const updateCartItem = (produtoId: string, upd: Partial<CartItem>) => {
    setCart((prev) =>
      prev
        .map((i) => (i.produto_id === produtoId ? { ...i, ...upd } : i))
        .filter((i) => i.quantidade > 0)
    )
  }

  const removeFromCart = (produtoId: string) => {
    setCart((prev) => prev.filter((i) => i.produto_id !== produtoId))
  }

  const addPayment = (forma?: PaymentRow['forma']) => {
    const v = Number(String(valorPag).replace(',', '.')) || 0
    if (v <= 0) return
    const formaToUse = forma ?? formaPag
    setPayments((prev) => [...prev, { forma: formaToUse, valor: v }])
    setValorPag('')
  }

  const removePayment = (index: number) => {
    setPayments((prev) => prev.filter((_, i) => i !== index))
  }

  const finalizar = async () => {
    setErro('')
    setSucesso(null)
    if (!caixaAberto) {
      setErro('Abra o caixa antes de vender.')
      return
    }
    if (cart.length === 0) {
      setErro('Adicione itens ao carrinho.')
      return
    }
    if (!vendedorId) {
      setErro('Selecione o vendedor da venda antes de finalizar.')
      setPagamentoModalAberto(false)
      setVendedorModalAberto(true)
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
    try {
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
        pagamentos: payments.map((p) => ({ forma: p.forma, valor: p.valor })),
        desconto_total: descontoTotal - acrescimoTotal,
        troco,
      })
      setSucesso(`Venda #${venda.numero} finalizada.`)
      setUltimaVendaId(venda.id)
      setCart([])
      setDescontoTotal(0)
      setAcrescimoTotal(0)
      setPayments([])
      setValorRecebido(0)
      setPagamentoModalAberto(false)
      setCupomPreviewModalAberto(true)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao finalizar venda.')
    } finally {
      setFinalizando(false)
    }
  }

  const handleImprimir = async (vendaId: string) => {
    setImprimindoId(vendaId)
    setErro('')
    try {
      const result = await window.electronAPI.cupom.imprimir(vendaId)
      if (!result.ok) setErro(result.error ?? 'Erro ao imprimir')
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
        setNfceModalMessage({ type: 'success', text: 'NFC-e emitida com sucesso.' })
        // Imprime o cupom fiscal completo (chave, QR code, tributos) na impressora configurada
        await handleImprimirCupomFiscal(vendaId)
      } else {
        setNfceModalMessage({ type: 'error', text: result.error ?? 'Erro ao emitir NFC-e.' })
      }
    } catch (err) {
      setNfceModalMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao emitir NFC-e.' })
    } finally {
      setEmitindoNfceId(null)
    }
  }

  const valorUnitarioFoco = produtoFoco?.preco ?? 0
  const valorTotalFoco = valorUnitarioFoco * qtyLancar

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

  if (!empresaId) {
    return (
      <Layout>
        <PageTitle title="PDV" subtitle="Sessão inválida." />
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="pdv-page">
        {/* Avisos compactos só quando necessário */}
        {!caixaAberto && (
          <div className="pdv-alerts">
            <Alert variant="warning" className="pdv-alert-inline" style={{ flex: 1 }}>
              Não há caixa aberto. Você pode abrir o caixa pela tela <strong>Caixa</strong> ou
              diretamente aqui no PDV.
            </Alert>
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon={<Wallet size={16} />}
              onClick={() => setAbrirCaixaModalAberto(true)}
            >
              Abrir caixa pelo PDV
            </Button>
          </div>
        )}
        {caixaAberto && (
          <div className="pdv-alerts">
            <Alert variant="info" className="pdv-alert-inline">
              Caixa aberto neste terminal. Você pode realizar o <strong>fechamento do caixa</strong> aqui pelo PDV.
            </Alert>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<Wallet size={16} />}
              onClick={async () => {
                if (!caixaAberto) return
                try {
                  const resumo = await window.electronAPI.caixa.getResumoFechamento(caixaAberto.id)
                  setResumoFechamento(resumo)
                  setValorCaixaContado(resumo ? resumo.saldo_atual.toFixed(2) : '')
                  setValorManterProximoCaixa('')
                  setFecharCaixaModalAberto(true)
                } catch (err) {
                  setErro(err instanceof Error ? err.message : 'Erro ao carregar resumo para fechamento de caixa.')
                }
              }}
            >
              Fechar caixa pelo PDV
            </Button>
          </div>
        )}
        {(erro || sucesso) && (
          <div className="pdv-alerts">
            <Alert variant={erro ? 'error' : 'success'} style={{ marginBottom: 0, flex: 1 }}>
              {erro || sucesso}
            </Alert>
            {sucesso && ultimaVendaId && !cupomPreviewModalAberto && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Printer size={16} />}
                onClick={() => handleImprimir(ultimaVendaId)}
                disabled={imprimindoId === ultimaVendaId}
              >
                {imprimindoId === ultimaVendaId ? 'Abrindo...' : 'Imprimir cupom'}
              </Button>
            )}
          </div>
        )}

        <div className="pdv-grid">
          {/* Coluna esquerda: imagem do produto + código de barras + quantidade + valores */}
          <section className="pdv-entrada">
            <div className="pdv-imagem-produto card">
              {produtoFoco ? (
                produtoFoco.imagem ? (
                  <img src={produtoFoco.imagem} alt="" />
                ) : (
                  <ProdutoPlaceholder />
                )
              ) : (
                <div className="pdv-imagem-placeholder">
                  <Package size={48} strokeWidth={1.2} />
                  <span>Imagem do produto</span>
                </div>
              )}
            </div>

            <div className="pdv-campos-lancamento card">
              <div className="pdv-field">
                <label className="pdv-field-label">Código de barras — F5</label>
                <div className="pdv-search-wrap">
                  <Search size={18} className="pdv-search-icon" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    data-pdv-search="true"
                    className="input-el pdv-search"
                    placeholder="Digite ou escaneie o código..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && lancarPorBusca()}
                    autoFocus
                  />
                </div>
              </div>
              <div className="pdv-field-row">
                <div className="pdv-field">
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
                <div className="pdv-field">
                  <label className="pdv-field-label">Valor unitário</label>
                  <input
                    type="text"
                    readOnly
                    value={valorUnitarioFoco > 0 ? `R$ ${valorUnitarioFoco.toFixed(2)}` : '0,00'}
                    className="input-el pdv-valor-readonly"
                  />
                </div>
                <div className="pdv-field">
                  <label className="pdv-field-label">Valor total</label>
                  <input
                    type="text"
                    readOnly
                    value={valorTotalFoco > 0 ? `R$ ${valorTotalFoco.toFixed(2)}` : '0,00'}
                    className="input-el pdv-valor-readonly pdv-valor-total"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={lancarPorBusca}
                disabled={!caixaAberto || !search.trim() || produtos.length === 0}
                className="pdv-btn-adicionar"
              >
                Adicionar ao cupom
              </Button>
            </div>

            <div className="pdv-produtos-atalho">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setPainelProdutosAberto(true)}
                disabled={!caixaAberto}
                className="pdv-btn-produtos"
              >
                <Package size={18} />
                Abrir produtos (Espaço)
              </Button>
              <p className="pdv-produtos-hint">Barra de espaço no teclado abre a tela de produtos — os mais vendidos aparecem primeiro.</p>
            </div>
          </section>

          {/* Coluna direita: Cupom (tabela) + Cliente + Subtotal + Pagamento + Finalizar */}
          <aside className="pdv-caixa">
            <div className="pdv-caixa-card card">
              <h3 className="pdv-cupom-title">Cupom</h3>

              <div className="pdv-cupom-tabela-wrap">
                {cart.length === 0 ? (
                  <p className="pdv-cart-empty">Nenhum item. Use o código de barras ou clique nos produtos.</p>
                ) : (
                  <table className="table pdv-cupom-table">
                    <thead>
                      <tr>
                        <th className="pdv-cupom-th-cod">Cód. barras</th>
                        <th className="pdv-cupom-th-desc">Descrição</th>
                        <th className="pdv-cupom-th-qtd">Qtd</th>
                        <th className="pdv-cupom-th-unit">Vlr. unit.</th>
                        <th className="pdv-cupom-th-total">Total</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((i) => (
                        <tr key={i.produto_id}>
                          <td className="pdv-cupom-cod">{i.codigo_barras || '—'}</td>
                          <td className="pdv-cupom-desc">{i.descricao}</td>
                          <td className="pdv-cupom-qtd-cell">
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={i.quantidade}
                              onChange={(e) => {
                                const v = Math.floor(Number(e.target.value) || 0)
                                updateCartItem(i.produto_id, {
                                  quantidade: v < 1 ? 0 : v,
                                })
                              }}
                              className="input-el pdv-cart-qty"
                            />
                          </td>
                          <td className="pdv-cupom-unit">R$ {i.preco_unitario.toFixed(2)}</td>
                          <td className="pdv-cupom-total">R$ {(i.preco_unitario * i.quantidade - i.desconto).toFixed(2)}</td>
                          <td>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFromCart(i.produto_id)}
                              aria-label="Remover"
                            >
                              ×
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="pdv-field pdv-vendedor-row">
                <label className="pdv-field-label">
                  <User size={16} /> Vendedor
                </label>
                <Select
                  options={vendedorOptions}
                  value={vendedorId}
                  onChange={(e) => setVendedorId(e.target.value)}
                />
              </div>

              <div className="pdv-field pdv-cliente-row">
                <label className="pdv-field-label"><User size={16} /> Cliente</label>
                <Select
                  options={clienteOptions}
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                />
              </div>
              <div className="pdv-subtotal-row">
                <span>Subtotal</span>
                <strong className="pdv-subtotal-valor">R$ {subtotal.toFixed(2)}</strong>
              </div>

              {cart.length > 0 && (
                <Button
                  type="button"
                  variant="primary"
                  fullWidth
                  size="lg"
                  onClick={() => setPagamentoModalAberto(true)}
                  className="pdv-btn-abrir-pagamento"
                >
                  <CreditCard size={20} />
                  Finalizar venda
                </Button>
              )}
            </div>
          </aside>
        </div>
      </div>

      <Dialog
        open={pagamentoModalAberto}
        onClose={() => setPagamentoModalAberto(false)}
        title="Finalizar venda"
        size="medium"
        showCloseButton={true}
      >
        <div className="pdv-modal-pagamento">
          <div className="pdv-modal-row">
            <span>Subtotal</span>
            <strong>R$ {subtotal.toFixed(2)}</strong>
          </div>
          <div className="pdv-modal-field">
            <label className="pdv-field-label">Desconto (R$)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={descontoTotal || ''}
              onChange={(e) => setDescontoTotal(Number(e.target.value) || 0)}
              className="input-el"
            />
          </div>
          <div className="pdv-modal-field">
            <label className="pdv-field-label">Acréscimo (R$)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={acrescimoTotal || ''}
              onChange={(e) => setAcrescimoTotal(Number(e.target.value) || 0)}
              className="input-el"
            />
          </div>
          <div className="pdv-modal-total">
            <span>Total</span>
            <strong>R$ {total.toFixed(2)}</strong>
          </div>

          <h4 className="pdv-section-label">
            <CreditCard size={18} /> Formas de pagamento
          </h4>
          <div className="pdv-payment-valor-recebido">
            <label className="pdv-field-label">Valor Recebido (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={valorPag}
              onChange={(e) => setValorPag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPayment()}
              className="input-el pdv-input-valor-recebido"
            />
          </div>
          <div className="pdv-formas-grid">
            {FORMAS.map((f) => (
              <button
                key={f.value}
                type="button"
                className="pdv-forma-btn"
                onClick={() => addPayment(f.value)}
                disabled={Number(String(valorPag).replace(',', '.')) <= 0}
                title={`Adicionar R$ ${valorPag || '0,00'} em ${f.label}`}
              >
                <span className="pdv-forma-btn-icon">{f.icon}</span>
                <span className="pdv-forma-btn-label">{f.label}</span>
              </button>
            ))}
          </div>
          <p className="pdv-formas-hint">Digite o valor e clique em uma ou mais formas para pagamento misto.</p>
          <div className="pdv-payments-list">
            {payments.map((p, idx) => (
              <div key={idx} className="pdv-payment-row">
                <span>
                  {FORMAS.find((f) => f.value === p.forma)?.label ?? p.forma}: R$ {p.valor.toFixed(2)}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => removePayment(idx)}>
                  Remover
                </Button>
              </div>
            ))}
          </div>
          <p className="pdv-payments-total">
            Total pagamentos: <strong>R$ {totalPagamentos.toFixed(2)}</strong>
          </p>

          {payments.some((p) => p.forma === 'DINHEIRO') && (
            <div className="pdv-modal-field pdv-troco">
              <label className="pdv-field-label">
                <Banknote size={16} /> Valor recebido em dinheiro (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={valorRecebido || ''}
                onChange={(e) => setValorRecebido(Number(e.target.value) || 0)}
                className="input-el"
              />
              {troco > 0 && (
                <p className="pdv-troco-value">Troco: R$ {troco.toFixed(2)}</p>
              )}
            </div>
          )}

          <Button
            type="button"
            variant="primary"
            fullWidth
            size="lg"
            onClick={finalizar}
            disabled={
              finalizando || Math.abs(totalPagamentos - total) > 0.01 || total <= 0
            }
            className="pdv-btn-finalizar"
          >
            {finalizando ? 'Finalizando...' : 'Confirmar e finalizar venda'}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={fecharCaixaModalAberto}
        onClose={() => setFecharCaixaModalAberto(false)}
        title="Fechamento de caixa pelo PDV"
        size="medium"
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
            setSucesso('Caixa fechado com sucesso.')
          } catch (err) {
            setErro(err instanceof Error ? err.message : 'Erro ao fechar o caixa.')
          } finally {
            setConfirmarFechamentoCaixa(false)
          }
        }}
      />

      {/* Pré-visualização do relatório de fechamento de caixa */}
      <Dialog
        open={previewFechamentoAberto && !!htmlFechamentoCaixa}
        onClose={() => {
          if (!imprimindoFechamento) setPreviewFechamentoAberto(false)
        }}
        title="Relatório de fechamento de caixa"
        size="medium"
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
        open={abrirCaixaModalAberto}
        onClose={() => {
          if (!abrindoCaixaPdv) setAbrirCaixaModalAberto(false)
        }}
        title="Abertura de caixa pelo PDV"
        size="medium"
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
            setSucesso('Caixa aberto com sucesso.')
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
        open={vendedorModalAberto}
        onClose={() => {
          if (vendedorId) setVendedorModalAberto(false)
        }}
        title="Selecione o vendedor"
        size="medium"
        showCloseButton={!!vendedorId}
      >
        <div className="pdv-vendedor-modal">
          <p className="pdv-vendedor-hint">
            Escolha quem está atendendo esta venda. Usaremos esse dado para relatórios e comissões.
          </p>
          <Select
            options={vendedorOptions}
            value={vendedorId}
            onChange={(e) => setVendedorId(e.target.value)}
          />
          <div className="pdv-vendedor-actions">
            <Button
              type="button"
              fullWidth
              onClick={() => vendedorId && setVendedorModalAberto(false)}
              disabled={!vendedorId}
            >
              Continuar para o PDV
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={cupomPreviewModalAberto}
        onClose={() => { setCupomPreviewModalAberto(false); setNfceModalMessage(null) }}
        title="Cupom — Pré-visualização"
        size="medium"
        showCloseButton={true}
      >
        <div className="pdv-cupom-preview-modal">
          {cupomPreviewLoading ? (
            <p className="pdv-cupom-preview-loading">Carregando cupom...</p>
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
              onClick={() => ultimaVendaId && handleImprimir(ultimaVendaId)}
              disabled={!ultimaVendaId || imprimindoId === ultimaVendaId}
            >
              {imprimindoId === ultimaVendaId ? 'Abrindo impressora...' : 'Imprimir cupom'}
            </Button>
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
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => { setCupomPreviewModalAberto(false); setNfceModalMessage(null) }}
            >
              Fechar
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={painelProdutosAberto}
        onClose={() => setPainelProdutosAberto(false)}
        title="Produtos — mais vendidos primeiro"
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
            {produtosPanel.map((p) => (
              <button
                key={p.id}
                type="button"
                className="pdv-produto-card"
                onClick={() => {
                  addToCart(p, qtyLancar)
                  setPainelProdutosAberto(false)
                }}
                disabled={!caixaAberto}
              >
                <div className="pdv-produto-card-img">
                  {p.imagem ? <img src={p.imagem} alt="" /> : <ProdutoPlaceholder />}
                </div>
                <div className="pdv-produto-card-body">
                  <span className="pdv-produto-card-nome">{p.nome}</span>
                  <span className="pdv-produto-card-preco">R$ {p.preco.toFixed(2)}</span>
                </div>
              </button>
            ))}
          </div>
          {produtosPanel.length === 0 && (
            <p className="pdv-empty">
              {searchProdutosPanel.trim() ? `Nenhum produto para "${searchProdutosPanel}"` : 'Nenhum produto cadastrado.'}
            </p>
          )}
        </div>
      </Dialog>
    </Layout>
  )
}
