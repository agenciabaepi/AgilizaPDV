import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CreditCard, Loader2, MapPin, QrCode, Tag, Wallet } from 'lucide-react'
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
import { formatCPF, formatPhone, isValidCPF, isValidPhone, onlyDigits } from '../../lib/validators'
import {
  cidadesIguais,
  extrairCidadeDeEndereco,
  formatarEnderecoEntrega,
  maskCep,
  pagamentoManualLiberado,
} from '../../lib/loja-online-endereco'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineCart } from '../../hooks/useLojaOnlineCart'
import { useLojaOnlineClienteAuth } from '../../hooks/useLojaOnlineClienteAuth'
import { LojaOnlineCheckoutSuccess } from '../../components/loja-online/LojaOnlineCheckoutSuccess'
import { LojaOnlineMercadoPagoBrick } from '../../components/loja-online/LojaOnlineMercadoPagoBrick'
import { LojaOnlineCheckoutAccordionStep } from '../../components/loja-online/LojaOnlineCheckoutAccordionStep'
import { getLojaOnlineAttribution } from '../../lib/loja-online-attribution'
import { trackLojaOnlineEvent } from '../../lib/loja-online-track'
import { cepParaUf, lojaOnlineFreteContexto, trackLojaOnlineBehavior } from '../../lib/loja-online-behavior'
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
  const [guestCpf, setGuestCpf] = useState('')
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
  const [logradouro, setLogradouro] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [uf, setUf] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')
  const [referencia, setReferencia] = useState('')
  const [cepErro, setCepErro] = useState<string | null>(null)
  const [cidadeLoja, setCidadeLoja] = useState<string | null>(null)
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
  const skipScrollOnMount = useRef(true)
  const beginCheckoutTracked = useRef(false)

  useEffect(() => {
    if (beginCheckoutTracked.current || !store?.empresa_id || items.length === 0 || done) return
    beginCheckoutTracked.current = true
    void trackLojaOnlineEvent({
      empresaId: store.empresa_id,
      eventName: 'begin_checkout',
      value: subtotal,
      contentIds: items.map((i) => i.produtoId),
    })
  }, [store?.empresa_id, items, subtotal, done])

  useEffect(() => {
    if (skipScrollOnMount.current) {
      skipScrollOnMount.current = false
      return
    }
    if (!openStep) return
    // Aguarda o DOM trocar a etapa (accordion) antes de rolar
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
      })
    })
  }, [openStep])

  const pedidoQueryId = searchParams.get('pedido')
  const recoveringPedidoId = pedidoQueryId

  const valorFreteBase = formaEntrega === 'entrega' ? (freteSelecionado?.valor ?? 0) : 0
  const freteGratis = lojaOnlineFreteGratisProgress(store, subtotal)
  const valorFrete = formaEntrega === 'entrega' && freteGratis.unlocked ? 0 : valorFreteBase
  const valorDesconto = cupom?.desconto ?? 0
  const cashbackUsado = usarCashback ? Math.min(cashbackSaldo, subtotal - valorDesconto + valorFrete) : 0
  const total = pedidoTotalLiquido({ subtotal, valorFrete, valorDesconto, cashbackUsado })

  const cepEntrega = (cep.replace(/\D/g, '') || cliente?.cep?.replace(/\D/g, '') || '')
  const guestCheckout = !cliente && !exigirCadastro
  const mostrarFormEndereco = !guestCheckout && (!cliente?.endereco?.trim() || editandoEndereco)
  const enderecoFormatado = formatarEnderecoEntrega({
    cep: cepEntrega,
    logradouro,
    bairro,
    cidade,
    uf,
    numero,
    complemento,
    referencia,
  })
  const enderecoEntrega = guestCheckout || mostrarFormEndereco
    ? enderecoFormatado
    : (endereco.trim() || cliente?.endereco?.trim() || '')
  const cidadeCliente = cidade.trim() || null
  const manualNaCidade = pagamentoManualLiberado({
    formaEntrega,
    cidadeLoja,
    cidadeCliente,
  })

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
    let cancelled = false
    const configurada = store?.loja_online_pag_manual_cidade?.trim()
    if (configurada) {
      setCidadeLoja(configurada)
      return
    }
    const origem = store?.loja_online_frete_cep_origem?.replace(/\D/g, '') ?? ''
    if (origem.length === 8) {
      void buscarCep(origem).then((data) => {
        if (cancelled) return
        if (data?.localidade) {
          setCidadeLoja(data.localidade)
          return
        }
        setCidadeLoja(extrairCidadeDeEndereco(store?.endereco))
      })
      return () => {
        cancelled = true
      }
    }
    setCidadeLoja(extrairCidadeDeEndereco(store?.endereco))
    return () => {
      cancelled = true
    }
  }, [store?.loja_online_pag_manual_cidade, store?.loja_online_frete_cep_origem, store?.endereco])

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
    if (pagamentos.manual && manualNaCidade) {
      list.push({
        id: 'manual',
        label: 'Combinar / pagar na entrega',
        hint: cidadeLoja
          ? `Somente para CEPs de ${cidadeLoja}`
          : 'Finalize e combine o pagamento com a loja',
        icon: <Wallet size={18} />,
      })
    }
    return list
  }, [pagamentos, manualNaCidade, cidadeLoja])

  const pagamentoUnico = metodosDisponiveis.length <= 1

  useEffect(() => {
    if (!metodosDisponiveis.length) return
    if (!metodosDisponiveis.some((m) => m.id === formaPagamento)) {
      setFormaPagamento(metodosDisponiveis[0].id)
    }
  }, [metodosDisponiveis, formaPagamento])
  const metodoUnicoId = pagamentoUnico ? metodosDisponiveis[0]?.id : null

  useEffect(() => {
    if (!metodoUnicoId) return
    setFormaPagamento(metodoUnicoId)
  }, [metodoUnicoId])

  const validateGuestDados = (): string | null => {
    if (guestNome.trim().split(/\s+/).filter(Boolean).length < 2) return 'Informe seu nome completo (nome e sobrenome).'
    if (!isValidCPF(guestCpf)) return 'Informe um CPF válido.'
    if (onlyDigits(guestTelefone).length < 10 || !isValidPhone(guestTelefone)) {
      return 'Informe um WhatsApp válido com DDD.'
    }
    if (!guestEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
      return 'Informe um e-mail válido.'
    }
    if (cepEntrega.length !== 8) return 'Informe um CEP válido.'
    if (!cidade.trim() || !uf.trim()) return 'Digite o CEP para carregar a cidade.'
    if (!logradouro.trim()) return 'Informe a rua / logradouro.'
    if (!numero.trim()) return 'Informe o número da casa ou prédio.'
    if (!bairro.trim()) return 'Informe o bairro.'
    return null
  }

  const validateCheckout = (): string | null => {
    if (!cliente && exigirCadastro) return 'Faça login para continuar.'
    if (guestCheckout) {
      const erroDados = validateGuestDados()
      if (erroDados) return erroDados
    }
    if (formaEntrega === 'entrega') {
      if (cepEntrega.length !== 8) return 'Informe um CEP válido.'
      if (mostrarFormEndereco) {
        if (!cidade.trim()) return 'Digite o CEP para carregar o endereço e a cidade.'
        if (!logradouro.trim()) return 'Informe a rua / logradouro.'
        if (!numero.trim()) return 'Informe o número da casa ou prédio.'
      } else if (!enderecoEntrega) {
        return 'Cadastre um endereço na sua conta ou informe o endereço de entrega.'
      }
      if (!freteSelecionado && store?.loja_online_frete_tipo === 'correios') {
        return 'Calcule e selecione uma opção de frete.'
      }
      if (formaPagamento === 'manual' && !manualNaCidade) {
        return cidadeLoja
          ? `Pagamento na entrega disponível apenas para CEPs de ${cidadeLoja}.`
          : 'Pagamento na entrega indisponível para este CEP.'
      }
    }
    if (total <= 0) return 'Total do pedido inválido.'
    if (metodosDisponiveis.length === 0) {
      return cidadeLoja
        ? `Nenhuma forma de pagamento disponível para este CEP. Pagamento na entrega é só para ${cidadeLoja}.`
        : 'Nenhuma forma de pagamento disponível.'
    }
    return null
  }

  const dadosProntos = !guestCheckout || validateGuestDados() === null

  const entregaPronta =
    formaEntrega === 'retirada' ||
    (formaEntrega === 'entrega' &&
      cepEntrega.length === 8 &&
      (mostrarFormEndereco
        ? !!logradouro.trim() && !!cidade.trim() && !!numero.trim()
        : !!enderecoEntrega) &&
      (store?.loja_online_frete_tipo !== 'correios' || !!freteSelecionado || freteGratis.unlocked))

  const confirmarDados = () => {
    const erroDados = guestCheckout ? validateGuestDados() : null
    if (erroDados) {
      setError(erroDados)
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
    setOpenStep('pagamento')
  }

  const editarEtapa = (step: 'dados' | 'entrega' | 'pagamento') => {
    setError(null)
    if (step === 'dados') {
      setDadosDone(false)
      setEntregaDone(false)
      setPagamentoDone(false)
    } else if (step === 'entrega') {
      setEntregaDone(false)
      setPagamentoDone(false)
    } else {
      setPagamentoDone(false)
    }
    setOpenStep(step)
  }

  const escolherPagamento = (id: LojaOnlineFormaPagamento) => {
    setFormaPagamento(id)
    trackLojaOnlineBehavior('payment_select', { metodo: id, total })
    setOpenStep('pagamento')
  }

  const buildPedidoInput = () => {
    const attr = getLojaOnlineAttribution()
    return {
      empresaId: store!.empresa_id,
      cliente: cliente ?? null,
      guest: cliente
        ? undefined
        : {
            nome: guestNome.trim().replace(/\s+/g, ' '),
            email: guestEmail.trim(),
            telefone: formatPhone(guestTelefone),
            cpf: onlyDigits(guestCpf),
            endereco: enderecoFormatado,
            cep: maskCep(cepEntrega),
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
      utm_source: attr?.utm_source ?? null,
      utm_medium: attr?.utm_medium ?? null,
      utm_campaign: attr?.utm_campaign ?? null,
      fbclid: attr?.fbclid ?? null,
    }
  }

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
      void trackLojaOnlineEvent({
        empresaId: store.empresa_id,
        eventName: 'purchase',
        pedidoId: result.pedido.id,
        value: result.pedido.total,
        contentIds: result.itens.map((i) => i.produto_id),
      })
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
      trackLojaOnlineBehavior('checkout_submit', { metodo: 'mercadopago', total, frete: valorFrete, subtotal })
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
    [store?.empresa_id, slug, cliente, items, formaEntrega, endereco, logradouro, numero, bairro, cidade, uf, complemento, referencia, observacoes, formaPagamento, valorFrete, valorDesconto, cashbackUsado, cupom, freteSelecionado, cep, finalizeCheckout]
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
      const res = await calcularFreteLojaOnline(
        slug,
        digits,
        undefined,
        subtotal,
        items.map((item) => ({
          id: item.produtoId,
          quantidade: item.quantidade,
          preco: item.preco,
        })),
        lojaOnlineFreteContexto('checkout')
      )
      setOpcoesFrete(res.opcoes)
      setFreteSelecionado(res.opcoes[0] ?? null)
      if (res.opcoes.length > 0) {
        const valores = res.opcoes.map((o) => o.valor)
        const prazos = res.opcoes.map((o) => o.prazo).filter((p) => p > 0)
        trackLojaOnlineBehavior('shipping_quote', {
          uf: cepParaUf(digits),
          subtotal,
          frete_min: Math.min(...valores),
          frete_max: Math.max(...valores),
          prazo_min: prazos.length ? Math.min(...prazos) : null,
          opcoes: res.opcoes.length,
          tipo: 'correios',
        })
      } else {
        trackLojaOnlineBehavior('shipping_error', { msg: 'Nenhuma opção de frete para o CEP', uf: cepParaUf(digits) })
      }
    } catch (err) {
      setOpcoesFrete([])
      setFreteSelecionado(null)
      const raw = err instanceof Error ? err.message : 'Erro ao calcular frete.'
      trackLojaOnlineBehavior('shipping_error', { msg: raw.slice(0, 120), uf: cepParaUf(digits) })
      const lower = raw.toLowerCase()
      setError(
        lower.includes('postal_code') ||
          lower.includes('cep_destino') ||
          lower.includes('422') ||
          lower.includes('{')
          ? 'CEP inválido ou sem cobertura de frete. Confira o número e tente de novo.'
          : raw
      )
    } finally {
      setFreteLoading(false)
    }
  }

  useEffect(() => {
    if (formaEntrega !== 'entrega' || !slug || store?.loja_online_frete_tipo !== 'correios') return
    if (freteGratis.unlocked) return
    if (cepEntrega.length !== 8) return
    void calcularFrete(cepEntrega)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recalcula quando o CEP de destino muda
  }, [formaEntrega, slug, store?.loja_online_frete_tipo, cepEntrega, freteGratis.unlocked])

  const aplicarCupom = async () => {
    if (!slug || !cupomInput.trim()) return
    setCupomLoading(true)
    setError(null)
    try {
      const validado = await validarCupomLojaOnline(slug, cupomInput.trim(), subtotal)
      setCupom(validado)
      trackLojaOnlineBehavior('coupon_apply', { ok: true, codigo: validado.codigo, desconto: validado.desconto, subtotal })
    } catch (err) {
      setCupom(null)
      const msg = err instanceof Error ? err.message : 'Cupom inválido.'
      trackLojaOnlineBehavior('coupon_apply', { ok: false, codigo: cupomInput.trim().slice(0, 30), msg })
      setError(msg)
    } finally {
      setCupomLoading(false)
    }
  }

  const preencherCep = async (raw: string) => {
    const digits = raw.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepLoading(true)
    setCepErro(null)
    try {
      const data = await buscarCep(digits)
      if (!data) {
        setCepErro('CEP não encontrado. Confira o número e tente de novo.')
        setCidade('')
        setUf('')
        setLogradouro('')
        setBairro('')
        return
      }
      setLogradouro(data.logradouro)
      setBairro(data.bairro)
      setCidade(data.localidade)
      setUf(data.uf)
      if (data.complemento && !complemento.trim()) setComplemento(data.complemento)
      if (!endereco.trim()) {
        const linha = [data.logradouro, data.bairro, data.localidade, data.uf].filter(Boolean).join(', ')
        if (linha) setEndereco(linha)
      }
    } finally {
      setCepLoading(false)
    }
  }

  useEffect(() => {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) {
      setCepErro(null)
      if (digits.length === 0) return
      return
    }
    const timer = window.setTimeout(() => {
      void preencherCep(digits)
    }, 350)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- busca ao completar o CEP
  }, [cep])

  const cepFreteRef = useRef('')
  useEffect(() => {
    if (cepEntrega === cepFreteRef.current) return
    cepFreteRef.current = cepEntrega
    if (store?.loja_online_frete_tipo !== 'correios') return
    setOpcoesFrete([])
    setFreteSelecionado(null)
  }, [cepEntrega, store?.loja_online_frete_tipo])

  const etapaAtual: 'dados' | 'entrega' | 'pagamento' =
    !cliente && !exigirCadastro && !dadosDone ? 'dados' : !entregaDone ? 'entrega' : 'pagamento'
  useEffect(() => {
    if (done || items.length === 0) return
    trackLojaOnlineBehavior('checkout_step', { step: etapaAtual, subtotal })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- registra cada troca de etapa
  }, [etapaAtual, done])

  useEffect(() => {
    if (done || items.length === 0) return
    trackLojaOnlineBehavior('delivery_mode', { modo: formaEntrega })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- registra a escolha de entrega
  }, [formaEntrega, done])

  const freteNaoCorreiosRef = useRef('')
  useEffect(() => {
    if (formaEntrega !== 'entrega' || !freteSelecionado || cepEntrega.length !== 8) return
    if (store?.loja_online_frete_tipo === 'correios' && freteSelecionado.codigo !== 'GRATIS') return
    const key = `${cepEntrega}|${freteSelecionado.codigo}|${freteSelecionado.valor}`
    if (freteNaoCorreiosRef.current === key) return
    freteNaoCorreiosRef.current = key
    trackLojaOnlineBehavior('shipping_quote', {
      uf: cepParaUf(cepEntrega),
      subtotal,
      frete_min: freteSelecionado.valor,
      frete_max: freteSelecionado.valor,
      prazo_min: freteSelecionado.prazo || null,
      opcoes: 1,
      tipo: freteSelecionado.codigo === 'GRATIS' ? 'gratis' : 'fixo',
    })
  }, [formaEntrega, freteSelecionado, cepEntrega, subtotal, store?.loja_online_frete_tipo])

  useEffect(() => {
    if (!error) return
    trackLojaOnlineBehavior('checkout_error', { msg: error.slice(0, 140), stage: etapaAtual })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- registra cada erro exibido
  }, [error])

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
    trackLojaOnlineBehavior('checkout_submit', { metodo: formaPagamento, total, frete: valorFrete, subtotal })
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

  const precisaDados = !cliente && !exigirCadastro
  const currentStep: 'dados' | 'entrega' | 'pagamento' =
    precisaDados && !dadosDone ? 'dados' : !entregaDone ? 'entrega' : 'pagamento'
  const nDados = 1
  const nEntrega = precisaDados ? 2 : 1
  const nPagamento = precisaDados ? 3 : 2
  const mostrarCamposEndereco = formaEntrega === 'entrega' && (!mostrarFormEndereco || !!cidade.trim())
  const mostrarOpcoesFrete =
    formaEntrega === 'entrega' &&
    store?.loja_online_frete_tipo === 'correios' &&
    opcoesFrete.length > 0 &&
    (mostrarFormEndereco ? !!cidade.trim() && !!numero.trim() : !!enderecoEntrega)
  const resumoEntrega =
    formaEntrega === 'retirada'
      ? 'Retirar na loja'
      : [logradouro && numero ? `${logradouro}, ${numero}` : enderecoEntrega, cidade ? `${cidade}${uf ? ` - ${uf}` : ''}` : '']
          .filter(Boolean)
          .join(' · ')
  const resumoPagamento = metodosDisponiveis.find((m) => m.id === formaPagamento)?.label ?? null

  const renderEnderecoForm = (mostrarCampos: boolean, bairroObrigatorio = false) => (
    <>
      <label className="input-wrap">
        <span className="input-label">CEP</span>
        <div className="loja-store-cep-row">
          <input
            className="input-el"
            value={maskCep(cep)}
            onChange={(e) => setCep(e.target.value)}
            onBlur={(e) => void preencherCep(e.target.value)}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            required
          />
          {(cepLoading || freteLoading) && (
            <span className="loja-store-cep-status">
              <Loader2 size={16} className="loja-store-success-icon--spin" />
              {cepLoading ? 'Buscando endereço…' : 'Calculando frete…'}
            </span>
          )}
        </div>
        {cepErro && <p className="loja-online-field-error">{cepErro}</p>}
      </label>

      {mostrarCampos && (
        <>
          {cidade && (
            <div className="loja-store-endereco-cidade">
              <MapPin size={18} />
              <div>
                <strong>{cidade}{uf ? ` - ${uf}` : ''}</strong>
                <small>
                  {cidadeLoja && cidadesIguais(cidade, cidadeLoja)
                    ? 'Entrega local · pagamento na entrega liberado'
                    : cidadeLoja
                      ? `Pagamento na entrega só para ${cidadeLoja}`
                      : 'Cidade identificada pelo CEP'}
                </small>
              </div>
            </div>
          )}

          <label className="input-wrap">
            <span className="input-label">Rua / logradouro</span>
            <input
              className="input-el"
              value={logradouro}
              onChange={(e) => setLogradouro(e.target.value)}
              placeholder="Preenchido pelo CEP"
              required
            />
          </label>

          <div className="loja-store-endereco-grid">
            <label className="input-wrap">
              <span className="input-label">Número</span>
              <input
                className="input-el"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Nº da casa"
                required
              />
            </label>
            <label className="input-wrap">
              <span className="input-label">Complemento</span>
              <input
                className="input-el"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                placeholder="Apto, bloco…"
              />
            </label>
          </div>

          <label className="input-wrap">
            <span className="input-label">Bairro</span>
            <input
              className="input-el"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              placeholder="Preenchido pelo CEP"
              required={bairroObrigatorio}
            />
          </label>

          <label className="input-wrap">
            <span className="input-label">Ponto de referência (opcional)</span>
            <input
              className="input-el"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ex.: em frente à padaria, portão azul"
            />
          </label>
        </>
      )}
    </>
  )

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
    <div className="loja-store-page loja-store-checkout-page loja-store-checkout-page--wizard">
      {store?.empresa_id && (
        <LojaOnlineCheckoutOfertaTopBar empresaId={store.empresa_id} oferta={checkoutOferta} />
      )}

      <div className="loja-store-checkout-wizard">
        <div className="loja-store-checkout-toolbar">
          <Link
            to={link('carrinho')}
            className="loja-store-checkout-back"
            aria-label="Voltar ao carrinho"
          >
            <ArrowLeft size={22} strokeWidth={2.25} />
          </Link>
          <div className="loja-store-checkout-wizard-heading">
            <h1>Finalizar compra</h1>
            <p>Preencha uma etapa de cada vez</p>
          </div>
        </div>

        <ol className="loja-store-checkout-steps" aria-label="Etapas do checkout">
          {precisaDados && (
            <li className={currentStep === 'dados' ? 'is-active' : dadosDone ? 'is-done' : ''}>1. Dados</li>
          )}
          <li className={currentStep === 'entrega' ? 'is-active' : entregaDone ? 'is-done' : ''}>
            {nEntrega}. Entrega
          </li>
          <li className={currentStep === 'pagamento' ? 'is-active' : ''}>
            {nPagamento}. Pagamento
          </li>
        </ol>

        <div className="loja-store-checkout-mini-summary">
          <ul>
            {items.map((item) => (
              <li key={item.produtoId}>
                <span>
                  {item.quantidade}× {item.nome}
                </span>
                <strong>{formatCurrency(item.preco * item.quantidade)}</strong>
              </li>
            ))}
          </ul>
          <div className="loja-store-checkout-mini-total">
            <span>Total</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
        </div>

        {store?.empresa_id && <LojaOnlineCheckoutOfertaBanner oferta={checkoutOferta} />}

        <div className="loja-store-checkout-wizard-steps">
          {precisaDados && (
            <LojaOnlineCheckoutAccordionStep
              number={nDados}
              title="Seus dados"
              summary={dadosDone ? `${guestNome.trim()} · CPF ${formatCPF(guestCpf)} · ${formatPhone(guestTelefone)}` : null}
              open={currentStep === 'dados'}
              done={dadosDone}
              locked={false}
              onEdit={() => editarEtapa('dados')}
            >
              <div className="loja-store-checkout-step-body loja-store-guest-fields">
                <label className="input-wrap">
                  <span className="input-label">Nome completo</span>
                  <input
                    className="input-el"
                    value={guestNome}
                    onChange={(e) => setGuestNome(e.target.value)}
                    autoComplete="name"
                    placeholder="Nome e sobrenome"
                    required
                  />
                </label>
                <div className="loja-store-endereco-grid">
                  <label className="input-wrap">
                    <span className="input-label">CPF</span>
                    <input
                      className="input-el"
                      value={formatCPF(guestCpf)}
                      onChange={(e) => setGuestCpf(onlyDigits(e.target.value).slice(0, 11))}
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      required
                    />
                  </label>
                  <label className="input-wrap">
                    <span className="input-label">WhatsApp</span>
                    <input
                      className="input-el"
                      value={guestTelefone}
                      onChange={(e) => setGuestTelefone(formatPhone(e.target.value))}
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="(00) 00000-0000"
                      required
                    />
                  </label>
                </div>
                <label className="input-wrap">
                  <span className="input-label">E-mail</span>
                  <input
                    className="input-el"
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </label>
                <p className="loja-store-checkout-step-hint">Endereço</p>
                {renderEnderecoForm(!!cidade.trim(), true)}
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
            number={nEntrega}
            title="Como receber"
            summary={entregaDone ? resumoEntrega : null}
            open={currentStep === 'entrega'}
            done={entregaDone}
            locked={precisaDados && !dadosDone}
            onEdit={() => editarEtapa('entrega')}
          >
            <div className="loja-store-checkout-step-body">
              <p className="loja-store-checkout-step-hint">Como você quer receber o pedido?</p>
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
                <>
                  {!mostrarFormEndereco ? (
                    <div className="loja-store-endereco-cadastro">
                      <p className="loja-store-endereco-cadastro-label">Endereço de entrega</p>
                      <p className="loja-store-endereco-cadastro-text">
                        {enderecoEntrega}
                        {!guestCheckout && cepEntrega ? ` · CEP ${maskCep(cepEntrega)}` : ''}
                      </p>
                      {cidade && (
                        <p className="loja-store-endereco-cidade-inline">
                          <MapPin size={14} /> {cidade}{uf ? ` - ${uf}` : ''}
                        </p>
                      )}
                      <button
                        type="button"
                        className="loja-store-link-btn"
                        onClick={() => (guestCheckout ? editarEtapa('dados') : setEditandoEndereco(true))}
                      >
                        {guestCheckout ? 'Alterar endereço' : 'Usar outro endereço'}
                      </button>
                    </div>
                  ) : (
                    renderEnderecoForm(mostrarCamposEndereco)
                  )}

                  {mostrarOpcoesFrete && (
                    <div className="loja-store-frete-opcoes">
                      <p className="loja-store-checkout-step-hint">Escolha o frete</p>
                      {opcoesFrete.map((op) => (
                        <label key={op.codigo} className={`loja-store-pay-option${freteSelecionado?.codigo === op.codigo ? ' is-active' : ''}`}>
                          <input
                            type="radio"
                            name="frete"
                            checked={freteSelecionado?.codigo === op.codigo}
                            onChange={() => {
                              setFreteSelecionado(op)
                              trackLojaOnlineBehavior('shipping_select', { nome: op.nome, valor: op.valor, prazo: op.prazo })
                            }}
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
                </>
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
                Continuar para pagamento
              </button>
            </div>
          </LojaOnlineCheckoutAccordionStep>

          <LojaOnlineCheckoutAccordionStep
            number={nPagamento}
            title="Pagamento"
            summary={pagamentoDone ? resumoPagamento : null}
            open={currentStep === 'pagamento'}
            done={pagamentoDone}
            locked={!entregaDone}
            onEdit={() => editarEtapa('pagamento')}
          >
            <form onSubmit={handleSubmit} className="loja-store-checkout-step-body">
              <LojaOnlineOrderBumpCards
                ofertas={ofertasBump}
                selectedIds={selectedBumpIds}
                onToggle={toggleOrderBump}
                loading={orderBumpsLoading}
              />

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

              {!pagamentoUnico && (
                <div className="loja-store-pay-options">
                  <p className="loja-store-checkout-step-hint">Escolha como pagar</p>
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
              )}

              {pagamentos?.manual && formaEntrega === 'entrega' && cidade && cidadeLoja && !cidadesIguais(cidade, cidadeLoja) && (
                <p className="loja-online-hint">
                  Pagamento na entrega disponível apenas para CEPs de {cidadeLoja}.
                </p>
              )}

              {error && <p className="loja-online-field-error">{error}</p>}

              {formaPagamento === 'mercadopago' && !pagamentos?.mercadopagoPublicKey && (
                <p className="loja-online-field-error">Public Key do Mercado Pago não configurada no painel da loja.</p>
              )}

              {formaPagamento === 'mercadopago' && pagamentos?.mercadopagoPublicKey ? (
                <div className="loja-store-mp-brick-wrap">
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
          </LojaOnlineCheckoutAccordionStep>
        </div>
      </div>
    </div>
  )
}
