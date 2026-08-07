import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Layout } from '../components/Layout'
import { PageTitle, Card, CardBody, Button, Input, Alert, Select, Dialog, useOperationToast } from '../components/ui'
import { Users, Settings, Ban, Unlock } from 'lucide-react'
import type { VendaDetalhes } from '../vite-env'

type Tab = 'config' | 'clientes'

type CashbackConfigRow = {
  ativo: number
  percentual_padrao: number
  modo_validade: string
  dias_validade: number | null
  data_validade_fixa: string | null
  valor_minimo_compra_gerar: number
  valor_minimo_compra_usar: number
  valor_maximo_uso_por_venda: number | null
  permitir_quitar_total: number
  permitir_uso_mesma_compra: number
  calcular_sobre: string
  excluir_itens_com_desconto: number
  excluir_itens_promocionais: number
  gerar_sobre_valor_apos_cashback: number
  modo_lista: string
  arredondamento: string
  dias_alerta_expiracao: number
}

type ClienteCashRow = {
  cliente_id: string
  nome: string
  cpf_cnpj: string | null
  telefone: string | null
  saldo_disponivel: number
  saldo_expirado_acumulado: number
  total_gerado: number
  total_utilizado: number
  bloqueado: number
  ultima_mov: string | null
}

type SaldoResumo = {
  saldo_disponivel: number
  saldo_expirado_acumulado: number
  total_gerado: number
  total_utilizado: number
  bloqueado: boolean
  prestes_expirar: number
  proxima_expiracao: string | null
}

type MovRow = {
  id: string
  tipo: string
  origem: string
  venda_id: string | null
  valor: number
  saldo_disponivel_apos: number | null
  observacao: string | null
  created_at: string
}

type CreditoRow = {
  id: string
  venda_id_origem: string | null
  valor_inicial: number
  valor_restante: number
  expira_em: string | null
  status: string
  created_at: string
}

export function Cashback() {
  const { session } = useAuth()
  const empresaId = session && 'empresa_id' in session ? session.empresa_id : ''
  const userId = session && 'id' in session ? session.id : ''
  const op = useOperationToast()
  const api = window.electronAPI?.cashback

  const [tab, setTab] = useState<Tab>('config')
  const [cfg, setCfg] = useState<CashbackConfigRow | null>(null)
  const [clientesList, setClientesList] = useState<ClienteCashRow[]>([])
  const [filtro, setFiltro] = useState<string>('todos')
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<string>('nome')
  const [detalheId, setDetalheId] = useState<string | null>(null)
  const [detalheNome, setDetalheNome] = useState('')
  const [detalheOpen, setDetalheOpen] = useState(false)
  const [saldo, setSaldo] = useState<SaldoResumo | null>(null)
  const [movs, setMovs] = useState<MovRow[]>([])
  const [creditos, setCreditos] = useState<CreditoRow[]>([])
  const [vendasMap, setVendasMap] = useState<Record<string, VendaDetalhes>>({})
  const [relatorio, setRelatorio] = useState<Record<string, number> | null>(null)

  const [ajValor, setAjusteValor] = useState('')
  const [ajMotivo, setAjusteMotivo] = useState('')
  const [ajTipo, setAjusteTipo] = useState<'credito' | 'debito'>('credito')

  const loadConfig = useCallback(async () => {
    if (!empresaId || !api) return
    try {
      const c = (await api.getConfig(empresaId)) as CashbackConfigRow
      setCfg(c)
    } catch (e) {
      op.error(e instanceof Error ? e.message : 'Erro ao carregar configuração.')
    }
  }, [empresaId, api, op])

  const loadClientes = useCallback(async () => {
    if (!empresaId || !api) return
    try {
      const f =
        filtro === 'com_saldo' ? 'com_saldo' : filtro === 'sem_saldo' ? 'sem_saldo' : 'todos'
      const o =
        ordem === 'saldo_desc' ? 'saldo_desc' : ordem === 'mov_desc' ? 'mov_desc' : ordem === 'cpf' ? 'cpf' : 'nome'
      const rows = (await api.listClientes(empresaId, { q: busca || undefined, filtro: f, ordem: o })) as ClienteCashRow[]
      setClientesList(rows)
    } catch (e) {
      op.error(e instanceof Error ? e.message : 'Erro ao listar clientes.')
    }
  }, [empresaId, api, busca, filtro, ordem, op])

  const loadDetalhe = useCallback(async () => {
    if (!empresaId || !api || !detalheId) return
    try {
      const [s, movRows, credRows] = await Promise.all([
        api.getSaldoCliente(empresaId, detalheId) as Promise<SaldoResumo | null>,
        api.listMovimentacoes(empresaId, detalheId, 250) as Promise<MovRow[]>,
        api.listCreditosCliente(empresaId, detalheId, 300) as Promise<CreditoRow[]>,
      ])
      setSaldo(s)
      setMovs(movRows)
      setCreditos(credRows)
      const vendaIds = Array.from(
        new Set([
          ...movRows.map((m) => m.venda_id).filter((x): x is string => Boolean(x)),
          ...credRows.map((c) => c.venda_id_origem).filter((x): x is string => Boolean(x)),
        ])
      )
      const detalhesArr = await Promise.all(
        vendaIds.map(async (vendaId) => {
          try {
            const d = (await window.electronAPI?.cupom?.getDetalhes(vendaId)) as VendaDetalhes | null
            return d ? [vendaId, d] : null
          } catch {
            return null
          }
        })
      )
      const nextMap: Record<string, VendaDetalhes> = {}
      for (const e of detalhesArr) {
        if (e) nextMap[e[0]] = e[1]
      }
      setVendasMap(nextMap)
    } catch (e) {
      op.error(e instanceof Error ? e.message : 'Erro ao carregar extrato.')
    }
  }, [empresaId, api, detalheId, op])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  useEffect(() => {
    if (tab === 'clientes') loadClientes()
  }, [tab, loadClientes])

  useEffect(() => {
    if (detalheOpen && detalheId) loadDetalhe()
  }, [detalheOpen, detalheId, loadDetalhe])

  const salvarConfig = async () => {
    if (!empresaId || !api || !cfg) return
    try {
      await api.updateConfig(empresaId, {
        ativo: cfg.ativo === 1,
        percentual_padrao: cfg.percentual_padrao,
        modo_validade: cfg.modo_validade === 'FIXA' ? 'DIAS' : cfg.modo_validade,
        dias_validade: cfg.dias_validade,
        data_validade_fixa: null,
        valor_minimo_compra_gerar: cfg.valor_minimo_compra_gerar,
        valor_minimo_compra_usar: cfg.valor_minimo_compra_usar,
        valor_maximo_uso_por_venda: cfg.valor_maximo_uso_por_venda,
        permitir_quitar_total: cfg.permitir_quitar_total === 1,
        permitir_uso_mesma_compra: cfg.permitir_uso_mesma_compra === 1,
        calcular_sobre: 'LIQUIDO',
        excluir_itens_com_desconto: false,
        excluir_itens_promocionais: false,
        gerar_sobre_valor_apos_cashback: cfg.gerar_sobre_valor_apos_cashback === 1,
        modo_lista: 'TODOS_EXCETO_EXCLUIDOS',
        arredondamento: cfg.arredondamento,
        dias_alerta_expiracao: cfg.dias_alerta_expiracao,
      })
      op.saved('Configurações de cashback salvas.')
      await loadConfig()
    } catch (e) {
      op.failed(e, 'Erro ao salvar.')
    }
  }

  const abrirDetalhe = (c: ClienteCashRow) => {
    setDetalheId(c.cliente_id)
    setDetalheNome(c.nome)
    setDetalheOpen(true)
  }

  const ajuste = async () => {
    if (!empresaId || !api || !detalheId) return
    const v = Number(String(ajValor).replace(',', '.')) || 0
    if (!ajMotivo.trim()) {
      op.error('Informe o motivo do ajuste.')
      return
    }
    try {
      await api.ajusteManual({
        empresa_id: empresaId,
        cliente_id: detalheId,
        usuario_id: userId,
        tipo: ajTipo,
        valor: v,
        motivo: ajMotivo.trim(),
      })
      op.saved('Ajuste registrado.')
      setAjusteValor('')
      setAjusteMotivo('')
      await loadDetalhe()
      await loadClientes()
    } catch (e) {
      op.failed(e, 'Erro no ajuste.')
    }
  }

  const toggleBloqueio = async () => {
    if (!empresaId || !api || !detalheId || !saldo) return
    try {
      await api.setBloqueio(empresaId, detalheId, !saldo.bloqueado)
      op.saved(saldo.bloqueado ? 'Cliente desbloqueado.' : 'Cliente bloqueado no cashback.')
      await loadDetalhe()
    } catch (e) {
      op.failed(e, 'Erro ao alterar bloqueio.')
    }
  }

  const carregarRelatorio = async () => {
    if (!empresaId || !api) return
    try {
      setRelatorio((await api.relatorio(empresaId)) as Record<string, number>)
    } catch {
      setRelatorio(null)
    }
  }

  if (!empresaId || !api) {
    return (
      <Layout>
        <PageTitle title="Cashback" />
        <Alert variant="warning">Módulo indisponível neste ambiente.</Alert>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="cashback-page">
        <PageTitle title="Cashback" subtitle="Programa de fidelidade — configuração, clientes e extrato" />
        <div className="cashback-toolbar">
          <Button type="button" variant={tab === 'config' ? 'primary' : 'secondary'} size="sm" onClick={() => setTab('config')}>
            <Settings size={16} /> Configurações
          </Button>
          <Button type="button" variant={tab === 'clientes' ? 'primary' : 'secondary'} size="sm" onClick={() => setTab('clientes')}>
            <Users size={16} /> Clientes
          </Button>
        </div>

        {tab === 'config' && cfg && (
          <Card className="page-card cashback-card">
            <CardBody className="cashback-config-body">
              <div className="cashback-card-header-row">
                <h3 className="cashback-card-title">Programa de cashback</h3>
                <Button type="button" variant="secondary" size="sm" onClick={carregarRelatorio}>
                  Resumo movimentações (período livre em evolução)
                </Button>
              </div>
              {relatorio && (
                <div className="cashback-relatorio-grid">
                  <span>Gerado: R$ {(relatorio.total_gerado ?? 0).toFixed(2)}</span>
                  <span>Usado: R$ {(relatorio.total_usado ?? 0).toFixed(2)}</span>
                  <span>Expirado: R$ {(relatorio.total_expirado ?? 0).toFixed(2)}</span>
                  <span>Ajuste +: R$ {(relatorio.total_ajuste_credito ?? 0).toFixed(2)}</span>
                  <span>Ajuste −: R$ {(relatorio.total_ajuste_debito ?? 0).toFixed(2)}</span>
                </div>
              )}
              <label className="cashback-toggle-inline">
                <input
                  type="checkbox"
                  checked={cfg.ativo === 1}
                  onChange={(e) => setCfg({ ...cfg, ativo: e.target.checked ? 1 : 0 })}
                />
                Programa ativo
              </label>
              <p className="cashback-info-text">
                O cashback é calculado sobre o <strong>valor total da compra</strong>, com <strong>cliente identificado</strong> na finalização e CPF/CNPJ válido no cadastro. Sem cliente, não há geração nem exibição de benefício no cupom.
              </p>
              <div className="cashback-config-grid">
                <div className="cashback-field">
                  <label className="cashback-field-label">Percentual sobre o total da compra (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={cfg.percentual_padrao}
                    onChange={(e) => setCfg({ ...cfg, percentual_padrao: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="cashback-field">
                  <label className="cashback-field-label">Validade dos créditos</label>
                  <Select
                    value={cfg.modo_validade === 'FIXA' ? 'DIAS' : cfg.modo_validade}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        modo_validade: e.target.value,
                        data_validade_fixa: null,
                      })
                    }
                    options={[
                      { value: 'NUNCA', label: 'Não expira' },
                      { value: 'DIAS', label: 'Prazo em dias após a compra' },
                    ]}
                  />
                </div>
                {(cfg.modo_validade === 'DIAS' || cfg.modo_validade === 'FIXA') && (
                  <div className="cashback-field">
                    <label className="cashback-field-label">Dias de validade após a compra (dias_validade)</label>
                    <Input
                      type="number"
                      min={1}
                      value={cfg.dias_validade ?? ''}
                      onChange={(e) =>
                        setCfg({ ...cfg, dias_validade: e.target.value ? Number(e.target.value) : null })
                      }
                    />
                  </div>
                )}
                <div className="cashback-field">
                  <label className="cashback-field-label">Arredondamento do valor gerado</label>
                  <Select
                    value={cfg.arredondamento}
                    onChange={(e) => setCfg({ ...cfg, arredondamento: e.target.value })}
                    options={[
                      { value: 'PADRAO', label: 'Padrão (centavos)' },
                      { value: 'PARA_BAIXO', label: 'Sempre para baixo' },
                    ]}
                  />
                </div>
                <div className="cashback-field">
                  <label className="cashback-field-label">Alerta “prestes a expirar” (dias)</label>
                  <Input
                    type="number"
                    min={1}
                    value={cfg.dias_alerta_expiracao}
                    onChange={(e) => setCfg({ ...cfg, dias_alerta_expiracao: Number(e.target.value) || 7 })}
                  />
                </div>
                <div className="cashback-field">
                  <label className="cashback-field-label">Mín. compra para gerar (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={cfg.valor_minimo_compra_gerar}
                    onChange={(e) => setCfg({ ...cfg, valor_minimo_compra_gerar: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="cashback-field">
                  <label className="cashback-field-label">Mín. compra para usar saldo (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={cfg.valor_minimo_compra_usar}
                    onChange={(e) => setCfg({ ...cfg, valor_minimo_compra_usar: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="cashback-field">
                  <label className="cashback-field-label">Máx. uso por venda (R$) — vazio = ilimitado</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={cfg.valor_maximo_uso_por_venda ?? ''}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        valor_maximo_uso_por_venda: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
              </div>
              <div className="cashback-option-grid">
                <label className="cashback-option">
                  <input
                    type="checkbox"
                    className="cashback-option-check"
                    checked={cfg.permitir_quitar_total === 1}
                    onChange={(e) => setCfg({ ...cfg, permitir_quitar_total: e.target.checked ? 1 : 0 })}
                  />
                  <span>Permitir quitar 100% da venda com cashback</span>
                </label>
                <label className="cashback-option">
                  <input
                    type="checkbox"
                    className="cashback-option-check"
                    checked={cfg.permitir_uso_mesma_compra === 1}
                    onChange={(e) => setCfg({ ...cfg, permitir_uso_mesma_compra: e.target.checked ? 1 : 0 })}
                  />
                  <span>Permitir usar cashback na mesma compra</span>
                </label>
                <label className="cashback-option">
                  <input
                    type="checkbox"
                    className="cashback-option-check"
                    checked={cfg.gerar_sobre_valor_apos_cashback === 1}
                    onChange={(e) => setCfg({ ...cfg, gerar_sobre_valor_apos_cashback: e.target.checked ? 1 : 0 })}
                  />
                  <span>Gerar cashback também sobre o valor pago com cashback (sobre o total)</span>
                </label>
              </div>
              <Button type="button" variant="primary" onClick={salvarConfig}>
                Salvar configurações
              </Button>
            </CardBody>
          </Card>
        )}

        {tab === 'clientes' && (
        <Card className="page-card cashback-card cashback-card--stretch">
          <CardBody className="cashback-clients-body">
            <div className="cashback-filters">
              <div className="cashback-filters-search">
                <Input placeholder="Buscar nome, CPF ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
              <Select
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                options={[
                  { value: 'todos', label: 'Todos' },
                  { value: 'com_saldo', label: 'Com saldo' },
                  { value: 'sem_saldo', label: 'Sem saldo' },
                ]}
              />
              <Select
                value={ordem}
                onChange={(e) => setOrdem(e.target.value)}
                options={[
                  { value: 'nome', label: 'Nome' },
                  { value: 'saldo_desc', label: 'Maior saldo' },
                  { value: 'mov_desc', label: 'Última movimentação' },
                  { value: 'cpf', label: 'CPF' },
                ]}
              />
              <Button type="button" variant="secondary" size="sm" onClick={() => loadClientes()}>
                Atualizar
              </Button>
            </div>
            <div className="table-wrap cashback-table-wrap">
            <table className="table cashback-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>CPF/CNPJ</th>
                  <th>Disponível</th>
                  <th>Expirado (hist.)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clientesList.map((c) => (
                  <tr key={c.cliente_id}>
                    <td>
                      {c.nome}
                      {c.bloqueado ? <span className="cashback-tag-bloqueado">(bloqueado)</span> : null}
                    </td>
                    <td>{c.cpf_cnpj ?? '—'}</td>
                    <td>R$ {Number(c.saldo_disponivel).toFixed(2)}</td>
                    <td>R$ {Number(c.saldo_expirado_acumulado).toFixed(2)}</td>
                    <td>
                      <Button type="button" variant="secondary" size="sm" onClick={() => abrirDetalhe(c)}>
                        Detalhes
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </CardBody>
        </Card>
        )}

        <Dialog
          open={detalheOpen}
          onClose={() => setDetalheOpen(false)}
          title={detalheNome ? `Detalhes do cashback — ${detalheNome}` : 'Detalhes do cashback'}
          size="large"
          footer={
            <Button type="button" variant="secondary" onClick={() => setDetalheOpen(false)}>
              Fechar
            </Button>
          }
        >
          <div className="space-y-4">
            <Card className="page-card cashback-card cashback-detail-main">
              <CardBody className="cashback-detail-body">
                {saldo ? (
                  <div className="cashback-saldo-grid">
                    <div>
                      <strong>Disponível</strong>
                      <div>R$ {saldo.saldo_disponivel.toFixed(2)}</div>
                    </div>
                    <div>
                      <strong>Prestes a expirar</strong>
                      <div>R$ {saldo.prestes_expirar.toFixed(2)}</div>
                    </div>
                    <div>
                      <strong>Total gerado</strong>
                      <div>R$ {saldo.total_gerado.toFixed(2)}</div>
                    </div>
                    <div>
                      <strong>Total utilizado</strong>
                      <div>R$ {saldo.total_utilizado.toFixed(2)}</div>
                    </div>
                  </div>
                ) : (
                  <Alert>Cliente sem documento ou sem movimentações de cashback.</Alert>
                )}
                <div className="cashback-actions-row">
                  <Button type="button" variant={saldo?.bloqueado ? 'secondary' : 'primary'} size="sm" onClick={toggleBloqueio}>
                    {saldo?.bloqueado ? <Unlock size={16} /> : <Ban size={16} />}
                    {saldo?.bloqueado ? 'Desbloquear' : 'Bloquear programa'}
                  </Button>
                </div>
              </CardBody>
            </Card>

            <Card className="page-card cashback-card cashback-detail-adjust">
              <CardBody className="cashback-adjust-body">
                <h4 className="cashback-card-subtitle">Ajuste manual</h4>
                <div className="cashback-adjust-row">
                  <Select
                    value={ajTipo}
                    onChange={(e) => setAjusteTipo(e.target.value as 'credito' | 'debito')}
                    options={[
                      { value: 'credito', label: 'Crédito (+)' },
                      { value: 'debito', label: 'Débito (−)' },
                    ]}
                  />
                  <Input placeholder="Valor R$" value={ajValor} onChange={(e) => setAjusteValor(e.target.value)} className="cashback-adjust-value" />
                  <Input placeholder="Motivo (obrigatório)" value={ajMotivo} onChange={(e) => setAjusteMotivo(e.target.value)} className="cashback-adjust-reason" />
                  <Button type="button" variant="primary" size="sm" onClick={ajuste}>
                    Registrar
                  </Button>
                </div>
              </CardBody>
            </Card>

            <Card className="page-card cashback-card">
              <CardBody className="cashback-extrato-body">
                <h4 className="cashback-card-subtitle">Compras e créditos de cashback</h4>
                {Object.keys(vendasMap).length === 0 ? (
                  <Alert>Sem compras vinculadas ao cashback deste cliente.</Alert>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(vendasMap)
                      .sort((a, b) => new Date(b[1].venda.created_at).getTime() - new Date(a[1].venda.created_at).getTime())
                      .map(([vendaId, v]) => {
                        const creds = creditos.filter((c) => c.venda_id_origem === vendaId)
                        return (
                          <div key={vendaId} className="border border-border rounded-lg p-3 space-y-2">
                            <div className="flex flex-wrap gap-3 text-sm">
                              <strong>Venda #{v.venda.numero}</strong>
                              <span>Data: {new Date(v.venda.created_at).toLocaleString('pt-BR')}</span>
                              <span>Total: R$ {v.venda.total.toFixed(2)}</span>
                              <span>Cashback gerado: R$ {v.venda.cashback_gerado.toFixed(2)}</span>
                            </div>
                            <div className="text-sm">
                              <strong>Itens comprados:</strong>
                              <ul className="mt-1 space-y-1">
                                {v.itens.map((it, idx) => (
                                  <li key={`${vendaId}:${idx}`}>
                                    {it.descricao} — {it.quantidade} x R$ {it.preco_unitario.toFixed(2)} = R$ {it.total.toFixed(2)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="text-sm">
                              <strong>Créditos e vencimento:</strong>
                              {creds.length === 0 ? (
                                <div>Sem crédito gerado nesta venda.</div>
                              ) : (
                                <ul className="mt-1 space-y-1">
                                  {creds.map((c) => (
                                    <li key={c.id}>
                                      Valor: R$ {c.valor_inicial.toFixed(2)} | Restante: R$ {c.valor_restante.toFixed(2)} | Status: {c.status} | Vence em:{' '}
                                      {c.expira_em ? new Date(c.expira_em).toLocaleString('pt-BR') : 'Sem expiração'}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card className="page-card cashback-card cashback-detail-extrato">
              <CardBody className="cashback-extrato-body">
                <h4 className="cashback-card-subtitle">Extrato de movimentações</h4>
                <div className="table-wrap cashback-table-wrap">
                <table className="table cashback-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Valor</th>
                      <th>Saldo após</th>
                      <th>Obs.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movs.map((m) => (
                      <tr key={m.id}>
                        <td>{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                        <td>{m.tipo}</td>
                        <td>R$ {m.valor.toFixed(2)}</td>
                        <td>{m.saldo_disponivel_apos != null ? `R$ ${m.saldo_disponivel_apos.toFixed(2)}` : '—'}</td>
                        <td className="cashback-col-observacao">{m.observacao ?? m.venda_id ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </CardBody>
            </Card>
          </div>
        </Dialog>
      </div>
    </Layout>
  )
}
