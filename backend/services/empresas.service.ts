import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { updateSyncClock } from '../sync-clock'
import { addToOutbox } from '../../sync/outbox'

export type Empresa = {
  id: string
  nome: string
  cnpj: string | null
  created_at: string
}

export type EmpresaConfig = Empresa & {
  razao_social: string | null
  endereco: string | null
  telefone: string | null
  email: string | null
  logo: string | null
  cor_primaria: string | null
  modulos_json: string | null
}

/** Chaves dos módulos que podem ser ativados/desativados */
export const MODULOS_DISPONIVEIS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'produtos', label: 'Produtos' },
  { id: 'etiquetas', label: 'Etiquetas' },
  { id: 'categorias', label: 'Categorias' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'fornecedores', label: 'Fornecedores' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'caixa', label: 'Caixa' },
  { id: 'vendas', label: 'Vendas' },
  { id: 'pdv', label: 'PDV' },
] as const

export type ModuloId = (typeof MODULOS_DISPONIVEIS)[number]['id']

/** Retorna objeto de módulos habilitados. Se modulos_json for null/vazio, todos habilitados. */
export function parseModulos(modulosJson: string | null): Record<ModuloId, boolean> {
  const defaults: Record<ModuloId, boolean> = {
    dashboard: true,
    produtos: true,
    etiquetas: true,
    categorias: true,
    clientes: true,
    fornecedores: true,
    estoque: true,
    caixa: true,
    vendas: true,
    pdv: true,
  }
  if (!modulosJson?.trim()) return defaults
  try {
    const parsed = JSON.parse(modulosJson) as Record<string, boolean>
    return { ...defaults, ...parsed }
  } catch {
    return defaults
  }
}

const COLS_BASE = 'id, nome, cnpj, created_at'
const COLS_CONFIG = 'razao_social, endereco, telefone, email, logo, cor_primaria, modulos_json'

export function listEmpresas(): Empresa[] {
  const db = getDb()
  if (!db) return []
  const rows = db.prepare(`SELECT ${COLS_BASE} FROM empresas ORDER BY nome`).all() as Empresa[]
  return rows
}

export function createEmpresa(data: { nome: string; cnpj?: string }): Empresa {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  const id = randomUUID()
  db.prepare('INSERT INTO empresas (id, nome, cnpj) VALUES (?, ?, ?)').run(
    id,
    data.nome,
    data.cnpj ?? null
  )
  const row = db.prepare(`SELECT ${COLS_BASE} FROM empresas WHERE id = ?`).get(id) as Empresa
  updateSyncClock()
  addToOutbox('empresas', id, 'CREATE', row)
  return row
}

export function getEmpresaById(id: string): Empresa | null {
  const db = getDb()
  if (!db) return null
  const row = db.prepare(`SELECT ${COLS_BASE} FROM empresas WHERE id = ?`).get(id) as Empresa | undefined
  return row ?? null
}

/** Retorna configuração completa da empresa (dados, logo, cor, módulos). */
export function getEmpresaConfig(id: string): EmpresaConfig | null {
  const db = getDb()
  if (!db) return null
  const empresa = getEmpresaById(id)
  if (!empresa) return null

  const configRow = db
    .prepare(
      `SELECT razao_social, endereco, telefone, email, logo, cor_primaria, modulos_json
       FROM empresas_config WHERE empresa_id = ?`
    )
    .get(id) as
    | { razao_social: string | null; endereco: string | null; telefone: string | null; email: string | null; logo: string | null; cor_primaria: string | null; modulos_json: string | null }
    | undefined

  return {
    ...empresa,
    razao_social: configRow?.razao_social ?? null,
    endereco: configRow?.endereco ?? null,
    telefone: configRow?.telefone ?? null,
    email: configRow?.email ?? null,
    logo: configRow?.logo ?? null,
    cor_primaria: configRow?.cor_primaria ?? '#ea1d2c',
    modulos_json: configRow?.modulos_json ?? null,
  }
}

export type UpdateEmpresaConfigInput = {
  nome?: string
  cnpj?: string | null
  razao_social?: string | null
  endereco?: string | null
  telefone?: string | null
  email?: string | null
  logo?: string | null
  cor_primaria?: string | null
  modulos?: Record<ModuloId, boolean>
}

/** Atualiza configuração da empresa. */
export function updateEmpresaConfig(id: string, data: UpdateEmpresaConfigInput): EmpresaConfig | null {
  const db = getDb()
  if (!db) return null
  const existing = getEmpresaConfig(id)
  if (!existing) return null

  const empresaUpdates: string[] = []
  const empresaValues: unknown[] = []

  if (data.nome !== undefined) {
    empresaUpdates.push('nome = ?')
    empresaValues.push(data.nome)
  }
  if (data.cnpj !== undefined) {
    empresaUpdates.push('cnpj = ?')
    empresaValues.push(data.cnpj ?? null)
  }

  if (empresaUpdates.length > 0) {
    empresaValues.push(id)
    db.prepare(`UPDATE empresas SET ${empresaUpdates.join(', ')} WHERE id = ?`).run(...empresaValues)
  }

  const configFields = ['razao_social', 'endereco', 'telefone', 'email', 'logo', 'cor_primaria', 'modulos_json'] as const
  const hasConfigUpdate =
    data.razao_social !== undefined ||
    data.endereco !== undefined ||
    data.telefone !== undefined ||
    data.email !== undefined ||
    data.logo !== undefined ||
    data.cor_primaria !== undefined ||
    data.modulos !== undefined

  if (hasConfigUpdate) {
    const razao = data.razao_social !== undefined ? data.razao_social : existing.razao_social
    const endereco = data.endereco !== undefined ? data.endereco : existing.endereco
    const telefone = data.telefone !== undefined ? data.telefone : existing.telefone
    const email = data.email !== undefined ? data.email : existing.email
    const logo = data.logo !== undefined ? data.logo : existing.logo
    const cor_primaria = data.cor_primaria !== undefined ? data.cor_primaria : existing.cor_primaria
    const modulos_json =
      data.modulos !== undefined ? JSON.stringify(data.modulos) : existing.modulos_json

    db.prepare(
      `INSERT INTO empresas_config (empresa_id, razao_social, endereco, telefone, email, logo, cor_primaria, modulos_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(empresa_id) DO UPDATE SET
         razao_social = excluded.razao_social,
         endereco = excluded.endereco,
         telefone = excluded.telefone,
         email = excluded.email,
         logo = excluded.logo,
         cor_primaria = excluded.cor_primaria,
         modulos_json = excluded.modulos_json,
         updated_at = datetime('now')`
    ).run(id, razao, endereco, telefone, email, logo, cor_primaria ?? '#ea1d2c', modulos_json)
  }

  const updated = getEmpresaConfig(id)
  if (updated) {
    updateSyncClock()
    addToOutbox('empresas', id, 'UPDATE', updated)
  }
  return updated
}
