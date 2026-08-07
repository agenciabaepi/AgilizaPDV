import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { LayoutSaas } from '../../components/LayoutSaas'
import {
  PageTitle,
  Card,
  CardHeader,
  CardBody,
  Button,
  Alert,
  Select,
  Input,
  Dialog,
  useToast,
} from '../../components/ui'
import {
  ASSINATURA_STATUS_LABELS,
  fetchSaasEmpresa,
  updateSaasAssinatura,
  updateSaasRecursos,
  excluirSaasEmpresa,
  type SaasEmpresaResumo,
  type SaasPagamento,
  type SaasUsuario,
} from '../../lib/saas-api'
import { usePlanos } from '../../hooks/usePlanos'
import type { ModuloId } from '../../vite-env'
import { ArrowLeft, Save, RefreshCw, Trash2 } from 'lucide-react'

const MODULOS: { id: ModuloId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'produtos', label: 'Produtos' },
  { id: 'etiquetas', label: 'Etiquetas' },
  { id: 'categorias', label: 'Categorias' },
  { id: 'marcas', label: 'Marcas' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'fornecedores', label: 'Fornecedores' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'caixa', label: 'Caixa' },
  { id: 'vendas', label: 'Vendas' },
  { id: 'pdv', label: 'PDV' },
]

const th: CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  borderBottom: '1px solid var(--color-border)',
}
const td: CSSProperties = {
  padding: '8px 10px',
  fontSize: 'var(--text-sm)',
  borderBottom: '1px solid var(--color-border)',
}

function parseModulos(json: string | null): Record<ModuloId, boolean> {
  const defaults = MODULOS.reduce(
    (acc, m) => ({ ...acc, [m.id]: true }),
    {} as Record<ModuloId, boolean>
  )
  if (!json?.trim()) return defaults
  try {
    return { ...defaults, ...JSON.parse(json) }
  } catch {
    return defaults
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function SaasEmpresaDetalhe() {
  const { planosList } = usePlanos()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [empresa, setEmpresa] = useState<SaasEmpresaResumo | null>(null)
  const [usuarios, setUsuarios] = useState<SaasUsuario[]>([])
  const [pagamentos, setPagamentos] = useState<SaasPagamento[]>([])
  const [certificado, setCertificado] = useState<{ configurado: boolean; updated_at?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [status, setStatus] = useState('')
  const [plano, setPlano] = useState('')
  const [trialDias, setTrialDias] = useState('7')
  const [periodoDias, setPeriodoDias] = useState('30')
  const [modulos, setModulos] = useState<Record<ModuloId, boolean>>(() =>
    MODULOS.reduce((acc, m) => ({ ...acc, [m.id]: true }), {} as Record<ModuloId, boolean>)
  )
  const [lojaOnlineAtiva, setLojaOnlineAtiva] = useState(false)
  const [savingAssinatura, setSavingAssinatura] = useState(false)
  const [savingRecursos, setSavingRecursos] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    fetchSaasEmpresa(id)
      .then((res) => {
        if (!res.ok || !res.empresa) {
          setError(res.error ?? 'Empresa não encontrada.')
          setEmpresa(null)
          return
        }
        const e = res.empresa
        setEmpresa(e)
        setUsuarios(res.usuarios ?? [])
        setPagamentos(res.pagamentos ?? [])
        setCertificado(res.certificado ?? null)
        setStatus(e.assinatura_status ?? 'trial')
        setPlano(e.plano ?? 'basic')
        setModulos(parseModulos(e.modulos_json))
        setLojaOnlineAtiva(Number(e.loja_online_ativa) === 1)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar.')
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const handleSaveAssinatura = async () => {
    if (!id) return
    setSavingAssinatura(true)
    const res = await updateSaasAssinatura(id, { status, plano })
    setSavingAssinatura(false)
    if (!res.ok) {
      toast.addToast('error', res.error ?? 'Falha ao salvar assinatura.')
      return
    }
    toast.addToast('success', res.message ?? 'Assinatura atualizada.')
    load()
  }

  const handleExtendTrial = async () => {
    if (!id) return
    const dias = Number(trialDias)
    if (!Number.isFinite(dias) || dias < 0) {
      toast.addToast('error', 'Dias de trial inválidos.')
      return
    }
    setSavingAssinatura(true)
    const res = await updateSaasAssinatura(id, { trialDias: dias })
    setSavingAssinatura(false)
    if (!res.ok) {
      toast.addToast('error', res.error ?? 'Falha ao estender trial.')
      return
    }
    toast.addToast('success', 'Trial estendido por ' + dias + ' dias.')
    load()
  }

  const handleActivatePeriod = async () => {
    if (!id) return
    const dias = Number(periodoDias)
    if (!Number.isFinite(dias) || dias < 1) {
      toast.addToast('error', 'Dias de período inválidos.')
      return
    }
    setSavingAssinatura(true)
    const res = await updateSaasAssinatura(id, { periodoDias: dias })
    setSavingAssinatura(false)
    if (!res.ok) {
      toast.addToast('error', res.error ?? 'Falha ao ativar período.')
      return
    }
    toast.addToast('success', 'Periodo ativo por ' + dias + ' dias.')
    load()
  }

  const handleSaveRecursos = async () => {
    if (!id) return
    setSavingRecursos(true)
    const res = await updateSaasRecursos(id, { modulos, lojaOnlineAtiva })
    setSavingRecursos(false)
    if (!res.ok) {
      toast.addToast('error', res.error ?? 'Falha ao salvar recursos.')
      return
    }
    toast.addToast('success', res.message ?? 'Recursos atualizados.')
    load()
  }

  const handleOpenDelete = () => {
    setDeletePassword('')
    setDeleteError(null)
    setDeleteOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!id || !empresa) return
    if (!deletePassword.trim()) {
      setDeleteError('Informe sua senha de administrador SaaS.')
      return
    }
    setDeleteBusy(true)
    setDeleteError(null)
    const res = await excluirSaasEmpresa(id, deletePassword)
    setDeleteBusy(false)
    if (!res.ok) {
      setDeleteError(res.error ?? 'Falha ao excluir empresa.')
      return
    }
    toast.addToast('success', res.message ?? 'Empresa excluída.')
    setDeleteOpen(false)
    navigate('/saas', { replace: true })
  }

  if (!id) {
    return (
      <LayoutSaas>
        <Alert variant="error">ID da empresa inválido.</Alert>
      </LayoutSaas>
    )
  }

  return (
    <LayoutSaas>
      <div style={{ marginBottom: 16 }}>
        <Link to="/saas" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)' }}>
          <ArrowLeft size={16} />
          Voltar ao dashboard
        </Link>
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Carregando…</p>
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : empresa ? (
        <>
          <PageTitle
            title={empresa.nome}
            subtitle={`ID: ${empresa.empresa_id} · Código login: ${empresa.codigo_acesso ?? '—'}`}
          />

          <div className="suporte-config-stack">
            <Card className="page-card suporte-config-card">
              <CardHeader>Uso e métricas</CardHeader>
              <CardBody>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: 12,
                  }}
                >
                  {[
                    ['Produtos', empresa.produtos_count],
                    ['Clientes', empresa.clientes_count],
                    ['Usuários', empresa.usuarios_count],
                    ['Vendas', empresa.vendas_count],
                    ['Itens de venda', empresa.venda_itens_count],
                    ['Categorias', empresa.categorias_count],
                    ['Fornecedores', empresa.fornecedores_count],
                    ['NFC-e autorizadas', empresa.nfce_autorizadas_count],
                    ['NF-e autorizadas', empresa.nfe_autorizadas_count],
                    ['Registros (estimado)', empresa.registros_estimados_count],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{label}</div>
                      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
                        {Number(value).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  ))}
                </div>
                <p style={{ marginTop: 16, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  Certificado A1: {certificado?.configurado ? `configurado (${formatDate(certificado.updated_at)})` : 'não configurado'}
                  {empresa.loja_online_slug ? ` · Loja online: ${empresa.loja_online_slug}` : ''}
                </p>
              </CardBody>
            </Card>

            <Card className="page-card suporte-config-card">
              <CardHeader>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  Assinatura e plano
                  <Button type="button" variant="secondary" size="sm" leftIcon={<RefreshCw size={14} />} onClick={load}>
                    Atualizar
                  </Button>
                </span>
              </CardHeader>
              <CardBody>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
                  <Select
                    label="Status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    options={Object.entries(ASSINATURA_STATUS_LABELS)
                      .filter(([k]) => k !== 'sem_assinatura')
                      .map(([value, label]) => ({ value, label }))}
                  />
                  <Select
                    label="Plano"
                    value={plano}
                    onChange={(e) => setPlano(e.target.value)}
                    options={planosList.map((p) => ({
                      value: p.id,
                      label: `${p.nome} — R$ ${p.valor.toFixed(2)}`,
                    }))}
                  />
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                  Trial até: {formatDate(empresa.trial_fim)} · Período até: {formatDate(empresa.periodo_fim)} ·
                  Valor: R$ {Number(empresa.valor_mensal ?? 0).toFixed(2)}
                </p>
                <Button
                  type="button"
                  leftIcon={<Save size={16} />}
                  onClick={handleSaveAssinatura}
                  disabled={savingAssinatura}
                >
                  {savingAssinatura ? 'Salvando…' : 'Salvar status e plano'}
                </Button>

                <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
                  <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 12 }}>Ações rápidas</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                    <div>
                      <label style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 4 }}>Estender trial (dias)</label>
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={trialDias}
                        onChange={(e) => setTrialDias(e.target.value)}
                        className="input-el"
                        style={{ width: 100 }}
                      />
                    </div>
                    <Button type="button" variant="secondary" onClick={handleExtendTrial} disabled={savingAssinatura}>
                      Aplicar trial
                    </Button>
                    <div>
                      <label style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 4 }}>Ativar período (dias)</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={periodoDias}
                        onChange={(e) => setPeriodoDias(e.target.value)}
                        className="input-el"
                        style={{ width: 100 }}
                      />
                    </div>
                    <Button type="button" variant="secondary" onClick={handleActivatePeriod} disabled={savingAssinatura}>
                      Ativar assinatura
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="page-card suporte-config-card">
              <CardHeader>Recursos do sistema (módulos)</CardHeader>
              <CardBody>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 16 }}>
                  {MODULOS.map((m) => (
                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)' }}>
                      <input
                        type="checkbox"
                        checked={modulos[m.id]}
                        onChange={(e) => setModulos((prev) => ({ ...prev, [m.id]: e.target.checked }))}
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', marginBottom: 16 }}>
                  <input
                    type="checkbox"
                    checked={lojaOnlineAtiva}
                    onChange={(e) => setLojaOnlineAtiva(e.target.checked)}
                  />
                  Loja online ativa
                </label>
                <Button
                  type="button"
                  leftIcon={<Save size={16} />}
                  onClick={handleSaveRecursos}
                  disabled={savingRecursos}
                >
                  {savingRecursos ? 'Salvando…' : 'Salvar recursos'}
                </Button>
              </CardBody>
            </Card>

            <Card className="page-card suporte-config-card">
              <CardHeader>Usuários do PDV</CardHeader>
              <CardBody>
                {usuarios.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Nenhum usuário.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={th}>Nome</th>
                          <th style={th}>Login</th>
                          <th style={th}>E-mail</th>
                          <th style={th}>Perfil</th>
                          <th style={th}>Cadastro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usuarios.map((u) => (
                          <tr key={u.id}>
                            <td style={td}>{u.nome}</td>
                            <td style={td}><code>{u.login}</code></td>
                            <td style={td}>{u.email ?? '—'}</td>
                            <td style={td}>{u.role}</td>
                            <td style={td}>{formatDate(u.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>

            <Card className="page-card suporte-config-card">
              <CardHeader>Pagamentos (Asaas)</CardHeader>
              <CardBody>
                {pagamentos.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Nenhum pagamento registrado.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={th}>Valor</th>
                          <th style={th}>Status</th>
                          <th style={th}>Pago em</th>
                          <th style={th}>Criado</th>
                          <th style={th}>ID Asaas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagamentos.map((p) => (
                          <tr key={p.id}>
                            <td style={td}>R$ {Number(p.valor).toFixed(2)}</td>
                            <td style={td}>{p.status}</td>
                            <td style={td}>{formatDate(p.pago_em)}</td>
                            <td style={td}>{formatDate(p.created_at)}</td>
                            <td style={td}><code style={{ fontSize: 'var(--text-xs)' }}>{p.asaas_payment_id}</code></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {empresa.asaas_customer_id && (
                  <p style={{ marginTop: 12, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    Customer Asaas: {empresa.asaas_customer_id}
                  </p>
                )}
              </CardBody>
            </Card>

            <Card className="page-card suporte-config-card" style={{ borderColor: 'var(--color-error)', borderWidth: 1 }}>
              <CardHeader>Zona de perigo</CardHeader>
              <CardBody>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                  Exclui permanentemente a empresa <strong>{empresa.nome}</strong>, todos os usuários, produtos,
                  vendas, notas fiscais, dados da loja online, assinatura e arquivos relacionados. Esta ação não
                  pode ser desfeita.
                </p>
                <Button type="button" variant="danger" leftIcon={<Trash2 size={16} />} onClick={handleOpenDelete}>
                  Excluir empresa permanentemente
                </Button>
              </CardBody>
            </Card>
          </div>

          <Dialog
            open={deleteOpen}
            onClose={() => !deleteBusy && setDeleteOpen(false)}
            title="Confirmar exclusão"
            size="wide"
            closeOnBackdropClick={!deleteBusy}
            closeOnEscape={!deleteBusy}
            footer={
              <>
                <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleteBusy}>
                  Cancelar
                </Button>
                <Button type="button" variant="danger" onClick={handleConfirmDelete} disabled={deleteBusy}>
                  {deleteBusy ? 'Excluindo…' : 'Excluir definitivamente'}
                </Button>
              </>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Alert variant="error">
                Você está prestes a apagar <strong>{empresa.nome}</strong> e{' '}
                {Number(empresa.registros_estimados_count).toLocaleString('pt-BR')} registros estimados no banco.
              </Alert>
              <Input
                label="Senha do administrador SaaS"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Confirme com sua senha"
                autoComplete="current-password"
                disabled={deleteBusy}
              />
              {deleteError && <Alert variant="error">{deleteError}</Alert>}
            </div>
          </Dialog>
        </>
      ) : null}
    </LayoutSaas>
  )
}
