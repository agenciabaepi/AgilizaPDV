import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { PageTitle, Button, Alert, Select, Dialog } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import type {
  AppSession,
  VendaDetalhes,
  Cliente,
  Produto,
  EmpresaFiscalConfig,
  PagamentoInput,
  UsuarioSession,
} from '../vite-env'
import { Plus, Trash2, Printer } from 'lucide-react'

const FORMAS: { value: PagamentoInput['forma']; label: string }[] = [
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'PIX', label: 'PIX' },
  { value: 'CREDITO', label: 'Cartão de Crédito' },
  { value: 'DEBITO', label: 'Cartão de Débito' },
  { value: 'OUTROS', label: 'Outros' },
]

type NfeItemRow = {
  id: string
  produto_id?: string
  descricao: string
  cfop: string
  ncm: string
  unidade: string
  quantidade: number
  valorUnit: number
}

function nextId(): string {
  return `nfe-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isUsuarioEmpresa(s: AppSession | null): s is UsuarioSession {
  return s != null && !('suporte' in s && s.suporte)
}

export function NfeCriar() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const vendaId = searchParams.get('vendaId')

  const [detalhes, setDetalhes] = useState<VendaDetalhes | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  const [fiscalConfig, setFiscalConfig] = useState<EmpresaFiscalConfig | null>(null)
  const [loadingFiscal, setLoadingFiscal] = useState(true)

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteSearch, setClienteSearch] = useState('')
  const [clienteDropdownOpen, setClienteDropdownOpen] = useState(false)
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)
  const clienteDropdownRef = useRef<HTMLDivElement>(null)

  const [itens, setItens] = useState<NfeItemRow[]>([])
  const [descontoTotal, setDescontoTotal] = useState(0)
  const [frete, setFrete] = useState(0)

  const [pagamentos, setPagamentos] = useState<{ forma: PagamentoInput['forma']; valor: number }[]>([])
  const [formaPag, setFormaPag] = useState<PagamentoInput['forma']>('DINHEIRO')
  const [valorPag, setValorPag] = useState('')

  const [dataEmissao, setDataEmissao] = useState(() => new Date().toISOString().slice(0, 10))
  const [ambiente, setAmbiente] = useState<'homologacao' | 'producao'>('producao')
  const [emitindo, setEmitindo] = useState(false)
  const [confirmEmitOpen, setConfirmEmitOpen] = useState(false)
  const [danfePreview, setDanfePreview] = useState<{ vendaId: string; dataUrl: string } | null>(null)
  const [danfePreviewLoading, setDanfePreviewLoading] = useState(false)
  const [danfePrinting, setDanfePrinting] = useState(false)
  const initializedFromVendaRef = useRef(false)

  // Carregar detalhes da venda quando vendaId
  useEffect(() => {
    if (!vendaId) {
      setLoading(false)
      setDetalhes(null)
      initializedFromVendaRef.current = false
      return
    }
    setLoading(true)
    initializedFromVendaRef.current = false
    window.electronAPI.cupom
      .getDetalhes(vendaId)
      .then((d) => {
        if (!d) {
          setMessage({ type: 'error', text: 'Não foi possível carregar os dados da venda.' })
        } else {
          setDetalhes(d as VendaDetalhes)
        }
      })
      .finally(() => setLoading(false))
  }, [vendaId])

  // Carregar config fiscal
  useEffect(() => {
    if (!empresaId || !window.electronAPI?.empresas?.getFiscalConfig) {
      setLoadingFiscal(false)
      return
    }
    setLoadingFiscal(true)
    window.electronAPI.empresas
      .getFiscalConfig(empresaId)
      .then((f) => {
        setFiscalConfig(f ?? null)
        if (f) setAmbiente(f.ambiente)
      })
      .finally(() => setLoadingFiscal(false))
  }, [empresaId])

  // Carregar clientes para autocomplete
  useEffect(() => {
    if (!empresaId || !window.electronAPI?.clientes?.list) return
    window.electronAPI.clientes.list(empresaId).then(setClientes).catch(() => setClientes([]))
  }, [empresaId])

  // Quando temos detalhes da venda pela primeira vez, preencher itens/pagamentos e desconto (uma vez)
  useEffect(() => {
    if (!detalhes || !vendaId || initializedFromVendaRef.current) return
    initializedFromVendaRef.current = true
    setItens(
      detalhes.itens.map((i) => ({
        id: nextId(),
        produto_id: i.produto_id,
        descricao: i.descricao,
        cfop: '5102',
        ncm: '21069090',
        unidade: 'UN',
        quantidade: i.quantidade,
        valorUnit: i.quantidade > 0 ? i.total / i.quantidade : 0,
      }))
    )
    setDescontoTotal(detalhes.venda.desconto_total ?? 0)
    setPagamentos(
      detalhes.pagamentos.map((p) => ({
        forma: p.forma as PagamentoInput['forma'],
        valor: p.valor,
      }))
    )
  }, [vendaId, detalhes])

  // Preencher cliente quando clientes carregam e temos detalhes com cliente_id
  useEffect(() => {
    if (!detalhes?.venda.cliente_id || !clientes.length || selectedCliente?.id === detalhes.venda.cliente_id) return
    const c = clientes.find((x) => x.id === detalhes.venda.cliente_id)
    if (c) setSelectedCliente(c)
  }, [clientes, detalhes?.venda.cliente_id, selectedCliente?.id])

  // Fechar dropdown do cliente ao clicar fora
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (clienteDropdownRef.current && !clienteDropdownRef.current.contains(e.target as Node)) {
        setClienteDropdownOpen(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  const clientesFiltrados = clienteSearch.trim()
    ? clientes.filter(
        (c) =>
          c.nome.toLowerCase().includes(clienteSearch.toLowerCase()) ||
          (c.cpf_cnpj ?? '').replace(/\D/g, '').includes(clienteSearch.replace(/\D/g, ''))
      )
    : clientes.slice(0, 20)

  const totalProdutos = itens.reduce((acc, i) => acc + i.quantidade * i.valorUnit, 0)
  const totalNota = totalProdutos - descontoTotal + frete
  const totalPagamentos = pagamentos.reduce((acc, p) => acc + p.valor, 0)
  const pagamentosOk = Math.abs(totalPagamentos - totalNota) < 0.02

  const canEmit =
    (selectedCliente !== null || (vendaId && detalhes?.venda?.cliente_id)) &&
    itens.length >= 1 &&
    pagamentosOk &&
    itens.every((i) => i.descricao.trim() && i.quantidade > 0 && i.valorUnit >= 0)

  const addItem = useCallback(() => {
    setItens((prev) => [
      ...prev,
      {
        id: nextId(),
        descricao: '',
        cfop: '5102',
        ncm: '21069090',
        unidade: 'UN',
        quantidade: 1,
        valorUnit: 0,
      },
    ])
  }, [])

  const updateItem = useCallback((id: string, upd: Partial<NfeItemRow>) => {
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, ...upd } : i)))
  }, [])

  const removeItem = useCallback((id: string) => {
    setItens((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const setItemFromProduto = useCallback((itemId: string, p: Produto) => {
    updateItem(itemId, {
      produto_id: p.id,
      descricao: p.nome,
      cfop: (p.cfop || '5102').replace(/\D/g, '').slice(0, 4) || '5102',
      ncm: (p.ncm || '').replace(/\D/g, '').slice(0, 8) || '21069090',
      unidade: p.unidade || 'UN',
      valorUnit: p.preco ?? 0,
      quantidade: 1,
    })
  }, [updateItem])

  const addPagamento = useCallback(() => {
    const v = Number(String(valorPag).replace(',', '.')) || 0
    if (v <= 0) return
    setPagamentos((prev) => [...prev, { forma: formaPag, valor: v }])
    setValorPag('')
  }, [valorPag, formaPag])

  const removePagamento = useCallback((index: number) => {
    setPagamentos((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handlePreviewDanfe = useCallback(async () => {
    if (!vendaId || !window.electronAPI?.nfe?.previewDanfeA4) return
    try {
      await window.electronAPI.nfe.previewDanfeA4(vendaId)
    } catch (e) {
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Erro ao pré-visualizar a DANFE NF-e.',
      })
    }
  }, [vendaId])

  const abrirDanfeModal = useCallback(async (idVenda: string) => {
    const apiNfe: any = window.electronAPI?.nfe
    setDanfePreviewLoading(true)
    try {
      if (typeof apiNfe?.getDanfePdfDataUrl === 'function') {
        const result = await apiNfe.getDanfePdfDataUrl(idVenda)
        if (result.ok && result.dataUrl) {
          setDanfePreview({ vendaId: idVenda, dataUrl: result.dataUrl })
        } else {
          setMessage({
            type: 'error',
            text: result.error ?? 'Não foi possível abrir a pré-visualização do DANFE.',
          })
        }
      } else {
        const r = await apiNfe?.gerarDanfeA4?.(idVenda)
        if (!r?.ok && r?.error) {
          setMessage({
            type: 'error',
            text: `NF-e autorizada, mas não foi possível abrir o DANFE: ${r.error}`,
          })
        }
      }
    } catch (e) {
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Erro ao abrir DANFE NF-e.',
      })
    } finally {
      setDanfePreviewLoading(false)
    }
  }, [])

  const handleConfirmarEmitir = useCallback(async () => {
    if (!canEmit || !empresaId) return
    if (!isUsuarioEmpresa(session)) {
      setMessage({
        type: 'error',
        text: 'Faça login com um usuário da empresa para registrar a venda e emitir NF-e.',
      })
      setConfirmEmitOpen(false)
      return
    }

    setConfirmEmitOpen(false)
    setMessage(null)
    setEmitindo(true)

    try {
      let idVendaAlvo = vendaId ?? ''

      if (!vendaId) {
        const needPlaceholder = frete > 0 || itens.some((i) => !i.produto_id)
        let placeholderId: string | null = null
        if (needPlaceholder) {
          const er = await window.electronAPI.produtos.ensureNfeAvulsa(empresaId)
          if (!er.ok) {
            setMessage({ type: 'error', text: er.error })
            setEmitindo(false)
            return
          }
          placeholderId = er.produtoId
        }

        const clienteId = selectedCliente?.id
        if (!clienteId) {
          setMessage({ type: 'error', text: 'Selecione o destinatário (cliente).' })
          setEmitindo(false)
          return
        }

        const itensVenda = itens.map((row) => {
          const pid = row.produto_id ?? placeholderId
          if (!pid) {
            throw new Error('Item sem produto vinculado: selecione um produto na linha ou adicione frete/itens manuais.')
          }
          return {
            produto_id: pid,
            descricao: row.descricao.trim(),
            preco_unitario: row.valorUnit,
            quantidade: row.quantidade,
          }
        })

        if (frete > 0 && placeholderId) {
          itensVenda.push({
            produto_id: placeholderId,
            descricao: 'Frete',
            preco_unitario: frete,
            quantidade: 1,
          })
        }

        const venda = await window.electronAPI.vendas.finalizar({
          empresa_id: empresaId,
          usuario_id: session.id,
          cliente_id: clienteId,
          itens: itensVenda,
          pagamentos: pagamentos.map((p) => ({ forma: p.forma, valor: p.valor })),
          desconto_total: descontoTotal,
          troco: 0,
        })
        idVendaAlvo = venda.id
        setSearchParams({ vendaId: venda.id }, { replace: true })
      } else {
        if (selectedCliente && window.electronAPI.vendas.updateCliente) {
          try {
            await window.electronAPI.vendas.updateCliente(vendaId, selectedCliente.id)
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            if (msg.includes('No handler registered') || msg.includes('updateCliente')) {
              setMessage({
                type: 'error',
                text: 'Reinicie o aplicativo (feche e abra de novo) para que o cliente seja salvo na venda. Depois tente emitir novamente.',
              })
              setEmitindo(false)
              return
            }
            throw err
          }
        }
      }

      const result = await window.electronAPI.vendas.emitirNfe(idVendaAlvo)
      if (result?.ok) {
        setMessage({
          type: 'success',
          text: result.chave
            ? `NF-e autorizada pela SEFAZ. Chave: ${result.chave}`
            : 'NF-e autorizada pela SEFAZ.',
        })
        await abrirDanfeModal(idVendaAlvo)
      } else {
        const errorText = result?.error ?? 'Erro ao emitir NF-e.'
        const isEmDesenvolvimento =
          /em desenvolvimento|não foi enviada à SEFAZ|estrutura da NF-e montada/i.test(errorText)
        setMessage({
          type: isEmDesenvolvimento ? 'info' : 'error',
          text: isEmDesenvolvimento
            ? 'A estrutura da NF-e foi gerada com sucesso. A transmissão à SEFAZ será habilitada em uma próxima atualização.'
            : errorText,
        })
      }
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Erro ao emitir NF-e.' })
    } finally {
      setEmitindo(false)
    }
  }, [
    abrirDanfeModal,
    canEmit,
    descontoTotal,
    empresaId,
    frete,
    itens,
    pagamentos,
    selectedCliente,
    session,
    setSearchParams,
    vendaId,
  ])

  const renderConteudo = () => {
    if (loading) {
      return <p style={{ color: 'var(--color-text-muted)' }}>Carregando dados da venda...</p>
    }

    const serie = fiscalConfig?.serie_nfe ?? 1
    const proximoNumero = fiscalConfig != null ? fiscalConfig.ultimo_numero_nfe + 1 : '—'

    return (
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Dados da Nota Fiscal */}
        <section
          style={{
            padding: 16,
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Dados da Nota Fiscal</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 12,
              fontSize: 'var(--text-sm)',
            }}
          >
            <div>
              <label style={{ display: 'block', marginBottom: 4 }}>Série</label>
              <input
                type="text"
                readOnly
                value={loadingFiscal ? '…' : String(serie)}
                className="input-el"
                style={{ width: '100%', opacity: 0.9 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4 }}>Número</label>
              <input
                type="text"
                readOnly
                value={loadingFiscal ? '…' : String(proximoNumero)}
                className="input-el"
                style={{ width: '100%', opacity: 0.9 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4 }}>Ambiente</label>
              <select
                className="input-el"
                style={{ width: '100%' }}
                value={ambiente}
                onChange={(e) => setAmbiente(e.target.value as 'homologacao' | 'producao')}
              >
                <option value="producao">Produção</option>
                <option value="homologacao">Homologação</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4 }}>Finalidade</label>
              <select className="input-el" style={{ width: '100%' }} defaultValue="normal">
                <option value="normal">NF-e normal</option>
                <option value="complementar">Complementar</option>
                <option value="ajuste">Ajuste</option>
              </select>
            </div>
          </div>
          <div
            style={{
              marginTop: 12,
              display: 'grid',
              gridTemplateColumns: '2fr 1fr',
              gap: 12,
              fontSize: 'var(--text-sm)',
            }}
          >
            <div ref={clienteDropdownRef} style={{ position: 'relative' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Destinatário (cliente)</label>
              <input
                type="text"
                placeholder="Buscar cliente por nome ou CPF/CNPJ..."
                className="input-el"
                style={{ width: '100%' }}
                value={selectedCliente ? selectedCliente.nome : clienteSearch}
                onChange={(e) => {
                  setClienteSearch(e.target.value)
                  if (selectedCliente) setSelectedCliente(null)
                  setClienteDropdownOpen(true)
                }}
                onFocus={() => setClienteDropdownOpen(true)}
              />
              {selectedCliente && (
                <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                  {selectedCliente.cpf_cnpj && `Doc: ${selectedCliente.cpf_cnpj}`}
                  {selectedCliente.endereco && ` · ${selectedCliente.endereco}`}
                </div>
              )}
              {clienteDropdownOpen && (
                <ul
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: '100%',
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    maxHeight: 220,
                    overflow: 'auto',
                    zIndex: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                >
                  {clientesFiltrados.length === 0 ? (
                    <li style={{ padding: 12, color: 'var(--color-text-muted)' }}>Nenhum cliente encontrado</li>
                  ) : (
                    clientesFiltrados.map((c) => (
                      <li
                        key={c.id}
                        role="button"
                        tabIndex={0}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--color-border)',
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setSelectedCliente(c)
                          setClienteSearch('')
                          setClienteDropdownOpen(false)
                        }}
                      >
                        {c.nome}
                        {c.cpf_cnpj && (
                          <span style={{ color: 'var(--color-text-secondary)', marginLeft: 8 }}>{c.cpf_cnpj}</span>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4 }}>Data de emissão</label>
              <input
                type="date"
                className="input-el"
                style={{ width: '100%' }}
                value={dataEmissao}
                onChange={(e) => setDataEmissao(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Itens */}
        <section
          style={{
            padding: 16,
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Itens</h3>
            <Button type="button" variant="secondary" size="sm" leftIcon={<Plus size={16} />} onClick={addItem}>
              Adicionar item
            </Button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 4, borderBottom: '1px solid var(--color-border)' }}>#</th>
                <th style={{ textAlign: 'left', padding: 4, borderBottom: '1px solid var(--color-border)' }}>Produto / Descrição</th>
                <th style={{ textAlign: 'left', padding: 4, borderBottom: '1px solid var(--color-border)' }}>CFOP</th>
                <th style={{ textAlign: 'left', padding: 4, borderBottom: '1px solid var(--color-border)' }}>NCM</th>
                <th style={{ textAlign: 'right', padding: 4, borderBottom: '1px solid var(--color-border)' }}>Qtd</th>
                <th style={{ textAlign: 'right', padding: 4, borderBottom: '1px solid var(--color-border)' }}>Vl unit.</th>
                <th style={{ textAlign: 'right', padding: 4, borderBottom: '1px solid var(--color-border)' }}>Vl total</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {itens.map((row, idx) => (
                <NfeItemRow
                  key={row.id}
                  index={idx}
                  row={row}
                  empresaId={empresaId}
                  onUpdate={(upd) => updateItem(row.id, upd)}
                  onRemove={() => removeItem(row.id)}
                  onSelectProduct={(p) => setItemFromProduto(row.id, p)}
                />
              ))}
              {itens.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 12, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Nenhum item. Clique em &quot;Adicionar item&quot; e busque um produto.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Totais */}
        <section
          style={{
            padding: 16,
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Totais</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 12,
              fontSize: 'var(--text-sm)',
            }}
          >
            <div>
              <label style={{ display: 'block', marginBottom: 4 }}>Valor dos produtos</label>
              <input type="text" readOnly value={totalProdutos.toFixed(2)} className="input-el" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4 }}>Descontos</label>
              <input
                type="text"
                className="input-el"
                style={{ width: '100%' }}
                value={descontoTotal.toFixed(2)}
                onChange={(e) => setDescontoTotal(Number(String(e.target.value).replace(',', '.')) || 0)}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4 }}>Frete</label>
              <input
                type="text"
                className="input-el"
                style={{ width: '100%' }}
                value={frete.toFixed(2)}
                onChange={(e) => setFrete(Number(String(e.target.value).replace(',', '.')) || 0)}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4 }}>Valor total da NF-e</label>
              <input type="text" readOnly value={totalNota.toFixed(2)} className="input-el" style={{ width: '100%' }} />
            </div>
          </div>
        </section>

        {/* Condição de pagamento */}
        <section
          style={{
            padding: 16,
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Condição de Pagamento</h3>
          {!pagamentosOk && totalNota > 0 && (
            <Alert variant="warning" style={{ marginBottom: 12 }}>
              A soma dos pagamentos (R$ {totalPagamentos.toFixed(2)}) deve ser igual ao total da NF-e (R$ {totalNota.toFixed(2)}).
            </Alert>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
            <Select
              options={FORMAS.map((f) => ({ value: f.value, label: f.label }))}
              value={formaPag}
              onChange={(e) => setFormaPag(e.target.value as PagamentoInput['forma'])}
              style={{ width: 180 }}
            />
            <input
              type="text"
              placeholder="Valor"
              className="input-el"
              style={{ width: 120 }}
              value={valorPag}
              onChange={(e) => setValorPag(e.target.value)}
            />
            <Button type="button" variant="secondary" size="sm" onClick={addPagamento}>
              Adicionar
            </Button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 4, borderBottom: '1px solid var(--color-border)' }}>Forma</th>
                <th style={{ textAlign: 'right', padding: 4, borderBottom: '1px solid var(--color-border)' }}>Valor</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {pagamentos.map((p, idx) => (
                <tr key={idx}>
                  <td style={{ padding: 4, borderBottom: '1px solid var(--color-border)' }}>
                    {FORMAS.find((f) => f.value === p.forma)?.label ?? p.forma}
                  </td>
                  <td style={{ padding: 4, textAlign: 'right', borderBottom: '1px solid var(--color-border)' }}>
                    {p.valor.toFixed(2)}
                  </td>
                  <td style={{ padding: 4, borderBottom: '1px solid var(--color-border)' }}>
                    <button
                      type="button"
                      className="button-reset"
                      onClick={() => removePagamento(idx)}
                      style={{ padding: 4, cursor: 'pointer', color: 'var(--color-text-muted)' }}
                      title="Remover"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 8, fontWeight: 600 }}>
            Total pagamentos: R$ {totalPagamentos.toFixed(2)}
          </div>
        </section>

        {/* Transporte */}
        <section
          style={{
            padding: 16,
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Transporte</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr',
              gap: 12,
              fontSize: 'var(--text-sm)',
            }}
          >
            <div>
              <label style={{ display: 'block', marginBottom: 4 }}>Tipo de frete</label>
              <select className="input-el" style={{ width: '100%' }} defaultValue="9">
                <option value="9">Sem frete (modFrete 9)</option>
                <option value="0">Por conta do emitente</option>
                <option value="1">Por conta do destinatário</option>
              </select>
            </div>
          </div>
        </section>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button variant="secondary" onClick={() => navigate('/vendas')}>
            Voltar para vendas
          </Button>
          {vendaId && (
            <Button variant="secondary" onClick={handlePreviewDanfe}>
              Pré-visualizar DANFE (sem enviar)
            </Button>
          )}
          <Button
            variant="primary"
            disabled={!canEmit || emitindo}
            onClick={() => canEmit && setConfirmEmitOpen(true)}
          >
            {emitindo ? 'Emitindo...' : 'Emitir NF-e'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Layout>
      <PageTitle title="Emitir NF-e (modelo 55)" subtitle="Preencha ou revise os dados da nota fiscal eletrônica." />

      {message && (
        <div style={{ marginBottom: 16 }}>
          <Alert variant={message.type}>{message.text}</Alert>
        </div>
      )}

      <Dialog
        open={confirmEmitOpen}
        onClose={() => !emitindo && setConfirmEmitOpen(false)}
        title="Confirmar emissão de NF-e"
        footer={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Button variant="secondary" disabled={emitindo} onClick={() => setConfirmEmitOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={emitindo} onClick={() => void handleConfirmarEmitir()}>
              {emitindo ? 'Emitindo...' : 'Emitir'}
            </Button>
          </div>
        }
      >
        <p style={{ marginTop: 0, marginBottom: 8, color: 'var(--color-text-secondary)' }}>
          A nota será transmitida à SEFAZ com os dados abaixo. Confira antes de continuar.
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
          <li>
            <strong>Destinatário:</strong>{' '}
            {selectedCliente?.nome ??
              (detalhes?.venda?.cliente_id
                ? clientes.find((c) => c.id === detalhes.venda.cliente_id)?.nome
                : undefined) ??
              '—'}
          </li>
          <li>
            <strong>Valor total da NF-e:</strong> R$ {totalNota.toFixed(2)}
          </li>
          <li>
            <strong>Ambiente:</strong> {ambiente === 'producao' ? 'Produção' : 'Homologação'}
          </li>
        </ul>
      </Dialog>

      <Dialog
        open={danfePreview !== null}
        onClose={() => !danfePrinting && setDanfePreview(null)}
        title="DANFE NF-e"
        size="large"
        footer={
          danfePreview ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button
                leftIcon={<Printer size={16} />}
                onClick={async () => {
                  if (!danfePreview) return
                  setDanfePrinting(true)
                  setMessage(null)
                  try {
                    const apiNfe: any = window.electronAPI?.nfe
                    if (typeof apiNfe?.imprimirDanfeA4 !== 'function') {
                      await apiNfe?.gerarDanfeA4?.(danfePreview.vendaId)
                      setDanfePreview(null)
                      return
                    }
                    const r = await apiNfe.imprimirDanfeA4(danfePreview.vendaId)
                    if (!r.ok) setMessage({ type: 'error', text: r.error ?? 'Falha ao abrir impressão.' })
                    setDanfePreview(null)
                  } finally {
                    setDanfePrinting(false)
                  }
                }}
                disabled={danfePrinting}
              >
                {danfePrinting ? 'Imprimindo...' : 'Imprimir'}
              </Button>
              <Button variant="secondary" onClick={() => setDanfePreview(null)} disabled={danfePrinting}>
                Fechar
              </Button>
            </div>
          ) : null
        }
      >
        <div style={{ width: '100%' }}>
          {danfePreviewLoading ? (
            <p style={{ color: 'var(--color-text-muted)', padding: 16 }}>Carregando pré-visualização...</p>
          ) : danfePreview ? (
            <div
              style={{
                width: '100%',
                height: '70vh',
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid var(--color-border)',
              }}
            >
              <embed
                title="Pré-visualização DANFE NF-e"
                src={danfePreview.dataUrl}
                type="application/pdf"
                style={{ width: '100%', height: '100%', border: 0 }}
              />
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-muted)', padding: 16 }}>Pré-visualização indisponível.</p>
          )}
        </div>
      </Dialog>

      {renderConteudo()}
    </Layout>
  )
}

type NfeItemRowProps = {
  index: number
  row: NfeItemRow
  empresaId: string
  onUpdate: (upd: Partial<NfeItemRow>) => void
  onRemove: () => void
  onSelectProduct: (p: Produto) => void
}

function NfeItemRow({ index, row, empresaId, onUpdate, onRemove, onSelectProduct }: NfeItemRowProps) {
  const [prodSearch, setProdSearch] = useState('')
  const [prodDropdownOpen, setProdDropdownOpen] = useState(false)
  const [produtos, setProdutos] = useState<Produto[]>([])

  useEffect(() => {
    if (!empresaId || !window.electronAPI?.produtos?.list) return
    const search = prodSearch.trim()
    window.electronAPI.produtos
      .list(empresaId, { search: search || undefined, apenasAtivos: true })
      .then(setProdutos)
      .catch(() => setProdutos([]))
  }, [empresaId, prodSearch])

  const valorTotal = row.quantidade * row.valorUnit

  return (
    <tr>
      <td style={{ padding: 4, borderBottom: '1px solid var(--color-border)' }}>{index + 1}</td>
      <td style={{ padding: 4, borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ position: 'relative', minWidth: 180 }}>
          <input
            type="text"
            placeholder="Buscar produto..."
            className="input-el"
            style={{ width: '100%' }}
            value={prodSearch || row.descricao}
            onChange={(e) => {
              setProdSearch(e.target.value)
              if (!e.target.value) onUpdate({ descricao: '' })
              setProdDropdownOpen(true)
            }}
            onFocus={() => setProdDropdownOpen(true)}
          />
          {prodDropdownOpen && produtos.length > 0 && (
            <ul
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '100%',
                margin: 0,
                padding: 0,
                listStyle: 'none',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                maxHeight: 180,
                overflow: 'auto',
                zIndex: 10,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              {produtos.slice(0, 15).map((p) => (
                <li
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onSelectProduct(p)
                    setProdSearch('')
                    setProdDropdownOpen(false)
                  }}
                >
                  {p.nome} — R$ {(p.preco ?? 0).toFixed(2)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </td>
      <td style={{ padding: 4, borderBottom: '1px solid var(--color-border)' }}>
        <input
          type="text"
          className="input-el"
          style={{ width: 60 }}
          value={(row.cfop || '').replace(/\D/g, '').slice(0, 4)}
          onChange={(e) => onUpdate({ cfop: e.target.value.replace(/\D/g, '').slice(0, 4) })}
          placeholder="5102"
        />
      </td>
      <td style={{ padding: 4, borderBottom: '1px solid var(--color-border)' }}>
        <input
          type="text"
          className="input-el"
          style={{ width: 90 }}
          value={row.ncm}
          onChange={(e) => onUpdate({ ncm: e.target.value.replace(/\D/g, '').slice(0, 8) })}
        />
      </td>
      <td style={{ padding: 4, borderBottom: '1px solid var(--color-border)' }}>
        <input
          type="number"
          min={0}
          step={1}
          className="input-el"
          style={{ width: 70, textAlign: 'right' }}
          value={row.quantidade || ''}
          onChange={(e) => onUpdate({ quantidade: Number(e.target.value) || 0 })}
        />
      </td>
      <td style={{ padding: 4, borderBottom: '1px solid var(--color-border)' }}>
        <input
          type="text"
          className="input-el"
          style={{ width: 90, textAlign: 'right' }}
          value={row.valorUnit > 0 ? row.valorUnit.toFixed(2) : ''}
          onChange={(e) => onUpdate({ valorUnit: Number(String(e.target.value).replace(',', '.')) || 0 })}
        />
      </td>
      <td style={{ padding: 4, textAlign: 'right', borderBottom: '1px solid var(--color-border)' }}>
        {valorTotal.toFixed(2)}
      </td>
      <td style={{ padding: 4, borderBottom: '1px solid var(--color-border)' }}>
        <button
          type="button"
          className="button-reset"
          onClick={onRemove}
          style={{ padding: 4, cursor: 'pointer', color: 'var(--color-text-muted)' }}
          title="Remover item"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  )
}
