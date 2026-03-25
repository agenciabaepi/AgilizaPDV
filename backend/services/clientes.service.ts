import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { updateSyncClock } from '../sync-clock'
import { addToOutbox } from '../../sync/outbox'

export type Cliente = {
  id: string
  empresa_id: string
  nome: string
  cpf_cnpj: string | null
  telefone: string | null
  email: string | null
  endereco: string | null
  observacoes: string | null
  /** F (pessoa física) ou J (pessoa jurídica) */
  tipo_pessoa: 'F' | 'J'
  razao_social: string | null
  nome_fantasia: string | null
  inscricao_estadual: string | null
  /** 1=Contribuinte, 2=Isento, 9=Não contribuinte (padrão) */
  indicador_ie_dest: '1' | '2' | '9'
  email_nfe: string | null
  endereco_cep: string | null
  endereco_logradouro: string | null
  endereco_numero: string | null
  endereco_complemento: string | null
  endereco_bairro: string | null
  endereco_municipio: string | null
  endereco_municipio_codigo: number | null
  endereco_uf: string | null
  endereco_pais_codigo: number | null
  endereco_pais_nome: string | null
  /** Limite de crédito para venda a prazo (null = sem limite numérico). */
  limite_credito: number | null
  created_at: string
}

function digitsOnlyDoc(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const d = raw.replace(/\D/g, '')
  return d.length >= 11 ? d : null
}

/** Evita segundo cliente com o mesmo CPF/CNPJ na empresa (documento normalizado). */
function assertClienteDocumentoUnico(
  db: NonNullable<ReturnType<typeof getDb>>,
  empresaId: string,
  cpfCnpj: string | null,
  excludeClienteId?: string
): void {
  const digits = digitsOnlyDoc(cpfCnpj)
  if (!digits) return
  const row = excludeClienteId
    ? db
        .prepare(
          `SELECT id FROM clientes WHERE empresa_id = ? AND REPLACE(REPLACE(REPLACE(TRIM(COALESCE(cpf_cnpj,'')),'.',''),'-',''),'/','') = ? AND id != ? LIMIT 1`
        )
        .get(empresaId, digits, excludeClienteId) as { id: string } | undefined
    : db
        .prepare(
          `SELECT id FROM clientes WHERE empresa_id = ? AND REPLACE(REPLACE(REPLACE(TRIM(COALESCE(cpf_cnpj,'')),'.',''),'-',''),'/','') = ? LIMIT 1`
        )
        .get(empresaId, digits) as { id: string } | undefined
  if (row) throw new Error('Já existe cliente cadastrado com este CPF/CNPJ.')
}

const COLS = `
  id,
  empresa_id,
  nome,
  cpf_cnpj,
  telefone,
  email,
  endereco,
  observacoes,
  tipo_pessoa,
  razao_social,
  nome_fantasia,
  inscricao_estadual,
  indicador_ie_dest,
  email_nfe,
  endereco_cep,
  endereco_logradouro,
  endereco_numero,
  endereco_complemento,
  endereco_bairro,
  endereco_municipio,
  endereco_municipio_codigo,
  endereco_uf,
  endereco_pais_codigo,
  endereco_pais_nome,
  limite_credito,
  created_at
`

function rowToCliente(r: Record<string, unknown>): Cliente {
  return {
    id: r.id as string,
    empresa_id: r.empresa_id as string,
    nome: r.nome as string,
    cpf_cnpj: (r.cpf_cnpj as string) ?? null,
    telefone: (r.telefone as string) ?? null,
    email: (r.email as string) ?? null,
    endereco: (r.endereco as string) ?? null,
    observacoes: (r.observacoes as string) ?? null,
    tipo_pessoa: ((r.tipo_pessoa as string) === 'J' ? 'J' : 'F'),
    razao_social: (r.razao_social as string) ?? null,
    nome_fantasia: (r.nome_fantasia as string) ?? null,
    inscricao_estadual: (r.inscricao_estadual as string) ?? null,
    indicador_ie_dest: (r.indicador_ie_dest as '1' | '2' | '9') ?? '9',
    email_nfe: (r.email_nfe as string) ?? null,
    endereco_cep: (r.endereco_cep as string) ?? null,
    endereco_logradouro: (r.endereco_logradouro as string) ?? null,
    endereco_numero: (r.endereco_numero as string) ?? null,
    endereco_complemento: (r.endereco_complemento as string) ?? null,
    endereco_bairro: (r.endereco_bairro as string) ?? null,
    endereco_municipio: (r.endereco_municipio as string) ?? null,
    endereco_municipio_codigo: (r.endereco_municipio_codigo as number) ?? null,
    endereco_uf: (r.endereco_uf as string) ?? null,
    endereco_pais_codigo: (r.endereco_pais_codigo as number) ?? null,
    endereco_pais_nome: (r.endereco_pais_nome as string) ?? null,
    limite_credito: r.limite_credito != null && r.limite_credito !== '' ? Number(r.limite_credito) : null,
    created_at: r.created_at as string
  }
}

export function listClientes(empresaId: string): Cliente[] {
  const db = getDb()
  if (!db) return []
  const rows = db
    .prepare(
      `
    SELECT ${COLS}
    FROM clientes
    WHERE empresa_id = ?
    ORDER BY nome
  `
    )
    .all(empresaId) as Record<string, unknown>[]
  return rows.map(rowToCliente)
}

export function getClienteById(id: string): Cliente | null {
  const db = getDb()
  if (!db) return null
  const row = db
    .prepare(
      `
    SELECT ${COLS}
    FROM clientes
    WHERE id = ?
  `
    )
    .get(id) as Record<string, unknown> | undefined
  return row ? rowToCliente(row) : null
}

export type CreateClienteInput = {
  empresa_id: string
  nome: string
  cpf_cnpj?: string
  telefone?: string
  email?: string
  endereco?: string
  observacoes?: string
  tipo_pessoa?: 'F' | 'J'
  razao_social?: string
  nome_fantasia?: string
  inscricao_estadual?: string
  indicador_ie_dest?: '1' | '2' | '9'
  email_nfe?: string
  endereco_cep?: string
  endereco_logradouro?: string
  endereco_numero?: string
  endereco_complemento?: string
  endereco_bairro?: string
  endereco_municipio?: string
  endereco_municipio_codigo?: number
  endereco_uf?: string
  endereco_pais_codigo?: number
  endereco_pais_nome?: string
  limite_credito?: number | null
}

export function createCliente(data: CreateClienteInput): Cliente {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  const id = randomUUID()
  const now = new Date().toISOString()
  const tipoPessoa: 'F' | 'J' = data.tipo_pessoa === 'J' ? 'J' : 'F'
  const indicadorIe: '1' | '2' | '9' = data.indicador_ie_dest ?? '9'
  const cpfNorm = data.cpf_cnpj?.trim() || null
  assertClienteDocumentoUnico(db, data.empresa_id, cpfNorm)

  db.prepare(
    `
    INSERT INTO clientes (
      id,
      empresa_id,
      nome,
      cpf_cnpj,
      telefone,
      email,
      endereco,
      observacoes,
      tipo_pessoa,
      razao_social,
      nome_fantasia,
      inscricao_estadual,
      indicador_ie_dest,
      email_nfe,
      endereco_cep,
      endereco_logradouro,
      endereco_numero,
      endereco_complemento,
      endereco_bairro,
      endereco_municipio,
      endereco_municipio_codigo,
      endereco_uf,
      endereco_pais_codigo,
      endereco_pais_nome,
      limite_credito,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    id,
    data.empresa_id,
    data.nome.trim(),
    cpfNorm,
    data.telefone?.trim() || null,
    data.email?.trim() || null,
    data.endereco?.trim() || null,
    data.observacoes?.trim() || null,
    tipoPessoa,
    data.razao_social?.trim() || null,
    data.nome_fantasia?.trim() || null,
    data.inscricao_estadual?.trim() || null,
    indicadorIe,
    data.email_nfe?.trim() || null,
    data.endereco_cep?.trim() || null,
    data.endereco_logradouro?.trim() || null,
    data.endereco_numero?.trim() || null,
    data.endereco_complemento?.trim() || null,
    data.endereco_bairro?.trim() || null,
    data.endereco_municipio?.trim() || null,
    data.endereco_municipio_codigo ?? null,
    data.endereco_uf?.trim() || null,
    data.endereco_pais_codigo ?? null,
    data.endereco_pais_nome?.trim() || null,
    data.limite_credito != null && Number.isFinite(data.limite_credito) ? data.limite_credito : null,
    now
  )

  const row = db.prepare(`SELECT ${COLS} FROM clientes WHERE id = ?`).get(id) as Record<string, unknown>
  const cliente = rowToCliente(row)
  updateSyncClock()
  addToOutbox('clientes', id, 'CREATE', cliente)
  return cliente
}

export type UpdateClienteInput = Partial<Omit<CreateClienteInput, 'empresa_id'>>

export function updateCliente(id: string, data: UpdateClienteInput): Cliente | null {
  const db = getDb()
  if (!db) return null
  const current = getClienteById(id)
  if (!current) return null

  const nome = data.nome !== undefined ? data.nome.trim() : current.nome
  const cpf_cnpj = data.cpf_cnpj !== undefined ? (data.cpf_cnpj.trim() || null) : current.cpf_cnpj
  const telefone = data.telefone !== undefined ? (data.telefone.trim() || null) : current.telefone
  const email = data.email !== undefined ? (data.email.trim() || null) : current.email
  const endereco = data.endereco !== undefined ? (data.endereco.trim() || null) : current.endereco
  const observacoes = data.observacoes !== undefined ? (data.observacoes.trim() || null) : current.observacoes
  const tipo_pessoa: 'F' | 'J' =
    data.tipo_pessoa !== undefined ? (data.tipo_pessoa === 'J' ? 'J' : 'F') : current.tipo_pessoa
  const razao_social =
    data.razao_social !== undefined ? (data.razao_social.trim() || null) : current.razao_social
  const nome_fantasia =
    data.nome_fantasia !== undefined ? (data.nome_fantasia.trim() || null) : current.nome_fantasia
  const inscricao_estadual =
    data.inscricao_estadual !== undefined
      ? (data.inscricao_estadual.trim() || null)
      : current.inscricao_estadual
  const indicador_ie_dest: '1' | '2' | '9' =
    data.indicador_ie_dest !== undefined ? data.indicador_ie_dest : current.indicador_ie_dest
  const email_nfe = data.email_nfe !== undefined ? (data.email_nfe.trim() || null) : current.email_nfe
  const endereco_cep =
    data.endereco_cep !== undefined ? (data.endereco_cep.trim() || null) : current.endereco_cep
  const endereco_logradouro =
    data.endereco_logradouro !== undefined
      ? (data.endereco_logradouro.trim() || null)
      : current.endereco_logradouro
  const endereco_numero =
    data.endereco_numero !== undefined ? (data.endereco_numero.trim() || null) : current.endereco_numero
  const endereco_complemento =
    data.endereco_complemento !== undefined
      ? (data.endereco_complemento.trim() || null)
      : current.endereco_complemento
  const endereco_bairro =
    data.endereco_bairro !== undefined ? (data.endereco_bairro.trim() || null) : current.endereco_bairro
  const endereco_municipio =
    data.endereco_municipio !== undefined
      ? (data.endereco_municipio.trim() || null)
      : current.endereco_municipio
  const endereco_municipio_codigo =
    data.endereco_municipio_codigo !== undefined
      ? data.endereco_municipio_codigo
      : current.endereco_municipio_codigo
  const endereco_uf =
    data.endereco_uf !== undefined ? (data.endereco_uf.trim() || null) : current.endereco_uf
  const endereco_pais_codigo =
    data.endereco_pais_codigo !== undefined ? data.endereco_pais_codigo : current.endereco_pais_codigo
  const endereco_pais_nome =
    data.endereco_pais_nome !== undefined
      ? (data.endereco_pais_nome.trim() || null)
      : current.endereco_pais_nome
  const limite_credito =
    data.limite_credito !== undefined
      ? data.limite_credito != null && Number.isFinite(data.limite_credito)
        ? data.limite_credito
        : null
      : current.limite_credito

  assertClienteDocumentoUnico(db, current.empresa_id, cpf_cnpj, id)

  db.prepare(
    `
    UPDATE clientes SET
      nome = ?,
      cpf_cnpj = ?,
      telefone = ?,
      email = ?,
      endereco = ?,
      observacoes = ?,
      tipo_pessoa = ?,
      razao_social = ?,
      nome_fantasia = ?,
      inscricao_estadual = ?,
      indicador_ie_dest = ?,
      email_nfe = ?,
      endereco_cep = ?,
      endereco_logradouro = ?,
      endereco_numero = ?,
      endereco_complemento = ?,
      endereco_bairro = ?,
      endereco_municipio = ?,
      endereco_municipio_codigo = ?,
      endereco_uf = ?,
      endereco_pais_codigo = ?,
      endereco_pais_nome = ?,
      limite_credito = ?
    WHERE id = ?
  `
  ).run(
    nome,
    cpf_cnpj,
    telefone,
    email,
    endereco,
    observacoes,
    tipo_pessoa,
    razao_social,
    nome_fantasia,
    inscricao_estadual,
    indicador_ie_dest,
    email_nfe,
    endereco_cep,
    endereco_logradouro,
    endereco_numero,
    endereco_complemento,
    endereco_bairro,
    endereco_municipio,
    endereco_municipio_codigo,
    endereco_uf,
    endereco_pais_codigo,
    endereco_pais_nome,
    limite_credito,
    id
  )

  const updated = getClienteById(id)
  if (updated) {
    updateSyncClock()
    addToOutbox('clientes', id, 'UPDATE', updated)
  }
  return updated
}
