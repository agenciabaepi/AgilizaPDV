import { useMemo, useState } from 'react'
import { Layout } from '../components/Layout'
import { PageTitle, Button, Input } from '../components/ui'
import { Calendar, HandCoins, PlusCircle } from 'lucide-react'

type ContaReceber = {
  id: string
  cliente: string
  valor: number
  vencimento: string
  status: 'PENDENTE' | 'RECEBIDA'
}

const today = new Date().toISOString().slice(0, 10)

export function ContasReceber() {
  const [cliente, setCliente] = useState('')
  const [valor, setValor] = useState('')
  const [vencimento, setVencimento] = useState(today)
  const [contas, setContas] = useState<ContaReceber[]>([])

  const totalAberto = useMemo(
    () => contas.filter((c) => c.status === 'PENDENTE').reduce((acc, c) => acc + c.valor, 0),
    [contas]
  )

  const handleAdicionar = () => {
    const valorNumber = Number(valor.replace(',', '.'))
    if (!cliente.trim() || !Number.isFinite(valorNumber) || valorNumber <= 0) return
    setContas((prev) => [
      {
        id: crypto.randomUUID(),
        cliente: cliente.trim(),
        valor: valorNumber,
        vencimento,
        status: 'PENDENTE',
      },
      ...prev,
    ])
    setCliente('')
    setValor('')
    setVencimento(today)
  }

  const toggleRecebida = (id: string) => {
    setContas((prev) => prev.map((conta) => (conta.id === id ? { ...conta, status: conta.status === 'PENDENTE' ? 'RECEBIDA' : 'PENDENTE' } : conta)))
  }

  return (
    <Layout>
      <PageTitle title="Contas a receber" subtitle="Acompanhe recebimentos pendentes e fluxo de caixa previsto." />

      <div className="financeiro-form-wrap">
        <Input label="Cliente" placeholder="Ex.: João da Silva" value={cliente} onChange={(e) => setCliente(e.target.value)} />
        <Input label="Valor (R$)" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
        <Input label="Vencimento" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
        <Button leftIcon={<PlusCircle size={16} />} onClick={handleAdicionar}>
          Adicionar conta
        </Button>
      </div>

      <div className="financeiro-resumo-card financeiro-resumo-card--receber">
        <HandCoins size={18} />
        <span>Total em aberto:</span>
        <strong>
          {totalAberto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </strong>
      </div>

      <div className="financeiro-lista-wrap">
        <h3 className="financeiro-lista-title">Lançamentos</h3>
        {contas.length === 0 ? (
          <p className="financeiro-empty">Nenhuma conta a receber cadastrada.</p>
        ) : (
          <div className="financeiro-lista">
            {contas.map((conta) => (
              <div key={conta.id} className="financeiro-item">
                <div>
                  <div className="financeiro-item-title">{conta.cliente}</div>
                  <div className="financeiro-item-meta">
                    <Calendar size={14} />
                    <span>
                      Receber até {new Date(`${conta.vencimento}T00:00:00`).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
                <div className="financeiro-item-right">
                  <strong>{conta.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                  <Button size="sm" variant={conta.status === 'PENDENTE' ? 'secondary' : 'outline'} onClick={() => toggleRecebida(conta.id)}>
                    {conta.status === 'PENDENTE' ? 'Marcar como recebida' : 'Reabrir'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
