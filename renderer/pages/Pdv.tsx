import { useState, useEffect, useCallback, useRef } from 'react'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import type { Produto, Caixa, Cliente } from '../vite-env'
import { PageTitle, Button, Alert, Select, Dialog } from '../components/ui'
import { Printer, Search, Package, User, CreditCard, Banknote, QrCode, CircleDollarSign } from 'lucide-react'

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

  const [caixaAberto, setCaixaAberto] = useState<Caixa | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [descontoTotal, setDescontoTotal] = useState(0)
  const [acrescimoTotal, setAcrescimoTotal] = useState(0)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [valorRecebido, setValorRecebido] = useState(0)
  const [clienteId, setClienteId] = useState<string>('')
  const [formaPag, setFormaPag] = useState<PaymentRow['forma']>('DINHEIRO')
  const [valorPag, setValorPag] = useState('')
  const [pagamentoModalAberto, setPagamentoModalAberto] = useState(false)
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

  useEffect(() => {
    if (!empresaId || !window.electronAPI?.caixa) return
    window.electronAPI.caixa.getAberto(empresaId).then(setCaixaAberto).catch(() => setCaixaAberto(null))
  }, [empresaId])

  useEffect(() => {
    if (!empresaId || !window.electronAPI?.produtos) return
    window.electronAPI.produtos.list(empresaId, { search: search || undefined, apenasAtivos: true }).then(setProdutos).catch(() => setProdutos([]))
  }, [empresaId, search])

  useEffect(() => {
    if (!painelProdutosAberto || !empresaId || !window.electronAPI?.produtos) return
    const opts = searchProdutosPanel.trim()
      ? { search: searchProdutosPanel, apenasAtivos: true }
      : { apenasAtivos: true, ordenarPorMaisVendidos: true }
    window.electronAPI.produtos.list(empresaId, opts).then(setProdutosPanel).catch(() => setProdutosPanel([]))
  }, [painelProdutosAberto, empresaId, searchProdutosPanel])

  useEffect(() => {
    if (!empresaId) return
    const api = window.electronAPI?.clientes
    if (api) api.list(empresaId).then(setClientes).catch(() => setClientes([]))
    else setClientes([])
  }, [empresaId])

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
      if (e.key === ' ' && !isInput) {
        e.preventDefault()
        setPainelProdutosAberto((open) => !open)
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
  }, [lancarPorBusca])

  const subtotal = cart.reduce((acc, i) => acc + i.preco_unitario * i.quantidade - i.desconto, 0)
  const total = subtotal - descontoTotal + acrescimoTotal
  const totalPagamentos = payments.reduce((acc, p) => acc + p.valor, 0)
  const troco = valorRecebido > total ? valorRecebido - total : 0
  const valorRestante = total - totalPagamentos

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
        usuario_id: userId,
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

  const valorUnitarioFoco = produtoFoco?.preco ?? 0
  const valorTotalFoco = valorUnitarioFoco * qtyLancar

  const clienteOptions = [
    { value: '', label: 'Consumidor final' },
    ...clientes.map((c) => ({ value: c.id, label: c.nome })),
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
          <Alert variant="warning" className="pdv-alert-inline">
            Não há caixa aberto. Abra o caixa na tela <strong>Caixa</strong> para vender.
          </Alert>
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
        open={cupomPreviewModalAberto}
        onClose={() => setCupomPreviewModalAberto(false)}
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
              onClick={() => setCupomPreviewModalAberto(false)}
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
