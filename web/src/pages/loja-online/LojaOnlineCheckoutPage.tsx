import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CreditCard, Loader2, QrCode, Tag, Wallet } from 'lucide-react'
import {
  createLojaOnlinePedido,
  fetchLojaOnlineOrderBumps,
  fetchLojaOnlinePedidoCliente,
  fetchLojaOnlinePedidoItens,
  peekLojaOnlineOrderBumpsCache,
} from '../../lib/loja-online-api'
import { fetchCashbackSaldoOnline } from '../../lib/loja-online-cashback'
import { calcularFreteLojaOnline, enviarEmailPedidoLojaOnline, validarCupomLojaOnline } from '../../lib/loja-online-checkout-api'
import {
  clearCheckoutPedidoId,
  saveCheckoutPedidoId,
} from '../../lib/loja-online-checkout-session'
import {
  consultarStatusPagamentoLojaOnline,
  criarPagamentoLojaOnline,
  pagamentosPublicosFromStore,
  processarPagamentoMpLojaOnline,
  retomarPagamentoLojaOnline,
} from '../../lib/loja-online-pagamentos-api'
import { formatCurrency, lojaOnlineFreteGratisProgress, LOJA_ONLINE_OPCAO_FRETE_GRATIS } from '../../lib/loja-online'
import { buscarCep } from '../../lib/cep'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineCart } from '../../hooks/useLojaOnlineCart'
import { useLojaOnlineClienteAuth } from '../../hooks/useLojaOnlineClienteAuth'
import { LojaOnlineCheckoutSuccess } from '../../components/loja-online/LojaOnlineCheckoutSuccess'
import { LojaOnlineMercadoPagoBrick } from '../../components/loja-online/LojaOnlineMercadoPagoBrick'
import { LojaOnlineCheckoutAccordionStep } from '../../components/loja-online/LojaOnlineCheckoutAccordionStep'
import {
  LojaOnlineCheckoutOfertaBanner,
  LojaOnlineCheckoutOfertaTopBar,
} from '../../components/loja-online/LojaOnlineCheckoutOfertaHero'
import { LojaOnlineOrderBumpCards, orderBumpProdutoComPreco } from '../../components/loja-online/LojaOnlineOrderBumpCards'
import { resolveLojaOnlineOrderBumpOfertas } from '../../lib/loja-online-order-bumps'
import type {
  LojaOnlineCupomValidado,
  LojaOnlineFormaPagamento,
  LojaOnlineOpcaoFrete,
  LojaOnlineOrderBump,
  LojaOnlineOrderBumpOferta,
  LojaOnlinePedido,
  LojaOnlinePedidoItem,
} from '../../lib/loja-online-types'
import { pedidoAguardandoPagamentoOnline, pedidoTotalLiquido, parseLojaOnlineCheckoutOferta } from '../../lib/loja-online-types'

function maskCep(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

export function LojaOnlineCheckoutPage() {
  const { store, titulo, link, slug } = useLojaOnlineStore()
  const { items, total: subtotal, clear, addItem, removeItem } = useLojaOnlineCart()
  const { cliente, loading: authLoading } = useLojaOnlineClienteAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const permitirRetirada = store?.loja_online_permitir_retirada !== 0
  const permitirEntrega = store?.loja_online_permitir_entrega !== 0
  const exigirCadastro = store?.loja_online_exigir_cadastro !== 0
  const cashbackAtivo = store?.loja_online_cashback_ativo === 1 && !!cliente

  const [guestNome, setGuestNome] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestTelefone, setGuestTelefone] = useState('')
  const [cepLoading, setCepLoading] = useState(false)

  const pagamentos = useMemo(
    () => (store ? pagamentosPublicosFromStore(store) : null),
    [store]
  )

  useEffect(() => {
    if (!pagamentos) return
    if (pagamentos.asaasPix) setFormaPagamento('asaas_pix')
    else if (pagamentos.mercadopago) setFormaPagamento('mercadopago')
    else if (pagamentos.manual) setFormaPagamento('manual')
  }, [pagamentos?.asaasPix, pagamentos?.mercadopago, pagamentos?.manual])

  const [formaEntrega, setFormaEntrega] = useState<'retirada' | 'entrega'>(
    permitirRetirada ? 'retirada' : 'entrega'
  )
  const [formaPagamento, setFormaPagamento] = useState<LojaOnlineFormaPagamento>('manual')
  const [cep, setCep] = useState('')
  const [endereco, setEndereco] = useState('')
  const [editandoEndereco, setEditandoEndereco] = useState(false)
  const [observacoes, setObservacoes] = useState('')
  const [opcoesFrete, setOpcoesFrete] = useState<LojaOnlineOpcaoFrete[]>([])
  const [freteSelecionado, setFreteSelecionado] = useState<LojaOnlineOpcaoFrete | null>(null)
  const [freteLoading, setFreteLoading] = useState(false)
  const [cupomInput, setCupomInput] = useState('')
  const [cupom, setCupom] = useState<LojaOnlineCupomValidado | null>(null)
  const [cupomLoading, setCupomLoading] = useState(false)
  const [cashbackSaldo, setCashbackSaldo] = useState(0)
  const [usarCashback, setUsarCashback] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{
    pedido: LojaOnlinePedido
    itens: LojaOnlinePedidoItem[]
    pix?: { qrCodeImage: string; copyPaste: string; expirationDate: string } | null
  } | null>(null)
  const [recovering, setRecovering] = useState(false)
  /** Evita recovery competir com criação de PIX/cobrança no mesmo fluxo. */
  const checkoutAtivoRef = useRef(false)
  const cachedOrderBumps = store?.empresa_id
    ? peekLojaOnlineOrderBumpsCache(store.empresa_id)
    : null
  const [orderBumps, setOrderBumps] = useState<LojaOnlineOrderBump[]>(() => cachedOrderBumps ?? [])
  const [orderBumpsLoading, setOrderBumpsLoading] = useState(() => !cachedOrderBumps)
  const [selectedBumpIds, setSelectedBumpIds] = useState<Set<string>>(new Set())
  const [openStep, setOpenStep] = useState<'dados' | 'entrega' | 'pagamento' | null>(
    'entrega'
  )
  const [dadosDone, setDadosDone] = useState(false)
  const [entregaDone, setEntregaDone] = useState(false)
  const [pagamentoDone, setPagamentoDone] = useState(false)

  const pedidoQueryId = searchParams.get('pedido')
  const recoveringPedidoId = pedidoQueryId

  const valorFreteBase = formaEntrega === 'entrega' ? (freteSelecionado?.valor ?? 0) : 0
  const freteGratis = lojaOnlineFreteGratisProgress(store, subtotal)
  const valorFrete = formaEntrega === 'entrega' && freteGratis.unlocked ? 0 : valorFreteBase
  const valorDesconto = cupom?.desconto ?? 0
  const cashbackUsado = usarCashback ? Math.min(cashbackSaldo, subtotal - valorDesconto + valorFrete) : 0
  const total = pedidoTotalLiquido({ subtotal, valorFrete, valorDesconto, cashbackUsado })

  const cepEntrega = (cep.replace(/\D/g, '') || cliente?.cep?.replace(/\D/g, '') || '')
  const enderecoEntrega = (endereco.trim() || cliente?.endereco?.trim() || '')

  const ofertasBump = useMemo(() => {
    const cartSemBumps = items
      .filter((i) => !selectedBumpIds.has(i.produtoId))
      .map((i) => i.produtoId)
    return resolveLojaOnlineOrderBumpOfertas(orderBumps, cartSemBumps)
  }, [orderBumps, items, selectedBumpIds])

  const checkoutOferta = useMemo(
    () => parseLojaOnlineCheckoutOferta(store?.loja_online_checkout_oferta_json),
    [store?.loja_online_checkout_oferta_json]
  )

  useEffect(() => {
    if (!store?.empresa_id) return
    let cancelled = false
    setOrderBumpsLoading(true)
    fetchLojaOnlineOrderBumps(store.empresa_id, {
      somenteAtivos: true,
      includeTriggers: false,
    })
      .then((data) => {
        if (!cancelled) setOrderBumps(data)
      })
      .catch(() => {
        if (!cancelled) setOrderBumps([])
      })
      .finally(() => {
        if (!cancelled) setOrderBumpsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [store?.empresa_id])

  useEffect(() => {
    if (authLoading) return
    if (!cliente && !exigirCadastro && !dadosDone) setOpenStep('dados')
  }, [authLoading, cliente, exigirCadastro, dadosDone])

  const toggleOrderBump = useCallback((oferta: LojaOnlineOrderBumpOferta, checked: boolean) => {
    if (checked) {
      addItem(orderBumpProdutoComPreco(oferta), 1)
      setSelectedBumpIds((prev) => new Set(prev).add(oferta.produto.id))
    } else {
      removeItem(oferta.produto.id)
      setSelectedBumpIds((prev) => {
        const next = new Set(prev)
        next.delete(oferta.produto.id)
        return next
      })
    }
  }, [addItem, removeItem])

  useEffect(() => {
    if (!cliente) return
    setCep(cliente.cep ?? '')
    setEndereco(cliente.endereco ?? '')
    setEditandoEndereco(false)
  }, [cliente?.id, cliente?.cep, cliente?.endereco])

  useEffect(() => {
    if (!cashbackAtivo || !store?.empresa_id || !cliente?.cliente_pdv_id) {
      setCashbackSaldo(0)
      return
    }
    fetchCashbackSaldoOnline(store.empresa_id, cliente.cliente_pdv_id)
      .then((s) => setCashbackSaldo(s?.saldo_disponivel ?? 0))
      .catch(() => setCashbackSaldo(0))
  }, [cashbackAtivo, store?.empresa_id, cliente?.cliente_pdv_id])

  useEffect(() => {
    if (formaEntrega === 'entrega' && store?.loja_online_frete_tipo === 'gratis') {
      setOpcoesFrete([{ ...LOJA_ONLINE_OPCAO_FRETE_GRATIS }])
      setFreteSelecionado({ ...LOJA_ONLINE_OPCAO_FRETE_GRATIS })
    }
  }, [formaEntrega, store?.loja_online_frete_tipo])

  useEffect(() => {
    if (formaEntrega === 'entrega' && store?.loja_online_frete_tipo === 'fixo') {
      if (freteGratis.unlocked) {
        setOpcoesFrete([{ ...LOJA_ONLINE_OPCAO_FRETE_GRATIS }])
        setFreteSelecionado({ ...LOJA_ONLINE_OPCAO_FRETE_GRATIS })
        return
      }
      const valor = Number(store.loja_online_frete_valor_fixo) || 0
      setOpcoesFrete([{ servico: 'fixo', codigo: 'FIXO', nome: 'Frete fixo', valor, prazo: 0 }])
      setFreteSelecionado({ servico: 'fixo', codigo: 'FIXO', nome: 'Frete fixo', valor, prazo: 0 })
    }
  }, [formaEntrega, store?.loja_online_frete_tipo, store?.loja_online_frete_valor_fixo, freteGratis.unlocked])

  useEffect(() => {
    if (formaEntrega !== 'entrega' || store?.loja_online_frete_tipo !== 'correios') return
    if (freteGratis.unlocked) {
      setOpcoesFrete([{ ...LOJA_ONLINE_OPCAO_FRETE_GRATIS }])
      setFreteSelecionado({ ...LOJA_ONLINE_OPCAO_FRETE_GRATIS })
      return
    }
    setOpcoesFrete((prev) => (prev.length === 1 && prev[0]?.codigo === 'GRATIS' ? [] : prev))
    setFreteSelecionado((prev) => (prev?.codigo === 'GRATIS' ? null : prev))
  }, [formaEntrega, freteGratis.unlocked, store?.loja_online_frete_tipo])

  const metodosDisponiveis = useMemo(() => {
    if (!pagamentos) return []
    const list: { id: LojaOnlineFormaPagamento; label: string; hint: string; icon: React.ReactNode }[] = []
    if (pagamentos?.asaasPix) {
      list.push({ id: 'asaas_pix', label: 'PIX', hint: 'Pagamento instantâneo via Asaas', icon: <QrCode size={18} /> })
    }
    if (pagamentos?.mercadopago) {
      list.push({
        id: 'mercadopago',
        label: 'Mercado Pago',
        hint: 'Cartão, PIX e outros — pague sem sair da loja',
        icon: <CreditCard size={18} />,
      })
    }
    if (pagamentos.manual) {
      list.push({
        id: 'manual',
        label: 'Combinar / pagar na entrega',
        hint: 'Finalize e combine o pagamento com a loja',
        icon: <Wallet size={18} />,
      })
    }
    return list
  }, [pagamentos])

  const pagamentoUnico = metodosDisponiveis.length <= 1
  const metodoUnicoId = pagamentoUnico ? metodosDisponiveis[0]?.id : null

  useEffect(() => {
    if (!metodoUnicoId) return
    setFormaPagamento(metodoUnicoId)
    setPagamentoDone(true)
  }, [metodoUnicoId])

  const validateCheckout = (): string | null => {
    if (!cliente && exigirCadastro) return 'Faça login para continuar.'
    if (!cliente && !exigirCadastro) {
      if (!guestNome.trim()) return 'Informe seu nome.'
      if (!guestEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
        return 'Informe um e-mail válido.'
      }
    }
    if (formaEntrega === 'entrega') {
      if (!enderecoEntrega) return 'Cadastre um endereço na sua conta ou informe o endereço de entrega.'
      if (!freteSelecionado && store?.loja_online_frete_tipo === 'correios') {
        return 'Calcule e selecione uma opção de frete.'
      }
    }
    if (total <= 0) return 'Total do pedido inválido.'
    return null
  }

  const dadosProntos =
    !!cliente ||
    (!!guestNome.trim() && !!guestEmail.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim()))

  const entregaPronta =
    formaEntrega === 'retirada' ||
    (formaEntrega === 'entrega' &&
      !!enderecoEntrega &&
      (store?.loja_online_frete_tipo !== 'correios' || !!freteSelecionado || freteGratis.unlocked))

  const confirmarDados = () => {
    if (!dadosProntos) {
      setError('Informe nome e e-mail para continuar.')
      return
    }
    setError(null)
    setDadosDone(true)
    setOpenStep('entrega')
  }

  const confirmarEntrega = () => {
    if (!entregaPronta) {
      setError(
        formaEntrega === 'entrega'
          ? 'Informe o endereço e o frete para continuar.'
          : 'Escolha como deseja receber o pedido.'
      )
      return
    }
    setError(null)
    setEntregaDone(true)
    if (pagamentoUnico) {
      setPagamentoDone(true)
      setOpenStep(null)
    } else {
      setOpenStep('pagamento')
    }
  }

  const escolherPagamento = (id: LojaOnlineFormaPagamento) => {
    setFormaPagamento(id)
    setPagamentoDone(true)
    setOpenStep('pagamento')
  }

  const buildPedidoInput = () => ({
    empresaId: store!.empresa_id,
    cliente: cliente ?? null,
    guest: cliente
      ? undefined
      : {
          nome: guestNome.trim(),
          email: guestEmail.trim(),
          telefone: guestTelefone.trim() || null,
        },
    items,
    formaEntrega,
    enderecoEntrega: formaEntrega === 'entrega' ? enderecoEntrega : undefined,
    observacoes,
    formaPagamento,
    valorFrete,
    valorDesconto,
    cashbackUsado,
    cupomId: cupom?.id ?? null,
    cupomCodigo: cupom?.codigo ?? null,
    tipoFrete: freteSelecionado?.servico ?? null,
    cepDestino: formaEntrega === 'entrega' ? cepEntrega : cep,
  })

  const finalizeCheckout = useCallback(
    (
      result: { pedido: LojaOnlinePedido; itens: LojaOnlinePedidoItem[] },
      pix: { qrCodeImage: string; copyPaste: string; expirationDate: string } | null | undefined,
      opts?: { limparCarrinho?: boolean; limparSessao?: boolean }
    ) => {
      if (!store?.empresa_id) return
      if (opts?.limparCarrinho !== false) clear()
      if (opts?.limparSessao) clearCheckoutPedidoId(store.empresa_id)
      else saveCheckoutPedidoId(store.empresa_id, result.pedido.id)
      setDone({ ...result, pix: pix ?? null })
      navigate(
        { pathname: link('checkout'), search: `?pedido=${encodeURIComponent(result.pedido.id)}` },
        { replace: true }
      )
    },
    [store?.empresa_id, clear, navigate, link]
  )

  const handleMercadoPagoBrickPay = useCallback(
    async (formData: Record<string, unknown>) => {
      if (!store?.empresa_id || !slug) return
    if (exigirCadastro && !cliente) return
      const validationError = validateCheckout()
      if (validationError) {
        setError(validationError)
        throw new Error(validationError)
      }
      setSaving(true)
      setError(null)
      checkoutAtivoRef.current = true
      try {
        const result = await createLojaOnlinePedido(buildPedidoInput())
        const pay = await processarPagamentoMpLojaOnline(result.pedido.id, slug, formData)

        if (pay.status === 'approved') {
          finalizeCheckout(
            {
              pedido: { ...result.pedido, pagamento_status: 'pago', status: 'pagamento_aprovado' },
              itens: result.itens,
            },
            null,
            { limparSessao: true }
          )
          return
        }

        if (pay.pix) {
          finalizeCheckout(
            {
              pedido: { ...result.pedido, pagamento_status: 'pendente', status: 'aguardando_pagamento' },
              itens: result.itens,
            },
            pay.pix
          )
          return
        }

        finalizeCheckout(
          {
            pedido: { ...result.pedido, pagamento_status: 'pendente', status: 'aguardando_pagamento' },
            itens: result.itens,
          },
          null
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao processar pagamento.'
        setError(msg)
        throw err
      } finally {
        checkoutAtivoRef.current = false
        setSaving(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- buildPedidoInput usa estado do checkout
    [store?.empresa_id, slug, cliente, items, formaEntrega, endereco, observacoes, formaPagamento, valorFrete, valorDesconto, cashbackUsado, cupom, freteSelecionado, cep, finalizeCheckout]
  )

  useEffect(() => {
    if (
      !recoveringPedidoId ||
      !store?.empresa_id ||
      !cliente?.id ||
      !slug ||
      done ||
      saving ||
      checkoutAtivoRef.current
    ) {
      return
    }

    let cancelled = false
    setRecovering(true)

    void (async () => {
      const timeout = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('timeout')), 10000)
      })
      try {
        const pedido = await Promise.race([
          fetchLojaOnlinePedidoCliente(store.empresa_id, cliente.id, recoveringPedidoId),
          timeout,
        ])
        if (cancelled) return
        if (!pedido) {
          clearCheckoutPedidoId(store.empresa_id)
          navigate({ pathname: link('checkout'), search: '' }, { replace: true })
          return
        }

        const itens = await fetchLojaOnlinePedidoItens(pedido.id)
        if (cancelled) return

        await consultarStatusPagamentoLojaOnline(pedido.id, slug).catch(() => null)
        const atualizado =
          (await fetchLojaOnlinePedidoCliente(store.empresa_id, cliente.id, recoveringPedidoId)) ?? pedido

        if (atualizado.pagamento_status === 'pago' || atualizado.status === 'pagamento_aprovado') {
          clear()
          clearCheckoutPedidoId(store.empresa_id)
          setDone({ pedido: atualizado, itens, pix: null })
          return
        }

        if (pedidoAguardandoPagamentoOnline(atualizado)) {
          const retomar = await Promise.race([
            retomarPagamentoLojaOnline(atualizado.id, slug).catch(() => null),
            new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 8000)),
          ])
          if (cancelled) return

          if (retomar && 'alreadyPaid' in retomar && retomar.alreadyPaid) {
            clear()
            clearCheckoutPedidoId(store.empresa_id)
            setDone({
              pedido: { ...atualizado, pagamento_status: 'pago', status: 'pagamento_aprovado' },
              itens,
              pix: null,
            })
            return
          }

          const pixData =
            retomar && (retomar.tipo === 'asaas_pix' || retomar.tipo === 'pix') ? retomar.pix : null
          setDone({ pedido: atualizado, itens, pix: pixData })
          return
        }

        clearCheckoutPedidoId(store.empresa_id)
        setDone({ pedido: atualizado, itens, pix: null })
      } catch {
        if (!cancelled) {
          clearCheckoutPedidoId(store.empresa_id)
          navigate({ pathname: link('checkout'), search: '' }, { replace: true })
        }
      } finally {
        if (!cancelled) setRecovering(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [recoveringPedidoId, store?.empresa_id, cliente?.id, slug, done, saving, clear, navigate, link])

  const calcularFrete = async (cepDestino: string) => {
    if (!slug || formaEntrega !== 'entrega') return
    const digits = cepDestino.replace(/\D/g, '')
    if (digits.length !== 8) return
    setFreteLoading(true)
    setError(null)
    try {
      const res = await calcularFreteLojaOnline(slug, digits, undefined, subtotal)
      setOpcoesFrete(res.opcoes)
      setFreteSelecionado(res.opcoes[0] ?? null)
    } catch (err) {
      setOpcoesFrete([])
      setFreteSelecionado(null)
      setError(err instanceof Error ? err.message : 'Erro ao calcular frete.')
    } finally {
      setFreteLoading(false)
    }
  }

  useEffect(() => {
    if (formaEntrega !== 'entrega' || !slug || store?.loja_online_frete_tipo !== 'correios') return
    if (freteGratis.unlocked) return
    if (cepEntrega.length !== 8 || freteLoading || opcoesFrete.length > 0) return
    void calcularFrete(cepEntrega)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-calcula frete do cadastro uma vez
  }, [formaEntrega, slug, store?.loja_online_frete_tipo, cepEntrega, freteGratis.unlocked])

  const aplicarCupom = async () => {
    if (!slug || !cupomInput.trim()) return
    setCupomLoading(true)
    setError(null)
    try {
      const validado = await validarCupomLojaOnline(slug, cupomInput.trim(), subtotal)
      setCupom(validado)
    } catch (err) {
      setCupom(null)
      setError(err instanceof Error ? err.message : 'Cupom inválido.')
    } finally {
      setCupomLoading(false)
    }
  }

  const preencherCep = async (raw: string) => {
    const digits = raw.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepLoading(true)
    try {
      const data = await buscarCep(digits)
      if (!data) return
      const linha = [data.logradouro, data.bairro, data.localidade, data.uf].filter(Boolean).join(', ')
      if (linha) setEndereco((prev) => (prev.trim() ? prev : linha))
    } finally {
      setCepLoading(false)
    }
  }

  if (authLoading) {
    return <p className="loja-catalogo-empty">Carregando…</p>
  }

  if (!cliente && exigirCadastro) {
    return (
      <div className="loja-store-page loja-store-empty-state">
        <h1>Faça login para continuar</h1>
        <p>É necessário ter uma conta para finalizar compras nesta loja.</p>
        <Link to={link('entrar')} state={{ from: link('checkout') }} className="loja-store-btn-primary loja-store-btn-inline">
          Entrar ou criar conta
        </Link>
      </div>
    )
  }

  if (saving && !done) {
    return (
      <div className="loja-store-page loja-store-success">
        <Loader2 size={48} className="loja-store-success-icon loja-store-success-icon--spin" />
        <h1>Gerando pagamento…</h1>
        <p className="loja-online-hint">Aguarde enquanto preparamos o PIX ou confirmamos o cartão.</p>
      </div>
    )
  }

  if (recovering) {
    return (
      <div className="loja-store-page loja-store-success">
        <Loader2 size={48} className="loja-store-success-icon loja-store-success-icon--spin" />
        <h1>Verificando seu pedido…</h1>
        <p className="loja-online-hint">Aguarde enquanto confirmamos o status do pagamento.</p>
      </div>
    )
  }

  if (items.length === 0 && !done && !recovering) {
    navigate(link('carrinho'), { replace: true })
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!store?.empresa_id || !slug) return
    if (exigirCadastro && !cliente) return
    if (formaPagamento === 'mercadopago') return

    const validationError = validateCheckout()
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError(null)
    checkoutAtivoRef.current = true
    try {
      const result = await createLojaOnlinePedido(buildPedidoInput())

      let pix: { qrCodeImage: string; copyPaste: string; expirationDate: string } | null = null
      if (formaPagamento === 'asaas_pix') {
        const pag = await criarPagamentoLojaOnline(result.pedido.id, slug)
        if (pag.tipo === 'asaas_pix') {
          pix = pag.pix
        }
      }

      finalizeCheckout(result, pix, {
        limparSessao: formaPagamento === 'manual',
      })

      const emailTo = cliente?.email ?? guestEmail.trim()
      if (emailTo) {
        void enviarEmailPedidoLojaOnline({
          to: emailTo,
          subject: `Pedido confirmado — ${titulo}`,
          html: `<p>Olá ${cliente?.nome ?? guestNome},</p><p>Recebemos seu pedido <strong>#${result.pedido.id.slice(0, 8).toUpperCase()}</strong> no valor de <strong>${formatCurrency(result.pedido.total)}</strong>.</p><p>Obrigado por comprar em ${titulo}!</p>`,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar pedido.')
    } finally {
      checkoutAtivoRef.current = false
      setSaving(false)
    }
  }

  if (done) {
    return (
      <LojaOnlineCheckoutSuccess
        pedido={done.pedido}
        itens={done.itens}
        titulo={titulo}
        slug={slug}
        link={link}
        whatsapp={store?.loja_online_whatsapp}
        mensagemCheckout={store?.loja_online_mensagem_checkout}
        clienteLogado={!!cliente}
        pix={done.pix}
        empresaId={store?.empresa_id}
        onAbandon={() => {
          if (store?.empresa_id) clearCheckoutPedidoId(store.empresa_id)
          setDone(null)
          navigate(link(), { replace: true })
        }}
      />
    )
  }

  return (
    <div className="loja-store-page loja-store-checkout-page">
      {store?.empresa_id && (
        <LojaOnlineCheckoutOfertaTopBar empresaId={store.empresa_id} oferta={checkoutOferta} />
      )}

      <div className="loja-store-checkout-toolbar">
        <Link
          to={link('carrinho')}
          className="loja-store-checkout-back"
          aria-label="Voltar ao carrinho"
        >
          <ArrowLeft size={22} strokeWidth={2.25} />
        </Link>
      </div>

      <div className="loja-store-checkout-layout">
        <div className="loja-store-checkout-main">
          {store?.empresa_id && <LojaOnlineCheckoutOfertaBanner oferta={checkoutOferta} />}

          <LojaOnlineOrderBumpCards
            ofertas={ofertasBump}
            selectedIds={selectedBumpIds}
            onToggle={toggleOrderBump}
            loading={orderBumpsLoading}
          />

          {!cliente && !exigirCadastro && (
            <LojaOnlineCheckoutAccordionStep
              number={1}
              title="Seus dados"
              summary={dadosDone ? `${guestNome} · ${guestEmail}` : null}
              open={openStep === 'dados'}
              done={dadosDone}
              onToggle={() => setOpenStep(openStep === 'dados' ? null : 'dados')}
            >
              <div className="loja-store-checkout-step-body loja-store-guest-fields">
                <label className="input-wrap">
                  <span className="input-label">Nome completo</span>
                  <input className="input-el" value={guestNome} onChange={(e) => setGuestNome(e.target.value)} required />
                </label>
                <label className="input-wrap">
                  <span className="input-label">E-mail</span>
                  <input className="input-el" type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} required />
                </label>
                <label className="input-wrap">
                  <span className="input-label">Telefone (opcional)</span>
                  <input className="input-el" value={guestTelefone} onChange={(e) => setGuestTelefone(e.target.value)} />
                </label>
                <p className="loja-online-hint">
                  Já tem conta? <Link to={link('entrar')} state={{ from: link('checkout') }}>Entrar</Link>
                </p>
                <button type="button" className="loja-store-btn-primary" onClick={confirmarDados} disabled={!dadosProntos}>
                  Continuar
                </button>
              </div>
            </LojaOnlineCheckoutAccordionStep>
          )}

          <LojaOnlineCheckoutAccordionStep
            number={!cliente && !exigirCadastro ? 2 : 1}
            title="Como receber"
            summary={
              entregaDone
                ? formaEntrega === 'retirada'
                  ? 'Retirar na loja'
                  : `Entrega${enderecoEntrega ? ` · ${enderecoEntrega}` : ''}`
                : null
            }
            open={openStep === 'entrega'}
            done={entregaDone}
            onToggle={() => setOpenStep(openStep === 'entrega' ? null : 'entrega')}
          >
            <div className="loja-store-radio-group loja-store-radio-group--inline">
              {permitirRetirada && (
                <label className="loja-store-radio-chip">
                  <input
                    type="radio"
                    name="entrega"
                    checked={formaEntrega === 'retirada'}
                    onChange={() => {
                      setFormaEntrega('retirada')
                      setFreteSelecionado(null)
                    }}
                  />
                  Retirar na loja
                </label>
              )}
              {permitirEntrega && (
                <label className="loja-store-radio-chip">
                  <input
                    type="radio"
                    name="entrega"
                    checked={formaEntrega === 'entrega'}
                    onChange={() => setFormaEntrega('entrega')}
                  />
                  Entrega
                </label>
              )}
            </div>

            {formaEntrega === 'entrega' && (
              <div className="loja-store-checkout-step-body">
                {enderecoEntrega && !editandoEndereco ? (
                  <div className="loja-store-endereco-cadastro">
                    <p className="loja-store-endereco-cadastro-label">Endereço de entrega</p>
                    <p className="loja-store-endereco-cadastro-text">
                      {enderecoEntrega}
                      {cepEntrega ? ` · CEP ${maskCep(cepEntrega)}` : ''}
                    </p>
                    <button type="button" className="loja-store-link-btn" onClick={() => setEditandoEndereco(true)}>
                      Usar outro endereço
                    </button>
                  </div>
                ) : (
                  <>
                    <label className="input-wrap">
                      <span className="input-label">CEP</span>
                      <div className="loja-store-cep-row">
                        <input
                          className="input-el"
                          value={maskCep(cep)}
                          onChange={(e) => setCep(e.target.value)}
                          onBlur={(e) => preencherCep(e.target.value)}
                          placeholder="00000-000"
                          required
                        />
                        <button
                          type="button"
                          className="loja-store-btn-outline"
                          disabled={freteLoading || cepLoading || cep.replace(/\D/g, '').length !== 8}
                          onClick={() => {
                            void preencherCep(cep)
                            calcularFrete(cep)
                          }}
                        >
                          {freteLoading || cepLoading ? 'Buscando…' : 'CEP / Frete'}
                        </button>
                      </div>
                    </label>

                    {opcoesFrete.length > 0 && (
                      <div className="loja-store-frete-opcoes">
                        {opcoesFrete.map((op) => (
                          <label key={op.codigo} className={`loja-store-pay-option${freteSelecionado?.codigo === op.codigo ? ' is-active' : ''}`}>
                            <input
                              type="radio"
                              name="frete"
                              checked={freteSelecionado?.codigo === op.codigo}
                              onChange={() => setFreteSelecionado(op)}
                            />
                            <span className="loja-store-pay-option-text">
                              <strong>{op.nome}</strong>
                              <small>
                                {formatCurrency(op.valor)}
                                {op.prazo > 0 ? ` · até ${op.prazo} dia(s) úteis` : ''}
                              </small>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}

                    <label className="input-wrap">
                      <span className="input-label">Endereço completo</span>
                      <textarea
                        className="input-el loja-online-textarea"
                        rows={2}
                        value={endereco}
                        onChange={(e) => setEndereco(e.target.value)}
                        required
                      />
                    </label>
                  </>
                )}

                {enderecoEntrega && !editandoEndereco && store?.loja_online_frete_tipo === 'correios' && opcoesFrete.length > 0 && (
                  <div className="loja-store-frete-opcoes">
                    {opcoesFrete.map((op) => (
                      <label key={op.codigo} className={`loja-store-pay-option${freteSelecionado?.codigo === op.codigo ? ' is-active' : ''}`}>
                        <input
                          type="radio"
                          name="frete"
                          checked={freteSelecionado?.codigo === op.codigo}
                          onChange={() => setFreteSelecionado(op)}
                        />
                        <span className="loja-store-pay-option-text">
                          <strong>{op.nome}</strong>
                          <small>
                            {formatCurrency(op.valor)}
                            {op.prazo > 0 ? ` · até ${op.prazo} dia(s) úteis` : ''}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <label className="input-wrap loja-store-checkout-obs">
              <span className="input-label">Observações (opcional)</span>
              <input
                className="input-el"
                type="text"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex.: entregar após 18h"
              />
            </label>
            <button type="button" className="loja-store-btn-primary" onClick={confirmarEntrega} disabled={!entregaPronta}>
              Continuar
            </button>
          </LojaOnlineCheckoutAccordionStep>

          {!pagamentoUnico && (
            <LojaOnlineCheckoutAccordionStep
              number={!cliente && !exigirCadastro ? 3 : 2}
              title="Pagamento"
              summary={pagamentoDone ? (metodosDisponiveis.find((m) => m.id === formaPagamento)?.label ?? null) : null}
              open={openStep === 'pagamento'}
              done={pagamentoDone}
              onToggle={() => setOpenStep(openStep === 'pagamento' ? null : 'pagamento')}
            >
              <div className="loja-store-pay-options">
                {metodosDisponiveis.map((m) => (
                  <label key={m.id} className={`loja-store-pay-option${formaPagamento === m.id ? ' is-active' : ''}`}>
                    <input
                      type="radio"
                      name="pagamento"
                      checked={formaPagamento === m.id}
                      onChange={() => escolherPagamento(m.id)}
                    />
                    <span className="loja-store-pay-option-icon">{m.icon}</span>
                    <span className="loja-store-pay-option-text">
                      <strong>{m.label}</strong>
                      <small>{m.hint}</small>
                    </span>
                  </label>
                ))}
              </div>
            </LojaOnlineCheckoutAccordionStep>
          )}

          {formaPagamento === 'mercadopago' && !pagamentos?.mercadopagoPublicKey && (
            <p className="loja-online-field-error">Public Key do Mercado Pago não configurada no painel da loja.</p>
          )}
        </div>

        <aside className="loja-store-checkout-sidebar">
          <form onSubmit={handleSubmit} className="loja-store-checkout-summary-form">
            <h2 className="loja-store-checkout-summary-title">Resumo</h2>

            <ul className="loja-store-checkout-items">
              {items.map((item) => (
                <li key={item.produtoId} className="loja-store-checkout-item">
                  <span className="loja-store-checkout-item-qty">{item.quantidade}×</span>
                  <span className="loja-store-checkout-item-name">{item.nome}</span>
                  <span className="loja-store-checkout-item-price">
                    {formatCurrency(item.preco * item.quantidade)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="loja-store-checkout-extras">
              <div className="loja-store-checkout-cupom">
                <span className="input-label"><Tag size={14} /> Cupom</span>
                <div className="loja-store-cep-row">
                  <input
                    className="input-el input-el--sm"
                    value={cupomInput}
                    onChange={(e) => setCupomInput(e.target.value.toUpperCase())}
                    placeholder="Código"
                  />
                  <button type="button" className="loja-store-btn-outline loja-store-btn-sm" onClick={aplicarCupom} disabled={cupomLoading}>
                    {cupomLoading ? '…' : 'Aplicar'}
                  </button>
                </div>
                {cupom && (
                  <p className="loja-store-cupom-aplicado">
                    <strong>{cupom.codigo}</strong> − {formatCurrency(cupom.desconto)}
                    <button type="button" className="loja-store-link-btn" onClick={() => { setCupom(null); setCupomInput('') }}>
                      Remover
                    </button>
                  </p>
                )}
              </div>

              {cashbackAtivo && cashbackSaldo > 0 && (
                <label className="loja-online-toggle loja-store-checkout-cashback">
                  <input type="checkbox" checked={usarCashback} onChange={(e) => setUsarCashback(e.target.checked)} />
                  <span>Usar cashback ({formatCurrency(cashbackSaldo)})</span>
                </label>
              )}
            </div>

            <div className="loja-store-checkout-totals">
              <div className="loja-store-summary-row"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              {formaEntrega === 'entrega' && (valorFrete > 0 || freteGratis.unlocked) && (
                <div className="loja-store-summary-row">
                  <span>Frete</span>
                  <span>{freteGratis.unlocked ? 'Grátis' : formatCurrency(valorFrete)}</span>
                </div>
              )}
              {valorDesconto > 0 && (
                <div className="loja-store-summary-row loja-store-summary-row--discount">
                  <span>Desconto</span><span>− {formatCurrency(valorDesconto)}</span>
                </div>
              )}
              {cashbackUsado > 0 && (
                <div className="loja-store-summary-row loja-store-summary-row--discount">
                  <span>Cashback</span><span>− {formatCurrency(cashbackUsado)}</span>
                </div>
              )}
              <div className="loja-store-summary-row loja-store-summary-row--total">
                <span>Total</span>
                <strong>{formatCurrency(total)}</strong>
              </div>
            </div>

            {error && <p className="loja-online-field-error">{error}</p>}

            {formaPagamento === 'mercadopago' && pagamentos?.mercadopagoPublicKey ? (
              <div className="loja-store-mp-brick-wrap loja-store-mp-brick-wrap--after-summary">
                <LojaOnlineMercadoPagoBrick
                  key={`${pagamentos.mercadopagoPublicKey}-${total}`}
                  publicKey={pagamentos.mercadopagoPublicKey}
                  amount={total}
                  email={cliente?.email ?? guestEmail}
                  payerName={cliente?.nome ?? guestNome}
                  processing={saving}
                  onSubmit={handleMercadoPagoBrickPay}
                  onError={setError}
                />
              </div>
            ) : (
              <button type="submit" className="loja-store-btn-primary loja-store-btn-block" disabled={saving || metodosDisponiveis.length === 0}>
                {saving
                  ? 'Processando…'
                  : formaPagamento === 'asaas_pix'
                    ? 'Gerar PIX e finalizar'
                    : 'Confirmar pedido'}
              </button>
            )}
          </form>
        </aside>
      </div>
    </div>
  )
}
