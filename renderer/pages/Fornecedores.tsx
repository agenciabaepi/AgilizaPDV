import { useCallback, useEffect, useMemo, useState } from 'react'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import type { Fornecedor, FornecedorHistoricoItem } from '../vite-env'
import { PageTitle, Button, Input, Select, Dialog, Alert, ConfirmDialog, useOperationToast } from '../components/ui'
import {
  isValidDoc,
  isValidEmail,
  isValidPhone,
  formatDoc,
  formatPhone,
  onlyDigits,
} from '../lib/validators'
import { buscarCep } from '../lib/cep'

const PAGE_SIZE = 25

type FormTab =
  | 'principal'
  | 'contato'
  | 'endereco'
  | 'comercial'
  | 'fiscal'
  | 'bancario'
  | 'controle'

type FormState = {
  tipo_cadastro: 'F' | 'J'
  razao_social: string
  nome_fantasia: string
  nome_responsavel: string
  cnpj: string
  inscricao_estadual: string
  inscricao_municipal: string
  indicador_contribuinte: '1' | '2' | '9'
  fornecedor_principal: boolean
  categoria_fornecedor: string
  telefone_principal: string
  telefone_secundario: string
  celular_whatsapp: string
  email_principal: string
  email_financeiro: string
  site: string
  nome_contato_comercial: string
  nome_contato_financeiro: string
  endereco_cep: string
  endereco_logradouro: string
  endereco_numero: string
  endereco_complemento: string
  endereco_bairro: string
  endereco_cidade: string
  endereco_estado: string
  endereco_pais: string
  endereco_referencia: string
  prazo_medio_pagamento: string
  condicao_pagamento_padrao: string
  limite_credito: string
  vendedor_representante: string
  segmento_fornecedor: string
  origem_fornecedor: string
  observacoes_comerciais: string
  produtos_servicos_fornecidos: string
  banco: string
  agencia: string
  conta: string
  tipo_conta: string
  chave_pix: string
  favorecido: string
  documento_favorecido: string
  regime_tributario: string
  retencoes_aplicaveis: string
  observacoes_fiscais: string
  tipo_operacao_comum: string
  natureza_fornecimento: string
  observacoes: string
  observacoes_internas: string
  tags: string
  bloqueio_compras: boolean
  motivo_bloqueio: string
  avaliacao_interna: string
  prazo_medio_entrega: string
  score_classificacao: string
  contato: string
}

const emptyForm = (): FormState => ({
  tipo_cadastro: 'J',
  razao_social: '',
  nome_fantasia: '',
  nome_responsavel: '',
  cnpj: '',
  inscricao_estadual: '',
  inscricao_municipal: '',
  indicador_contribuinte: '9',
  fornecedor_principal: false,
  categoria_fornecedor: '',
  telefone_principal: '',
  telefone_secundario: '',
  celular_whatsapp: '',
  email_principal: '',
  email_financeiro: '',
  site: '',
  nome_contato_comercial: '',
  nome_contato_financeiro: '',
  endereco_cep: '',
  endereco_logradouro: '',
  endereco_numero: '',
  endereco_complemento: '',
  endereco_bairro: '',
  endereco_cidade: '',
  endereco_estado: '',
  endereco_pais: 'Brasil',
  endereco_referencia: '',
  prazo_medio_pagamento: '',
  condicao_pagamento_padrao: '',
  limite_credito: '',
  vendedor_representante: '',
  segmento_fornecedor: '',
  origem_fornecedor: '',
  observacoes_comerciais: '',
  produtos_servicos_fornecidos: '',
  banco: '',
  agencia: '',
  conta: '',
  tipo_conta: '',
  chave_pix: '',
  favorecido: '',
  documento_favorecido: '',
  regime_tributario: '',
  retencoes_aplicaveis: '',
  observacoes_fiscais: '',
  tipo_operacao_comum: '',
  natureza_fornecimento: '',
  observacoes: '',
  observacoes_internas: '',
  tags: '',
  bloqueio_compras: false,
  motivo_bloqueio: '',
  avaliacao_interna: '',
  prazo_medio_entrega: '',
  score_classificacao: '',
  contato: '',
})

function fornecedorToForm(f: Fornecedor): FormState {
  const s = emptyForm()
  return {
    ...s,
    tipo_cadastro: f.tipo_cadastro ?? 'J',
    razao_social: f.razao_social ?? '',
    nome_fantasia: f.nome_fantasia ?? '',
    nome_responsavel: f.nome_responsavel ?? '',
    cnpj: f.cnpj ?? '',
    inscricao_estadual: f.inscricao_estadual ?? '',
    inscricao_municipal: f.inscricao_municipal ?? '',
    indicador_contribuinte: f.indicador_contribuinte ?? '9',
    fornecedor_principal: !!f.fornecedor_principal,
    categoria_fornecedor: f.categoria_fornecedor ?? '',
    telefone_principal: f.telefone_principal ?? '',
    telefone_secundario: f.telefone_secundario ?? '',
    celular_whatsapp: f.celular_whatsapp ?? '',
    email_principal: f.email_principal ?? '',
    email_financeiro: f.email_financeiro ?? '',
    site: f.site ?? '',
    nome_contato_comercial: f.nome_contato_comercial ?? '',
    nome_contato_financeiro: f.nome_contato_financeiro ?? '',
    endereco_cep: f.endereco_cep ?? '',
    endereco_logradouro: f.endereco_logradouro ?? '',
    endereco_numero: f.endereco_numero ?? '',
    endereco_complemento: f.endereco_complemento ?? '',
    endereco_bairro: f.endereco_bairro ?? '',
    endereco_cidade: f.endereco_cidade ?? '',
    endereco_estado: f.endereco_estado ?? '',
    endereco_pais: f.endereco_pais ?? 'Brasil',
    endereco_referencia: f.endereco_referencia ?? '',
    prazo_medio_pagamento:
      f.prazo_medio_pagamento != null ? String(f.prazo_medio_pagamento) : '',
    condicao_pagamento_padrao: f.condicao_pagamento_padrao ?? '',
    limite_credito: f.limite_credito != null ? String(f.limite_credito) : '',
    vendedor_representante: f.vendedor_representante ?? '',
    segmento_fornecedor: f.segmento_fornecedor ?? '',
    origem_fornecedor: f.origem_fornecedor ?? '',
    observacoes_comerciais: f.observacoes_comerciais ?? '',
    produtos_servicos_fornecidos: f.produtos_servicos_fornecidos ?? '',
    banco: f.banco ?? '',
    agencia: f.agencia ?? '',
    conta: f.conta ?? '',
    tipo_conta: f.tipo_conta ?? '',
    chave_pix: f.chave_pix ?? '',
    favorecido: f.favorecido ?? '',
    documento_favorecido: f.documento_favorecido ?? '',
    regime_tributario: f.regime_tributario ?? '',
    retencoes_aplicaveis: f.retencoes_aplicaveis ?? '',
    observacoes_fiscais: f.observacoes_fiscais ?? '',
    tipo_operacao_comum: f.tipo_operacao_comum ?? '',
    natureza_fornecimento: f.natureza_fornecimento ?? '',
    observacoes: f.observacoes ?? '',
    observacoes_internas: f.observacoes_internas ?? '',
    tags: f.tags ?? '',
    bloqueio_compras: !!f.bloqueio_compras,
    motivo_bloqueio: f.motivo_bloqueio ?? '',
    avaliacao_interna: f.avaliacao_interna != null ? String(f.avaliacao_interna) : '',
    prazo_medio_entrega: f.prazo_medio_entrega != null ? String(f.prazo_medio_entrega) : '',
    score_classificacao: f.score_classificacao ?? '',
    contato: f.contato ?? '',
  }
}

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
].map((uf) => ({ value: uf, label: uf }))

const IND_IE_OPTIONS = [
  { value: '1', label: '1 - Contribuinte ICMS' },
  { value: '2', label: '2 - Isento de IE' },
  { value: '9', label: '9 - Não contribuinte' },
]

const TIPO_CONTA_OPTIONS = [
  { value: '', label: '—' },
  { value: 'corrente', label: 'Conta corrente' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'pagamento', label: 'Conta pagamento' },
]

const fornecedorCategoriasStorageKey = (empresaId: string) =>
  `agiliza:fornecedor_categorias_extra:${empresaId}`

function loadFornecedorCategoriasExtras(empresaId: string): string[] {
  if (!empresaId || typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(fornecedorCategoriasStorageKey(empresaId))
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return [...new Set(arr.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean))]
  } catch {
    return []
  }
}

function saveFornecedorCategoriasExtras(empresaId: string, list: string[]): void {
  if (!empresaId || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(fornecedorCategoriasStorageKey(empresaId), JSON.stringify(list))
  } catch {
    // ignore quota / private mode
  }
}

export function Fornecedores() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''
  const op = useOperationToast()

  const [list, setList] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | 'ativo' | 'inativo'>('todos')
  const [filterTipo, setFilterTipo] = useState<'todos' | 'F' | 'J'>('todos')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [filterCidade, setFilterCidade] = useState('')
  const [filterUf, setFilterUf] = useState('')
  const [sortBy, setSortBy] = useState<'razao' | 'cadastro' | 'atualizacao'>('razao')
  const [page, setPage] = useState(1)

  const [editing, setEditing] = useState<Fornecedor | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formTab, setFormTab] = useState<FormTab>('principal')
  const [saving, setSaving] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showHistorico, setShowHistorico] = useState(false)
  const [historicoRows, setHistoricoRows] = useState<FornecedorHistoricoItem[]>([])
  const [historicoLoading, setHistoricoLoading] = useState(false)
  const [confirmInativar, setConfirmInativar] = useState<Fornecedor | null>(null)
  const [confirmExcluir, setConfirmExcluir] = useState<Fornecedor | null>(null)
  const [confirmReativar, setConfirmReativar] = useState<Fornecedor | null>(null)
  /** Categorias cadastradas pelo usuário (localStorage por empresa), mescladas às vindas dos fornecedores */
  const [categoriasExtras, setCategoriasExtras] = useState<string[]>([])
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('')
  const [novaCategoriaMsg, setNovaCategoriaMsg] = useState<{ type: 'ok' | 'erro'; text: string } | null>(null)

  const load = useCallback(() => {
    if (!empresaId) return
    setLoading(true)
    window.electronAPI.fornecedores
      .list(empresaId)
      .then(setList)
      .finally(() => setLoading(false))
  }, [empresaId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (empresaId) setCategoriasExtras(loadFornecedorCategoriasExtras(empresaId))
  }, [empresaId])

  useEffect(() => {
    setPage(1)
  }, [search, filterStatus, filterTipo, filterCategoria, filterCidade, filterUf, sortBy])

  const categoriasUnicas = useMemo(() => {
    const s = new Set<string>()
    for (const f of list) {
      const c = f.categoria_fornecedor?.trim()
      if (c) s.add(c)
    }
    return [...s].sort()
  }, [list])

  /** Opções do select/filtro: fornecedores salvos + categorias cadastradas manualmente */
  const categoriasOpcoes = useMemo(() => {
    const s = new Set<string>()
    for (const c of categoriasUnicas) s.add(c)
    for (const c of categoriasExtras) s.add(c)
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [categoriasUnicas, categoriasExtras])

  const filteredSorted = useMemo(() => {
    let rows = list

    if (search.trim()) {
      const t = search.trim().toLowerCase()
      rows = rows.filter((f) => {
        const doc = onlyDigits(f.cnpj ?? '')
        return (
          (f.razao_social ?? '').toLowerCase().includes(t) ||
          (f.nome_fantasia ?? '').toLowerCase().includes(t) ||
          (f.cnpj ?? '').toLowerCase().includes(t) ||
          doc.includes(onlyDigits(t)) ||
          (f.telefone_principal ?? '').toLowerCase().includes(t) ||
          (f.celular_whatsapp ?? '').toLowerCase().includes(t) ||
          (f.email_principal ?? '').toLowerCase().includes(t) ||
          (f.contato ?? '').toLowerCase().includes(t)
        )
      })
    }

    if (filterStatus === 'ativo') rows = rows.filter((f) => f.ativo !== 0)
    if (filterStatus === 'inativo') rows = rows.filter((f) => f.ativo === 0)
    if (filterTipo !== 'todos') rows = rows.filter((f) => (f.tipo_cadastro ?? 'J') === filterTipo)
    if (filterCategoria.trim()) {
      const c = filterCategoria.trim().toLowerCase()
      rows = rows.filter((f) => (f.categoria_fornecedor ?? '').toLowerCase() === c)
    }
    if (filterCidade.trim()) {
      const c = filterCidade.trim().toLowerCase()
      rows = rows.filter((f) => (f.endereco_cidade ?? '').toLowerCase().includes(c))
    }
    if (filterUf.trim()) {
      const u = filterUf.trim().toUpperCase()
      rows = rows.filter((f) => (f.endereco_estado ?? '').toUpperCase() === u)
    }

    const sorted = [...rows]
    sorted.sort((a, b) => {
      if (sortBy === 'cadastro') {
        return (b.created_at ?? '').localeCompare(a.created_at ?? '')
      }
      if (sortBy === 'atualizacao') {
        return (b.updated_at ?? b.created_at ?? '').localeCompare(a.updated_at ?? a.created_at ?? '')
      }
      return (a.razao_social ?? '').localeCompare(b.razao_social ?? '', 'pt-BR')
    })
    return sorted
  }, [list, search, filterStatus, filterTipo, filterCategoria, filterCidade, filterUf, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages)
  const paginated = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE
    return filteredSorted.slice(start, start + PAGE_SIZE)
  }, [filteredSorted, pageSafe])

  const updateForm = (updates: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...updates }))
  }

  const openNew = () => {
    setEditing(null)
    setForm(emptyForm())
    setFormTab('principal')
    setError('')
    setNovaCategoriaNome('')
    setNovaCategoriaMsg(null)
    setShowForm(true)
  }

  const openEdit = (f: Fornecedor) => {
    setEditing(f)
    setForm(fornecedorToForm(f))
    setFormTab('principal')
    setError('')
    setNovaCategoriaNome('')
    setNovaCategoriaMsg(null)
    setShowForm(true)
  }

  const cadastrarNovaCategoriaFornecedor = () => {
    setNovaCategoriaMsg(null)
    const nome = novaCategoriaNome.trim()
    if (!nome) {
      setNovaCategoriaMsg({ type: 'erro', text: 'Informe um nome para a categoria.' })
      return
    }
    const exists = categoriasOpcoes.some((c) => c.toLowerCase() === nome.toLowerCase())
    if (exists) {
      const canonical = categoriasOpcoes.find((c) => c.toLowerCase() === nome.toLowerCase()) ?? nome
      updateForm({ categoria_fornecedor: canonical })
      setNovaCategoriaNome('')
      setNovaCategoriaMsg({
        type: 'ok',
        text: 'Esta categoria já existe; ela foi selecionada para o fornecedor. Salve o cadastro para gravar.',
      })
      return
    }
    const next = [...categoriasExtras, nome].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    setCategoriasExtras(next)
    saveFornecedorCategoriasExtras(empresaId, next)
    updateForm({ categoria_fornecedor: nome })
    setNovaCategoriaNome('')
    setNovaCategoriaMsg({
      type: 'ok',
      text: 'Categoria cadastrada e aplicada ao fornecedor. Salve o cadastro para gravar.',
    })
  }

  const openHistorico = async (f: Fornecedor) => {
    setEditing(f)
    setShowHistorico(true)
    setHistoricoLoading(true)
    setHistoricoRows([])
    try {
      const rows = await window.electronAPI.fornecedores.historico(f.id)
      setHistoricoRows(rows)
    } catch {
      setHistoricoRows([])
    } finally {
      setHistoricoLoading(false)
    }
  }

  const onBlurCep = async () => {
    const digits = onlyDigits(form.endereco_cep)
    if (digits.length !== 8) return
    setCepLoading(true)
    try {
      const r = await buscarCep(form.endereco_cep)
      if (r) {
        updateForm({
          endereco_logradouro: r.logradouro || form.endereco_logradouro,
          endereco_bairro: r.bairro || form.endereco_bairro,
          endereco_cidade: r.localidade || form.endereco_cidade,
          endereco_estado: r.uf || form.endereco_estado,
          endereco_complemento: r.complemento || form.endereco_complemento,
        })
      }
    } finally {
      setCepLoading(false)
    }
  }

  const validateForm = (): string | null => {
    if (!form.razao_social.trim()) {
      return form.tipo_cadastro === 'J' ? 'Razão social é obrigatória.' : 'Nome completo é obrigatório.'
    }
    if (form.tipo_cadastro === 'J' && !form.cnpj.trim()) {
      return 'CNPJ é obrigatório para pessoa jurídica.'
    }
    if (form.tipo_cadastro === 'F' && !form.cnpj.trim()) {
      return 'CPF é obrigatório para pessoa física.'
    }
    if (form.cnpj.trim() && !isValidDoc(form.tipo_cadastro, form.cnpj)) {
      return form.tipo_cadastro === 'J' ? 'CNPJ inválido.' : 'CPF inválido.'
    }
    if (form.email_principal.trim() && !isValidEmail(form.email_principal)) {
      return 'E-mail principal inválido.'
    }
    if (form.email_financeiro.trim() && !isValidEmail(form.email_financeiro)) {
      return 'E-mail financeiro inválido.'
    }
    for (const tel of [form.telefone_principal, form.telefone_secundario, form.celular_whatsapp]) {
      if (tel.trim() && !isValidPhone(tel)) {
        return 'Verifique o formato dos telefones (10 ou 11 dígitos).'
      }
    }
    if (form.bloqueio_compras && !form.motivo_bloqueio.trim()) {
      return 'Informe o motivo do bloqueio de compras.'
    }
    return null
  }

  const buildPayload = () => ({
    empresa_id: empresaId,
    razao_social: form.razao_social.trim(),
    tipo_cadastro: form.tipo_cadastro,
    cnpj: form.cnpj.trim() || undefined,
    contato: form.contato.trim() || undefined,
    observacoes: form.observacoes.trim() || undefined,
    nome_fantasia: form.nome_fantasia.trim() || undefined,
    nome_responsavel: form.nome_responsavel.trim() || undefined,
    inscricao_estadual: form.inscricao_estadual.trim() || undefined,
    inscricao_municipal: form.inscricao_municipal.trim() || undefined,
    indicador_contribuinte: form.indicador_contribuinte,
    fornecedor_principal: form.fornecedor_principal ? 1 : 0,
    categoria_fornecedor: form.categoria_fornecedor.trim() || undefined,
    telefone_principal: form.telefone_principal.trim() || undefined,
    telefone_secundario: form.telefone_secundario.trim() || undefined,
    celular_whatsapp: form.celular_whatsapp.trim() || undefined,
    email_principal: form.email_principal.trim() || undefined,
    email_financeiro: form.email_financeiro.trim() || undefined,
    site: form.site.trim() || undefined,
    nome_contato_comercial: form.nome_contato_comercial.trim() || undefined,
    nome_contato_financeiro: form.nome_contato_financeiro.trim() || undefined,
    endereco_cep: form.endereco_cep.trim() || undefined,
    endereco_logradouro: form.endereco_logradouro.trim() || undefined,
    endereco_numero: form.endereco_numero.trim() || undefined,
    endereco_complemento: form.endereco_complemento.trim() || undefined,
    endereco_bairro: form.endereco_bairro.trim() || undefined,
    endereco_cidade: form.endereco_cidade.trim() || undefined,
    endereco_estado: form.endereco_estado.trim().toUpperCase() || undefined,
    endereco_pais: form.endereco_pais.trim() || undefined,
    endereco_referencia: form.endereco_referencia.trim() || undefined,
    prazo_medio_pagamento: form.prazo_medio_pagamento.trim()
      ? parseInt(form.prazo_medio_pagamento, 10)
      : undefined,
    condicao_pagamento_padrao: form.condicao_pagamento_padrao.trim() || undefined,
    limite_credito: form.limite_credito.trim() ? parseFloat(form.limite_credito.replace(',', '.')) : undefined,
    vendedor_representante: form.vendedor_representante.trim() || undefined,
    segmento_fornecedor: form.segmento_fornecedor.trim() || undefined,
    origem_fornecedor: form.origem_fornecedor.trim() || undefined,
    observacoes_comerciais: form.observacoes_comerciais.trim() || undefined,
    produtos_servicos_fornecidos: form.produtos_servicos_fornecidos.trim() || undefined,
    banco: form.banco.trim() || undefined,
    agencia: form.agencia.trim() || undefined,
    conta: form.conta.trim() || undefined,
    tipo_conta: form.tipo_conta.trim() || undefined,
    chave_pix: form.chave_pix.trim() || undefined,
    favorecido: form.favorecido.trim() || undefined,
    documento_favorecido: form.documento_favorecido.trim() || undefined,
    regime_tributario: form.regime_tributario.trim() || undefined,
    retencoes_aplicaveis: form.retencoes_aplicaveis.trim() || undefined,
    observacoes_fiscais: form.observacoes_fiscais.trim() || undefined,
    tipo_operacao_comum: form.tipo_operacao_comum.trim() || undefined,
    natureza_fornecimento: form.natureza_fornecimento.trim() || undefined,
    observacoes_internas: form.observacoes_internas.trim() || undefined,
    tags: form.tags.trim() || undefined,
    bloqueio_compras: form.bloqueio_compras ? 1 : 0,
    motivo_bloqueio: form.motivo_bloqueio.trim() || undefined,
    avaliacao_interna: form.avaliacao_interna.trim() ? parseInt(form.avaliacao_interna, 10) : undefined,
    prazo_medio_entrega: form.prazo_medio_entrega.trim()
      ? parseInt(form.prazo_medio_entrega, 10)
      : undefined,
    score_classificacao: form.score_classificacao.trim() || undefined,
    ativo: editing ? editing.ativo : 1,
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const v = validateForm()
    if (v) {
      setError(v)
      return
    }
    if (!empresaId) {
      setError('Empresa não identificada.')
      return
    }
    setSaving(true)
    try {
      const payload = buildPayload()
      if (editing) {
        const { empresa_id: _e, ...rest } = payload
        await window.electronAPI.fornecedores.update(editing.id, rest)
        op.saved('Fornecedor atualizado com sucesso.')
      } else {
        await window.electronAPI.fornecedores.create(payload)
        op.created('Fornecedor cadastrado com sucesso.')
      }
      setShowForm(false)
      setEditing(null)
      load()
    } catch (err: unknown) {
      op.failed(err, 'Erro ao salvar fornecedor.')
      setError(err instanceof Error ? err.message : 'Erro ao salvar fornecedor.')
    } finally {
      setSaving(false)
    }
  }

  const doInativar = async () => {
    const f = confirmInativar
    if (!f) return
    setConfirmInativar(null)
    try {
      await window.electronAPI.fornecedores.update(f.id, { ativo: 0 })
      op.saved('Fornecedor inativado.')
      load()
    } catch (err: unknown) {
      op.failed(err, 'Erro ao inativar fornecedor.')
    }
  }

  const doReativar = async () => {
    const f = confirmReativar
    if (!f) return
    setConfirmReativar(null)
    try {
      await window.electronAPI.fornecedores.update(f.id, { ativo: 1 })
      op.saved('Fornecedor reativado.')
      load()
    } catch (err: unknown) {
      op.failed(err, 'Erro ao reativar fornecedor.')
    }
  }

  const doExcluir = async () => {
    const f = confirmExcluir
    if (!f) return
    setConfirmExcluir(null)
    try {
      const r = await window.electronAPI.fornecedores.delete(f.id)
      if (!r.ok) {
        op.error(r.error ?? 'Não foi possível excluir o fornecedor.')
        return
      }
      op.deleted('Fornecedor excluído com sucesso.')
      load()
    } catch (err: unknown) {
      op.failed(err, 'Erro ao excluir fornecedor.')
    }
  }

  const tabBtn = (id: FormTab, label: string) => (
    <button
      key={id}
      type="button"
      className={`form-tab-btn ${formTab === id ? 'form-tab-btn--active' : ''}`}
      onClick={() => setFormTab(id)}
    >
      {label}
    </button>
  )

  return (
    <Layout>
      <PageTitle
        title="Fornecedores"
        subtitle="Cadastro completo para compras, financeiro, fiscal e controle interno (multi-empresa)"
      />

      <div
        className="mb-section"
        style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', flexWrap: 'wrap' }}
      >
        <div style={{ minWidth: 220, flex: '1 1 240px' }}>
          <input
            className="input-el"
            placeholder="Buscar: nome, fantasia, CPF/CNPJ, tel, e-mail…"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ margin: 0 }}
          />
        </div>
        <Select
          label=""
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.currentTarget.value as typeof filterStatus)}
          options={[
            { value: 'todos', label: 'Status: todos' },
            { value: 'ativo', label: 'Ativos' },
            { value: 'inativo', label: 'Inativos' },
          ]}
        />
        <Select
          label=""
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.currentTarget.value as typeof filterTipo)}
          options={[
            { value: 'todos', label: 'Tipo: todos' },
            { value: 'J', label: 'PJ' },
            { value: 'F', label: 'PF' },
          ]}
        />
        <Select
          label=""
          value={filterCategoria}
          onChange={(e) => setFilterCategoria(e.currentTarget.value)}
          options={[{ value: '', label: 'Categoria: todas' }, ...categoriasOpcoes.map((c) => ({ value: c, label: c }))]}
        />
        <Input
          label=""
          value={filterCidade}
          onChange={(e) => setFilterCidade(e.currentTarget.value)}
          placeholder="Cidade"
        />
        <Select
          label=""
          value={filterUf}
          onChange={(e) => setFilterUf(e.currentTarget.value)}
          options={[{ value: '', label: 'UF' }, ...UF_OPTIONS]}
        />
        <Select
          label=""
          value={sortBy}
          onChange={(e) => setSortBy(e.currentTarget.value as typeof sortBy)}
          options={[
            { value: 'razao', label: 'Ordenar: nome' },
            { value: 'cadastro', label: 'Data cadastro' },
            { value: 'atualizacao', label: 'Última atualização' },
          ]}
        />
        <Button onClick={openNew}>Novo fornecedor</Button>
      </div>

      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
        {loading ? 'Carregando…' : `${filteredSorted.length} fornecedor(es) · Página ${pageSafe} de ${totalPages}`}
      </div>

      <div className="page-list-area">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Razão social / Nome</th>
                <th>Fantasia</th>
                <th>Tipo</th>
                <th>CPF/CNPJ</th>
                <th>Cidade / UF</th>
                <th>Status</th>
                <th>Principal</th>
                <th>Compras</th>
                <th style={{ minWidth: 200 }}></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((f) => (
                <tr key={f.id}>
                  <td>
                    <strong>{f.razao_social}</strong>
                    {f.fornecedor_principal ? (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 'var(--text-xs)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--color-primary-light)',
                          color: 'var(--color-primary)',
                        }}
                      >
                        Preferencial
                      </span>
                    ) : null}
                  </td>
                  <td>{f.nome_fantasia || '—'}</td>
                  <td>{f.tipo_cadastro === 'F' ? 'PF' : 'PJ'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>{f.cnpj || '—'}</td>
                  <td>
                    {f.endereco_cidade || '—'}
                    {f.endereco_estado ? ` / ${f.endereco_estado}` : ''}
                  </td>
                  <td>{f.ativo === 0 ? <span style={{ color: 'var(--color-warning)' }}>Inativo</span> : 'Ativo'}</td>
                  <td>{f.fornecedor_principal ? 'Sim' : '—'}</td>
                  <td>{f.bloqueio_compras ? <span style={{ color: 'var(--color-error)' }}>Bloqueado</span> : '—'}</td>
                  <td style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(f)}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openHistorico(f)}>
                      Histórico
                    </Button>
                    {f.ativo !== 0 ? (
                      <Button variant="ghost" size="sm" onClick={() => setConfirmInativar(f)}>
                        Inativar
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setConfirmReativar(f)}>
                        Reativar
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setConfirmExcluir(f)}>
                      Excluir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredSorted.length === 0 && !loading && (
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-6)' }}>
            Nenhum fornecedor encontrado.
          </p>
        )}
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}>
            <Button variant="secondary" size="sm" disabled={pageSafe <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span style={{ fontSize: 'var(--text-sm)' }}>
              {pageSafe} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={showForm}
        onClose={() => {
          setShowForm(false)
          setEditing(null)
        }}
        title={editing ? 'Editar fornecedor' : 'Novo fornecedor'}
        size="large"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            {editing && editing.ativo !== 0 ? (
              <Button type="button" variant="secondary" onClick={() => setConfirmInativar(editing)}>
                Inativar
              </Button>
            ) : null}
            <Button type="submit" form="form-fornecedor" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </>
        }
      >
        <form id="form-fornecedor" onSubmit={submit} className="form-tabs">
          <div className="form-tabs-list">
            {tabBtn('principal', 'Dados principais')}
            {tabBtn('contato', 'Contato')}
            {tabBtn('endereco', 'Endereço')}
            {tabBtn('comercial', 'Comercial')}
            {tabBtn('fiscal', 'Fiscal')}
            {tabBtn('bancario', 'Bancário')}
            {tabBtn('controle', 'Controle interno')}
          </div>

          <div className={`form-tab-panel ${formTab === 'principal' ? 'form-tab-panel--active' : ''}`}>
            <div className="form-section">
              <h3 className="form-section-title">Identificação</h3>
              <div className="form-grid">
                <Select
                  label="Tipo de cadastro"
                  value={form.tipo_cadastro}
                  onChange={(e) => updateForm({ tipo_cadastro: e.currentTarget.value as 'F' | 'J' })}
                  options={[
                    { value: 'J', label: 'Pessoa jurídica' },
                    { value: 'F', label: 'Pessoa física' },
                  ]}
                />
                <Input
                  label={form.tipo_cadastro === 'J' ? 'Razão social *' : 'Nome completo *'}
                  required
                  value={form.razao_social}
                  onChange={(e) => updateForm({ razao_social: e.currentTarget.value })}
                />
                <Input
                  label="Nome fantasia"
                  value={form.nome_fantasia}
                  onChange={(e) => updateForm({ nome_fantasia: e.currentTarget.value })}
                />
                <Input
                  label="Responsável"
                  value={form.nome_responsavel}
                  onChange={(e) => updateForm({ nome_responsavel: e.currentTarget.value })}
                />
                <Input
                  label={form.tipo_cadastro === 'J' ? 'CNPJ *' : 'CPF *'}
                  required
                  value={form.cnpj}
                  onChange={(e) => updateForm({ cnpj: e.currentTarget.value })}
                  onBlur={() => updateForm({ cnpj: formatDoc(form.tipo_cadastro, form.cnpj) })}
                  placeholder={form.tipo_cadastro === 'J' ? '00.000.000/0000-00' : '000.000.000-00'}
                />
                <Input label="Inscrição estadual" value={form.inscricao_estadual} onChange={(e) => updateForm({ inscricao_estadual: e.currentTarget.value })} />
                <Input label="Inscrição municipal" value={form.inscricao_municipal} onChange={(e) => updateForm({ inscricao_municipal: e.currentTarget.value })} />
                <Select
                  label="Indicador de contribuinte"
                  value={form.indicador_contribuinte}
                  onChange={(e) => updateForm({ indicador_contribuinte: e.currentTarget.value as '1' | '2' | '9' })}
                  options={IND_IE_OPTIONS}
                />
                <Select
                  label="Categoria do fornecedor"
                  value={form.categoria_fornecedor}
                  onChange={(e) => updateForm({ categoria_fornecedor: e.currentTarget.value })}
                  options={[
                    { value: '', label: '— Nenhuma / escolha abaixo' },
                    ...categoriasOpcoes.map((c) => ({ value: c, label: c })),
                  ]}
                />
                <div
                  className="form-section"
                  style={{
                    gridColumn: '1 / -1',
                    padding: 'var(--space-4)',
                    background: 'var(--color-bg)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <h4 className="form-section-title" style={{ marginTop: 0, fontSize: 'var(--text-sm)' }}>
                    Cadastrar nova categoria
                  </h4>
                  <p
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-secondary)',
                      marginBottom: 'var(--space-3)',
                      maxWidth: 640,
                    }}
                  >
                    Crie um nome de categoria para reutilizar neste e em outros fornecedores. Fica salvo neste computador
                    (por empresa) e aparece na lista acima e nos filtros da tela.
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 'var(--space-3)',
                      alignItems: 'flex-end',
                    }}
                  >
                    <div style={{ flex: '1 1 220px', minWidth: 180 }}>
                      <Input
                        label="Nome da nova categoria"
                        value={novaCategoriaNome}
                        onChange={(e) => {
                          setNovaCategoriaNome(e.currentTarget.value)
                          setNovaCategoriaMsg(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            cadastrarNovaCategoriaFornecedor()
                          }
                        }}
                        placeholder="Ex.: Matéria-prima, Serviços, Revenda, Embalagens…"
                      />
                    </div>
                    <Button type="button" variant="secondary" onClick={cadastrarNovaCategoriaFornecedor}>
                      Cadastrar e aplicar
                    </Button>
                  </div>
                  {novaCategoriaMsg?.type === 'ok' ? (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)', marginTop: 8, marginBottom: 0 }}>
                      {novaCategoriaMsg.text}
                    </p>
                  ) : null}
                  {novaCategoriaMsg?.type === 'erro' ? (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error)', marginTop: 8, marginBottom: 0 }}>
                      {novaCategoriaMsg.text}
                    </p>
                  ) : null}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={form.fornecedor_principal}
                    onChange={(e) => updateForm({ fornecedor_principal: e.currentTarget.checked })}
                  />
                  Fornecedor preferencial / principal
                </label>
                {editing ? (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', gridColumn: '1 / -1' }}>
                    Cadastro em: {new Date(editing.created_at).toLocaleString('pt-BR')}
                    {editing.updated_at
                      ? ` · Última alteração: ${new Date(editing.updated_at).toLocaleString('pt-BR')}`
                      : ''}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className={`form-tab-panel ${formTab === 'contato' ? 'form-tab-panel--active' : ''}`}>
            <div className="form-section">
              <h3 className="form-section-title">Contato</h3>
              <div className="form-grid">
                <Input
                  label="Telefone principal"
                  value={form.telefone_principal}
                  onChange={(e) => updateForm({ telefone_principal: e.currentTarget.value })}
                  onBlur={() => updateForm({ telefone_principal: formatPhone(form.telefone_principal) })}
                />
                <Input
                  label="Telefone secundário"
                  value={form.telefone_secundario}
                  onChange={(e) => updateForm({ telefone_secundario: e.currentTarget.value })}
                  onBlur={() => updateForm({ telefone_secundario: formatPhone(form.telefone_secundario) })}
                />
                <Input
                  label="Celular / WhatsApp"
                  value={form.celular_whatsapp}
                  onChange={(e) => updateForm({ celular_whatsapp: e.currentTarget.value })}
                  onBlur={() => updateForm({ celular_whatsapp: formatPhone(form.celular_whatsapp) })}
                />
                <Input label="E-mail principal" type="email" value={form.email_principal} onChange={(e) => updateForm({ email_principal: e.currentTarget.value })} />
                <Input label="E-mail financeiro" type="email" value={form.email_financeiro} onChange={(e) => updateForm({ email_financeiro: e.currentTarget.value })} />
                <Input label="Site" value={form.site} onChange={(e) => updateForm({ site: e.currentTarget.value })} placeholder="https://…" />
                <Input label="Nome contato comercial" value={form.nome_contato_comercial} onChange={(e) => updateForm({ nome_contato_comercial: e.currentTarget.value })} />
                <Input label="Nome contato financeiro" value={form.nome_contato_financeiro} onChange={(e) => updateForm({ nome_contato_financeiro: e.currentTarget.value })} />
                <Input
                  label="Contato (legado)"
                  value={form.contato}
                  onChange={(e) => updateForm({ contato: e.currentTarget.value })}
                  hint="Campo antigo; use os campos estruturados acima quando possível."
                />
              </div>
            </div>
          </div>

          <div className={`form-tab-panel ${formTab === 'endereco' ? 'form-tab-panel--active' : ''}`}>
            <div className="form-section">
              <h3 className="form-section-title">Endereço</h3>
              <div className="form-grid form-grid-3">
                <div>
                  <Input
                    label="CEP"
                    value={form.endereco_cep}
                    onChange={(e) => updateForm({ endereco_cep: e.currentTarget.value })}
                    onBlur={onBlurCep}
                    placeholder="00000-000"
                  />
                  {cepLoading ? (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>Buscando CEP…</span>
                  ) : null}
                </div>
                <Select label="UF" value={form.endereco_estado} onChange={(e) => updateForm({ endereco_estado: e.currentTarget.value })} options={[{ value: '', label: '—' }, ...UF_OPTIONS]} />
                <Input label="Cidade" value={form.endereco_cidade} onChange={(e) => updateForm({ endereco_cidade: e.currentTarget.value })} />
              </div>
              <div className="form-grid">
                <Input label="Logradouro" value={form.endereco_logradouro} onChange={(e) => updateForm({ endereco_logradouro: e.currentTarget.value })} />
                <Input label="Número" value={form.endereco_numero} onChange={(e) => updateForm({ endereco_numero: e.currentTarget.value })} />
                <Input label="Complemento" value={form.endereco_complemento} onChange={(e) => updateForm({ endereco_complemento: e.currentTarget.value })} />
                <Input label="Bairro" value={form.endereco_bairro} onChange={(e) => updateForm({ endereco_bairro: e.currentTarget.value })} />
                <Input label="País" value={form.endereco_pais} onChange={(e) => updateForm({ endereco_pais: e.currentTarget.value })} />
                <Input label="Referência" value={form.endereco_referencia} onChange={(e) => updateForm({ endereco_referencia: e.currentTarget.value })} />
              </div>
            </div>
          </div>

          <div className={`form-tab-panel ${formTab === 'comercial' ? 'form-tab-panel--active' : ''}`}>
            <div className="form-section">
              <h3 className="form-section-title">Dados comerciais</h3>
              <div className="form-grid form-grid-2">
                <Input label="Prazo médio de pagamento (dias)" value={form.prazo_medio_pagamento} onChange={(e) => updateForm({ prazo_medio_pagamento: e.currentTarget.value })} />
                <Input label="Condição de pagamento padrão" value={form.condicao_pagamento_padrao} onChange={(e) => updateForm({ condicao_pagamento_padrao: e.currentTarget.value })} />
                <Input label="Limite de crédito (R$)" value={form.limite_credito} onChange={(e) => updateForm({ limite_credito: e.currentTarget.value })} />
                <Input label="Vendedor / representante" value={form.vendedor_representante} onChange={(e) => updateForm({ vendedor_representante: e.currentTarget.value })} />
                <Input label="Segmento" value={form.segmento_fornecedor} onChange={(e) => updateForm({ segmento_fornecedor: e.currentTarget.value })} />
                <Input label="Origem do fornecedor" value={form.origem_fornecedor} onChange={(e) => updateForm({ origem_fornecedor: e.currentTarget.value })} />
              </div>
              <label className="input-label">Observações comerciais</label>
              <textarea className="input-el" rows={3} value={form.observacoes_comerciais} onChange={(e) => updateForm({ observacoes_comerciais: e.currentTarget.value })} style={{ width: '100%' }} />
              <label className="input-label" style={{ marginTop: 12 }}>Produtos ou serviços fornecidos</label>
              <textarea className="input-el" rows={3} value={form.produtos_servicos_fornecidos} onChange={(e) => updateForm({ produtos_servicos_fornecidos: e.currentTarget.value })} style={{ width: '100%' }} />
            </div>
          </div>

          <div className={`form-tab-panel ${formTab === 'fiscal' ? 'form-tab-panel--active' : ''}`}>
            <div className="form-section">
              <h3 className="form-section-title">Dados fiscais</h3>
              <div className="form-grid form-grid-2">
                <Input label="Regime tributário" value={form.regime_tributario} onChange={(e) => updateForm({ regime_tributario: e.currentTarget.value })} />
                <Input label="Retenções aplicáveis" value={form.retencoes_aplicaveis} onChange={(e) => updateForm({ retencoes_aplicaveis: e.currentTarget.value })} hint="Ex.: IRRF, PIS/COFINS/CSLL…" />
                <Input label="Tipo de operação mais comum" value={form.tipo_operacao_comum} onChange={(e) => updateForm({ tipo_operacao_comum: e.currentTarget.value })} />
                <Input label="Natureza de fornecimento" value={form.natureza_fornecimento} onChange={(e) => updateForm({ natureza_fornecimento: e.currentTarget.value })} />
              </div>
              <label className="input-label">Observações fiscais</label>
              <textarea className="input-el" rows={4} value={form.observacoes_fiscais} onChange={(e) => updateForm({ observacoes_fiscais: e.currentTarget.value })} style={{ width: '100%' }} />
            </div>
          </div>

          <div className={`form-tab-panel ${formTab === 'bancario' ? 'form-tab-panel--active' : ''}`}>
            <div className="form-section">
              <h3 className="form-section-title">Dados bancários / PIX</h3>
              <div className="form-grid form-grid-2">
                <Input label="Banco" value={form.banco} onChange={(e) => updateForm({ banco: e.currentTarget.value })} />
                <Input label="Agência" value={form.agencia} onChange={(e) => updateForm({ agencia: e.currentTarget.value })} />
                <Input label="Conta" value={form.conta} onChange={(e) => updateForm({ conta: e.currentTarget.value })} />
                <Select label="Tipo de conta" value={form.tipo_conta} onChange={(e) => updateForm({ tipo_conta: e.currentTarget.value })} options={TIPO_CONTA_OPTIONS} />
                <Input label="Chave PIX" value={form.chave_pix} onChange={(e) => updateForm({ chave_pix: e.currentTarget.value })} />
                <Input label="Favorecido" value={form.favorecido} onChange={(e) => updateForm({ favorecido: e.currentTarget.value })} />
                <Input label="Documento do favorecido" value={form.documento_favorecido} onChange={(e) => updateForm({ documento_favorecido: e.currentTarget.value })} />
              </div>
            </div>
          </div>

          <div className={`form-tab-panel ${formTab === 'controle' ? 'form-tab-panel--active' : ''}`}>
            <div className="form-section">
              <h3 className="form-section-title">Controle interno</h3>
              <div className="form-grid form-grid-3">
                <Input label="Prazo médio de entrega (dias)" value={form.prazo_medio_entrega} onChange={(e) => updateForm({ prazo_medio_entrega: e.currentTarget.value })} />
                <Input label="Avaliação interna (1–5)" value={form.avaliacao_interna} onChange={(e) => updateForm({ avaliacao_interna: e.currentTarget.value })} />
                <Input label="Score / classificação" value={form.score_classificacao} onChange={(e) => updateForm({ score_classificacao: e.currentTarget.value })} />
              </div>
              <label className="input-label">Tags (separadas por vírgula)</label>
              <input className="input-el" value={form.tags} onChange={(e) => updateForm({ tags: e.currentTarget.value })} style={{ width: '100%', marginBottom: 12 }} />
              <label className="input-label">Observações gerais (legado)</label>
              <textarea className="input-el" rows={2} value={form.observacoes} onChange={(e) => updateForm({ observacoes: e.currentTarget.value })} style={{ width: '100%' }} />
              <label className="input-label" style={{ marginTop: 12 }}>Observações internas (não vão para documentos externos)</label>
              <textarea className="input-el" rows={4} value={form.observacoes_internas} onChange={(e) => updateForm({ observacoes_internas: e.currentTarget.value })} style={{ width: '100%' }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
                <input
                  type="checkbox"
                  checked={form.bloqueio_compras}
                  onChange={(e) => updateForm({ bloqueio_compras: e.currentTarget.checked })}
                />
                Bloquear novas compras deste fornecedor
              </label>
              <Input
                label="Motivo do bloqueio"
                value={form.motivo_bloqueio}
                onChange={(e) => updateForm({ motivo_bloqueio: e.currentTarget.value })}
                hint="Obrigatório se bloqueio estiver ativo."
              />
            </div>
          </div>

          {error ? (
            <Alert variant="error" style={{ marginTop: 16 }}>
              {error}
            </Alert>
          ) : null}
        </form>
      </Dialog>

      <Dialog
        open={showHistorico}
        onClose={() => {
          setShowHistorico(false)
          setEditing(null)
        }}
        title={editing ? `Histórico — ${editing.razao_social}` : 'Histórico'}
        size="large"
        footer={
          <Button type="button" variant="secondary" onClick={() => setShowHistorico(false)}>
            Fechar
          </Button>
        }
      >
        {historicoLoading ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>Carregando…</p>
        ) : historicoRows.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>Nenhum registro de histórico.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Operação</th>
                  <th>Detalhes</th>
                  <th>Usuário</th>
                </tr>
              </thead>
              <tbody>
                {historicoRows.map((h) => (
                  <tr key={h.id}>
                    <td>{new Date(h.created_at).toLocaleString('pt-BR')}</td>
                    <td>{h.operacao}</td>
                    <td>{h.campos_alterados ?? '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{h.usuario_id ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!confirmInativar}
        onClose={() => setConfirmInativar(null)}
        onConfirm={doInativar}
        title="Inativar fornecedor"
        message="O cadastro ficará inativo e não será removido. Deseja continuar?"
        confirmLabel="Inativar"
      />
      <ConfirmDialog
        open={!!confirmReativar}
        onClose={() => setConfirmReativar(null)}
        onConfirm={doReativar}
        title="Reativar fornecedor"
        message="O fornecedor voltará ao status ativo."
        confirmLabel="Reativar"
      />
      <ConfirmDialog
        open={!!confirmExcluir}
        onClose={() => setConfirmExcluir(null)}
        onConfirm={doExcluir}
        title="Excluir fornecedor"
        message="Exclusão definitiva apenas se não houver produtos vinculados. Deseja continuar?"
        confirmLabel="Excluir"
        variant="danger"
      />
    </Layout>
  )
}
