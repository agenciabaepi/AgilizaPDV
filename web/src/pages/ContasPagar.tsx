import { useMemo, useState } from 'react'
import { Layout } from '../components/Layout'
import { PageTitle, Button, Input } from '../components/ui'
import { Calendar, PlusCircle, Wallet } from 'lucide-react'

type ContaPagar = {
  id: string
  descricao: string
  valor: number
  vencimento: string
  status: 'PENDENTE' | 'PAGA'
}

const today = new Date().toISOString().slice(0, 10)

export function ContasPagar() {
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [vencimento, setVencimento] = useState(today)
  const [contas, setContas] = useState<ContaPagar[]>([])

  const totalPendente = useMemo(
    () => contas.filter((c) => c.status === 'PENDENTE').reduce((acc, c) => acc + c.valor, 0),
    [contas]
  )

  const handleAdicionar = () => {
    const valorNumber = Number(valor.replace(',', '.'))
    if (!descricao.trim() || !Number.isFinite(valorNumber) || valorNumber <= 0) return
    setContas((prev) => [
      {
        id: crypto.randomUUID(),
        descricao: descricao.trim(),
        valor: valorNumber,
        vencimento,
        status: 'PENDENTE',
      },
      ...prev,
    ])
    setDescricao('')
    setValor('')
    setVencimento(today)
  }

  const togglePago = (id: string) => {
    setContas((prev) => prev.map((conta) => (conta.id === id ? { ...conta, status: conta.status === 'PENDENTE' ? 'PAGA' : 'PENDENTE' } : conta)))
  }

  return (
    <Layout>
      <PageTitle title="Contas a pagar" subtitle="Gerencie despesas e controle os vencimentos do financeiro." />

      <div className="financeiro-form-wrap">
        <Input label="Descrição" placeholder="Ex.: Aluguel da loja" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <Input label="Valor (R$)" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
        <Input label="Vencimento" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
        <Button leftIcon={<PlusCircle size={16} />} onClick={handleAdicionar}>
          Adicionar conta
        </Button>
      </div>

      <div className="financeiro-resumo-card">
        <Wallet size={18} />
        <span>Total pendente:</span>
        <strong>
          {totalPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </strong>
      </div>

      <div className="financeiro-lista-wrap">
        <h3 className="financeiro-lista-title">Lançamentos</h3>
        {contas.length === 0 ? (
          <p className="financeiro-empty">Nenhuma conta a pagar cadastrada.</p>
        ) : (
          <div className="financeiro-lista">
            {contas.map((conta) => (
              <div key={conta.id} className="financeiro-item">
                <div>
                  <div className="financeiro-item-title">{conta.descricao}</div>
                  <div className="financeiro-item-meta">
                    <Calendar size={14} />
                    <span>
                      Vence em {new Date(`${conta.vencimento}T00:00:00`).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
                <div className="financeiro-item-right">
                  <strong>{conta.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                  <Button size="sm" variant={conta.status === 'PENDENTE' ? 'secondary' : 'outline'} onClick={() => togglePago(conta.id)}>
                    {conta.status === 'PENDENTE' ? 'Marcar como paga' : 'Reabrir'}
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
