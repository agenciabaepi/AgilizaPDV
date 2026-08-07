import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { updateSyncClock } from '../sync-clock'
import { addToOutbox } from '../../sync/outbox'
import { EMPRESAS_CONFIG_MIRROR_SELECT_SQL } from '../../sync/empresas-config-mirror'

export type Empresa = {
  id: string
  nome: string
  cnpj: string | null
  /** Número usado no login do PDV (não expõe UUID). */
  codigo_acesso: number | null
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
  impressora_cupom: string | null
  /** Preset de página para cupom térmico: compat | thermal_80_72 | thermal_80_full */
  cupom_layout_pagina: string
  cupom_fiscal_auto_emitir: number
  cupom_fiscal_auto_formas_json: string | null
  loja_online_ativa: number
  loja_online_slug: string | null
  loja_online_titulo: string | null
  loja_online_descricao: string | null
  loja_online_whatsapp: string | null
  loja_online_mostrar_preco: number
  loja_online_ocultar_sem_estoque: number
  loja_online_banner: string | null
}

/** Chaves dos módulos que podem ser ativados/desativados */
export const MODULOS_DISPONIVEIS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'produtos', label: 'Produtos' },
  { id: 'etiquetas', label: 'Etiquetas' },
  { id: 'categorias', label: 'Categorias' },
  { id: 'marcas', label: 'Marcas' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'fornecedores', label: 'Fornecedores' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'caixa', label: 'Caixa' },
  { id: 'vendas', label: 'Vendas' },
  { id: 'pdv', label: 'PDV' },
] as const

export type ModuloId = (typeof MODULOS_DISPONIVEIS)[number]['id']

/**
 * Snapshot atual de `empresas_config` para o espelho Supabase (todas as colunas conhecidas pelo sync).
 */
export function getEmpresasConfigMirrorPayload(empresaId: string): Record<string, unknown> | null {
  const db = getDb()
  if (!db) return null
  const row = db
    .prepare(`SELECT ${EMPRESAS_CONFIG_MIRROR_SELECT_SQL} FROM empresas_config WHERE empresa_id = ?`)
    .get(empresaId) as Record<string, unknown> | undefined
  if (!row?.empresa_id) return null
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

/** Enfileira envio completo de `empresas_config` ao Supabase (último número NFC-e/NF-e, fiscal, loja). */
export function queueEmpresasConfigMirrorSync(empresaId: string): void {
  const payload = getEmpresasConfigMirrorPayload(empresaId)
  if (!payload?.empresa_id) return
  updateSyncClock()
  addToOutbox('empresas_config', empresaId, 'UPDATE', payload)
}

/** Retorna objeto de módulos habilitados. Se modulos_json for null/vazio, todos habilitados. */
export function parseModulos(modulosJson: string | null): Record<ModuloId, boolean> {
  const defaults: Record<ModuloId, boolean> = {
    dashboard: true,
    produtos: true,
    etiquetas: true,
    categorias: true,
    marcas: true,
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

const COLS_BASE = 'id, nome, cnpj, codigo_acesso, created_at'
const COLS_CONFIG =
  'razao_social, endereco, telefone, email, logo, cor_primaria, modulos_json, impressora_cupom, cupom_layout_pagina, loja_online_ativa, loja_online_slug, loja_online_titulo, loja_online_descricao, loja_online_whatsapp, loja_online_mostrar_preco, loja_online_ocultar_sem_estoque, loja_online_banner'

const LOJA_ONLINE_RESERVED_SLUGS = new Set([
  'www', 'app', 'api', 'admin', 'suporte', 'login', 'cadastro', 'loja', 'dashboard', 'pdv', 'static', 'assets',
])

export function normalizeLojaOnlineSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function validateLojaOnlineSlug(slug: string): string | null {
  if (!slug) return null
  if (slug.length < 3) return 'Use pelo menos 3 caracteres.'
  if (slug.length > 40) return 'Use no máximo 40 caracteres.'
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    return 'Use apenas letras minúsculas, números e hífens (sem hífen no início ou fim).'
  }
  if (LOJA_ONLINE_RESERVED_SLUGS.has(slug)) return 'Este endereço está reservado pelo sistema.'
  return null
}

function isLojaOnlineSlugTaken(db: NonNullable<ReturnType<typeof getDb>>, slug: string, excludeEmpresaId: string): boolean {
  const row = db
    .prepare(
      `SELECT empresa_id FROM empresas_config
       WHERE LOWER(TRIM(loja_online_slug)) = ? AND empresa_id != ?`
    )
    .get(slug, excludeEmpresaId) as { empresa_id: string } | undefined
  return !!row
}

export function listEmpresas(): Empresa[] {
  const db = getDb()
  if (!db) return []
  const rows = db.prepare(`SELECT ${COLS_BASE} FROM empresas ORDER BY nome`).all() as Empresa[]
  return rows.map((r) => ({ ...r, codigo_acesso: r.codigo_acesso ?? null }))
}

function nextCodigoAcessoDisponivel(db: NonNullable<ReturnType<typeof getDb>>): number {
  const row = db.prepare('SELECT COALESCE(MAX(codigo_acesso), 999) AS m FROM empresas').get() as { m: number }
  let candidate = Math.max(1000, (row?.m ?? 999) + 1)
  while (db.prepare('SELECT 1 FROM empresas WHERE codigo_acesso = ?').get(candidate)) {
    candidate += 1
  }
  return candidate
}

/** Preenche codigo_acesso para empresas antigas (uma vez por linha sem código). */
export function backfillCodigosAcesso(): void {
  const db = getDb()
  if (!db) return
  const nulls = db.prepare('SELECT id FROM empresas WHERE codigo_acesso IS NULL ORDER BY created_at, id').all() as { id: string }[]
  if (nulls.length === 0) return
  const upd = db.prepare('UPDATE empresas SET codigo_acesso = ? WHERE id = ?')
  for (const { id } of nulls) {
    const codigo = nextCodigoAcessoDisponivel(db)
    upd.run(codigo, id)
    const row = db.prepare(`SELECT ${COLS_BASE} FROM empresas WHERE id = ?`).get(id) as Empresa
    updateSyncClock()
    addToOutbox('empresas', id, 'UPDATE', { id: row.id, nome: row.nome, cnpj: row.cnpj, codigo_acesso: row.codigo_acesso, created_at: row.created_at })
  }
}

export function countEmpresas(): number {
  const db = getDb()
  if (!db) return 0
  const row = db.prepare('SELECT COUNT(*) AS c FROM empresas').get() as { c: number }
  return row?.c ?? 0
}

/**
 * Resolve o ID interno a partir do número digitado no login (apenas dígitos).
 * Retorna null se inválido ou empresa inexistente.
 */
export function resolveEmpresaIdFromCodigoLogin(raw: string): string | null {
  const s = raw.trim().replace(/\D/g, '')
  if (!s || s.length > 12) return null
  const num = parseInt(s, 10)
  if (!Number.isFinite(num) || num < 1) return null
  const db = getDb()
  if (!db) return null
  const row = db.prepare('SELECT id FROM empresas WHERE codigo_acesso = ?').get(num) as { id: string } | undefined
  return row?.id ?? null
}

export function createEmpresa(data: { nome: string; cnpj?: string; codigo_acesso?: number | null }): Empresa {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  let codigo: number
  if (data.codigo_acesso != null && Number.isInteger(data.codigo_acesso) && data.codigo_acesso >= 1) {
    const clash = db.prepare('SELECT id FROM empresas WHERE codigo_acesso = ?').get(data.codigo_acesso) as { id: string } | undefined
    if (clash) throw new Error(`Código ${data.codigo_acesso} já está em uso por outra empresa.`)
    codigo = data.codigo_acesso
  } else {
    codigo = nextCodigoAcessoDisponivel(db)
  }
  const id = randomUUID()
  db.prepare('INSERT INTO empresas (id, nome, cnpj, codigo_acesso) VALUES (?, ?, ?, ?)').run(id, data.nome, data.cnpj ?? null, codigo)
  const row = db.prepare(`SELECT ${COLS_BASE} FROM empresas WHERE id = ?`).get(id) as Empresa
  updateSyncClock()
  addToOutbox('empresas', id, 'CREATE', row)
  return row
}

export function getEmpresaById(id: string): Empresa | null {
  const db = getDb()
  if (!db) return null
  const row = db.prepare(`SELECT ${COLS_BASE} FROM empresas WHERE id = ?`).get(id) as Empresa | undefined
  if (!row) return null
  return { ...row, codigo_acesso: row.codigo_acesso ?? null }
}

/** Retorna configuração completa da empresa (dados, logo, cor, módulos). */
export function getEmpresaConfig(id: string): EmpresaConfig | null {
  const db = getDb()
  if (!db) return null
  const empresa = getEmpresaById(id)
  if (!empresa) return null

  const configRow = db
    .prepare(
      `SELECT razao_social, endereco, telefone, email, logo, cor_primaria, modulos_json, impressora_cupom, cupom_layout_pagina,
              cupom_fiscal_auto_emitir, cupom_fiscal_auto_formas_json,
              loja_online_ativa, loja_online_slug, loja_online_titulo, loja_online_descricao, loja_online_whatsapp,
              loja_online_mostrar_preco, loja_online_ocultar_sem_estoque, loja_online_banner
       FROM empresas_config WHERE empresa_id = ?`
    )
    .get(id) as
    | {
        razao_social: string | null
        endereco: string | null
        telefone: string | null
        email: string | null
        logo: string | null
        cor_primaria: string | null
        modulos_json: string | null
        impressora_cupom: string | null
        cupom_layout_pagina: string | null
        cupom_fiscal_auto_emitir: number | null
        cupom_fiscal_auto_formas_json: string | null
        loja_online_ativa: number | null
        loja_online_slug: string | null
        loja_online_titulo: string | null
        loja_online_descricao: string | null
        loja_online_whatsapp: string | null
        loja_online_mostrar_preco: number | null
        loja_online_ocultar_sem_estoque: number | null
        loja_online_banner: string | null
      }
    | undefined

  return {
    ...empresa,
    razao_social: configRow?.razao_social ?? null,
    endereco: configRow?.endereco ?? null,
    telefone: configRow?.telefone ?? null,
    email: configRow?.email ?? null,
    logo: configRow?.logo ?? null,
    cor_primaria: configRow?.cor_primaria ?? '#1d4ed8',
    modulos_json: configRow?.modulos_json ?? null,
    impressora_cupom: configRow?.impressora_cupom ?? null,
    cupom_layout_pagina: configRow?.cupom_layout_pagina?.trim() || 'compat',
    cupom_fiscal_auto_emitir: configRow?.cupom_fiscal_auto_emitir ? 1 : 0,
    cupom_fiscal_auto_formas_json: configRow?.cupom_fiscal_auto_formas_json ?? null,
    loja_online_ativa: configRow?.loja_online_ativa ? 1 : 0,
    loja_online_slug: configRow?.loja_online_slug?.trim() || null,
    loja_online_titulo: configRow?.loja_online_titulo?.trim() || null,
    loja_online_descricao: configRow?.loja_online_descricao ?? null,
    loja_online_whatsapp: configRow?.loja_online_whatsapp?.trim() || null,
    loja_online_mostrar_preco: configRow?.loja_online_mostrar_preco !== 0 ? 1 : 0,
    loja_online_ocultar_sem_estoque: configRow?.loja_online_ocultar_sem_estoque ? 1 : 0,
    loja_online_banner: configRow?.loja_online_banner ?? null,
  }
}

export type UpdateEmpresaConfigInput = {
  nome?: string
  cnpj?: string | null
  /** Número do login PDV; deve ser único entre empresas. */
  codigo_acesso?: number | null
  razao_social?: string | null
  endereco?: string | null
  telefone?: string | null
  email?: string | null
  logo?: string | null
  cor_primaria?: string | null
  modulos?: Record<ModuloId, boolean>
  impressora_cupom?: string | null
  cupom_layout_pagina?: string | null
  cupom_fiscal_auto_emitir?: boolean
  cupom_fiscal_auto_formas_json?: string | null
  loja_online_ativa?: boolean
  loja_online_slug?: string | null
  loja_online_titulo?: string | null
  loja_online_descricao?: string | null
  loja_online_whatsapp?: string | null
  loja_online_mostrar_preco?: boolean
  loja_online_ocultar_sem_estoque?: boolean
  loja_online_banner?: string | null
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
  if (data.codigo_acesso !== undefined) {
    const c = data.codigo_acesso
    if (c != null) {
      if (!Number.isInteger(c) || c < 1) {
        return null
      }
      const clash = db.prepare('SELECT id FROM empresas WHERE codigo_acesso = ? AND id != ?').get(c, id) as { id: string } | undefined
      if (clash) return null
    }
    empresaUpdates.push('codigo_acesso = ?')
    empresaValues.push(c ?? null)
  }

  if (empresaUpdates.length > 0) {
    empresaValues.push(id)
    db.prepare(`UPDATE empresas SET ${empresaUpdates.join(', ')} WHERE id = ?`).run(...empresaValues)
  }

  const configFields = [
    'razao_social',
    'endereco',
    'telefone',
    'email',
    'logo',
    'cor_primaria',
    'modulos_json',
    'impressora_cupom',
    'cupom_layout_pagina',
  ] as const
  const hasConfigUpdate =
    data.razao_social !== undefined ||
    data.endereco !== undefined ||
    data.telefone !== undefined ||
    data.email !== undefined ||
    data.logo !== undefined ||
    data.cor_primaria !== undefined ||
    data.modulos !== undefined ||
    data.impressora_cupom !== undefined ||
    data.cupom_layout_pagina !== undefined ||
    data.cupom_fiscal_auto_emitir !== undefined ||
    data.cupom_fiscal_auto_formas_json !== undefined ||
    data.loja_online_ativa !== undefined ||
    data.loja_online_slug !== undefined ||
    data.loja_online_titulo !== undefined ||
    data.loja_online_descricao !== undefined ||
    data.loja_online_whatsapp !== undefined ||
    data.loja_online_mostrar_preco !== undefined ||
    data.loja_online_ocultar_sem_estoque !== undefined ||
    data.loja_online_banner !== undefined

  if (hasConfigUpdate) {
    const razao = data.razao_social !== undefined ? data.razao_social : existing.razao_social
    const endereco = data.endereco !== undefined ? data.endereco : existing.endereco
    const telefone = data.telefone !== undefined ? data.telefone : existing.telefone
    const email = data.email !== undefined ? data.email : existing.email
    const logo = data.logo !== undefined ? data.logo : existing.logo
    const cor_primaria = data.cor_primaria !== undefined ? data.cor_primaria : existing.cor_primaria
    const modulos_json =
      data.modulos !== undefined ? JSON.stringify(data.modulos) : existing.modulos_json
    const impressora_cupom = data.impressora_cupom !== undefined ? data.impressora_cupom : existing.impressora_cupom
    const cupom_layout_pagina =
      data.cupom_layout_pagina !== undefined ? data.cupom_layout_pagina : existing.cupom_layout_pagina
    const cupom_fiscal_auto_emitir =
      data.cupom_fiscal_auto_emitir !== undefined
        ? data.cupom_fiscal_auto_emitir
          ? 1
          : 0
        : existing.cupom_fiscal_auto_emitir
    const cupom_fiscal_auto_formas_json =
      data.cupom_fiscal_auto_formas_json !== undefined
        ? data.cupom_fiscal_auto_formas_json
        : existing.cupom_fiscal_auto_formas_json

    const loja_online_ativa =
      data.loja_online_ativa !== undefined ? (data.loja_online_ativa ? 1 : 0) : existing.loja_online_ativa
    let loja_online_slug =
      data.loja_online_slug !== undefined
        ? data.loja_online_slug?.trim()
          ? normalizeLojaOnlineSlug(data.loja_online_slug)
          : null
        : existing.loja_online_slug
    const loja_online_titulo =
      data.loja_online_titulo !== undefined
        ? data.loja_online_titulo?.trim() || null
        : existing.loja_online_titulo
    const loja_online_descricao =
      data.loja_online_descricao !== undefined ? data.loja_online_descricao : existing.loja_online_descricao
    const loja_online_whatsapp =
      data.loja_online_whatsapp !== undefined
        ? data.loja_online_whatsapp?.trim() || null
        : existing.loja_online_whatsapp
    const loja_online_mostrar_preco =
      data.loja_online_mostrar_preco !== undefined
        ? data.loja_online_mostrar_preco
          ? 1
          : 0
        : existing.loja_online_mostrar_preco
    const loja_online_ocultar_sem_estoque =
      data.loja_online_ocultar_sem_estoque !== undefined
        ? data.loja_online_ocultar_sem_estoque
          ? 1
          : 0
        : existing.loja_online_ocultar_sem_estoque
    const loja_online_banner =
      data.loja_online_banner !== undefined ? data.loja_online_banner : existing.loja_online_banner

    if (loja_online_ativa && !loja_online_slug) {
      throw new Error('Informe o endereço (subdomínio) da loja online para publicar o catálogo.')
    }
    if (loja_online_slug) {
      const slugError = validateLojaOnlineSlug(loja_online_slug)
      if (slugError) throw new Error(slugError)
      if (isLojaOnlineSlugTaken(db, loja_online_slug, id)) {
        throw new Error('Este endereço já está em uso por outra loja.')
      }
    }

    db.prepare(
      `INSERT INTO empresas_config (empresa_id, razao_social, endereco, telefone, email, logo, cor_primaria, modulos_json, impressora_cupom, cupom_layout_pagina,
        cupom_fiscal_auto_emitir, cupom_fiscal_auto_formas_json,
        loja_online_ativa, loja_online_slug, loja_online_titulo, loja_online_descricao, loja_online_whatsapp, loja_online_mostrar_preco, loja_online_ocultar_sem_estoque, loja_online_banner, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(empresa_id) DO UPDATE SET
         razao_social = excluded.razao_social,
         endereco = excluded.endereco,
         telefone = excluded.telefone,
         email = excluded.email,
         logo = excluded.logo,
         cor_primaria = excluded.cor_primaria,
         modulos_json = excluded.modulos_json,
         impressora_cupom = excluded.impressora_cupom,
         cupom_layout_pagina = excluded.cupom_layout_pagina,
         cupom_fiscal_auto_emitir = excluded.cupom_fiscal_auto_emitir,
         cupom_fiscal_auto_formas_json = excluded.cupom_fiscal_auto_formas_json,
         loja_online_ativa = excluded.loja_online_ativa,
         loja_online_slug = excluded.loja_online_slug,
         loja_online_titulo = excluded.loja_online_titulo,
         loja_online_descricao = excluded.loja_online_descricao,
         loja_online_whatsapp = excluded.loja_online_whatsapp,
         loja_online_mostrar_preco = excluded.loja_online_mostrar_preco,
         loja_online_ocultar_sem_estoque = excluded.loja_online_ocultar_sem_estoque,
         loja_online_banner = excluded.loja_online_banner,
         updated_at = datetime('now')`
    ).run(
      id,
      razao,
      endereco,
      telefone,
      email,
      logo,
      cor_primaria ?? '#1d4ed8',
      modulos_json,
      impressora_cupom,
      cupom_layout_pagina ?? 'compat',
      cupom_fiscal_auto_emitir,
      cupom_fiscal_auto_formas_json,
      loja_online_ativa,
      loja_online_slug,
      loja_online_titulo,
      loja_online_descricao,
      loja_online_whatsapp,
      loja_online_mostrar_preco,
      loja_online_ocultar_sem_estoque,
      loja_online_banner
    )
  }

  const updated = getEmpresaConfig(id)
  if (updated) {
    updateSyncClock()
    addToOutbox('empresas', id, 'UPDATE', {
      id: updated.id,
      nome: updated.nome,
      cnpj: updated.cnpj,
      codigo_acesso: updated.codigo_acesso,
      created_at: updated.created_at
    })
    queueEmpresasConfigMirrorSync(id)
  }
  return updated
}

// --- Configuração fiscal (NF-e / NFC-e) ---

export type AmbienteFiscal = 'homologacao' | 'producao'

export type EmpresaFiscalConfig = {
  ambiente: AmbienteFiscal
  serie_nfe: number
  ultimo_numero_nfe: number
  serie_nfce: number
  ultimo_numero_nfce: number
  csc_nfce: string | null
  csc_id_nfce: string | null
  indicar_fonte_ibpt: boolean
  xml_autorizados: string[]
  uf_emitente: string
  ie_emitente: string
  c_mun_emitente: number | null
  ncm_padrao: string | null
  tributo_aprox_federal_pct: number
  tributo_aprox_estadual_pct: number
  tributo_aprox_municipal_pct: number
}

const FISCAL_DEFAULTS: EmpresaFiscalConfig = {
  ambiente: 'producao',
  serie_nfe: 1,
  ultimo_numero_nfe: 0,
  serie_nfce: 1,
  ultimo_numero_nfce: 0,
  csc_nfce: null,
  csc_id_nfce: null,
  indicar_fonte_ibpt: true,
  xml_autorizados: [],
  uf_emitente: 'SP',
  ie_emitente: 'ISENTO',
  c_mun_emitente: 3550308, // São Paulo/SP (fallback)
  ncm_padrao: '21069090', // Outras preparações para alimentação (genérico)
  tributo_aprox_federal_pct: 0,
  tributo_aprox_estadual_pct: 0,
  tributo_aprox_municipal_pct: 0,
}

export function getFiscalConfig(empresaId: string): EmpresaFiscalConfig | null {
  const db = getDb()
  if (!db) return null
  if (!getEmpresaById(empresaId)) return null

  const row = db
    .prepare(
      `SELECT ambiente_fiscal, serie_nfe, ultimo_numero_nfe, serie_nfce, ultimo_numero_nfce,
              csc_nfce, csc_id_nfce, indicar_fonte_ibpt, xml_autorizados_json, uf_emitente, ie_emitente, c_mun_emitente, ncm_padrao,
              tributo_aprox_federal_pct, tributo_aprox_estadual_pct, tributo_aprox_municipal_pct
       FROM empresas_config WHERE empresa_id = ?`
    )
    .get(empresaId) as {
      ambiente_fiscal?: number | null
      serie_nfe?: number | null
      ultimo_numero_nfe?: number | null
      serie_nfce?: number | null
      ultimo_numero_nfce?: number | null
      csc_nfce?: string | null
      csc_id_nfce?: string | null
      indicar_fonte_ibpt?: number | null
      xml_autorizados_json?: string | null
      uf_emitente?: string | null
      ie_emitente?: string | null
      c_mun_emitente?: number | null
      ncm_padrao?: string | null
      tributo_aprox_federal_pct?: number | null
      tributo_aprox_estadual_pct?: number | null
      tributo_aprox_municipal_pct?: number | null
    } | undefined

  if (!row) return { ...FISCAL_DEFAULTS }

  let xml_autorizados: string[] = []
  if (row.xml_autorizados_json?.trim()) {
    try {
      xml_autorizados = JSON.parse(row.xml_autorizados_json) as string[]
      if (!Array.isArray(xml_autorizados)) xml_autorizados = []
    } catch {
      xml_autorizados = []
    }
  }

  return {
    ambiente: row.ambiente_fiscal === 0 ? 'homologacao' : 'producao',
    serie_nfe: row.serie_nfe ?? FISCAL_DEFAULTS.serie_nfe,
    ultimo_numero_nfe: row.ultimo_numero_nfe ?? FISCAL_DEFAULTS.ultimo_numero_nfe,
    serie_nfce: row.serie_nfce ?? FISCAL_DEFAULTS.serie_nfce,
    ultimo_numero_nfce: row.ultimo_numero_nfce ?? FISCAL_DEFAULTS.ultimo_numero_nfce,
    csc_nfce: row.csc_nfce?.trim() || null,
    csc_id_nfce: row.csc_id_nfce?.trim() || null,
    indicar_fonte_ibpt: row.indicar_fonte_ibpt !== 0,
    xml_autorizados,
    uf_emitente: (row.uf_emitente?.trim() || FISCAL_DEFAULTS.uf_emitente).toUpperCase().slice(0, 2),
    ie_emitente: row.ie_emitente?.trim() || FISCAL_DEFAULTS.ie_emitente,
    c_mun_emitente: row.c_mun_emitente != null ? row.c_mun_emitente : FISCAL_DEFAULTS.c_mun_emitente,
    ncm_padrao: row.ncm_padrao?.trim() || FISCAL_DEFAULTS.ncm_padrao,
    tributo_aprox_federal_pct: row.tributo_aprox_federal_pct != null ? row.tributo_aprox_federal_pct : 0,
    tributo_aprox_estadual_pct: row.tributo_aprox_estadual_pct != null ? row.tributo_aprox_estadual_pct : 0,
    tributo_aprox_municipal_pct: row.tributo_aprox_municipal_pct != null ? row.tributo_aprox_municipal_pct : 0,
  }
}

export type UpdateFiscalConfigInput = {
  ambiente?: AmbienteFiscal
  serie_nfe?: number
  ultimo_numero_nfe?: number
  serie_nfce?: number
  ultimo_numero_nfce?: number
  csc_nfce?: string | null
  csc_id_nfce?: string | null
  indicar_fonte_ibpt?: boolean
  xml_autorizados?: string[]
  uf_emitente?: string
  ie_emitente?: string
  c_mun_emitente?: number | null
  ncm_padrao?: string | null
  tributo_aprox_federal_pct?: number
  tributo_aprox_estadual_pct?: number
  tributo_aprox_municipal_pct?: number
}

/** Garante que existe uma linha em empresas_config e atualiza apenas os campos fiscais. */
export function updateFiscalConfig(empresaId: string, data: UpdateFiscalConfigInput): EmpresaFiscalConfig | null {
  const db = getDb()
  if (!db) return null
  if (!getEmpresaById(empresaId)) return null

  const current = getFiscalConfig(empresaId)
  if (!current) return null

  const ambiente_fiscal = data.ambiente !== undefined ? (data.ambiente === 'homologacao' ? 0 : 1) : (current.ambiente === 'homologacao' ? 0 : 1)
  const serie_nfe = data.serie_nfe ?? current.serie_nfe
  const ultimo_numero_nfe = data.ultimo_numero_nfe ?? current.ultimo_numero_nfe
  const serie_nfce = data.serie_nfce ?? current.serie_nfce
  const ultimo_numero_nfce = data.ultimo_numero_nfce ?? current.ultimo_numero_nfce
  const csc_nfce = data.csc_nfce !== undefined ? (data.csc_nfce?.trim() || null) : current.csc_nfce
  const csc_id_nfce = data.csc_id_nfce !== undefined ? (data.csc_id_nfce?.trim() || null) : current.csc_id_nfce
  const indicar_fonte_ibpt = data.indicar_fonte_ibpt !== undefined ? data.indicar_fonte_ibpt : current.indicar_fonte_ibpt
  const xml_autorizados = data.xml_autorizados ?? current.xml_autorizados
  const uf_emitente = (data.uf_emitente ?? current.uf_emitente)?.trim()?.toUpperCase()?.slice(0, 2) || 'SP'
  const ie_emitente = (data.ie_emitente ?? current.ie_emitente)?.trim() || 'ISENTO'
  const c_mun_emitente = data.c_mun_emitente !== undefined ? data.c_mun_emitente : current.c_mun_emitente
  const ncm_padrao = data.ncm_padrao !== undefined ? (data.ncm_padrao?.trim() || null) : current.ncm_padrao
  const tributo_aprox_federal_pct = data.tributo_aprox_federal_pct ?? current.tributo_aprox_federal_pct
  const tributo_aprox_estadual_pct = data.tributo_aprox_estadual_pct ?? current.tributo_aprox_estadual_pct
  const tributo_aprox_municipal_pct = data.tributo_aprox_municipal_pct ?? current.tributo_aprox_municipal_pct
  const xml_autorizados_json = JSON.stringify(Array.isArray(xml_autorizados) ? xml_autorizados : [])

  const existingRow = db.prepare('SELECT empresa_id FROM empresas_config WHERE empresa_id = ?').get(empresaId)
  if (existingRow) {
    db.prepare(
      `UPDATE empresas_config SET
        ambiente_fiscal = ?, serie_nfe = ?, ultimo_numero_nfe = ?, serie_nfce = ?, ultimo_numero_nfce = ?,
        csc_nfce = ?, csc_id_nfce = ?, indicar_fonte_ibpt = ?, xml_autorizados_json = ?, uf_emitente = ?, ie_emitente = ?, c_mun_emitente = ?, ncm_padrao = ?,
        tributo_aprox_federal_pct = ?, tributo_aprox_estadual_pct = ?, tributo_aprox_municipal_pct = ?, updated_at = datetime('now')
       WHERE empresa_id = ?`
    ).run(
      ambiente_fiscal,
      serie_nfe,
      ultimo_numero_nfe,
      serie_nfce,
      ultimo_numero_nfce,
      csc_nfce,
      csc_id_nfce,
      indicar_fonte_ibpt ? 1 : 0,
      xml_autorizados_json,
      uf_emitente,
      ie_emitente,
      c_mun_emitente,
      ncm_padrao,
      tributo_aprox_federal_pct,
      tributo_aprox_estadual_pct,
      tributo_aprox_municipal_pct,
      empresaId
    )
  } else {
    db.prepare(
      `INSERT INTO empresas_config (empresa_id, cor_primaria, ambiente_fiscal, serie_nfe, ultimo_numero_nfe, serie_nfce, ultimo_numero_nfce, csc_nfce, csc_id_nfce, indicar_fonte_ibpt, xml_autorizados_json, uf_emitente, ie_emitente, c_mun_emitente, ncm_padrao, tributo_aprox_federal_pct, tributo_aprox_estadual_pct, tributo_aprox_municipal_pct, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      empresaId,
      '#1d4ed8',
      ambiente_fiscal,
      serie_nfe,
      ultimo_numero_nfe,
      serie_nfce,
      ultimo_numero_nfce,
      csc_nfce,
      csc_id_nfce,
      indicar_fonte_ibpt ? 1 : 0,
      xml_autorizados_json,
      uf_emitente,
      ie_emitente,
      c_mun_emitente ?? null,
      ncm_padrao,
      tributo_aprox_federal_pct,
      tributo_aprox_estadual_pct,
      tributo_aprox_municipal_pct
    )
  }

  queueEmpresasConfigMirrorSync(empresaId)
  return getFiscalConfig(empresaId)
}
