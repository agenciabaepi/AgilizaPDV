import { useCallback, useEffect, useMemo, useState } from 'react'
import { Layout } from '../components/Layout'
import { PageTitle, Button, Input, Select, Dialog, Alert, useOperationToast } from '../components/ui'
import { Calendar, HandCoins, RefreshCw, Settings2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import type { Caixa } from '../vite-env'

type ContaReceberRow = {
  id: string
  empresa_id: string
  venda_id: string
  cliente_id: string
  valor: number
  vencimento: string
  status: string
  cliente_nome: string
  venda_numero: number
}

type VendaPrazoConfig = {
  usar_limite_credito: boolean
  bloquear_inadimplente: boolean
}

const FORMAS_RECEB: { value: string; label: string }[] = [
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'PIX', label: 'PIX' },
  { value: 'DEBITO', label: 'Cartão de débito' },
  { value: 'CREDITO', label: 'Cartão de crédito' },
  { value: 'OUTROS', label: 'Outros' },
]

export function ContasReceber() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''
  const userId = session?.id ?? ''
  const op = useOperationToast()

  const [contas, setContas] = useState<ContaReceberRow[]>([])
  const [loading, setLoading] = useState(false)
  const [clienteFiltro, setClienteFiltro] = useState('')
  const [cfg, setCfg] = useState<VendaPrazoConfig | null>(null)
  const [caixaAberto, setCaixaAberto] = useState<Caixa | null>(null)
  const [receberConta, setReceberConta] = useState<ContaReceberRow | null>(null)
  const [formaRecebimento, setFormaRecebimento] = useState('DINHEIRO')
  const [recebendo, setRecebendo] = useState(false)

  const api = window.electronAPI?.contasReceber

  const load = useCallback(async () => {
    if (!empresaId || !api?.list) return
    setLoading(true)
    try {
      const rows = (await api.list(empresaId, { status: 'aberto', limit: 500 })) as ContaReceberRow[]
      setContas(Array.isArray(rows) ? rows : [])
    } catch {
      setContas([])
    } finally {
      setLoading(false)
    }
  }, [empresaId, api])

  const loadCfg = useCallback(async () => {
    if (!empresaId || !api?.getVendaPrazoConfig) return
    try {
      const c = (await api.getVendaPrazoConfig(empresaId)) as VendaPrazoConfig
      setCfg(c)
    } catch {
      setCfg({ usar_limite_credito: false, bloquear_inadimplente: false })
    }
  }, [empresaId, api])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadCfg()
  }, [loadCfg])

  useEffect(() => {
    if (!empresaId || !window.electronAPI?.caixa?.getAberto) return
    window.electronAPI.caixa.getAberto(empresaId).then(setCaixaAberto).catch(() => setCaixaAberto(null))
  }, [empresaId])

  const contasFiltradas = useMemo(() => {
    if (!clienteFiltro.trim()) return contas
    const t = clienteFiltro.trim().toLowerCase()
    return contas.filter((c) => c.cliente_nome.toLowerCase().includes(t))
  }, [contas, clienteFiltro])

  const totalAberto = useMemo(
    () => contasFiltradas.reduce((acc, c) => acc + c.valor, 0),
    [contasFiltradas]
  )

  const salvarCfg = async () => {
    if (!empresaId || !api?.updateVendaPrazoConfig || !cfg) return
    try {
      await api.updateVendaPrazoConfig(empresaId, cfg)
      op.saved('Configurações salvas.')
    } catch (e) {
      op.failed(e, 'Erro ao salvar.')
    }
  }

  const confirmarReceber = async () => {
    if (!receberConta || !caixaAberto || !empresaId || !api?.receber) return
    setRecebendo(true)
    try {
      const contaIdParaRecibo = receberConta.id
      await api.receber({
        conta_id: contaIdParaRecibo,
        empresa_id: empresaId,
        caixa_id: caixaAberto.id,
        usuario_id: userId,
        forma: formaRecebimento as 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'OUTROS',
      })
      op.saved('Recebimento registrado no caixa.')
      setReceberConta(null)
      const imprimirRecibo = window.electronAPI?.cupom?.imprimirReciboRecebimento
      if (typeof imprimirRecibo === 'function') {
        const r = await imprimirRecibo(contaIdParaRecibo)
        if (r && !r.ok && r.error) {
          op.warn(`Comprovante não impresso: ${r.error}`)
        }
      }
      await load()
      const cx = await window.electronAPI?.caixa?.getAberto(empresaId)
      setCaixaAberto(cx ?? null)
    } catch (e) {
      op.failed(e, 'Erro ao receber.')
    } finally {
      setRecebendo(false)
    }
  }

  const hoje = new Date().toISOString().slice(0, 10)
  const vencido = (v: string) => v < hoje

  return (
    <Layout>
      <PageTitle title="Contas a receber" subtitle="Títulos em aberto, recebimentos e regras de venda a prazo." />

      <div className="financeiro-toolbar-row">
        <Button leftIcon={<RefreshCw size={16} />} variant="secondary" onClick={() => load()} disabled={loading}>
          Atualizar
        </Button>
      </div>

      {cfg && (
        <div className="financeiro-config-card">
          <div className="financeiro-config-head">
            <Settings2 size={18} />
            <span>Venda a prazo — regras opcionais</span>
          </div>
          <div className="financeiro-config-grid">
            <label className="financeiro-check">
              <input
                type="checkbox"
                checked={cfg.usar_limite_credito}
                onChange={(e) => setCfg({ ...cfg, usar_limite_credito: e.target.checked })}
              />
              Limitar crédito pelo campo «Limite de crédito» no cadastro do cliente
            </label>
            <label className="financeiro-check">
              <input
                type="checkbox"
                checked={cfg.bloquear_inadimplente}
                onChange={(e) => setCfg({ ...cfg, bloquear_inadimplente: e.target.checked })}
              />
              Bloquear nova venda a prazo para clientes com título vencido em aberto
            </label>
          </div>
          <Button size="sm" variant="secondary" onClick={salvarCfg}>
            Salvar regras
          </Button>
        </div>
      )}

      <div className="financeiro-form-wrap financeiro-form-wrap--filtro">
        <Input
          label="Filtrar por cliente"
          placeholder="Nome do cliente"
          value={clienteFiltro}
          onChange={(e) => setClienteFiltro(e.target.value)}
        />
      </div>

      <div className="financeiro-resumo-card financeiro-resumo-card--receber">
        <HandCoins size={18} />
        <span>Total em aberto (filtrado):</span>
        <strong>
          {totalAberto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </strong>
      </div>

      {!caixaAberto && (
        <Alert variant="warning" style={{ marginBottom: 'var(--space-3)' }}>
          Abra o caixa no PDV para registrar recebimentos — o valor será lançado no caixa atual pela forma escolhida.
        </Alert>
      )}

      <div className="financeiro-lista-wrap">
        <h3 className="financeiro-lista-title">Parcelas em aberto</h3>
        {loading ? (
          <p className="financeiro-empty">Carregando…</p>
        ) : contasFiltradas.length === 0 ? (
          <p className="financeiro-empty">Nenhuma conta pendente.</p>
        ) : (
          <div className="financeiro-lista">
            {contasFiltradas.map((conta) => (
              <div key={conta.id} className="financeiro-item">
                <div>
                  <div className="financeiro-item-title">
                    {conta.cliente_nome} — Venda #{conta.venda_numero}
                  </div>
                  <div className="financeiro-item-meta">
                    <Calendar size={14} />
                    <span className={vencido(conta.vencimento) ? 'financeiro-vencido' : ''}>
                      Venc. {new Date(`${conta.vencimento}T12:00:00`).toLocaleDateString('pt-BR')}
                      {vencido(conta.vencimento) ? ' — vencido' : ''}
                    </span>
                  </div>
                </div>
                <div className="financeiro-item-right">
                  <strong>{conta.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!caixaAberto}
                    onClick={() => {
                      setFormaRecebimento('DINHEIRO')
                      setReceberConta(conta)
                    }}
                  >
                    Receber
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={receberConta != null}
        onClose={() => !recebendo && setReceberConta(null)}
        title="Registrar recebimento"
        showCloseButton={!recebendo}
      >
        {receberConta && (
          <div className="financeiro-dialog-body">
            <p className="text-secondary text-sm" style={{ marginTop: 0 }}>
              Cliente: <strong>{receberConta.cliente_nome}</strong>
              <br />
              Valor:{' '}
              <strong>{receberConta.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
            </p>
            <Select
              label="Forma de recebimento (entrada no caixa)"
              value={formaRecebimento}
              onChange={(e) => setFormaRecebimento(e.target.value)}
              options={FORMAS_RECEB.map((o) => ({ value: o.value, label: o.label }))}
            />
            <div className="financeiro-dialog-actions">
              <Button variant="secondary" onClick={() => setReceberConta(null)} disabled={recebendo}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={confirmarReceber} disabled={recebendo}>
                {recebendo ? 'Registrando…' : 'Confirmar recebimento'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </Layout>
  )
}
