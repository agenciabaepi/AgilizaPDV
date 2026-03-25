import { useCallback, useEffect, useMemo, useState } from 'react'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import type { Cliente } from '../vite-env'
import { PageTitle, Button, Input, Select, Dialog, Alert, useOperationToast } from '../components/ui'

type TipoPessoa = 'F' | 'J'

type FormState = {
  nome: string
  tipo_pessoa: TipoPessoa
  cpf_cnpj: string
  razao_social: string
  nome_fantasia: string
  inscricao_estadual: string
  indicador_ie_dest: '1' | '2' | '9'
  telefone: string
  email: string
  email_nfe: string
  endereco_cep: string
  endereco_logradouro: string
  endereco_numero: string
  endereco_complemento: string
  endereco_bairro: string
  endereco_municipio: string
  endereco_municipio_codigo: string
  endereco_uf: string
  endereco_pais_codigo: string
  endereco_pais_nome: string
  endereco_texto: string
  observacoes: string
  limite_credito: string
}

const initialForm: FormState = {
  nome: '',
  tipo_pessoa: 'F',
  cpf_cnpj: '',
  razao_social: '',
  nome_fantasia: '',
  inscricao_estadual: '',
  indicador_ie_dest: '9',
  telefone: '',
  email: '',
  email_nfe: '',
  endereco_cep: '',
  endereco_logradouro: '',
  endereco_numero: '',
  endereco_complemento: '',
  endereco_bairro: '',
  endereco_municipio: '',
  endereco_municipio_codigo: '',
  endereco_uf: '',
  endereco_pais_codigo: '',
  endereco_pais_nome: 'Brasil',
  endereco_texto: '',
  observacoes: '',
  limite_credito: '',
}

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
].map((uf) => ({ value: uf, label: uf }))

const IND_IE_OPTIONS = [
  { value: '1', label: '1 - Contribuinte ICMS' },
  { value: '2', label: '2 - Contribuinte isento de inscrição' },
  { value: '9', label: '9 - Não contribuinte (consumidor final)' },
]

export function Clientes() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''
  const op = useOperationToast()

  const [list, setList] = useState<Cliente[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [form, setForm] = useState<FormState>(initialForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formTab, setFormTab] = useState<'basico' | 'endereco' | 'fiscal' | 'outros'>('basico')
  type HistoricoPrazoRow = {
    venda_id: string
    numero: number
    total: number
    data_vencimento: string | null
    created_at: string
    conta_status: string
    valor_conta: number
  }
  const [historicoPrazo, setHistoricoPrazo] = useState<HistoricoPrazoRow[]>([])
  const [historicoPrazoLoading, setHistoricoPrazoLoading] = useState(false)

  const filteredList = useMemo(() => {
    if (!search.trim()) return list
    const term = search.trim().toLowerCase()
    return list.filter((c) => {
      return (
        c.nome.toLowerCase().includes(term) ||
        (c.cpf_cnpj ?? '').toLowerCase().includes(term) ||
        (c.email ?? '').toLowerCase().includes(term) ||
        (c.telefone ?? '').toLowerCase().includes(term) ||
        (c.endereco_municipio ?? '').toLowerCase().includes(term)
      )
    })
  }, [list, search])

  const load = useCallback(() => {
    if (!empresaId) return
    window.electronAPI.clientes.list(empresaId).then(setList)
  }, [empresaId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const api = window.electronAPI?.contasReceber?.listHistoricoPrazo
    if (!editing || !empresaId || !api || !showForm) {
      setHistoricoPrazo([])
      return
    }
    setHistoricoPrazoLoading(true)
    api(empresaId, editing.id)
      .then((rows) => {
        setHistoricoPrazo(Array.isArray(rows) ? (rows as HistoricoPrazoRow[]) : [])
      })
      .catch(() => setHistoricoPrazo([]))
      .finally(() => setHistoricoPrazoLoading(false))
  }, [editing, empresaId, showForm])

  const updateForm = (updates: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...updates }))
  }

  const openNew = () => {
    setEditing(null)
    setForm(initialForm)
    setFormTab('basico')
    setError('')
    setShowForm(true)
  }

  const openEdit = (c: Cliente) => {
    setEditing(c)
    setForm({
      nome: c.nome ?? '',
      tipo_pessoa: c.tipo_pessoa ?? 'F',
      cpf_cnpj: c.cpf_cnpj ?? '',
      razao_social: c.razao_social ?? '',
      nome_fantasia: c.nome_fantasia ?? '',
      inscricao_estadual: c.inscricao_estadual ?? '',
      indicador_ie_dest: c.indicador_ie_dest ?? '9',
      telefone: c.telefone ?? '',
      email: c.email ?? '',
      email_nfe: c.email_nfe ?? c.email ?? '',
      endereco_cep: c.endereco_cep ?? '',
      endereco_logradouro: c.endereco_logradouro ?? '',
      endereco_numero: c.endereco_numero ?? '',
      endereco_complemento: c.endereco_complemento ?? '',
      endereco_bairro: c.endereco_bairro ?? '',
      endereco_municipio: c.endereco_municipio ?? '',
      endereco_municipio_codigo: c.endereco_municipio_codigo != null ? String(c.endereco_municipio_codigo) : '',
      endereco_uf: c.endereco_uf ?? '',
      endereco_pais_codigo: c.endereco_pais_codigo != null ? String(c.endereco_pais_codigo) : '',
      endereco_pais_nome: c.endereco_pais_nome ?? 'Brasil',
      endereco_texto: c.endereco ?? '',
      observacoes: c.observacoes ?? '',
      limite_credito: c.limite_credito != null && Number.isFinite(c.limite_credito) ? String(c.limite_credito) : '',
    })
    setFormTab('basico')
    setError('')
    setShowForm(true)
  }

  const cancelForm = () => {
    setEditing(null)
    setShowForm(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.nome.trim()) {
      setError('Nome é obrigatório.')
      return
    }
    if (!empresaId) {
      setError('Empresa não identificada.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        empresa_id: empresaId,
        nome: form.nome.trim(),
        tipo_pessoa: form.tipo_pessoa,
        cpf_cnpj: form.cpf_cnpj.trim() || undefined,
        razao_social: form.razao_social.trim() || undefined,
        nome_fantasia: form.nome_fantasia.trim() || undefined,
        inscricao_estadual: form.inscricao_estadual.trim() || undefined,
        indicador_ie_dest: form.indicador_ie_dest,
        telefone: form.telefone.trim() || undefined,
        email: form.email.trim() || undefined,
        email_nfe: form.email_nfe.trim() || undefined,
        endereco_cep: form.endereco_cep.trim() || undefined,
        endereco_logradouro: form.endereco_logradouro.trim() || undefined,
        endereco_numero: form.endereco_numero.trim() || undefined,
        endereco_complemento: form.endereco_complemento.trim() || undefined,
        endereco_bairro: form.endereco_bairro.trim() || undefined,
        endereco_municipio: form.endereco_municipio.trim() || undefined,
        endereco_municipio_codigo: form.endereco_municipio_codigo
          ? Number(form.endereco_municipio_codigo)
          : undefined,
        endereco_uf: form.endereco_uf.trim() || undefined,
        endereco_pais_codigo: form.endereco_pais_codigo ? Number(form.endereco_pais_codigo) : undefined,
        endereco_pais_nome: form.endereco_pais_nome.trim() || undefined,
        endereco: form.endereco_texto.trim() || undefined,
        observacoes: form.observacoes.trim() || undefined,
        limite_credito: (() => {
          const raw = form.limite_credito.trim().replace(',', '.')
          if (!raw) return null
          const n = Number(raw)
          return Number.isFinite(n) && n >= 0 ? n : null
        })(),
      }

      if (editing) {
        await window.electronAPI.clientes.update(editing.id, payload)
        op.saved('Cliente atualizado com sucesso.')
      } else {
        await window.electronAPI.clientes.create(payload)
        op.created('Cliente cadastrado com sucesso.')
      }

      setEditing(null)
      setShowForm(false)
      load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar cliente.'
      op.failed(err, 'Erro ao salvar cliente.')
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const totalClientes = list.length

  return (
    <Layout>
      <PageTitle
        title="Clientes"
        subtitle="Cadastro completo de clientes para uso no PDV e nas notas fiscais"
      />

      <div
        className="mb-section"
        style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}
      >
        <div style={{ minWidth: 260, flex: '1 1 320px' }}>
          <input
            className="input-el"
            placeholder="Buscar por nome, documento, telefone, e-mail ou cidade"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ margin: 0 }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 120, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          {totalClientes === 0 ? 'Nenhum cliente cadastrado ainda.' : `${totalClientes} cliente(s) encontrados.`}
        </div>
        <Button onClick={openNew}>Novo cliente</Button>
      </div>

      <Dialog
        open={showForm}
        onClose={cancelForm}
        title={editing ? 'Editar cliente' : 'Novo cliente'}
        size="large"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={cancelForm}>
              Cancelar
            </Button>
            <Button type="submit" form="form-cliente" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </>
        }
      >
        <form id="form-cliente" onSubmit={submit} className="form-tabs">
          <div className="form-tabs-list">
            <button
              type="button"
              className={`form-tab-btn ${formTab === 'basico' ? 'form-tab-btn--active' : ''}`}
              onClick={() => setFormTab('basico')}
            >
              Dados básicos
            </button>
            <button
              type="button"
              className={`form-tab-btn ${formTab === 'endereco' ? 'form-tab-btn--active' : ''}`}
              onClick={() => setFormTab('endereco')}
            >
              Endereço
            </button>
            <button
              type="button"
              className={`form-tab-btn ${formTab === 'fiscal' ? 'form-tab-btn--active' : ''}`}
              onClick={() => setFormTab('fiscal')}
            >
              Fiscal (NF-e)
            </button>
            <button
              type="button"
              className={`form-tab-btn ${formTab === 'outros' ? 'form-tab-btn--active' : ''}`}
              onClick={() => setFormTab('outros')}
            >
              Outros
            </button>
          </div>

          <div className={`form-tab-panel ${formTab === 'basico' ? 'form-tab-panel--active' : ''}`}>
            <div className="form-section">
              <h3 className="form-section-title">Identificação</h3>
              <div className="form-grid">
                <Select
                  label="Tipo de pessoa"
                  value={form.tipo_pessoa}
                  onChange={(e) => updateForm({ tipo_pessoa: e.currentTarget.value as TipoPessoa })}
                  options={[
                    { value: 'F', label: 'Pessoa física' },
                    { value: 'J', label: 'Pessoa jurídica' },
                  ]}
                />
                <Input
                  label={form.tipo_pessoa === 'J' ? 'Razão social' : 'Nome completo'}
                  required
                  value={form.nome}
                  onChange={(e) => updateForm({ nome: e.currentTarget.value })}
                />
                <Input
                  label={form.tipo_pessoa === 'J' ? 'Nome fantasia' : 'Apelido'}
                  value={form.nome_fantasia}
                  onChange={(e) => updateForm({ nome_fantasia: e.currentTarget.value })}
                />
                <Input
                  label={form.tipo_pessoa === 'J' ? 'CNPJ' : 'CPF'}
                  value={form.cpf_cnpj}
                  onChange={(e) => updateForm({ cpf_cnpj: e.currentTarget.value })}
                  placeholder={form.tipo_pessoa === 'J' ? '00.000.000/0000-00' : '000.000.000-00'}
                />
              </div>
            </div>

            <div className="form-section">
              <h3 className="form-section-title">Contato</h3>
              <div className="form-grid">
                <Input
                  label="Telefone / WhatsApp"
                  value={form.telefone}
                  onChange={(e) => updateForm({ telefone: e.currentTarget.value })}
                  placeholder="(00) 00000-0000"
                />
                <Input
                  label="E-mail"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateForm({ email: e.currentTarget.value })}
                />
                <Input
                  label="E-mail para NF-e"
                  type="email"
                  value={form.email_nfe}
                  onChange={(e) => updateForm({ email_nfe: e.currentTarget.value })}
                  hint="Opcional. Se vazio, será usado o e-mail principal."
                />
              </div>
            </div>
          </div>

          <div className={`form-tab-panel ${formTab === 'endereco' ? 'form-tab-panel--active' : ''}`}>
            <div className="form-section">
              <h3 className="form-section-title">Endereço principal</h3>
              <div className="form-grid form-grid-3">
                <Input
                  label="CEP"
                  value={form.endereco_cep}
                  onChange={(e) => updateForm({ endereco_cep: e.currentTarget.value })}
                  placeholder="00000-000"
                />
                <Input
                  label="UF"
                  value={form.endereco_uf}
                  onChange={(e) => updateForm({ endereco_uf: e.currentTarget.value.toUpperCase() })}
                  placeholder="SP"
                />
                <Input
                  label="Cidade"
                  value={form.endereco_municipio}
                  onChange={(e) => updateForm({ endereco_municipio: e.currentTarget.value })}
                />
              </div>
              <div className="form-grid">
                <Input
                  label="Logradouro"
                  value={form.endereco_logradouro}
                  onChange={(e) => updateForm({ endereco_logradouro: e.currentTarget.value })}
                  placeholder="Rua, avenida, etc."
                />
                <Input
                  label="Número"
                  value={form.endereco_numero}
                  onChange={(e) => updateForm({ endereco_numero: e.currentTarget.value })}
                />
                <Input
                  label="Complemento"
                  value={form.endereco_complemento}
                  onChange={(e) => updateForm({ endereco_complemento: e.currentTarget.value })}
                />
                <Input
                  label="Bairro"
                  value={form.endereco_bairro}
                  onChange={(e) => updateForm({ endereco_bairro: e.currentTarget.value })}
                />
              </div>
              <div className="form-grid form-grid-3">
                <Input
                  label="Cód. município IBGE (opcional)"
                  value={form.endereco_municipio_codigo}
                  onChange={(e) => updateForm({ endereco_municipio_codigo: e.currentTarget.value })}
                  placeholder="Ex.: 3550308 (São Paulo)"
                />
                <Select
                  label="UF (lista)"
                  value={form.endereco_uf}
                  onChange={(e) => updateForm({ endereco_uf: e.currentTarget.value })}
                  options={[{ value: '', label: '—' }, ...UF_OPTIONS]}
                />
                <Input
                  label="CEP (texto livre)"
                  value={form.endereco_cep}
                  onChange={(e) => updateForm({ endereco_cep: e.currentTarget.value })}
                  placeholder=""
                />
              </div>
              <div className="form-grid form-grid-2">
                <Input
                  label="Código do país (opcional)"
                  value={form.endereco_pais_codigo}
                  onChange={(e) => updateForm({ endereco_pais_codigo: e.currentTarget.value })}
                  placeholder="1058 = Brasil"
                />
                <Input
                  label="Nome do país"
                  value={form.endereco_pais_nome}
                  onChange={(e) => updateForm({ endereco_pais_nome: e.currentTarget.value })}
                />
              </div>
              <div className="form-section">
                <label className="input-label" style={{ display: 'block', marginBottom: 4 }}>
                  Endereço em texto livre (opcional)
                </label>
                <textarea
                  className="input-el"
                  value={form.endereco_texto}
                  onChange={(e) => updateForm({ endereco_texto: e.currentTarget.value })}
                  rows={3}
                  placeholder="Campo livre usado em telas antigas. Mantido por compatibilidade."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          <div className={`form-tab-panel ${formTab === 'fiscal' ? 'form-tab-panel--active' : ''}`}>
            <div className="form-section">
              <h3 className="form-section-title">Dados fiscais para NF-e</h3>
              <div className="form-grid form-grid-2">
                <Input
                  label="Inscrição estadual"
                  value={form.inscricao_estadual}
                  onChange={(e) => updateForm({ inscricao_estadual: e.currentTarget.value })}
                />
                <Select
                  label="Indicador IE do destinatário"
                  value={form.indicador_ie_dest}
                  onChange={(e) =>
                    updateForm({ indicador_ie_dest: e.currentTarget.value as '1' | '2' | '9' })
                  }
                  options={IND_IE_OPTIONS}
                />
              </div>
              <p
                className="input-hint"
                style={{ marginTop: 8, fontSize: 'var(--text-xs)', maxWidth: 600 }}
              >
                Esses campos são usados diretamente na NF-e (destinatário). Para consumidores finais
                comuns, deixe o indicador como &quot;9 - Não contribuinte&quot;.
              </p>
            </div>
          </div>

          <div className={`form-tab-panel ${formTab === 'outros' ? 'form-tab-panel--active' : ''}`}>
            <div className="form-section">
              <h3 className="form-section-title">Venda a prazo</h3>
              <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-3)' }}>
                O limite é aplicado apenas se a regra estiver ativa em Financeiro → Contas a receber.
              </p>
              <div className="form-grid" style={{ maxWidth: 320 }}>
                <Input
                  label="Limite de crédito (R$)"
                  placeholder="Vazio = sem limite"
                  value={form.limite_credito}
                  onChange={(e) => updateForm({ limite_credito: e.target.value })}
                />
              </div>
              {editing && (
                <div style={{ marginTop: 'var(--space-4)' }}>
                  <h4 className="form-section-title" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
                    Histórico de compras a prazo
                  </h4>
                  {historicoPrazoLoading ? (
                    <p className="text-secondary text-sm">Carregando…</p>
                  ) : historicoPrazo.length === 0 ? (
                    <p className="text-secondary text-sm">Nenhuma compra a prazo registrada.</p>
                  ) : (
                    <div className="table-wrap" style={{ maxHeight: 200, overflow: 'auto' }}>
                      <table className="table table--compact">
                        <thead>
                          <tr>
                            <th>Venda</th>
                            <th>Data</th>
                            <th>Venc.</th>
                            <th>Valor</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historicoPrazo.map((h) => (
                            <tr key={h.venda_id}>
                              <td>#{h.numero}</td>
                              <td>{new Date(h.created_at).toLocaleString('pt-BR')}</td>
                              <td>
                                {h.data_vencimento
                                  ? new Date(`${h.data_vencimento}T12:00:00`).toLocaleDateString('pt-BR')
                                  : '—'}
                              </td>
                              <td>{h.valor_conta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                              <td>{h.conta_status === 'PENDENTE' ? 'Em aberto' : h.conta_status === 'RECEBIDA' ? 'Recebida' : h.conta_status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="form-section">
              <h3 className="form-section-title">Observações internas</h3>
              <label className="input-label" style={{ display: 'block', marginBottom: 4 }}>
                Observações
              </label>
              <textarea
                className="input-el"
                value={form.observacoes}
                onChange={(e) => updateForm({ observacoes: e.currentTarget.value })}
                rows={4}
                placeholder="Anotações internas sobre o cliente. Não vão para a nota fiscal."
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
          </div>

          {error && (
            <Alert variant="error" style={{ marginTop: 16 }}>
              {error}
            </Alert>
          )}
        </form>
      </Dialog>

      <div className="page-list-area">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Documento</th>
                <th>Cidade / UF</th>
                <th>Telefone</th>
                <th>E-mail</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((c) => (
                <tr key={c.id}>
                  <td>{c.nome}</td>
                  <td>{c.tipo_pessoa === 'J' ? 'Jurídica' : 'Física'}</td>
                  <td>{c.cpf_cnpj || '—'}</td>
                  <td>
                    {c.endereco_municipio || '—'}
                    {c.endereco_uf ? ` / ${c.endereco_uf}` : ''}
                  </td>
                  <td>{c.telefone || '—'}</td>
                  <td>{c.email || '—'}</td>
                  <td>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                      Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredList.length === 0 && (
          <p
            style={{
              color: 'var(--color-text-secondary)',
              marginTop: 'var(--space-6)',
              fontSize: 'var(--text-sm)',
              flex: 1,
            }}
          >
            Nenhum cliente encontrado.
          </p>
        )}
      </div>
    </Layout>
  )
}
