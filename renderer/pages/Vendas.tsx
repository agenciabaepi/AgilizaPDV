import { useState, useEffect, useCallback } from 'react'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import type { Venda } from '../vite-env'
import { PageTitle, Button, ConfirmDialog } from '../components/ui'
import { Printer, Trash2, Calendar, Receipt, DollarSign, CheckCircle, XCircle } from 'lucide-react'

type Periodo = 'hoje' | 'semana' | 'mes'

function getPeriodoRange(periodo: Periodo): { dataInicio: string; dataFim: string } {
  const now = new Date()
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  if (periodo === 'hoje') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    return { dataInicio: start.toISOString(), dataFim: endOfToday.toISOString() }
  }

  if (periodo === 'semana') {
    const day = now.getDay()
    const startSemana = new Date(now)
    startSemana.setDate(now.getDate() - day)
    startSemana.setHours(0, 0, 0, 0)
    return { dataInicio: startSemana.toISOString(), dataFim: endOfToday.toISOString() }
  }

  // mês
  const startMes = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  return { dataInicio: startMes.toISOString(), dataFim: endOfToday.toISOString() }
}

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mês' },
]

export function Vendas() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''
  const userId = session?.id ?? ''

  const [periodo, setPeriodo] = useState<Periodo>('hoje')
  const [vendas, setVendas] = useState<Venda[]>([])
  const [loading, setLoading] = useState(true)
  const [imprimindoId, setImprimindoId] = useState<string | null>(null)
  const [cancelandoId, setCancelandoId] = useState<string | null>(null)
  const [cancelarVendaId, setCancelarVendaId] = useState<string | null>(null)

  const loadVendas = useCallback(() => {
    if (!empresaId) return
    setLoading(true)
    const options = periodo === 'hoje'
      ? { periodo: 'hoje' as const }
      : (() => {
          const { dataInicio, dataFim } = getPeriodoRange(periodo)
          return { dataInicio, dataFim }
        })()
    window.electronAPI.vendas
      .list(empresaId, options)
      .then(setVendas)
      .finally(() => setLoading(false))
  }, [empresaId, periodo])

  useEffect(() => {
    loadVendas()
  }, [loadVendas])

  const handleImprimir = async (vendaId: string) => {
    setImprimindoId(vendaId)
    try {
      await window.electronAPI.cupom.imprimir(vendaId)
    } finally {
      setImprimindoId(null)
    }
  }

  const handleCancelar = async (vendaId: string) => {
    setCancelandoId(vendaId)
    try {
      await window.electronAPI.vendas.cancelar(vendaId, userId)
      setCancelarVendaId(null)
      loadVendas()
    } finally {
      setCancelandoId(null)
    }
  }

  const totalPeriodo = vendas.reduce((acc, v) => acc + v.total, 0)
  const totalConcluidas = vendas.filter((v) => v.status === 'CONCLUIDA').length
  const totalCanceladas = vendas.filter((v) => v.status === 'CANCELADA').length

  if (!empresaId) {
    return (
      <Layout>
        <PageTitle title="Vendas" subtitle="Sessão inválida." />
      </Layout>
    )
  }

  return (
    <Layout>
      <PageTitle
        title="Vendas"
        subtitle="Consulte as vendas por período e gerencie cupons e cancelamentos"
      />

      <div className="vendas-cards-resumo">
        <div className="vendas-card-resumo vendas-card-resumo--vendas">
          <div className="vendas-card-resumo__icon">
            <Receipt size={22} strokeWidth={1.8} />
          </div>
          <div className="vendas-card-resumo__content">
            <span className="vendas-card-resumo__label">Vendas</span>
            <span className="vendas-card-resumo__value">{vendas.length}</span>
          </div>
        </div>
        <div className="vendas-card-resumo vendas-card-resumo--total">
          <div className="vendas-card-resumo__icon">
            <DollarSign size={22} strokeWidth={1.8} />
          </div>
          <div className="vendas-card-resumo__content">
            <span className="vendas-card-resumo__label">Total</span>
            <span className="vendas-card-resumo__value">R$ {totalPeriodo.toFixed(2)}</span>
          </div>
        </div>
        <div className="vendas-card-resumo vendas-card-resumo--concluidas">
          <div className="vendas-card-resumo__icon">
            <CheckCircle size={22} strokeWidth={1.8} />
          </div>
          <div className="vendas-card-resumo__content">
            <span className="vendas-card-resumo__label">Concluídas</span>
            <span className="vendas-card-resumo__value">{totalConcluidas}</span>
          </div>
        </div>
        <div className="vendas-card-resumo vendas-card-resumo--canceladas">
          <div className="vendas-card-resumo__icon">
            <XCircle size={22} strokeWidth={1.8} />
          </div>
          <div className="vendas-card-resumo__content">
            <span className="vendas-card-resumo__label">Canceladas</span>
            <span className="vendas-card-resumo__value">{totalCanceladas}</span>
          </div>
        </div>
      </div>

      <div className="vendas-toolbar">
        <div className="vendas-periodos">
          <Calendar size={20} />
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`btn btn--secondary btn--sm ${periodo === p.id ? 'vendas-periodo-ativo' : ''}`}
              onClick={() => setPeriodo(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="vendas-lista-wrap">
        <h3 className="vendas-lista-title">Cupons</h3>
        {loading ? (
          <p className="vendas-loading">Carregando...</p>
        ) : vendas.length === 0 ? (
          <p className="vendas-empty">Nenhuma venda no período selecionado.</p>
        ) : (
          <div className="vendas-lista-cards">
            {vendas.map((v) => (
              <div
                key={v.id}
                className={`vendas-card-item vendas-card-item--${v.status.toLowerCase()}`}
              >
                <div className="vendas-card-item__main">
                  <div className="vendas-card-item__numero">#{v.numero}</div>
                  <div className="vendas-card-item__meta">
                    <time className="vendas-card-item__data">
                      {new Date(v.created_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                    <span className={`vendas-card-item__status vendas-status vendas-status--${v.status.toLowerCase()}`}>
                      {v.status}
                    </span>
                  </div>
                  <div className="vendas-card-item__total">R$ {v.total.toFixed(2)}</div>
                </div>
                {v.status === 'CONCLUIDA' && (
                  <div className="vendas-card-item__acoes">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      leftIcon={<Printer size={14} />}
                      onClick={() => handleImprimir(v.id)}
                      disabled={imprimindoId === v.id}
                    >
                      {imprimindoId === v.id ? 'Abrindo...' : 'Cupom'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      leftIcon={<Trash2 size={14} />}
                      onClick={() => setCancelarVendaId(v.id)}
                      disabled={cancelandoId === v.id}
                    >
                      {cancelandoId === v.id ? 'Cancelando...' : 'Cancelar'}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={cancelarVendaId !== null}
        onClose={() => setCancelarVendaId(null)}
        onConfirm={() =>
          cancelarVendaId ? handleCancelar(cancelarVendaId) : Promise.resolve()
        }
        title="Cancelar venda"
        message="Cancelar esta venda? O estoque dos itens será estornado."
        confirmLabel="Cancelar venda"
        variant="danger"
        loading={cancelandoId !== null}
      />
    </Layout>
  )
}
