import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, RefreshCw, ShoppingBag, UserCheck, Users } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, useToast } from '../components/ui'
import { fetchLojaOnlineClientesAdmin } from '../lib/loja-online-api'
import { formatCurrency, formatWhatsAppLink } from '../lib/loja-online'
import type { LojaOnlineClienteAdmin } from '../lib/loja-online-types'

function formatDoc(doc: string | null | undefined): string {
  const d = String(doc ?? '').replace(/\D/g, '')
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return doc?.trim() || '—'
}

function formatCep(cep: string | null | undefined): string {
  const d = String(cep ?? '').replace(/\D/g, '')
  if (d.length === 8) return d.replace(/(\d{5})(\d{3})/, '$1-$2')
  return cep?.trim() || ''
}

function formatPhone(tel: string | null | undefined): string {
  const d = String(tel ?? '').replace(/\D/g, '')
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return tel?.trim() || '—'
}

export function LojaOnlineClientesAdmin({ empresaId }: { empresaId: string }) {
  const { addToast } = useToast()
  const [clientes, setClientes] = useState<LojaOnlineClienteAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchLojaOnlineClientesAdmin(empresaId)
      setClientes(data)
    } catch {
      addToast('error', 'Erro ao carregar clientes da loja online.')
    } finally {
      setLoading(false)
    }
  }, [empresaId, addToast])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const term = busca.trim().toLowerCase()
    if (!term) return clientes
    const digits = term.replace(/\D/g, '')
    return clientes.filter((c) => {
      const hay = [c.nome, c.email, c.telefone, c.cpf_cnpj, c.endereco, c.cep]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (hay.includes(term)) return true
      if (digits.length >= 3) {
        const docs = `${c.telefone ?? ''}${c.cpf_cnpj ?? ''}${c.cep ?? ''}`.replace(/\D/g, '')
        return docs.includes(digits)
      }
      return false
    })
  }, [clientes, busca])

  const resumo = useMemo(() => {
    const comPedidos = filtered.filter((c) => c.pedidos_count > 0).length
    const vinculadosPdv = filtered.filter((c) => c.cliente_pdv_id).length
    const totalGasto = filtered.reduce((acc, c) => acc + (c.pedidos_total || 0), 0)
    return {
      total: filtered.length,
      comPedidos,
      vinculadosPdv,
      totalGasto,
    }
  }, [filtered])

  return (
    <Card className="page-card loja-admin-pedidos-card">
      <CardHeader>
        <span>Clientes da loja online</span>
        <Button type="button" variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} /> Atualizar
        </Button>
      </CardHeader>
      <CardBody className="loja-admin-pedidos-card-body">
        <div className="loja-admin-pedidos-toolbar loja-admin-clientes-toolbar">
          <input
            className="input-el loja-admin-clientes-search"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, e-mail, telefone ou documento"
            aria-label="Buscar clientes"
          />
        </div>

        <div className="loja-admin-pedidos-resumo">
          <div className="loja-admin-pedidos-resumo-card">
            <Users size={20} />
            <div>
              <span>Clientes</span>
              <strong>{resumo.total}</strong>
            </div>
          </div>
          <div className="loja-admin-pedidos-resumo-card">
            <ShoppingBag size={20} />
            <div>
              <span>Com pedidos</span>
              <strong>{resumo.comPedidos}</strong>
            </div>
          </div>
          <div className="loja-admin-pedidos-resumo-card">
            <UserCheck size={20} />
            <div>
              <span>Vinculados ao PDV</span>
              <strong>{resumo.vinculadosPdv}</strong>
            </div>
          </div>
          <div className="loja-admin-pedidos-resumo-card">
            <ShoppingBag size={20} />
            <div>
              <span>Total em pedidos</span>
              <strong>{formatCurrency(resumo.totalGasto)}</strong>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="loja-online-hint">Carregando clientes…</p>
        ) : filtered.length === 0 ? (
          <p className="loja-online-hint">
            {busca.trim()
              ? 'Nenhum cliente encontrado para essa busca.'
              : 'Ainda não há clientes cadastrados na loja online.'}
          </p>
        ) : (
          <div className="page-list-area loja-admin-clientes-list">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Contato</th>
                    <th>Documento</th>
                    <th>Endereço</th>
                    <th>Pedidos</th>
                    <th>Cadastro</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const wa = c.telefone ? formatWhatsAppLink(c.telefone) : ''
                    return (
                      <tr key={c.id}>
                        <td>
                          <div className="loja-admin-clientes-nome">
                            <strong>{c.nome}</strong>
                            <small>{c.email}</small>
                            {c.cliente_pdv_id ? (
                              <Link to="/clientes" className="loja-admin-clientes-pdv-badge" title="Cliente vinculado ao PDV">
                                PDV
                              </Link>
                            ) : null}
                          </div>
                        </td>
                        <td>{formatPhone(c.telefone)}</td>
                        <td>{formatDoc(c.cpf_cnpj)}</td>
                        <td>
                          <div className="loja-admin-clientes-endereco">
                            {c.endereco?.trim() || '—'}
                            {formatCep(c.cep) ? <small>CEP {formatCep(c.cep)}</small> : null}
                          </div>
                        </td>
                        <td>
                          {c.pedidos_count > 0 ? (
                            <div className="loja-admin-clientes-pedidos">
                              <strong>{c.pedidos_count}</strong>
                              <small>{formatCurrency(c.pedidos_total)}</small>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {c.created_at
                            ? new Date(c.created_at).toLocaleDateString('pt-BR')
                            : '—'}
                        </td>
                        <td>
                          {wa ? (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="loja-admin-clientes-wa"
                              title="Abrir WhatsApp"
                            >
                              <MessageCircle size={16} />
                            </a>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
