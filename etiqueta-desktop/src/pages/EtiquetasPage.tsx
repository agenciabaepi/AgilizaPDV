import { useEffect, useMemo, useState } from 'react'
import { Eye, Plus, Printer, RefreshCw, Settings2, Trash2 } from 'lucide-react'
import logoAgiliza from '../assets/logo.svg'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import type {
  LabelTemplate,
  PrinterInfo,
  PrinterStatus,
  Produto,
  UpdateState,
  UsuarioSession
} from '../vite-env'

type QueueItem = {
  produtoId: string
  nome: string
  codigo: number | null
  quantidade: number
}

type WorkspaceTab = 'fila' | 'impressora'

type Props = {
  session: UsuarioSession
  onLogout: () => void
}

function inferTemplateFromPrinterName(printerName: string): 'PPLA' | 'PPLB' | null {
  const name = (printerName || '').toLowerCase()
  if (name.includes('ppla')) return 'PPLA'
  if (name.includes('pplb')) return 'PPLB'
  return null
}

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function labelVariacao(p: Produto): string {
  const raw = p.variacao_valores_json?.trim()
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const parts = Object.values(parsed)
        .map((v) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : ''))
        .filter(Boolean)
      if (parts.length > 0) return parts.join(' / ')
    } catch {
      // ignore
    }
  }
  if (p.sku?.trim()) return p.sku.trim()
  if (p.codigo != null) return `Cód. ${p.codigo}`
  return p.nome
}

export function EtiquetasPage({ session, onLogout }: Props) {
  const empresaId = session.empresa_id

  const [tab, setTab] = useState<WorkspaceTab>('fila')
  const [previewOpen, setPreviewOpen] = useState(false)

  const [produtos, setProdutos] = useState<Produto[]>([])
  const [preferredVariacaoByPai, setPreferredVariacaoByPai] = useState<Record<string, string>>({})
  const [variacoes, setVariacoes] = useState<Produto[]>([])
  const [loadingVariacoes, setLoadingVariacoes] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedVariacaoId, setSelectedVariacaoId] = useState('')
  const [quantityInput, setQuantityInput] = useState(1)
  const [queue, setQueue] = useState<QueueItem[]>([])

  const [templates, setTemplates] = useState<LabelTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState('')
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus | null>(null)

  const [previewHtml, setPreviewHtml] = useState('')
  const [previewSummary, setPreviewSummary] = useState<{ totalLabels: number; language: string } | null>(
    null
  )

  const [loading, setLoading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [appVersion, setAppVersion] = useState('')
  const [updateState, setUpdateState] = useState<UpdateState | null>(null)
  const [installingUpdate, setInstallingUpdate] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const result = await window.etiquetaAPI.produtos.list(empresaId, {
          search: search.trim() || undefined
        })
        if (cancelled) return
        setProdutos(result.items)
        setPreferredVariacaoByPai(result.preferredVariacaoByPai ?? {})
        setSelectedProductId((prev) => {
          if (prev && result.items.some((p) => p.id === prev)) return prev
          return result.items[0]?.id ?? ''
        })
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar produtos.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    const timer = window.setTimeout(() => {
      void load()
    }, search.trim() ? 250 : 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [empresaId, search])

  useEffect(() => {
    if (!selectedProductId) {
      setVariacoes([])
      setSelectedVariacaoId('')
      return
    }
    let cancelled = false
    setLoadingVariacoes(true)
    window.etiquetaAPI.produtos
      .listVariacoes(empresaId, selectedProductId)
      .then((items) => {
        if (cancelled) return
        setVariacoes(items)
        const preferred = preferredVariacaoByPai[selectedProductId]
        const nextId =
          (preferred && items.some((v) => v.id === preferred) ? preferred : null) ??
          items[0]?.id ??
          ''
        setSelectedVariacaoId(nextId)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setVariacoes([])
        setSelectedVariacaoId('')
        setError(err instanceof Error ? err.message : 'Erro ao carregar variações.')
      })
      .finally(() => {
        if (!cancelled) setLoadingVariacoes(false)
      })
    return () => {
      cancelled = true
    }
  }, [empresaId, selectedProductId, preferredVariacaoByPai])

  useEffect(() => {
    let cancelled = false
    window.etiquetaAPI.app
      .getVersion()
      .then((version) => {
        if (!cancelled) setAppVersion(version)
      })
      .catch(() => undefined)
    window.etiquetaAPI.app
      .getUpdateState()
      .then((state) => {
        if (!cancelled) setUpdateState(state)
      })
      .catch(() => undefined)
    const unsubscribe = window.etiquetaAPI.app.onUpdateStatus((state) => {
      setUpdateState(state)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    Promise.all([
      window.etiquetaAPI.etiquetas.listTemplates(),
      window.etiquetaAPI.etiquetas.listPrinters()
    ])
      .then(([tpls, ptrs]) => {
        setTemplates(tpls)
        setPrinters(ptrs)
        if (!selectedTemplateId && tpls[0]?.id) setSelectedTemplateId(tpls[0].id)
        if (!selectedPrinter) {
          const preferred =
            ptrs.find((p) => /argox|os-?214|ppl[ab]/i.test(p.name)) ??
            ptrs.find((p) => p.isDefault) ??
            ptrs[0]
          const name = preferred?.name ?? ''
          setSelectedPrinter(name)
          const inferred = inferTemplateFromPrinterName(name)
          if (inferred) {
            const best = tpls.find((t) => t.language === inferred)
            if (best) setSelectedTemplateId(best.id)
          }
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar impressoras.')
      })
  }, [])

  useEffect(() => {
    if (!selectedPrinter) {
      setPrinterStatus(null)
      return
    }
    let cancelled = false
    const refresh = () => {
      window.etiquetaAPI.etiquetas
        .getPrinterStatus(selectedPrinter)
        .then((status) => {
          if (!cancelled) setPrinterStatus(status)
        })
        .catch((err: unknown) => {
          if (cancelled) return
          setPrinterStatus({
            name: selectedPrinter,
            online: false,
            detail: err instanceof Error ? err.message : 'Falha ao consultar impressora.'
          })
        })
    }
    refresh()
    const id = window.setInterval(refresh, 4000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [selectedPrinter])

  const productOptions = useMemo(
    () =>
      produtos.length === 0
        ? [{ value: '', label: loading ? 'Carregando...' : 'Nenhum produto' }]
        : produtos.map((p) => ({
            value: p.id,
            label: `${p.nome} (${p.codigo ?? 's/cód'}) — ${formatMoney(Number(p.preco) || 0)}`
          })),
    [produtos, loading]
  )

  const variacaoOptions = useMemo(
    () =>
      variacoes.map((v) => ({
        value: v.id,
        label: `${labelVariacao(v)} — ${formatMoney(Number(v.preco) || 0)}`
      })),
    [variacoes]
  )

  const queueProduct = useMemo(() => {
    if (variacoes.length > 0) {
      return variacoes.find((v) => v.id === selectedVariacaoId) ?? null
    }
    return produtos.find((p) => p.id === selectedProductId) ?? null
  }, [variacoes, selectedVariacaoId, produtos, selectedProductId])

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  )

  const printerLanguage = useMemo(
    () => inferTemplateFromPrinterName(selectedPrinter),
    [selectedPrinter]
  )

  const languageMismatch = Boolean(
    printerLanguage && selectedTemplate && printerLanguage !== selectedTemplate.language
  )

  const totalEtiquetas = useMemo(
    () => queue.reduce((sum, item) => sum + item.quantidade, 0),
    [queue]
  )

  useEffect(() => {
    if (!selectedTemplateId || queue.length === 0) {
      setPreviewHtml('')
      setPreviewSummary(null)
      return
    }
    window.etiquetaAPI.etiquetas
      .preview({
        empresaId,
        templateId: selectedTemplateId,
        items: queue.map((q) => ({ produtoId: q.produtoId, quantidade: q.quantidade }))
      })
      .then((result) => {
        setPreviewHtml(result.preview.html)
        setPreviewSummary({ totalLabels: result.totalLabels, language: result.language })
      })
      .catch((err: unknown) => {
        setPreviewHtml('')
        setPreviewSummary(null)
        setError(err instanceof Error ? err.message : 'Erro ao gerar pré-visualização.')
      })
  }, [empresaId, selectedTemplateId, queue])

  const addToQueue = () => {
    if (!selectedProductId) return
    if (variacoes.length > 0 && !selectedVariacaoId) {
      setError('Selecione a variação do produto antes de adicionar.')
      return
    }
    const product = queueProduct
    const qty = Math.max(1, Math.floor(quantityInput || 1))
    if (!product) return
    const displayName =
      variacoes.length > 0 ? `${product.nome} · ${labelVariacao(product)}` : product.nome
    setError('')
    setQueue((prev) => {
      const idx = prev.findIndex((i) => i.produtoId === product.id)
      if (idx === -1) {
        return [
          ...prev,
          {
            produtoId: product.id,
            nome: displayName,
            codigo: product.codigo ?? null,
            quantidade: qty
          }
        ]
      }
      const next = [...prev]
      next[idx] = { ...next[idx], quantidade: next[idx].quantidade + qty }
      return next
    })
    setSuccess('Produto adicionado na fila de etiquetas.')
  }

  const installUpdate = async () => {
    setInstallingUpdate(true)
    try {
      const result = await window.etiquetaAPI.app.installUpdateNow()
      if (!result.ok) setError(result.message)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao instalar atualização.')
    } finally {
      setInstallingUpdate(false)
    }
  }

  const printQueue = async () => {
    if (!selectedPrinter) {
      setError('Selecione uma impressora antes de imprimir.')
      setTab('impressora')
      return
    }
    if (queue.length === 0) {
      setError('Adicione itens na fila para imprimir.')
      return
    }
    setError('')
    setSuccess('')
    setPrinting(true)
    try {
      const result = await window.etiquetaAPI.etiquetas.print({
        empresaId,
        templateId: selectedTemplateId || undefined,
        printerName: selectedPrinter,
        items: queue.map((q) => ({ produtoId: q.produtoId, quantidade: q.quantidade }))
      })
      if (!result.ok) {
        setError(result.error ?? 'Falha ao imprimir etiquetas.')
        return
      }
      setSuccess(`Impressão enviada (${result.labels ?? 0} etiqueta(s)).`)
      setQueue([])
      setPreviewOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar para impressão.')
    } finally {
      setPrinting(false)
    }
  }

  const previewDoc = useMemo(() => {
    if (!previewHtml) return ''
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;background:#fff;">${previewHtml}</body></html>`
  }, [previewHtml])

  const printerShortName = selectedPrinter
    ? selectedPrinter.replace(/^ARGOX[_ ]?/i, '').slice(0, 28)
    : 'Nenhuma'

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header-brand">
          <img src={logoAgiliza} alt="Agiliza" className="app-header-logo" />
          <div className="app-header-meta">
            <p className="app-header-title">Etiquetas</p>
            <p className="app-header-user">{session.nome}</p>
          </div>
        </div>
        <div className="app-header-actions">
          {appVersion ? <span className="app-header-version">v{appVersion}</span> : null}
          <button
            type="button"
            className="etiquetas-printer-chip"
            onClick={() => setTab('impressora')}
            title="Abrir configuração da impressora"
          >
            <span
              className={`etiquetas-status-dot ${
                printerStatus?.online ? 'etiquetas-status-dot--on' : 'etiquetas-status-dot--off'
              }`}
            />
            <span className="etiquetas-printer-chip-text">{printerShortName}</span>
            <Settings2 size={14} />
          </button>
          <Button variant="secondary" size="sm" onClick={onLogout}>
            Sair
          </Button>
        </div>
      </header>

      <main className="app-main">
        <div className="page-content etiquetas-page-root">
          {updateState?.phase === 'downloading' || updateState?.phase === 'available' ? (
            <Alert variant="info" style={{ marginBottom: 12 }}>
              {updateState.message ?? 'Baixando atualização...'}
              {typeof updateState.percent === 'number' ? ` (${updateState.percent}%)` : ''}
            </Alert>
          ) : null}
          {updateState?.phase === 'downloaded' ? (
            <Alert variant="success" style={{ marginBottom: 12 }}>
              <div className="etiquetas-update-banner">
                <span>{updateState.message ?? 'Atualização pronta para instalar.'}</span>
                <Button
                  size="sm"
                  leftIcon={<RefreshCw size={14} />}
                  onClick={() => void installUpdate()}
                  disabled={installingUpdate}
                >
                  {installingUpdate ? 'Reiniciando...' : 'Reiniciar e instalar'}
                </Button>
              </div>
            </Alert>
          ) : null}

          <div className="etiquetas-page-intro">
            <div>
              <h1 className="page-title">Impressão de etiquetas</h1>
              <p className="page-subtitle">
                Busque produtos, monte a fila e imprima. Ajuste a impressora só quando precisar.
              </p>
            </div>
          </div>

          {error ? (
            <Alert variant="error" style={{ marginBottom: 12 }}>
              {error}
            </Alert>
          ) : null}
          {success ? (
            <Alert variant="success" style={{ marginBottom: 12 }}>
              {success}
            </Alert>
          ) : null}

          <div className="etiquetas-tabs" role="tablist" aria-label="Seções">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'fila'}
              className={`etiquetas-tab ${tab === 'fila' ? 'etiquetas-tab--active' : ''}`}
              onClick={() => setTab('fila')}
            >
              Produtos e fila
              {totalEtiquetas > 0 ? (
                <span className="etiquetas-tab-badge">{totalEtiquetas}</span>
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'impressora'}
              className={`etiquetas-tab ${tab === 'impressora' ? 'etiquetas-tab--active' : ''}`}
              onClick={() => setTab('impressora')}
            >
              <Settings2 size={15} />
              Impressora
            </button>
          </div>

          {tab === 'fila' ? (
            <div className="etiquetas-workspace" role="tabpanel">
              <section className="card etiquetas-add-card">
                <div className="card-header">Adicionar produtos</div>
                <div className="card-body etiquetas-card-body">
                  <Input
                    label="Buscar produto"
                    value={search}
                    onChange={(e) => setSearch(e.currentTarget.value)}
                    placeholder="Nome, código ou código de barras"
                    autoFocus
                  />
                  <Select
                    label="Produto"
                    options={productOptions}
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.currentTarget.value)}
                    disabled={loading}
                  />
                  {variacoes.length > 0 ? (
                    <Select
                      label="Variação"
                      options={
                        variacaoOptions.length > 0
                          ? variacaoOptions
                          : [{ value: '', label: loadingVariacoes ? 'Carregando...' : 'Sem variação' }]
                      }
                      value={selectedVariacaoId}
                      onChange={(e) => setSelectedVariacaoId(e.currentTarget.value)}
                      disabled={loadingVariacoes}
                    />
                  ) : null}
                  <div className="etiquetas-add-row">
                    <Input
                      label="Quantidade"
                      type="number"
                      min={1}
                      step={1}
                      value={quantityInput}
                      onChange={(e) => setQuantityInput(Number(e.currentTarget.value) || 1)}
                    />
                    <Button
                      leftIcon={<Plus size={16} />}
                      onClick={addToQueue}
                      disabled={
                        loading ||
                        loadingVariacoes ||
                        !selectedProductId ||
                        (variacoes.length > 0 && !selectedVariacaoId)
                      }
                      className="etiquetas-add-btn"
                    >
                      Adicionar à fila
                    </Button>
                  </div>
                </div>
              </section>

              <section className="card etiquetas-queue-card">
                <div className="etiquetas-queue-header">
                  <div>
                    <div className="card-header-inline">Fila de impressão</div>
                    <p className="etiquetas-queue-meta">
                      {queue.length === 0
                        ? 'Nenhum item'
                        : `${queue.length} produto(s) · ${totalEtiquetas} etiqueta(s)`}
                    </p>
                  </div>
                  <div className="etiquetas-queue-toolbar">
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Eye size={15} />}
                      onClick={() => setPreviewOpen(true)}
                      disabled={queue.length === 0 || !previewHtml}
                    >
                      Ver prévia
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Trash2 size={15} />}
                      onClick={() => setQueue([])}
                      disabled={queue.length === 0}
                    >
                      Limpar
                    </Button>
                    <Button
                      size="sm"
                      leftIcon={<Printer size={15} />}
                      onClick={printQueue}
                      disabled={queue.length === 0 || printing}
                    >
                      {printing ? 'Imprimindo...' : 'Imprimir'}
                    </Button>
                  </div>
                </div>
                <div className="card-body">
                  {queue.length === 0 ? (
                    <div className="etiquetas-empty">
                      <p>A fila está vazia.</p>
                      <span>Busque um produto ao lado e adicione a quantidade desejada.</span>
                    </div>
                  ) : (
                    <div className="etiquetas-queue-list">
                      {queue.map((item) => (
                        <div key={item.produtoId} className="etiquetas-queue-item">
                          <div className="etiquetas-queue-main">
                            <div className="etiquetas-queue-name">{item.nome || 'Produto sem nome'}</div>
                            <div className="etiquetas-queue-code">Cód.: {item.codigo ?? '—'}</div>
                          </div>
                          <div className="etiquetas-queue-actions">
                            <input
                              className="input-el etiquetas-qty-input"
                              type="number"
                              min={1}
                              step={1}
                              aria-label={`Quantidade de ${item.nome}`}
                              value={item.quantidade}
                              onChange={(e) => {
                                const qty = Math.max(1, Math.floor(Number(e.currentTarget.value) || 1))
                                setQueue((prev) =>
                                  prev.map((q) =>
                                    q.produtoId === item.produtoId ? { ...q, quantidade: qty } : q
                                  )
                                )
                              }}
                              style={{ margin: 0 }}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setQueue((prev) => prev.filter((q) => q.produtoId !== item.produtoId))
                              }
                            >
                              Remover
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div className="etiquetas-settings" role="tabpanel">
              <section className="card">
                <div className="card-header">Configuração da impressora</div>
                <div className="card-body etiquetas-card-body">
                  <Select
                    label="Modelo de etiqueta"
                    options={templates.map((t) => ({ value: t.id, label: t.name }))}
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.currentTarget.value)}
                  />
                  <Select
                    label="Impressora"
                    options={
                      printers.length === 0
                        ? [{ value: '', label: 'Nenhuma impressora encontrada' }]
                        : printers.map((p) => ({
                            value: p.name,
                            label: p.isDefault ? `${p.name} (padrão)` : p.name
                          }))
                    }
                    value={selectedPrinter}
                    onChange={(e) => {
                      const next = e.currentTarget.value
                      setSelectedPrinter(next)
                      const inferred = inferTemplateFromPrinterName(next)
                      if (inferred) {
                        const best = templates.find((t) => t.language === inferred)
                        if (best) setSelectedTemplateId(best.id)
                      }
                    }}
                  />
                  <div className="etiquetas-printer-status">
                    <span>Status:</span>
                    <strong
                      style={{
                        color: printerStatus?.online ? 'var(--color-success)' : 'var(--color-error)'
                      }}
                    >
                      {printerStatus ? (printerStatus.online ? 'Online' : 'Offline') : 'Indisponível'}
                    </strong>
                    {printerStatus?.detail ? (
                      <span className="etiquetas-printer-detail">{printerStatus.detail}</span>
                    ) : null}
                  </div>
                  {languageMismatch ? (
                    <Alert variant="warning" style={{ fontSize: 'var(--text-sm)' }}>
                      <strong>Atenção:</strong> o nome da impressora sugere <strong>{printerLanguage}</strong>,
                      mas o modelo de etiqueta é <strong>{selectedTemplate?.language}</strong>. Na impressão o
                      app força o idioma da fila automaticamente.
                    </Alert>
                  ) : null}
                  {!printerStatus?.online ? (
                    <Alert variant="error" style={{ fontSize: 'var(--text-sm)' }}>
                      Impressora offline ou USB desconectado. Reconecte o cabo, cancele jobs travados na fila do
                      macOS (job “(stdin)” / “Enviando dados”) e tente de novo.
                    </Alert>
                  ) : null}
                  <Alert variant="info" style={{ fontSize: 'var(--text-sm)' }}>
                    Sua fila é <strong>PPLA</strong>. Se ainda travar, cancele o job na fila do sistema e, se
                    precisar, crie uma impressora <strong>Genérico / Somente texto</strong> na mesma porta USB.
                  </Alert>
                  <div className="etiquetas-settings-footer">
                    <Button variant="secondary" onClick={() => setTab('fila')}>
                      Voltar para a fila
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>

      <Modal
        open={previewOpen}
        title="Pré-visualização das etiquetas"
        onClose={() => setPreviewOpen(false)}
        wide
      >
        {previewSummary ? (
          <p className="etiquetas-preview-summary">
            {previewSummary.totalLabels} etiqueta(s) — Linguagem {previewSummary.language}
          </p>
        ) : null}
        <div className="etiquetas-preview-wrap">
          {previewHtml ? (
            <iframe
              title="Pré-visualização de etiquetas"
              srcDoc={previewDoc}
              className="etiquetas-preview-frame"
            />
          ) : (
            <div className="etiquetas-empty">
              <p>Sem prévia disponível.</p>
              <span>Adicione itens na fila para gerar a visualização.</span>
            </div>
          )}
        </div>
        <div className="etiquetas-preview-actions">
          <Button variant="secondary" onClick={() => setPreviewOpen(false)}>
            Fechar
          </Button>
          <Button
            leftIcon={<Printer size={16} />}
            onClick={printQueue}
            disabled={queue.length === 0 || printing}
          >
            {printing ? 'Imprimindo...' : 'Imprimir fila'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
