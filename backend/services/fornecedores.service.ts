import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { updateSyncClock } from '../sync-clock'
import { addToOutbox } from '../../sync/outbox'

/** Documento (CPF ou CNPJ) armazenado na coluna legada `cnpj` */
export type Fornecedor = {
  id: string
  empresa_id: string
  razao_social: string
  cnpj: string | null
  contato: string | null
  observacoes: string | null
  created_at: string
  tipo_cadastro: 'F' | 'J'
  nome_fantasia: string | null
  nome_responsavel: string | null
  inscricao_estadual: string | null
  inscricao_municipal: string | null
  indicador_contribuinte: '1' | '2' | '9'
  ativo: number
  fornecedor_principal: number
  categoria_fornecedor: string | null
  updated_at: string | null
  created_by: string | null
  updated_by: string | null
  telefone_principal: string | null
  telefone_secundario: string | null
  celular_whatsapp: string | null
  email_principal: string | null
  email_financeiro: string | null
  site: string | null
  nome_contato_comercial: string | null
  nome_contato_financeiro: string | null
  endereco_cep: string | null
  endereco_logradouro: string | null
  endereco_numero: string | null
  endereco_complemento: string | null
  endereco_bairro: string | null
  endereco_cidade: string | null
  endereco_estado: string | null
  endereco_pais: string | null
  endereco_referencia: string | null
  prazo_medio_pagamento: number | null
  condicao_pagamento_padrao: string | null
  limite_credito: number | null
  vendedor_representante: string | null
  segmento_fornecedor: string | null
  origem_fornecedor: string | null
  observacoes_comerciais: string | null
  produtos_servicos_fornecidos: string | null
  banco: string | null
  agencia: string | null
  conta: string | null
  tipo_conta: string | null
  chave_pix: string | null
  favorecido: string | null
  documento_favorecido: string | null
  regime_tributario: string | null
  retencoes_aplicaveis: string | null
  observacoes_fiscais: string | null
  tipo_operacao_comum: string | null
  natureza_fornecimento: string | null
  observacoes_internas: string | null
  tags: string | null
  bloqueio_compras: number
  motivo_bloqueio: string | null
  avaliacao_interna: number | null
  prazo_medio_entrega: number | null
  score_classificacao: string | null
}

export type FornecedorHistoricoItem = {
  id: string
  fornecedor_id: string
  empresa_id: string
  operacao: 'CREATE' | 'UPDATE' | 'INATIVAR' | 'REATIVAR'
  campos_alterados: string | null
  usuario_id: string | null
  created_at: string
}

const COLS = `
  id, empresa_id, razao_social, cnpj, contato, observacoes, created_at,
  tipo_cadastro, nome_fantasia, nome_responsavel, inscricao_estadual, inscricao_municipal,
  indicador_contribuinte, ativo, fornecedor_principal, categoria_fornecedor,
  updated_at, created_by, updated_by,
  telefone_principal, telefone_secundario, celular_whatsapp, email_principal, email_financeiro,
  site, nome_contato_comercial, nome_contato_financeiro,
  endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro,
  endereco_cidade, endereco_estado, endereco_pais, endereco_referencia,
  prazo_medio_pagamento, condicao_pagamento_padrao, limite_credito, vendedor_representante,
  segmento_fornecedor, origem_fornecedor, observacoes_comerciais, produtos_servicos_fornecidos,
  banco, agencia, conta, tipo_conta, chave_pix, favorecido, documento_favorecido,
  regime_tributario, retencoes_aplicaveis, observacoes_fiscais, tipo_operacao_comum, natureza_fornecimento,
  observacoes_internas, tags, bloqueio_compras, motivo_bloqueio, avaliacao_interna, prazo_medio_entrega, score_classificacao
`

function normalizeDoc(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

function rowToFornecedor(r: Record<string, unknown>): Fornecedor {
  const indicador = (r.indicador_contribuinte as string) ?? '9'
  return {
    id: r.id as string,
    empresa_id: r.empresa_id as string,
    razao_social: r.razao_social as string,
    cnpj: (r.cnpj as string) ?? null,
    contato: (r.contato as string) ?? null,
    observacoes: (r.observacoes as string) ?? null,
    created_at: r.created_at as string,
    tipo_cadastro: (r.tipo_cadastro as string) === 'F' ? 'F' : 'J',
    nome_fantasia: (r.nome_fantasia as string) ?? null,
    nome_responsavel: (r.nome_responsavel as string) ?? null,
    inscricao_estadual: (r.inscricao_estadual as string) ?? null,
    inscricao_municipal: (r.inscricao_municipal as string) ?? null,
    indicador_contribuinte: indicador === '1' || indicador === '2' ? indicador : '9',
    ativo: Number(r.ativo ?? 1),
    fornecedor_principal: Number(r.fornecedor_principal ?? 0),
    categoria_fornecedor: (r.categoria_fornecedor as string) ?? null,
    updated_at: (r.updated_at as string) ?? null,
    created_by: (r.created_by as string) ?? null,
    updated_by: (r.updated_by as string) ?? null,
    telefone_principal: (r.telefone_principal as string) ?? null,
    telefone_secundario: (r.telefone_secundario as string) ?? null,
    celular_whatsapp: (r.celular_whatsapp as string) ?? null,
    email_principal: (r.email_principal as string) ?? null,
    email_financeiro: (r.email_financeiro as string) ?? null,
    site: (r.site as string) ?? null,
    nome_contato_comercial: (r.nome_contato_comercial as string) ?? null,
    nome_contato_financeiro: (r.nome_contato_financeiro as string) ?? null,
    endereco_cep: (r.endereco_cep as string) ?? null,
    endereco_logradouro: (r.endereco_logradouro as string) ?? null,
    endereco_numero: (r.endereco_numero as string) ?? null,
    endereco_complemento: (r.endereco_complemento as string) ?? null,
    endereco_bairro: (r.endereco_bairro as string) ?? null,
    endereco_cidade: (r.endereco_cidade as string) ?? null,
    endereco_estado: (r.endereco_estado as string) ?? null,
    endereco_pais: (r.endereco_pais as string) ?? null,
    endereco_referencia: (r.endereco_referencia as string) ?? null,
    prazo_medio_pagamento:
      r.prazo_medio_pagamento != null ? Number(r.prazo_medio_pagamento) : null,
    condicao_pagamento_padrao: (r.condicao_pagamento_padrao as string) ?? null,
    limite_credito: r.limite_credito != null ? Number(r.limite_credito) : null,
    vendedor_representante: (r.vendedor_representante as string) ?? null,
    segmento_fornecedor: (r.segmento_fornecedor as string) ?? null,
    origem_fornecedor: (r.origem_fornecedor as string) ?? null,
    observacoes_comerciais: (r.observacoes_comerciais as string) ?? null,
    produtos_servicos_fornecidos: (r.produtos_servicos_fornecidos as string) ?? null,
    banco: (r.banco as string) ?? null,
    agencia: (r.agencia as string) ?? null,
    conta: (r.conta as string) ?? null,
    tipo_conta: (r.tipo_conta as string) ?? null,
    chave_pix: (r.chave_pix as string) ?? null,
    favorecido: (r.favorecido as string) ?? null,
    documento_favorecido: (r.documento_favorecido as string) ?? null,
    regime_tributario: (r.regime_tributario as string) ?? null,
    retencoes_aplicaveis: (r.retencoes_aplicaveis as string) ?? null,
    observacoes_fiscais: (r.observacoes_fiscais as string) ?? null,
    tipo_operacao_comum: (r.tipo_operacao_comum as string) ?? null,
    natureza_fornecimento: (r.natureza_fornecimento as string) ?? null,
    observacoes_internas: (r.observacoes_internas as string) ?? null,
    tags: (r.tags as string) ?? null,
    bloqueio_compras: Number(r.bloqueio_compras ?? 0),
    motivo_bloqueio: (r.motivo_bloqueio as string) ?? null,
    avaliacao_interna: r.avaliacao_interna != null ? Number(r.avaliacao_interna) : null,
    prazo_medio_entrega: r.prazo_medio_entrega != null ? Number(r.prazo_medio_entrega) : null,
    score_classificacao: (r.score_classificacao as string) ?? null
  }
}

function assertNoDuplicateDoc(
  empresaId: string,
  docNorm: string,
  excludeId?: string
): void {
  if (!docNorm) return
  const db = getDb()
  if (!db) return
  const rows = db
    .prepare(`SELECT id, cnpj FROM fornecedores WHERE empresa_id = ?`)
    .all(empresaId) as { id: string; cnpj: string | null }[]
  for (const row of rows) {
    if (excludeId && row.id === excludeId) continue
    if (normalizeDoc(row.cnpj) === docNorm) {
      throw new Error('Já existe um fornecedor com este CPF/CNPJ nesta empresa.')
    }
  }
}

function assertNoDuplicateRazao(
  empresaId: string,
  razao: string,
  excludeId?: string
): void {
  const norm = razao.trim().toLowerCase()
  if (norm.length < 3) return
  const db = getDb()
  if (!db) return
  const rows = db
    .prepare(`SELECT id, razao_social FROM fornecedores WHERE empresa_id = ?`)
    .all(empresaId) as { id: string; razao_social: string }[]
  for (const row of rows) {
    if (excludeId && row.id === excludeId) continue
    if (row.razao_social.trim().toLowerCase() === norm) {
      throw new Error('Já existe um fornecedor com esta razão social / nome nesta empresa.')
    }
  }
}

function appendHistorico(
  fornecedorId: string,
  empresaId: string,
  operacao: FornecedorHistoricoItem['operacao'],
  campos: string | null,
  usuarioId: string | null
): void {
  const db = getDb()
  if (!db) return
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO fornecedores_historico (id, fornecedor_id, empresa_id, operacao, campos_alterados, usuario_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, fornecedorId, empresaId, operacao, campos, usuarioId, now)
}

export function listFornecedores(empresaId: string): Fornecedor[] {
  const db = getDb()
  if (!db) return []
  const rows = db
    .prepare(`SELECT ${COLS} FROM fornecedores WHERE empresa_id = ? ORDER BY razao_social`)
    .all(empresaId) as Record<string, unknown>[]
  return rows.map(rowToFornecedor)
}

export function getFornecedorById(id: string): Fornecedor | null {
  const db = getDb()
  if (!db) return null
  const row = db.prepare(`SELECT ${COLS} FROM fornecedores WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined
  return row ? rowToFornecedor(row) : null
}

export function listHistoricoFornecedor(fornecedorId: string): FornecedorHistoricoItem[] {
  const db = getDb()
  if (!db) return []
  const rows = db
    .prepare(
      `SELECT id, fornecedor_id, empresa_id, operacao, campos_alterados, usuario_id, created_at
       FROM fornecedores_historico WHERE fornecedor_id = ? ORDER BY created_at DESC`
    )
    .all(fornecedorId) as Record<string, unknown>[]
  return rows.map((r) => ({
    id: r.id as string,
    fornecedor_id: r.fornecedor_id as string,
    empresa_id: r.empresa_id as string,
    operacao: r.operacao as FornecedorHistoricoItem['operacao'],
    campos_alterados: (r.campos_alterados as string) ?? null,
    usuario_id: (r.usuario_id as string) ?? null,
    created_at: r.created_at as string
  }))
}

/** Conta produtos vinculados (impede exclusão física). */
export function countProdutosVinculados(fornecedorId: string): number {
  const db = getDb()
  if (!db) return 0
  const row = db
    .prepare(`SELECT COUNT(*) as c FROM produtos WHERE fornecedor_id = ?`)
    .get(fornecedorId) as { c: number }
  return row?.c ?? 0
}

export type CreateFornecedorInput = {
  empresa_id: string
  razao_social: string
  tipo_cadastro?: 'F' | 'J'
  cnpj?: string | null
  contato?: string | null
  observacoes?: string | null
  nome_fantasia?: string | null
  nome_responsavel?: string | null
  inscricao_estadual?: string | null
  inscricao_municipal?: string | null
  indicador_contribuinte?: '1' | '2' | '9'
  fornecedor_principal?: number
  categoria_fornecedor?: string | null
  usuario_id?: string | null
  telefone_principal?: string | null
  telefone_secundario?: string | null
  celular_whatsapp?: string | null
  email_principal?: string | null
  email_financeiro?: string | null
  site?: string | null
  nome_contato_comercial?: string | null
  nome_contato_financeiro?: string | null
  endereco_cep?: string | null
  endereco_logradouro?: string | null
  endereco_numero?: string | null
  endereco_complemento?: string | null
  endereco_bairro?: string | null
  endereco_cidade?: string | null
  endereco_estado?: string | null
  endereco_pais?: string | null
  endereco_referencia?: string | null
  prazo_medio_pagamento?: number | null
  condicao_pagamento_padrao?: string | null
  limite_credito?: number | null
  vendedor_representante?: string | null
  segmento_fornecedor?: string | null
  origem_fornecedor?: string | null
  observacoes_comerciais?: string | null
  produtos_servicos_fornecidos?: string | null
  banco?: string | null
  agencia?: string | null
  conta?: string | null
  tipo_conta?: string | null
  chave_pix?: string | null
  favorecido?: string | null
  documento_favorecido?: string | null
  regime_tributario?: string | null
  retencoes_aplicaveis?: string | null
  observacoes_fiscais?: string | null
  tipo_operacao_comum?: string | null
  natureza_fornecimento?: string | null
  observacoes_internas?: string | null
  tags?: string | null
  bloqueio_compras?: number
  motivo_bloqueio?: string | null
  avaliacao_interna?: number | null
  prazo_medio_entrega?: number | null
  score_classificacao?: string | null
}

export function createFornecedor(data: CreateFornecedorInput): Fornecedor {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')

  const razao = data.razao_social.trim()
  if (!razao) throw new Error('Razão social ou nome é obrigatório.')

  const tipo: 'F' | 'J' = data.tipo_cadastro === 'F' ? 'F' : 'J'
  const docNorm = normalizeDoc(data.cnpj ?? '')
  assertNoDuplicateDoc(data.empresa_id, docNorm)
  assertNoDuplicateRazao(data.empresa_id, razao)

  const id = randomUUID()
  const now = new Date().toISOString()
  const indicador: '1' | '2' | '9' = data.indicador_contribuinte ?? '9'

  db.prepare(
    `INSERT INTO fornecedores (
      id, empresa_id, razao_social, cnpj, contato, observacoes, created_at,
      tipo_cadastro, nome_fantasia, nome_responsavel, inscricao_estadual, inscricao_municipal,
      indicador_contribuinte, ativo, fornecedor_principal, categoria_fornecedor,
      updated_at, created_by, updated_by,
      telefone_principal, telefone_secundario, celular_whatsapp, email_principal, email_financeiro,
      site, nome_contato_comercial, nome_contato_financeiro,
      endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro,
      endereco_cidade, endereco_estado, endereco_pais, endereco_referencia,
      prazo_medio_pagamento, condicao_pagamento_padrao, limite_credito, vendedor_representante,
      segmento_fornecedor, origem_fornecedor, observacoes_comerciais, produtos_servicos_fornecidos,
      banco, agencia, conta, tipo_conta, chave_pix, favorecido, documento_favorecido,
      regime_tributario, retencoes_aplicaveis, observacoes_fiscais, tipo_operacao_comum, natureza_fornecimento,
      observacoes_internas, tags, bloqueio_compras, motivo_bloqueio, avaliacao_interna, prazo_medio_entrega, score_classificacao
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, 1, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?
    )`
  ).run(
    id,
    data.empresa_id,
    razao,
    data.cnpj?.trim() || null,
    data.contato?.trim() || null,
    data.observacoes?.trim() || null,
    now,
    tipo,
    data.nome_fantasia?.trim() || null,
    data.nome_responsavel?.trim() || null,
    data.inscricao_estadual?.trim() || null,
    data.inscricao_municipal?.trim() || null,
    indicador,
    data.fornecedor_principal ? 1 : 0,
    data.categoria_fornecedor?.trim() || null,
    now,
    data.usuario_id ?? null,
    data.usuario_id ?? null,
    data.telefone_principal?.trim() || null,
    data.telefone_secundario?.trim() || null,
    data.celular_whatsapp?.trim() || null,
    data.email_principal?.trim() || null,
    data.email_financeiro?.trim() || null,
    data.site?.trim() || null,
    data.nome_contato_comercial?.trim() || null,
    data.nome_contato_financeiro?.trim() || null,
    data.endereco_cep?.trim() || null,
    data.endereco_logradouro?.trim() || null,
    data.endereco_numero?.trim() || null,
    data.endereco_complemento?.trim() || null,
    data.endereco_bairro?.trim() || null,
    data.endereco_cidade?.trim() || null,
    data.endereco_estado?.trim() || null,
    data.endereco_pais?.trim() || 'Brasil',
    data.endereco_referencia?.trim() || null,
    data.prazo_medio_pagamento ?? null,
    data.condicao_pagamento_padrao?.trim() || null,
    data.limite_credito ?? null,
    data.vendedor_representante?.trim() || null,
    data.segmento_fornecedor?.trim() || null,
    data.origem_fornecedor?.trim() || null,
    data.observacoes_comerciais?.trim() || null,
    data.produtos_servicos_fornecidos?.trim() || null,
    data.banco?.trim() || null,
    data.agencia?.trim() || null,
    data.conta?.trim() || null,
    data.tipo_conta?.trim() || null,
    data.chave_pix?.trim() || null,
    data.favorecido?.trim() || null,
    data.documento_favorecido?.trim() || null,
    data.regime_tributario?.trim() || null,
    data.retencoes_aplicaveis?.trim() || null,
    data.observacoes_fiscais?.trim() || null,
    data.tipo_operacao_comum?.trim() || null,
    data.natureza_fornecimento?.trim() || null,
    data.observacoes_internas?.trim() || null,
    data.tags?.trim() || null,
    data.bloqueio_compras ? 1 : 0,
    data.motivo_bloqueio?.trim() || null,
    data.avaliacao_interna ?? null,
    data.prazo_medio_entrega ?? null,
    data.score_classificacao?.trim() || null
  )

  appendHistorico(id, data.empresa_id, 'CREATE', null, data.usuario_id ?? null)

  const row = db.prepare(`SELECT ${COLS} FROM fornecedores WHERE id = ?`).get(id) as Record<string, unknown>
  const fornecedor = rowToFornecedor(row)
  updateSyncClock()
  addToOutbox('fornecedores', id, 'CREATE', fornecedor as unknown as Record<string, unknown>)
  return fornecedor
}

export type UpdateFornecedorInput = Partial<Omit<CreateFornecedorInput, 'empresa_id'>> & {
  ativo?: number
}

export function updateFornecedor(
  id: string,
  data: UpdateFornecedorInput,
  options?: { usuario_id?: string | null }
): Fornecedor | null {
  const db = getDb()
  if (!db) return null
  const current = getFornecedorById(id)
  if (!current) return null

  const razao = data.razao_social !== undefined ? data.razao_social.trim() : current.razao_social
  if (!razao) throw new Error('Razão social ou nome é obrigatório.')

  const tipo: 'F' | 'J' =
    data.tipo_cadastro !== undefined ? (data.tipo_cadastro === 'F' ? 'F' : 'J') : current.tipo_cadastro

  const cnpj =
    data.cnpj !== undefined ? (data.cnpj?.trim() || null) : current.cnpj
  const docNorm = normalizeDoc(cnpj)
  assertNoDuplicateDoc(current.empresa_id, docNorm, id)

  if (data.razao_social !== undefined) {
    assertNoDuplicateRazao(current.empresa_id, razao, id)
  }

  const contato = data.contato !== undefined ? (data.contato?.trim() || null) : current.contato
  const observacoes = data.observacoes !== undefined ? (data.observacoes?.trim() || null) : current.observacoes
  const nome_fantasia =
    data.nome_fantasia !== undefined ? (data.nome_fantasia?.trim() || null) : current.nome_fantasia
  const nome_responsavel =
    data.nome_responsavel !== undefined ? (data.nome_responsavel?.trim() || null) : current.nome_responsavel
  const inscricao_estadual =
    data.inscricao_estadual !== undefined
      ? (data.inscricao_estadual?.trim() || null)
      : current.inscricao_estadual
  const inscricao_municipal =
    data.inscricao_municipal !== undefined
      ? (data.inscricao_municipal?.trim() || null)
      : current.inscricao_municipal
  const indicador: '1' | '2' | '9' =
    data.indicador_contribuinte !== undefined ? data.indicador_contribuinte : current.indicador_contribuinte
  const ativo = data.ativo !== undefined ? (data.ativo ? 1 : 0) : current.ativo
  const fornecedor_principal =
    data.fornecedor_principal !== undefined
      ? data.fornecedor_principal
        ? 1
        : 0
      : current.fornecedor_principal
  const categoria_fornecedor =
    data.categoria_fornecedor !== undefined
      ? (data.categoria_fornecedor?.trim() || null)
      : current.categoria_fornecedor

  const pick = <K extends keyof Fornecedor>(key: K, fromData: keyof UpdateFornecedorInput): string | null => {
    const dk = fromData as string
    if (dk in data && (data as Record<string, unknown>)[dk] !== undefined) {
      const v = (data as Record<string, unknown>)[dk]
      return v == null || v === '' ? null : String(v).trim() || null
    }
    return current[key] as string | null
  }

  const pickNum = (dkey: keyof UpdateFornecedorInput, cur: number | null): number | null => {
    if (dkey in data && (data as Record<string, unknown>)[dkey as string] !== undefined) {
      const v = (data as Record<string, unknown>)[dkey as string]
      return v == null || v === '' ? null : Number(v)
    }
    return cur
  }

  const telefone_principal = pick('telefone_principal', 'telefone_principal')
  const telefone_secundario = pick('telefone_secundario', 'telefone_secundario')
  const celular_whatsapp = pick('celular_whatsapp', 'celular_whatsapp')
  const email_principal = pick('email_principal', 'email_principal')
  const email_financeiro = pick('email_financeiro', 'email_financeiro')
  const site = pick('site', 'site')
  const nome_contato_comercial = pick('nome_contato_comercial', 'nome_contato_comercial')
  const nome_contato_financeiro = pick('nome_contato_financeiro', 'nome_contato_financeiro')
  const endereco_cep = pick('endereco_cep', 'endereco_cep')
  const endereco_logradouro = pick('endereco_logradouro', 'endereco_logradouro')
  const endereco_numero = pick('endereco_numero', 'endereco_numero')
  const endereco_complemento = pick('endereco_complemento', 'endereco_complemento')
  const endereco_bairro = pick('endereco_bairro', 'endereco_bairro')
  const endereco_cidade = pick('endereco_cidade', 'endereco_cidade')
  const endereco_estado = pick('endereco_estado', 'endereco_estado')
  const endereco_pais =
    data.endereco_pais !== undefined
      ? (data.endereco_pais?.trim() || 'Brasil')
      : current.endereco_pais ?? 'Brasil'
  const endereco_referencia = pick('endereco_referencia', 'endereco_referencia')
  const prazo_medio_pagamento = pickNum('prazo_medio_pagamento', current.prazo_medio_pagamento)
  const condicao_pagamento_padrao = pick('condicao_pagamento_padrao', 'condicao_pagamento_padrao')
  const limite_credito = pickNum('limite_credito', current.limite_credito)
  const vendedor_representante = pick('vendedor_representante', 'vendedor_representante')
  const segmento_fornecedor = pick('segmento_fornecedor', 'segmento_fornecedor')
  const origem_fornecedor = pick('origem_fornecedor', 'origem_fornecedor')
  const observacoes_comerciais = pick('observacoes_comerciais', 'observacoes_comerciais')
  const produtos_servicos_fornecidos = pick('produtos_servicos_fornecidos', 'produtos_servicos_fornecidos')
  const banco = pick('banco', 'banco')
  const agencia = pick('agencia', 'agencia')
  const conta = pick('conta', 'conta')
  const tipo_conta = pick('tipo_conta', 'tipo_conta')
  const chave_pix = pick('chave_pix', 'chave_pix')
  const favorecido = pick('favorecido', 'favorecido')
  const documento_favorecido = pick('documento_favorecido', 'documento_favorecido')
  const regime_tributario = pick('regime_tributario', 'regime_tributario')
  const retencoes_aplicaveis = pick('retencoes_aplicaveis', 'retencoes_aplicaveis')
  const observacoes_fiscais = pick('observacoes_fiscais', 'observacoes_fiscais')
  const tipo_operacao_comum = pick('tipo_operacao_comum', 'tipo_operacao_comum')
  const natureza_fornecimento = pick('natureza_fornecimento', 'natureza_fornecimento')
  const observacoes_internas = pick('observacoes_internas', 'observacoes_internas')
  const tags = pick('tags', 'tags')
  const bloqueio_compras =
    data.bloqueio_compras !== undefined ? (data.bloqueio_compras ? 1 : 0) : current.bloqueio_compras
  const motivo_bloqueio = pick('motivo_bloqueio', 'motivo_bloqueio')
  const avaliacao_interna = pickNum('avaliacao_interna', current.avaliacao_interna)
  const prazo_medio_entrega = pickNum('prazo_medio_entrega', current.prazo_medio_entrega)
  const score_classificacao = pick('score_classificacao', 'score_classificacao')

  const now = new Date().toISOString()
  const usuarioId = options?.usuario_id ?? null

  db.prepare(
    `UPDATE fornecedores SET
      razao_social = ?, cnpj = ?, contato = ?, observacoes = ?,
      tipo_cadastro = ?, nome_fantasia = ?, nome_responsavel = ?, inscricao_estadual = ?, inscricao_municipal = ?,
      indicador_contribuinte = ?, ativo = ?, fornecedor_principal = ?, categoria_fornecedor = ?,
      updated_at = ?, updated_by = ?,
      telefone_principal = ?, telefone_secundario = ?, celular_whatsapp = ?, email_principal = ?, email_financeiro = ?,
      site = ?, nome_contato_comercial = ?, nome_contato_financeiro = ?,
      endereco_cep = ?, endereco_logradouro = ?, endereco_numero = ?, endereco_complemento = ?, endereco_bairro = ?,
      endereco_cidade = ?, endereco_estado = ?, endereco_pais = ?, endereco_referencia = ?,
      prazo_medio_pagamento = ?, condicao_pagamento_padrao = ?, limite_credito = ?, vendedor_representante = ?,
      segmento_fornecedor = ?, origem_fornecedor = ?, observacoes_comerciais = ?, produtos_servicos_fornecidos = ?,
      banco = ?, agencia = ?, conta = ?, tipo_conta = ?, chave_pix = ?, favorecido = ?, documento_favorecido = ?,
      regime_tributario = ?, retencoes_aplicaveis = ?, observacoes_fiscais = ?, tipo_operacao_comum = ?, natureza_fornecimento = ?,
      observacoes_internas = ?, tags = ?, bloqueio_compras = ?, motivo_bloqueio = ?, avaliacao_interna = ?, prazo_medio_entrega = ?, score_classificacao = ?
    WHERE id = ?`
  ).run(
    razao,
    cnpj,
    contato,
    observacoes,
    tipo,
    nome_fantasia,
    nome_responsavel,
    inscricao_estadual,
    inscricao_municipal,
    indicador,
    ativo,
    fornecedor_principal,
    categoria_fornecedor,
    now,
    usuarioId,
    telefone_principal,
    telefone_secundario,
    celular_whatsapp,
    email_principal,
    email_financeiro,
    site,
    nome_contato_comercial,
    nome_contato_financeiro,
    endereco_cep,
    endereco_logradouro,
    endereco_numero,
    endereco_complemento,
    endereco_bairro,
    endereco_cidade,
    endereco_estado,
    endereco_pais,
    endereco_referencia,
    prazo_medio_pagamento,
    condicao_pagamento_padrao,
    limite_credito,
    vendedor_representante,
    segmento_fornecedor,
    origem_fornecedor,
    observacoes_comerciais,
    produtos_servicos_fornecidos,
    banco,
    agencia,
    conta,
    tipo_conta,
    chave_pix,
    favorecido,
    documento_favorecido,
    regime_tributario,
    retencoes_aplicaveis,
    observacoes_fiscais,
    tipo_operacao_comum,
    natureza_fornecimento,
    observacoes_internas,
    tags,
    bloqueio_compras,
    motivo_bloqueio,
    avaliacao_interna,
    prazo_medio_entrega,
    score_classificacao,
    id
  )

  const changedKeys = Object.keys(data).filter((k) => k !== 'usuario_id')
  const camposResumo =
    changedKeys.length > 0 ? changedKeys.slice(0, 25).join(', ') + (changedKeys.length > 25 ? '…' : '') : null

  let operacaoHist: FornecedorHistoricoItem['operacao'] = 'UPDATE'
  if (data.ativo !== undefined && data.ativo !== current.ativo) {
    if (current.ativo === 1 && data.ativo === 0) operacaoHist = 'INATIVAR'
    else if (current.ativo === 0 && data.ativo === 1) operacaoHist = 'REATIVAR'
  }
  appendHistorico(id, current.empresa_id, operacaoHist, camposResumo, usuarioId)

  const updated = getFornecedorById(id)
  if (updated) {
    updateSyncClock()
    addToOutbox('fornecedores', id, 'UPDATE', updated as unknown as Record<string, unknown>)
  }
  return updated
}

export function inativarFornecedor(id: string, usuarioId?: string | null): Fornecedor | null {
  return updateFornecedor(id, { ativo: 0 }, { usuario_id: usuarioId })
}

export function reativarFornecedor(id: string, usuarioId?: string | null): Fornecedor | null {
  return updateFornecedor(id, { ativo: 1 }, { usuario_id: usuarioId })
}

/** Exclusão física apenas sem vínculos em produtos. */
export function deleteFornecedor(id: string): { ok: boolean; error?: string } {
  const db = getDb()
  if (!db) return { ok: false, error: 'Banco não inicializado.' }
  const f = getFornecedorById(id)
  if (!f) return { ok: false, error: 'Fornecedor não encontrado.' }
  const n = countProdutosVinculados(id)
  if (n > 0) {
    return {
      ok: false,
      error: `Não é possível excluir: ${n} produto(s) vinculado(s). Inative o cadastro em vez de excluir.`
    }
  }
  db.prepare(`DELETE FROM fornecedores WHERE id = ?`).run(id)
  updateSyncClock()
  // Espelho Supabase não suporta DELETE em fornecedores no sync atual; exclusão fica só no local.
  return { ok: true }
}
