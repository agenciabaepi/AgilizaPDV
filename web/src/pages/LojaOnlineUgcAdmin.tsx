import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  Handshake,
  Link2,
  Loader2,
  MousePointerClick,
  RefreshCw,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { Button, Card, CardBody, CardHeader, Input, useToast } from '../components/ui'
import { formatCurrency } from '../lib/loja-online'
import {
  fetchLojaOnlineUgcComissoes,
  fetchLojaOnlineUgcConfig,
  fetchLojaOnlineUgcCriadoresAdmin,
  fetchLojaOnlineUgcSaques,
  saveLojaOnlineUgcConfig,
  updateLojaOnlineUgcCriadorStatusAdmin,
  updateLojaOnlineUgcSaqueAdmin,
} from '../lib/loja-online-ugc-api'
import type {
  LojaOnlineUgcComissao,
  LojaOnlineUgcCriadorKpi,
  LojaOnlineUgcCriadorStatus,
  LojaOnlineUgcSaque,
} from '../lib/loja-online-types'

type Props = { empresaId: string }
type TabId = 'criadores' | 'saques' | 'comissoes'

const STATUS_LABEL: Record<LojaOnlineUgcCriadorStatus, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  bloqueado: 'Bloqueado',
}

const COMISSAO_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  cancelada: 'Cancelada',
  paga: 'Paga',
}

const SAQUE_LABEL: Record<string, string> = {
  solicitado: 'Solicitado',
  pago: 'Pago',
  recusado: 'Recusado',
}

function statusClass(status: string): string {
  if (status === 'aprovado' || status === 'aprovada' || status === 'pago' || status === 'paga') {
    return 'loja-ugc-badge loja-ugc-badge--ok'
  }
  if (status === 'pendente' || status === 'solicitado') {
    return 'loja-ugc-badge loja-ugc-badge--warn'
  }
  if (status === 'rejeitado' || status === 'bloqueado' || status === 'cancelada' || status === 'recusado') {
    return 'loja-ugc-badge loja-ugc-badge--danger'
  }
  return 'loja-ugc-badge'
}

export function LojaOnlineUgcAdmin({ empresaId }: Props) {
  const { addToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [ativo, setAtivo] = useState(false)
  const [saqueMinimo, setSaqueMinimo] = useState('50')
  const [cookieDias, setCookieDias] = useState('30')
  const [savingCfg, setSavingCfg] = useState(false)
  const [criadores, setCriadores] = useState<LojaOnlineUgcCriadorKpi[]>([])
  const [saques, setSaques] = useState<LojaOnlineUgcSaque[]>([])
  const [comissoes, setComissoes] = useState<LojaOnlineUgcComissao[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editCodigo, setEditCodigo] = useState('')
  const [tab, setTab] = useState<TabId>('criadores')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cfg, list, saq, com] = await Promise.all([
        fetchLojaOnlineUgcConfig(empresaId),
        fetchLojaOnlineUgcCriadoresAdmin(empresaId),
        fetchLojaOnlineUgcSaques({ empresaId }),
        fetchLojaOnlineUgcComissoes({ empresaId, limit: 100 }),
      ])
      setAtivo(cfg.ativo)
      setSaqueMinimo(String(cfg.saqueMinimo))
      setCookieDias(String(cfg.cookieDias))
      setCriadores(list)
      setSaques(saq)
      setComissoes(com)
      setSelectedId((prev) => (prev && list.some((c) => c.id === prev) ? prev : null))
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao carregar parceiros.')
    } finally {
      setLoading(false)
    }
  }, [empresaId, addToast])

  useEffect(() => {
    void load()
  }, [load])

  const selected = useMemo(
    () => criadores.find((c) => c.id === selectedId) ?? null,
    [criadores, selectedId]
  )

  useEffect(() => {
    if (selected) setEditCodigo(selected.codigo)
  }, [selected])

  const resumo = useMemo(() => {
    const pendentes = criadores.filter((c) => c.status === 'pendente').length
    const aprovados = criadores.filter((c) => c.status === 'aprovado').length
    const cliques = criadores.reduce((s, c) => s + c.cliques, 0)
    const saquesAbertos = saques.filter((s) => s.status === 'solicitado').length
    return { pendentes, aprovados, cliques, saquesAbertos, total: criadores.length }
  }, [criadores, saques])

  const saveConfig = async () => {
    setSavingCfg(true)
    try {
      await saveLojaOnlineUgcConfig(empresaId, {
        ativo,
        saqueMinimo: Number(saqueMinimo.replace(',', '.')) || 0,
        cookieDias: Number(cookieDias) || 30,
      })
      addToast('success', 'Configuração do programa salva.')
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSavingCfg(false)
    }
  }

  const setStatus = async (criadorId: string, status: LojaOnlineUgcCriadorStatus) => {
    try {
      await updateLojaOnlineUgcCriadorStatusAdmin({
        empresaId,
        criadorId,
        status,
        codigo:
          (status === 'aprovado' || selected?.status === 'aprovado') &&
          editCodigo &&
          selectedId === criadorId
            ? editCodigo
            : undefined,
      })
      addToast('success', `Cadastro marcado como ${STATUS_LABEL[status].toLowerCase()}.`)
      await load()
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao atualizar status.')
    }
  }

  const processSaque = async (saqueId: string, status: 'pago' | 'recusado') => {
    try {
      await updateLojaOnlineUgcSaqueAdmin({ empresaId, saqueId, status })
      addToast('success', status === 'pago' ? 'Saque marcado como pago.' : 'Saque recusado.')
      await load()
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao processar saque.')
    }
  }

  return (
    <div className="loja-ugc-admin">
      <Card className="page-card loja-admin-pedidos-card">
        <CardHeader>
          <span>
            <Handshake size={20} /> Programa de parceiros
          </span>
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} /> Atualizar
          </Button>
        </CardHeader>
        <CardBody className="loja-admin-pedidos-card-body">
          <p className="loja-online-hint loja-ugc-admin-intro">
            Defina a % de comissão em cada produto (Produtos → aba Loja online). Os criadores acessam{' '}
            <strong>/parceiros</strong> na vitrine para gerar links e acompanhar ganhos.
          </p>

          <div className="loja-ugc-config">
            <label className="loja-ugc-config-toggle">
              <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
              <span>
                <strong>Programa ativo na vitrine</strong>
                <small>Libera cadastro e área do parceiro em /parceiros</small>
              </span>
            </label>
            <div className="loja-ugc-config-fields">
              <Input
                label="Saque mínimo (R$)"
                value={saqueMinimo}
                onChange={(e) => setSaqueMinimo(e.target.value)}
                inputMode="decimal"
              />
              <Input
                label="Cookie de atribuição (dias)"
                value={cookieDias}
                onChange={(e) => setCookieDias(e.target.value)}
                inputMode="numeric"
                hint="Por quanto tempo o link do parceiro vale após o clique"
              />
            </div>
            <div className="loja-ugc-config-actions">
              <Button type="button" onClick={() => void saveConfig()} disabled={savingCfg}>
                {savingCfg ? 'Salvando…' : 'Salvar configuração'}
              </Button>
            </div>
          </div>

          <div className="loja-admin-pedidos-resumo">
            <div className="loja-admin-pedidos-resumo-card">
              <Users size={20} />
              <div>
                <span>Criadores</span>
                <strong>{resumo.total}</strong>
              </div>
            </div>
            <div className={`loja-admin-pedidos-resumo-card ${resumo.pendentes ? 'loja-admin-pedidos-resumo-card--warn' : ''}`}>
              <Handshake size={20} />
              <div>
                <span>Pendentes</span>
                <strong>{resumo.pendentes}</strong>
              </div>
            </div>
            <div className="loja-admin-pedidos-resumo-card">
              <Check size={20} />
              <div>
                <span>Aprovados</span>
                <strong>{resumo.aprovados}</strong>
              </div>
            </div>
            <div className="loja-admin-pedidos-resumo-card">
              <MousePointerClick size={20} />
              <div>
                <span>Cliques</span>
                <strong>{resumo.cliques}</strong>
              </div>
            </div>
            <div className={`loja-admin-pedidos-resumo-card ${resumo.saquesAbertos ? 'loja-admin-pedidos-resumo-card--warn' : ''}`}>
              <Wallet size={20} />
              <div>
                <span>Saques abertos</span>
                <strong>{resumo.saquesAbertos}</strong>
              </div>
            </div>
          </div>

          <div className="loja-ugc-tabs" role="tablist">
            {(
              [
                ['criadores', `Criadores (${criadores.length})`],
                ['saques', `Saques (${saques.length})`],
                ['comissoes', `Comissões (${comissoes.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`loja-ugc-tab ${tab === id ? 'loja-ugc-tab--active' : ''}`}
                onClick={() => {
                  setTab(id)
                  if (id !== 'criadores') setSelectedId(null)
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="loja-online-hint" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 size={16} className="spin" /> Carregando…
            </p>
          ) : null}

          {!loading && tab === 'criadores' ? (
            <div className="loja-ugc-criadores">
              {criadores.length === 0 ? (
                <p className="loja-online-hint">Nenhum cadastro de parceiro ainda.</p>
              ) : (
                <div className="page-list-area">
                  <div className="table-wrap">
                    <table className="table loja-ugc-table">
                      <thead>
                        <tr>
                          <th>Parceiro</th>
                          <th>Código</th>
                          <th>Status</th>
                          <th>Cliques</th>
                          <th>Pedidos</th>
                          <th>Comissão</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {criadores.map((c) => (
                          <tr
                            key={c.id}
                            className={selectedId === c.id ? 'loja-ugc-row--selected' : undefined}
                          >
                            <td>
                              <div className="loja-admin-clientes-nome">
                                <strong>{c.nome}</strong>
                                <small>{c.email}</small>
                              </div>
                            </td>
                            <td>
                              <code className="loja-ugc-code">{c.codigo}</code>
                            </td>
                            <td>
                              <span className={statusClass(c.status)}>{STATUS_LABEL[c.status]}</span>
                            </td>
                            <td>{c.cliques}</td>
                            <td>{c.pedidos}</td>
                            <td>
                              <div className="loja-admin-clientes-pedidos">
                                <strong>{formatCurrency(c.comissao_aprovada)}</strong>
                                <small>pend. {formatCurrency(c.comissao_pendente)}</small>
                              </div>
                            </td>
                            <td>
                              <Button
                                type="button"
                                variant={selectedId === c.id ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
                              >
                                {selectedId === c.id ? 'Fechar' : 'Gerenciar'}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selected ? (
                <div className="loja-ugc-detail">
                  <div className="loja-ugc-detail-head">
                    <div>
                      <h3>{selected.nome}</h3>
                      <p>
                        {selected.email}
                        {selected.telefone ? ` · ${selected.telefone}` : ''}
                      </p>
                    </div>
                    <span className={statusClass(selected.status)}>{STATUS_LABEL[selected.status]}</span>
                  </div>

                  <div className="loja-ugc-detail-grid">
                    <div>
                      <span className="loja-ugc-detail-label">Redes</span>
                      <p>
                        {[
                          selected.instagram && `Instagram: ${selected.instagram}`,
                          selected.tiktok && `TikTok: ${selected.tiktok}`,
                          selected.youtube && `YouTube: ${selected.youtube}`,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Não informado'}
                      </p>
                    </div>
                    <div>
                      <span className="loja-ugc-detail-label">Chave PIX</span>
                      <p>{selected.pix_chave || '—'}</p>
                    </div>
                  </div>

                  <div className="loja-ugc-detail-kpis">
                    <div>
                      <span>Links</span>
                      <strong>{selected.links}</strong>
                    </div>
                    <div>
                      <span>Cliques</span>
                      <strong>{selected.cliques}</strong>
                    </div>
                    <div>
                      <span>Pedidos</span>
                      <strong>{selected.pedidos}</strong>
                    </div>
                    <div>
                      <span>Vendas</span>
                      <strong>{formatCurrency(selected.vendas_valor)}</strong>
                    </div>
                    <div>
                      <span>Pendente</span>
                      <strong>{formatCurrency(selected.comissao_pendente)}</strong>
                    </div>
                    <div>
                      <span>Aprovada</span>
                      <strong>{formatCurrency(selected.comissao_aprovada)}</strong>
                    </div>
                    <div>
                      <span>Paga</span>
                      <strong>{formatCurrency(selected.comissao_paga)}</strong>
                    </div>
                  </div>

                  <div className="loja-ugc-detail-actions">
                    <Input
                      label="Código de afiliado"
                      value={editCodigo}
                      onChange={(e) => setEditCodigo(e.target.value.toUpperCase())}
                    />
                    <div className="loja-ugc-detail-btns">
                      {selected.status === 'pendente' ? (
                        <>
                          <Button type="button" onClick={() => void setStatus(selected.id, 'aprovado')}>
                            <Check size={16} /> Aprovar
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void setStatus(selected.id, 'rejeitado')}
                          >
                            <X size={16} /> Rejeitar
                          </Button>
                        </>
                      ) : null}
                      {selected.status === 'aprovado' ? (
                        <>
                          <Button type="button" onClick={() => void setStatus(selected.id, 'aprovado')}>
                            <Link2 size={16} /> Salvar código
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void setStatus(selected.id, 'bloqueado')}
                          >
                            Bloquear
                          </Button>
                        </>
                      ) : null}
                      {selected.status === 'bloqueado' || selected.status === 'rejeitado' ? (
                        <Button type="button" onClick={() => void setStatus(selected.id, 'aprovado')}>
                          Reativar / aprovar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {!loading && tab === 'saques' ? (
            saques.length === 0 ? (
              <p className="loja-online-hint">Nenhum saque solicitado.</p>
            ) : (
              <div className="page-list-area">
                <div className="table-wrap">
                  <table className="table loja-ugc-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Criador</th>
                        <th>Valor</th>
                        <th>PIX</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {saques.map((s) => (
                        <tr key={s.id}>
                          <td>{new Date(s.created_at).toLocaleString('pt-BR')}</td>
                          <td>
                            <div className="loja-admin-clientes-nome">
                              <strong>{s.criador_nome || s.criador_id.slice(0, 8)}</strong>
                              <small>{s.criador_email}</small>
                            </div>
                          </td>
                          <td>
                            <strong>{formatCurrency(s.valor)}</strong>
                          </td>
                          <td>
                            <code className="loja-ugc-code">{s.pix_chave}</code>
                          </td>
                          <td>
                            <span className={statusClass(s.status)}>{SAQUE_LABEL[s.status] ?? s.status}</span>
                          </td>
                          <td>
                            {s.status === 'solicitado' ? (
                              <div className="loja-ugc-inline-actions">
                                <Button type="button" size="sm" onClick={() => void processSaque(s.id, 'pago')}>
                                  Pagar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => void processSaque(s.id, 'recusado')}
                                >
                                  Recusar
                                </Button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : null}

          {!loading && tab === 'comissoes' ? (
            comissoes.length === 0 ? (
              <p className="loja-online-hint">Nenhuma comissão ainda.</p>
            ) : (
              <div className="page-list-area">
                <div className="table-wrap">
                  <table className="table loja-ugc-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Pedido</th>
                        <th>Produto</th>
                        <th>Base</th>
                        <th>%</th>
                        <th>Valor</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comissoes.map((c) => (
                        <tr key={c.id}>
                          <td>{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                          <td>
                            <div className="loja-admin-clientes-nome">
                              <strong>#{c.pedido_id.slice(0, 8)}</strong>
                              <small>{c.pedido_cliente || '—'}</small>
                            </div>
                          </td>
                          <td>{c.produto_nome || '—'}</td>
                          <td>{formatCurrency(c.base_calculo)}</td>
                          <td>{c.percentual}%</td>
                          <td>
                            <strong>{formatCurrency(c.valor)}</strong>
                          </td>
                          <td>
                            <span className={statusClass(c.status)}>{COMISSAO_LABEL[c.status] ?? c.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : null}
        </CardBody>
      </Card>
    </div>
  )
}
