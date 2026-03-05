import { useState, useEffect, useCallback } from 'react'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import type { Caixa, CaixaMovimento } from '../vite-env'
import {
  PageTitle,
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Alert,
  ConfirmDialog,
} from '../components/ui'
import { ArrowDownCircle, ArrowUpCircle, Lock, Unlock } from 'lucide-react'

export function Caixa() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''
  const userId = session?.id ?? ''
  const [caixaAberto, setCaixaAberto] = useState<Caixa | null>(null)
  const [saldo, setSaldo] = useState(0)
  const [movimentos, setMovimentos] = useState<CaixaMovimento[]>([])
  const [historico, setHistorico] = useState<Caixa[]>([])
  const [valorInicial, setValorInicial] = useState(0)
  const [abrirLoading, setAbrirLoading] = useState(false)
  const [abrirError, setAbrirError] = useState('')
  const [showSangria, setShowSangria] = useState(false)
  const [showSuprimento, setShowSuprimento] = useState(false)
  const [movValor, setMovValor] = useState(0)
  const [movMotivo, setMovMotivo] = useState('')
  const [movLoading, setMovLoading] = useState(false)
  const [movError, setMovError] = useState('')
  const [fecharLoading, setFecharLoading] = useState(false)
  const [showFecharConfirm, setShowFecharConfirm] = useState(false)

  const load = useCallback(() => {
    if (!empresaId) return
    window.electronAPI.caixa.getAberto(empresaId).then((c) => {
      setCaixaAberto(c)
      if (c) {
        window.electronAPI.caixa.getSaldo(c.id).then(setSaldo)
        window.electronAPI.caixa.listMovimentos(c.id).then(setMovimentos)
      } else {
        setSaldo(0)
        setMovimentos([])
      }
    })
    window.electronAPI.caixa.list(empresaId, 20).then(setHistorico)
  }, [empresaId])

  useEffect(() => {
    load()
  }, [load])

  const handleAbrir = async (e: React.FormEvent) => {
    e.preventDefault()
    setAbrirError('')
    setAbrirLoading(true)
    try {
      const c = await window.electronAPI.caixa.abrir(empresaId, userId, valorInicial)
      setCaixaAberto(c)
      setSaldo(c.valor_inicial)
      setMovimentos([])
      load()
    } catch (err) {
      setAbrirError(err instanceof Error ? err.message : 'Erro ao abrir caixa.')
    } finally {
      setAbrirLoading(false)
    }
  }

  const handleFechar = async () => {
    if (!caixaAberto) return
    setFecharLoading(true)
    try {
      await window.electronAPI.caixa.fechar(caixaAberto.id)
      setCaixaAberto(null)
      setSaldo(0)
      setMovimentos([])
      setShowFecharConfirm(false)
      load()
    } finally {
      setFecharLoading(false)
    }
  }

  const handleRegistrarMovimento = async (tipo: 'SANGRIA' | 'SUPRIMENTO') => {
    if (!caixaAberto || movValor <= 0) return
    setMovError('')
    setMovLoading(true)
    try {
      await window.electronAPI.caixa.registrarMovimento({
        caixa_id: caixaAberto.id,
        empresa_id: empresaId,
        tipo,
        valor: movValor,
        motivo: movMotivo.trim() || undefined,
        usuario_id: userId
      })
      setMovValor(0)
      setMovMotivo('')
      setShowSangria(false)
      setShowSuprimento(false)
      window.electronAPI.caixa.getSaldo(caixaAberto.id).then(setSaldo)
      window.electronAPI.caixa.listMovimentos(caixaAberto.id).then(setMovimentos)
    } catch (err) {
      setMovError(err instanceof Error ? err.message : 'Erro ao registrar.')
    } finally {
      setMovLoading(false)
    }
  }

  if (!empresaId) {
    return (
      <Layout>
        <PageTitle title="Caixa" subtitle="Sessão inválida." />
      </Layout>
    )
  }

  return (
    <Layout>
      <PageTitle title="Caixa" subtitle="Abertura, sangria, suprimento e fechamento" />

      {!caixaAberto ? (
        <Card className="mb-section" style={{ width: '100%' }}>
          <CardHeader>Abrir caixa</CardHeader>
          <CardBody>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16, fontSize: 'var(--text-sm)' }}>
              Informe o valor inicial em dinheiro no caixa.
            </p>
            <form onSubmit={handleAbrir}>
              <Input
                label="Valor inicial (R$)"
                type="number"
                step="0.01"
                min={0}
                value={valorInicial || ''}
                onChange={(e) => setValorInicial(Number(e.currentTarget.value) || 0)}
                required
              />
              {abrirError && <Alert variant="error" style={{ marginTop: 16 }}>{abrirError}</Alert>}
              <Button type="submit" disabled={abrirLoading} style={{ marginTop: 20 }}>
                {abrirLoading ? 'Abrindo...' : 'Abrir caixa'}
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : (
        <>
          <Card className="mb-section">
            <CardHeader style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Unlock size={22} />
              Caixa aberto
            </CardHeader>
            <CardBody>
              <p style={{ margin: '4px 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                Aberto em: <strong style={{ color: 'var(--color-text)' }}>{new Date(caixaAberto.aberto_em).toLocaleString('pt-BR')}</strong>
              </p>
              <p style={{ margin: '4px 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                Valor inicial: <strong style={{ color: 'var(--color-text)' }}>R$ {caixaAberto.valor_inicial.toFixed(2)}</strong>
              </p>
              <p style={{ margin: '12px 0', fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-primary)' }}>
                Saldo atual: R$ {saldo.toFixed(2)}
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 16, flexWrap: 'wrap' }}>
                <Button
                  variant="outline"
                  leftIcon={<ArrowDownCircle size={18} />}
                  onClick={() => { setShowSangria(true); setShowSuprimento(false); setMovValor(0); setMovMotivo(''); setMovError(''); }}
                >
                  Sangria
                </Button>
                <Button
                  variant="outline"
                  leftIcon={<ArrowUpCircle size={18} />}
                  onClick={() => { setShowSuprimento(true); setShowSangria(false); setMovValor(0); setMovMotivo(''); setMovError(''); }}
                >
                  Suprimento
                </Button>
                <Button
                  variant="danger"
                  leftIcon={<Lock size={18} />}
                  onClick={() => setShowFecharConfirm(true)}
                  disabled={fecharLoading}
                  style={{ marginLeft: 'auto' }}
                >
                  {fecharLoading ? 'Fechando...' : 'Fechar caixa'}
                </Button>
              </div>

              {(showSangria || showSuprimento) && (
                <div style={{ marginTop: 24, padding: 20, background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)' }}>
                  <h4 style={{ marginTop: 0, marginBottom: 12, fontSize: 'var(--text-base)' }}>{showSangria ? 'Sangria' : 'Suprimento'}</h4>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ width: 140 }}>
                      <Input
                        label="Valor (R$)"
                        type="number"
                        step="0.01"
                        min={0.01}
                        value={movValor || ''}
                        onChange={(e) => setMovValor(Number(e.currentTarget.value) || 0)}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <Input
                        label="Motivo (opcional)"
                        value={movMotivo}
                        onChange={(e) => setMovMotivo(e.currentTarget.value)}
                      />
                    </div>
                    <Button
                      onClick={() => showSangria ? handleRegistrarMovimento('SANGRIA') : handleRegistrarMovimento('SUPRIMENTO')}
                      disabled={movLoading || movValor <= 0}
                    >
                      {movLoading ? 'Salvando...' : 'Confirmar'}
                    </Button>
                    <Button variant="secondary" onClick={() => { setShowSangria(false); setShowSuprimento(false); setMovError(''); }}>
                      Cancelar
                    </Button>
                  </div>
                  {movError && <Alert variant="error" style={{ marginTop: 12 }}>{movError}</Alert>}
                </div>
              )}
            </CardBody>
          </Card>

          <Card className="mb-section">
            <CardHeader>Movimentos do caixa</CardHeader>
            <CardBody style={{ padding: 0 }}>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Valor</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimentos.map((m) => (
                      <tr key={m.id}>
                        <td>{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                        <td>{m.tipo}</td>
                        <td style={{ color: m.tipo === 'SANGRIA' ? 'var(--color-error)' : 'var(--color-success)' }}>
                          {m.tipo === 'SANGRIA' ? '−' : '+'} R$ {m.valor.toFixed(2)}
                        </td>
                        <td>{m.motivo ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {movimentos.length === 0 && (
                <p style={{ padding: 20, color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>Nenhum movimento ainda.</p>
              )}
            </CardBody>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>Histórico de caixas</CardHeader>
        <CardBody style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Aberto em</th>
                  <th>Fechado em</th>
                  <th>Valor inicial</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((c) => (
                  <tr key={c.id}>
                    <td>{new Date(c.aberto_em).toLocaleString('pt-BR')}</td>
                    <td>{c.fechado_em ? new Date(c.fechado_em).toLocaleString('pt-BR') : '—'}</td>
                    <td>R$ {c.valor_inicial.toFixed(2)}</td>
                    <td>{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {historico.length === 0 && (
            <p style={{ padding: 20, color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>Nenhum caixa registrado.</p>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={showFecharConfirm}
        onClose={() => setShowFecharConfirm(false)}
        onConfirm={handleFechar}
        title="Fechar caixa"
        message="Confirma o fechamento do caixa? Não será possível reabri-lo."
        confirmLabel="Fechar caixa"
        variant="danger"
        loading={fecharLoading}
      />
    </Layout>
  )
}
