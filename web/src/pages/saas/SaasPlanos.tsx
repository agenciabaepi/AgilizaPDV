import { useCallback, useEffect, useState } from 'react'
import { LayoutSaas } from '../../components/LayoutSaas'
import {
  PageTitle,
  Card,
  CardHeader,
  CardBody,
  Button,
  Alert,
  Input,
  useToast,
} from '../../components/ui'
import { fetchSaasPlanos, updateSaasPlanos, type SaasPlanoConfig } from '../../lib/saas-api'
import { Save, RefreshCw, CreditCard } from 'lucide-react'

type PlanoForm = SaasPlanoConfig & { recursosText: string }

function toForm(p: SaasPlanoConfig): PlanoForm {
  return { ...p, recursosText: p.recursos.join('\n') }
}

function fromForm(f: PlanoForm) {
  return {
    id: f.id,
    nome: f.nome.trim(),
    valor_mensal: Number(f.valor),
    descricao: f.descricao.trim(),
    notas_fiscais: f.notasFiscais,
    loja_online: f.lojaOnline,
    destaque: f.destaque,
    ativo: f.ativo,
    recursos: f.recursosText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    ordem: f.ordem,
  }
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function SaasPlanos() {
  const toast = useToast()
  const [planos, setPlanos] = useState<PlanoForm[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchSaasPlanos()
      .then((res) => {
        if (!res.ok || !res.planos) {
          setError(res.error ?? 'Falha ao carregar planos.')
          setPlanos([])
          return
        }
        setPlanos(res.planos.map(toForm))
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Erro ao carregar planos.')
        setPlanos([])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const updatePlano = (id: string, patch: Partial<PlanoForm>) => {
    setPlanos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  const handleSave = async () => {
    for (const p of planos) {
      const valor = Number(p.valor)
      if (!p.nome.trim()) {
        toast.addToast('error', `Nome obrigatório para o plano ${p.id}.`)
        return
      }
      if (!Number.isFinite(valor) || valor < 0) {
        toast.addToast('error', `Valor inválido para o plano ${p.nome}.`)
        return
      }
    }

    setSaving(true)
    const res = await updateSaasPlanos(planos.map(fromForm))
    setSaving(false)

    if (!res.ok) {
      toast.addToast('error', res.error ?? 'Falha ao salvar planos.')
      return
    }

    toast.addToast('success', res.message ?? 'Planos atualizados.')
    load()
  }

  return (
    <LayoutSaas>
      <PageTitle
        title="Planos e preços"
        subtitle="Valores mensais exibidos na landing page, página de assinatura e checkout PIX."
      />

      <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Button type="button" variant="secondary" leftIcon={<RefreshCw size={16} />} onClick={load} disabled={loading}>
          Atualizar
        </Button>
        <Button type="button" leftIcon={<Save size={16} />} onClick={handleSave} disabled={saving || loading}>
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Carregando planos…</p>
      ) : (
        <div className="suporte-config-stack">
          {planos.map((plano) => (
            <Card key={plano.id} className="page-card suporte-config-card">
              <CardHeader>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={20} />
                  Plano {plano.id.toUpperCase()}
                  {plano.destaque && (
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: 'var(--color-primary-light)',
                        color: 'var(--color-primary)',
                        fontWeight: 600,
                      }}
                    >
                      Destaque
                    </span>
                  )}
                </span>
              </CardHeader>
              <CardBody>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <Input
                    label="Nome exibido"
                    value={plano.nome}
                    onChange={(e) => updatePlano(plano.id, { nome: e.target.value })}
                  />
                  <Input
                    label="Valor mensal (R$)"
                    type="number"
                    min={0}
                    step={0.01}
                    value={String(plano.valor)}
                    onChange={(e) => updatePlano(plano.id, { valor: Number(e.target.value) })}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label className="input-label">Descrição curta</label>
                  <textarea
                    className="input-el"
                    rows={2}
                    value={plano.descricao}
                    onChange={(e) => updatePlano(plano.id, { descricao: e.target.value })}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label className="input-label">Recursos (um por linha)</label>
                  <textarea
                    className="input-el"
                    rows={4}
                    value={plano.recursosText}
                    onChange={(e) => updatePlano(plano.id, { recursosText: e.target.value })}
                    style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)' }}>
                    <input
                      type="checkbox"
                      checked={plano.notasFiscais}
                      onChange={(e) => updatePlano(plano.id, { notasFiscais: e.target.checked })}
                    />
                    Emissão NFC-e / NF-e
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)' }}>
                    <input
                      type="checkbox"
                      checked={plano.lojaOnline}
                      onChange={(e) => updatePlano(plano.id, { lojaOnline: e.target.checked })}
                    />
                    Loja online
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)' }}>
                    <input
                      type="checkbox"
                      checked={plano.destaque}
                      onChange={(e) => updatePlano(plano.id, { destaque: e.target.checked })}
                    />
                    Marcar como destaque
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)' }}>
                    <input
                      type="checkbox"
                      checked={plano.ativo}
                      onChange={(e) => updatePlano(plano.id, { ativo: e.target.checked })}
                    />
                    Plano ativo (visível no site)
                  </label>
                </div>

                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                  Preview: {formatCurrency(plano.valor)}/mês
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Alert variant="info" style={{ marginTop: 16 }}>
        Após salvar, os novos valores passam a ser usados no checkout PIX e nas páginas públicas em até 1 minuto
        (cache do servidor). Assinaturas já ativas mantêm o valor gravado na empresa até renovação ou troca de plano.
      </Alert>
    </LayoutSaas>
  )
}
