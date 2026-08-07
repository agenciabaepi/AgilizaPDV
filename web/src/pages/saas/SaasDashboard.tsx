import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { LayoutSaas } from '../../components/LayoutSaas'
import { PageTitle, Card, CardBody, Button, Alert, Input, Select } from '../../components/ui'
import {
  ASSINATURA_STATUS_LABELS,
  fetchSaasEmpresas,
  PLANO_LABELS,
  type SaasEmpresaResumo,
  type SaasTotais,
} from '../../lib/saas-api'
import { RefreshCw, Search, Building2, FileCheck, Package, Database } from 'lucide-react'

const th: CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  borderBottom: '1px solid var(--color-border)',
  whiteSpace: 'nowrap',
}
const td: CSSProperties = {
  padding: '10px 12px',
  fontSize: 'var(--text-sm)',
  borderBottom: '1px solid var(--color-border)',
}

function statusBadge(status: string | null) {
  const key = status ?? 'sem_assinatura'
  const label = ASSINATURA_STATUS_LABELS[key] ?? key
  const colors: Record<string, { bg: string; color: string }> = {
    trial: { bg: '#dbeafe', color: '#1d4ed8' },
    active: { bg: '#dcfce7', color: '#15803d' },
    pending_payment: { bg: '#fef3c7', color: '#b45309' },
    expired: { bg: '#fee2e2', color: '#b91c1c' },
    cancelled: { bg: '#f3f4f6', color: '#6b7280' },
    sem_assinatura: { bg: '#f3f4f6', color: '#6b7280' },
  }
  const c = colors[key] ?? colors.sem_assinatura
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        background: c.bg,
        color: c.color,
      }}
    >
      {label}
    </span>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '16px 20px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        minWidth: 140,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--color-text-muted)' }}>
        {icon}
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{value.toLocaleString('pt-BR')}</div>
    </div>
  )
}

export function SaasDashboard() {
  const [empresas, setEmpresas] = useState<SaasEmpresaResumo[]>([])
  const [totais, setTotais] = useState<SaasTotais | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [planoFilter, setPlanoFilter] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchSaasEmpresas({
      search: search.trim() || undefined,
      status: statusFilter || undefined,
      plano: planoFilter || undefined,
    })
      .then((res) => {
        if (!res.ok) {
          setError(res.error ?? 'Falha ao carregar empresas.')
          setEmpresas([])
          setTotais(null)
          return
        }
        setEmpresas(res.empresas ?? [])
        setTotais(res.totais ?? null)
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Erro ao carregar.')
        setEmpresas([])
        setTotais(null)
      })
      .finally(() => setLoading(false))
  }, [search, statusFilter, planoFilter])

  useEffect(() => {
    load()
  }, [load])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load()
  }

  return (
    <LayoutSaas>
      <PageTitle
        title="Gestão SaaS"
        subtitle="Empresas cadastradas, assinaturas, uso de dados e emissão fiscal."
      />

      {totais && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <StatCard label="Empresas" value={totais.empresas} icon={<Building2 size={16} />} />
          <StatCard label="Trial" value={totais.trial} icon={<Building2 size={16} />} />
          <StatCard label="Ativas" value={totais.active} icon={<Building2 size={16} />} />
          <StatCard label="Pendentes" value={totais.pending} icon={<Building2 size={16} />} />
          <StatCard label="Produtos (total)" value={totais.produtos} icon={<Package size={16} />} />
          <StatCard label="NFC-e emitidas" value={totais.nfce} icon={<FileCheck size={16} />} />
          <StatCard label="NF-e emitidas" value={totais.nfe} icon={<FileCheck size={16} />} />
          <StatCard label="Registros (estimado)" value={totais.registros} icon={<Database size={16} />} />
        </div>
      )}

      <Card className="page-card">
        <CardBody>
          <form
            onSubmit={handleSearch}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              alignItems: 'flex-end',
              marginBottom: 20,
            }}
          >
            <div style={{ flex: '1 1 220px', minWidth: 200 }}>
              <Input
                label="Buscar"
                placeholder="Nome, CNPJ, e-mail, código ou ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div style={{ minWidth: 160 }}>
              <Select
                label="Status assinatura"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: '', label: 'Todos' },
                  ...Object.entries(ASSINATURA_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
                ]}
              />
            </div>
            <div style={{ minWidth: 140 }}>
              <Select
                label="Plano"
                value={planoFilter}
                onChange={(e) => setPlanoFilter(e.target.value)}
                options={[
                  { value: '', label: 'Todos' },
                  ...Object.entries(PLANO_LABELS).map(([v, l]) => ({ value: v, label: l })),
                ]}
              />
            </div>
            <Button type="submit" leftIcon={<Search size={16} />}>Filtrar</Button>
            <Button type="button" variant="secondary" leftIcon={<RefreshCw size={16} />} onClick={load} disabled={loading}>
              Atualizar
            </Button>
          </form>

          {error && <Alert variant="error">{error}</Alert>}

          {loading ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Carregando empresas…</p>
          ) : empresas.length === 0 ? (
            <Alert variant="info">Nenhuma empresa encontrada.</Alert>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Empresa</th>
                    <th style={th}>Código</th>
                    <th style={th}>Assinatura</th>
                    <th style={th}>Plano</th>
                    <th style={th}>Produtos</th>
                    <th style={th}>NFC-e</th>
                    <th style={th}>NF-e</th>
                    <th style={th}>Vendas</th>
                    <th style={th}>Registros</th>
                    <th style={th}>Cadastro</th>
                  </tr>
                </thead>
                <tbody>
                  {empresas.map((e) => (
                    <tr key={e.empresa_id}>
                      <td style={td}>
                        <Link
                          to={`/saas/empresa/${e.empresa_id}`}
                          style={{ fontWeight: 600, color: 'var(--color-primary)' }}
                        >
                          {e.nome}
                        </Link>
                        {e.cnpj && (
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{e.cnpj}</div>
                        )}
                      </td>
                      <td style={td}>{e.codigo_acesso ?? '—'}</td>
                      <td style={td}>{statusBadge(e.assinatura_status)}</td>
                      <td style={td}>{PLANO_LABELS[e.plano ?? ''] ?? e.plano ?? '—'}</td>
                      <td style={td}>{Number(e.produtos_count).toLocaleString('pt-BR')}</td>
                      <td style={td}>{Number(e.nfce_autorizadas_count).toLocaleString('pt-BR')}</td>
                      <td style={td}>{Number(e.nfe_autorizadas_count).toLocaleString('pt-BR')}</td>
                      <td style={td}>{Number(e.vendas_count).toLocaleString('pt-BR')}</td>
                      <td style={td}>{Number(e.registros_estimados_count).toLocaleString('pt-BR')}</td>
                      <td style={td}>
                        {e.empresa_created_at
                          ? new Date(e.empresa_created_at).toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </LayoutSaas>
  )
}
