import { useEffect, useMemo, useState } from 'react'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import type { LabelTemplate, PrinterInfo, PrinterStatus, Produto } from '../vite-env'
import { Alert, Button, Input, PageTitle, Select } from '../components/ui'
import { Plus, Trash2, Printer } from 'lucide-react'

type QueueItem = {
  produtoId: string
  nome: string
  codigo: number | null
  quantidade: number
}

export function Etiquetas() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''

  const [produtos, setProdutos] = useState<Produto[]>([])
  const [search, setSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [quantityInput, setQuantityInput] = useState(1)

  const [queue, setQueue] = useState<QueueItem[]>([])

  const [templates, setTemplates] = useState<LabelTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState('')
  const [printMode, setPrintMode] = useState<'RAW' | 'SYSTEM'>('RAW')
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus | null>(null)

  const [previewHtml, setPreviewHtml] = useState('')
  const [previewSummary, setPreviewSummary] = useState<{ totalLabels: number; language: string } | null>(null)

  const [loading, setLoading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const inferTemplateFromPrinterName = (printerName: string): 'PPLA' | 'PPLB' | null => {
    const name = (printerName || '').toLowerCase()
    if (!name) return null
    if (name.includes('ppla')) return 'PPLA'
    if (name.includes('pplb')) return 'PPLB'
    return null
  }

  useEffect(() => {
    if (!empresaId) return
    setLoading(true)
    window.electronAPI.produtos
      .list(empresaId, { apenasAtivos: true })
      .then((items) => {
        setProdutos(items)
        if (!selectedProductId && items[0]?.id) setSelectedProductId(items[0].id)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar produtos.')
      })
      .finally(() => setLoading(false))
  }, [empresaId])

  useEffect(() => {
    Promise.all([window.electronAPI.etiquetas.listTemplates(), window.electronAPI.etiquetas.listPrinters()])
      .then(([tpls, ptrs]) => {
        setTemplates(tpls)
        setPrinters(ptrs)
        if (!selectedTemplateId && tpls[0]?.id) setSelectedTemplateId(tpls[0].id)
        if (!selectedPrinter) {
          const defaultPrinter = ptrs.find((p) => p.isDefault)?.name ?? ptrs[0]?.name ?? ''
          setSelectedPrinter(defaultPrinter)
          const inferredLanguage = inferTemplateFromPrinterName(defaultPrinter)
          if (inferredLanguage) {
            const bestTemplate = tpls.find((t) => t.language === inferredLanguage)
            if (bestTemplate) setSelectedTemplateId(bestTemplate.id)
          }
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar configurações de impressão.')
      })
  }, [])
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  )

  const selectedTemplateHint = selectedTemplate?.language ?? 'PPLB'

  /** Nome da fila costuma incluir PPLA/PPLB (ex.: "Argox ... PPLA (Copiar 1)"). */
  const printerLanguageFromName = useMemo(
    () => inferTemplateFromPrinterName(selectedPrinter),
    [selectedPrinter]
  )

  const languageMismatch = Boolean(
    printerLanguageFromName && selectedTemplate && printerLanguageFromName !== selectedTemplate.language
  )


  useEffect(() => {
    if (!selectedPrinter) {
      setPrinterStatus(null)
      return
    }
    window.electronAPI.etiquetas
      .getPrinterStatus(selectedPrinter)
      .then(setPrinterStatus)
      .catch((err: unknown) => {
        setPrinterStatus({
          name: selectedPrinter,
          online: false,
          detail: err instanceof Error ? err.message : 'Falha ao consultar impressora.'
        })
      })
  }, [selectedPrinter])

  const filteredProdutos = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return produtos
    return produtos.filter((p) => {
      const nome = p.nome.toLowerCase()
      const cod = String(p.codigo ?? '').toLowerCase()
      const barras = (p.codigo_barras ?? '').toLowerCase()
      return nome.includes(term) || cod.includes(term) || barras.includes(term)
    })
  }, [produtos, search])

  const productOptions = useMemo(
    () => filteredProdutos.map((p) => ({ value: p.id, label: `${p.nome} (${p.codigo ?? 's/cód'})` })),
    [filteredProdutos]
  )

  const previewDoc = useMemo(() => {
    if (!previewHtml) return ''
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;">${previewHtml}</body></html>`
  }, [previewHtml])

  useEffect(() => {
    if (!selectedTemplateId || queue.length === 0) {
      setPreviewHtml('')
      setPreviewSummary(null)
      return
    }
    window.electronAPI.etiquetas
      .preview({
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
  }, [selectedTemplateId, queue])

  const addToQueue = () => {
    const product = produtos.find((p) => p.id === selectedProductId)
    const qty = Math.max(1, Math.floor(quantityInput || 1))
    if (!product) return
    setError('')
    setQueue((prev) => {
      const idx = prev.findIndex((i) => i.produtoId === product.id)
      if (idx === -1) {
        return [
          ...prev,
          {
            produtoId: product.id,
            nome: product.nome,
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

  const updateQueueQty = (produtoId: string, quantidade: number) => {
    const qty = Math.max(1, Math.floor(quantidade || 1))
    setQueue((prev) => prev.map((item) => (item.produtoId === produtoId ? { ...item, quantidade: qty } : item)))
  }

  const removeFromQueue = (produtoId: string) => {
    setQueue((prev) => prev.filter((item) => item.produtoId !== produtoId))
  }

  const clearQueue = () => setQueue([])

  const printQueue = async () => {
    if (!selectedPrinter) {
      setError('Selecione uma impressora antes de imprimir.')
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
      const result = await window.electronAPI.etiquetas.print({
        templateId: selectedTemplateId || undefined,
        printerName: selectedPrinter,
        printMode,
        items: queue.map((q) => ({ produtoId: q.produtoId, quantidade: q.quantidade }))
      })
      if (!result.ok) {
        setError(result.error ?? 'Falha ao imprimir etiquetas.')
        return
      }
      setSuccess(`Impressão enviada com sucesso (${result.labels ?? 0} etiqueta(s)).`)
      setQueue([])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar para impressão.')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <Layout>
      <div className="etiquetas-page-root">
        <PageTitle
          title="Etiquetas"
          subtitle="Monte a fila de impressão selecionando produtos e quantidades para imprimir várias etiquetas em lote."
        />

        {error && <Alert variant="error" style={{ marginBottom: 12 }}>{error}</Alert>}
        {success && <Alert variant="success" style={{ marginBottom: 12 }}>{success}</Alert>}

        <div className="etiquetas-config-grid mb-section">
        <section className="card">
          <div className="card-header">Adicionar na fila</div>
          <div className="card-body etiquetas-card-body">
            <Input
              label="Buscar produto"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              placeholder="Nome, código ou código de barras"
            />
            <Select
              label="Produto"
              options={productOptions}
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.currentTarget.value)}
            />
            <Input
              label="Quantidade de etiquetas"
              type="number"
              min={1}
              step={1}
              value={quantityInput}
              onChange={(e) => setQuantityInput(Number(e.currentTarget.value) || 1)}
            />
            <Button leftIcon={<Plus size={16} />} onClick={addToQueue} disabled={loading || !selectedProductId}>
              Adicionar à fila
            </Button>
          </div>
        </section>

        <section className="card">
          <div className="card-header">Configuração de impressão</div>
          <div className="card-body etiquetas-card-body">
            <Select
              label="Modelo de etiqueta"
              options={templates.map((t) => ({ value: t.id, label: t.name }))}
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.currentTarget.value)}
            />
            <Select
              label="Modo de impressão"
              options={[
                { value: 'RAW', label: 'RAW (comandos da etiqueta)' },
                { value: 'SYSTEM', label: 'Sistema/Driver (fallback)' }
              ]}
              value={printMode}
              onChange={(e) => setPrintMode((e.currentTarget.value as 'RAW' | 'SYSTEM') || 'RAW')}
            />
            {printers.length === 0 &&
              typeof navigator !== 'undefined' &&
              (navigator.userAgent?.includes('Mac') || navigator.platform?.toLowerCase().includes('mac')) && (
              <Alert variant="warning" style={{ marginBottom: 12, fontSize: 'var(--text-sm)' }}>
                <strong>Nenhuma impressora na lista?</strong> No <strong>Mac</strong>, o app usa o CUPS: cadastre a impressora em{' '}
                <strong>Ajustes do Sistema → Impressoras e scanners</strong>. Depois, no Terminal, rode{' '}
                <code style={{ wordBreak: 'break-all' }}>lpstat -p</code> — se listar filas e o Agiliza não, atualize o app ou
                reporte o resultado desse comando.
              </Alert>
            )}
            <Select
              label="Impressora"
              options={printers.map((p) => ({ value: p.name, label: p.isDefault ? `${p.name} (padrão)` : p.name }))}
              value={selectedPrinter}
              onChange={(e) => {
                const nextPrinter = e.currentTarget.value
                setSelectedPrinter(nextPrinter)
                const inferredLanguage = inferTemplateFromPrinterName(nextPrinter)
                if (inferredLanguage) {
                  const bestTemplate = templates.find((t) => t.language === inferredLanguage)
                  if (bestTemplate) setSelectedTemplateId(bestTemplate.id)
                }
              }}
            />
            <div className="etiquetas-printer-status">
              <span>Status:</span>
              <strong style={{ color: printerStatus?.online ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {printerStatus ? (printerStatus.online ? 'Online' : 'Offline') : 'Indisponível'}
              </strong>
              {printerStatus?.detail ? <span className="etiquetas-printer-detail">{printerStatus.detail}</span> : null}
            </div>
            {languageMismatch && (
              <Alert variant="warning" style={{ marginTop: 12, fontSize: 'var(--text-sm)' }}>
                <strong>Atenção:</strong> o nome da impressora sugere <strong>{printerLanguageFromName}</strong>, mas o modelo de
                etiqueta é <strong>{selectedTemplateHint}</strong>. Ajuste um dos dois para ficarem iguais (ou troque a emulação
                na Argox pelo utilitário Argox / painel da impressora).
              </Alert>
            )}
            <Alert variant="info" style={{ marginTop: 12, fontSize: 'var(--text-sm)' }}>
              <strong>Teste da impressora ou página em branco funciona, mas o Agiliza não imprime?</strong> Isso é comum: o driver
              Argox aceita trabalhos <strong>gráficos</strong> do Windows, mas às vezes <strong>não repassa RAW</strong> do aplicativo
              (a fila até marca “Impresso”). <strong>Solução:</strong> crie uma impressora <strong>Genérico / Somente texto</strong>{' '}
              usando a <strong>mesma porta USB</strong> da Argox e, aqui em Etiquetas, escolha <strong>essa fila</strong> em vez da
              “Argox … PPLA”. Ela deve aparecer na lista junto com a Argox.
            </Alert>
            <Alert variant="info" style={{ marginTop: 8, fontSize: 'var(--text-sm)' }}>
              <strong>Fila mostra “Impresso”, mas não sai etiqueta?</strong> Confira também: (1) emulação no{' '}
              <strong>menu da impressora</strong> igual ao modelo (PPLA/PPLB); (2) <strong>sensor de gap</strong> / calibração; (3){' '}
              fila “Copiar 1” na porta certa; (4) Propriedades → Avançado → <strong>WinPrint</strong> e dados <strong>RAW</strong> na
              fila Argox, se for insistir nela.
            </Alert>
            <Alert variant="info" style={{ marginTop: 8, fontSize: 'var(--text-sm)' }}>
              <strong>Impressora laser joga texto com N, q, A, B…?</strong> Isso é normal: ela não interpreta PPL. Na Argox, se
              isso acontecer, a fila não está em modo etiqueta/RAW ou a emulação não bate.
            </Alert>
          </div>
        </section>
      </div>

      <section className="card mb-section etiquetas-queue-card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>Fila de etiquetas ({queue.length} item(ns))</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" leftIcon={<Trash2 size={16} />} onClick={clearQueue} disabled={queue.length === 0}>
              Limpar fila
            </Button>
            <Button leftIcon={<Printer size={16} />} onClick={printQueue} disabled={queue.length === 0 || printing}>
              {printing ? 'Imprimindo...' : 'Imprimir fila'}
            </Button>
          </div>
        </div>

        <div className="card-body">
        {queue.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Nenhum item na fila.</p>
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
                    value={item.quantidade}
                    onChange={(e) => updateQueueQty(item.produtoId, Number(e.currentTarget.value))}
                    style={{ margin: 0 }}
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeFromQueue(item.produtoId)}>
                    Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </section>

      <section className="card">
        <div className="card-header">Pré-visualização</div>
        <div className="card-body">
          {previewSummary && (
            <p style={{ marginTop: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              {previewSummary.totalLabels} etiqueta(s) — Linguagem {previewSummary.language}
            </p>
          )}
          <div className="etiquetas-preview-wrap">
            {previewHtml ? (
              <iframe
                title="Pré-visualização de etiquetas"
                srcDoc={previewDoc}
                className="etiquetas-preview-frame"
              />
            ) : (
              <div style={{ padding: 12, color: 'var(--color-text-secondary)' }}>
                A pré-visualização aparece aqui quando houver itens na fila.
              </div>
            )}
          </div>
        </div>
      </section>
      </div>
    </Layout>
  )
}
