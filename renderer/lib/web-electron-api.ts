/**
 * Implementação da electronAPI usando Supabase diretamente para o modo web (browser).
 * Injeta window.electronAPI quando o app não está rodando dentro do Electron.
 */
import { supabase } from './supabase'
import { verificarSenhaWeb } from './web-crypto'
import type {
  Empresa,
  EmpresaConfig,
  EmpresaFiscalConfig,
  UpdateEmpresaConfigInput,
  UpdateFiscalConfigInput,
  Usuario,
  UsuarioSession,
  AppSession,
  Produto,
  CreateProdutoInput,
  UpdateProdutoInput,
  Cliente,
  Fornecedor,
  FornecedorHistoricoItem,
  CreateFornecedorInput,
  UpdateFornecedorInput,
  Categoria,
  CategoriaTreeNode,
  Marca,
  EstoqueMovimento,
  ProdutoSaldo,
  RegistrarMovimentoInput,
  Caixa,
  CaixaMovimento,
  RegistrarMovimentoCaixaInput,
  CaixaResumoFechamento,
  Venda,
  VendaComNfce,
  FinalizarVendaInput,
  NfceListItem,
  NfeListItem,
  NfeStatus,
  StatusNfce,
} from '../vite-env'

const SESSION_KEY = 'agiliza_web_session'

function saveSession(session: AppSession | null): void {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } else {
    localStorage.removeItem(SESSION_KEY)
  }
}

function loadSession(): AppSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AppSession
  } catch {
    return null
  }
}

function notSupported(name: string): never {
  throw new Error(`[web mode] ${name} não disponível no modo web.`)
}

function contribuicaoSaldoFromTipo(tipo: string, quantidade: number): number {
  switch (tipo) {
    case 'ENTRADA':
    case 'DEVOLUCAO':
      return quantidade
    case 'SAIDA':
      return -quantidade
    case 'AJUSTE':
      return quantidade
    default:
      return 0
  }
}

/** Nome do cliente em join `vendas → clientes` (Supabase pode devolver objeto ou array de 1). */
function webClienteNomeFromJoin(clientes: unknown): string | null {
  if (clientes == null) return null
  if (Array.isArray(clientes)) {
    const first = clientes[0] as { nome?: string } | undefined
    const n = first?.nome?.trim()
    return n || null
  }
  const n = (clientes as { nome?: string }).nome?.trim()
  return n || null
}

const WEB_IN_CHUNK = 100

async function supabaseSelectInChunks<T>(
  table: string,
  selectFields: string,
  inColumn: string,
  ids: string[],
  extra?: (q: ReturnType<(typeof supabase)['from']>) => ReturnType<(typeof supabase)['from']>
): Promise<T[]> {
  if (ids.length === 0) return []
  const acc: T[] = []
  for (let i = 0; i < ids.length; i += WEB_IN_CHUNK) {
    const slice = ids.slice(i, i + WEB_IN_CHUNK)
    let q = supabase.from(table).select(selectFields).in(inColumn, slice)
    if (extra) q = extra(q)
    const { data, error } = await q
    if (error) return []
    acc.push(...((data ?? []) as T[]))
  }
  return acc
}

/** Saldo = soma dos movimentos (igual ao backend local). */
async function getSaldoProdutoFromMovimentos(empresaId: string, produtoId: string): Promise<number> {
  const { data, error } = await supabase
    .from('estoque_movimentos')
    .select('tipo, quantidade')
    .eq('empresa_id', empresaId)
    .eq('produto_id', produtoId)
  if (error) throw error
  let acc = 0
  for (const row of data ?? []) {
    const r = row as { tipo?: string; quantidade?: unknown }
    const q = Number(r.quantidade)
    if (!Number.isFinite(q)) continue
    acc += contribuicaoSaldoFromTipo(String(r.tipo ?? ''), q)
  }
  return acc
}

async function selectUsuariosForAuth(empresaId: string, normalizedLogin: string): Promise<Record<string, unknown>[]> {
  const fullSelect = 'id, empresa_id, nome, login, role, modulos_json, created_at, senha_hash'
  const fallbackSelect = 'id, empresa_id, nome, login, role, created_at, senha_hash'

  const primary = await supabase
    .from('usuarios')
    .select(fullSelect)
    .eq('empresa_id', empresaId)
    .ilike('login', normalizedLogin)

  if (!primary.error) return (primary.data ?? []) as Record<string, unknown>[]
  if (!primary.error.message.includes('modulos_json')) {
    throw new Error(`Falha ao consultar usuarios no Supabase: ${primary.error.message}`)
  }

  const retry = await supabase
    .from('usuarios')
    .select(fallbackSelect)
    .eq('empresa_id', empresaId)
    .ilike('login', normalizedLogin)
  if (retry.error) throw new Error(`Falha ao consultar usuarios no Supabase: ${retry.error.message}`)
  return (retry.data ?? []) as Record<string, unknown>[]
}

async function selectUsuariosFallbackByLogin(normalizedLogin: string): Promise<Record<string, unknown>[]> {
  const fullSelect = 'id, empresa_id, nome, login, role, modulos_json, created_at, senha_hash'
  const fallbackSelect = 'id, empresa_id, nome, login, role, created_at, senha_hash'

  const primary = await supabase
    .from('usuarios')
    .select(fullSelect)
    .ilike('login', normalizedLogin)

  if (!primary.error) return (primary.data ?? []) as Record<string, unknown>[]
  if (!primary.error.message.includes('modulos_json')) {
    throw new Error(`Falha no fallback de usuarios: ${primary.error.message}`)
  }

  const retry = await supabase
    .from('usuarios')
    .select(fallbackSelect)
    .ilike('login', normalizedLogin)
  if (retry.error) throw new Error(`Falha no fallback de usuarios: ${retry.error.message}`)
  return (retry.data ?? []) as Record<string, unknown>[]
}

async function selectUsuariosByEmpresa(empresaId: string): Promise<Record<string, unknown>[]> {
  const fullSelect = 'id, empresa_id, nome, login, role, modulos_json, created_at'
  const fallbackSelect = 'id, empresa_id, nome, login, role, created_at'

  const primary = await supabase
    .from('usuarios')
    .select(fullSelect)
    .eq('empresa_id', empresaId)
    .order('nome')

  if (!primary.error) return (primary.data ?? []) as Record<string, unknown>[]
  if (!primary.error.message.includes('modulos_json')) {
    throw new Error(`Falha ao listar usuarios no Supabase: ${primary.error.message}`)
  }

  const retry = await supabase
    .from('usuarios')
    .select(fallbackSelect)
    .eq('empresa_id', empresaId)
    .order('nome')
  if (retry.error) throw new Error(`Falha ao listar usuarios no Supabase: ${retry.error.message}`)
  return (retry.data ?? []) as Record<string, unknown>[]
}

async function selectUsuarioById(id: string): Promise<Record<string, unknown> | null> {
  const fullSelect = 'id, empresa_id, nome, login, role, modulos_json, created_at'
  const fallbackSelect = 'id, empresa_id, nome, login, role, created_at'

  const primary = await supabase
    .from('usuarios')
    .select(fullSelect)
    .eq('id', id)
    .maybeSingle()

  if (!primary.error) return (primary.data as Record<string, unknown> | null) ?? null
  if (!primary.error.message.includes('modulos_json')) {
    throw new Error(`Falha ao consultar usuario no Supabase: ${primary.error.message}`)
  }

  const retry = await supabase
    .from('usuarios')
    .select(fallbackSelect)
    .eq('id', id)
    .maybeSingle()
  if (retry.error) throw new Error(`Falha ao consultar usuario no Supabase: ${retry.error.message}`)
  return (retry.data as Record<string, unknown> | null) ?? null
}

function buildCategoriaTree(categorias: Categoria[]): CategoriaTreeNode[] {
  const map = new Map<string, CategoriaTreeNode>()
  for (const cat of categorias) {
    map.set(cat.id, { ...cat, children: [] })
  }
  const roots: CategoriaTreeNode[] = []
  for (const node of map.values()) {
    if (node.parent_id) {
      const parent = map.get(node.parent_id)
      if (parent) parent.children.push(node)
      else roots.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

export const webElectronAPI: Window['electronAPI'] = {
  ping: async () => 'pong',

  // ── Empresas ─────────────────────────────────────────────────────────────
  empresas: {
    list: async (): Promise<Empresa[]> => {
      const { data, error } = await supabase
        .from('empresas')
        .select('id, nome, cnpj, created_at')
        .order('nome')
      if (error) throw error
      return (data ?? []) as Empresa[]
    },
    create: async (d) => {
      const { data, error } = await supabase
        .from('empresas')
        .insert({ id: crypto.randomUUID(), nome: d.nome, cnpj: d.cnpj ?? null })
        .select('id, nome, cnpj, created_at')
        .single()
      if (error) throw error
      return data as Empresa
    },
    getConfig: async (empresaId): Promise<EmpresaConfig | null> => {
      // No Supabase, os campos "cor_primaria", "razao_social", etc vivem em `empresas_config`.
      const { data: empresa, error: errEmpresa } = await supabase
        .from('empresas')
        .select('id, nome, cnpj, created_at')
        .eq('id', empresaId)
        .maybeSingle()
      if (errEmpresa) throw errEmpresa
      if (!empresa) return null

      const { data: config, error: errConfig } = await supabase
        .from('empresas_config')
        .select('*')
        .eq('empresa_id', empresaId)
        .maybeSingle()
      if (errConfig) throw errConfig

      const merged = { ...(empresa as Record<string, unknown>), ...(config ?? {}) } as Record<string, unknown>
      const rawLayout = merged.cupom_layout_pagina
      if (typeof rawLayout !== 'string' || !String(rawLayout).trim()) {
        merged.cupom_layout_pagina = 'compat'
      }
      return merged as EmpresaConfig
    },
    updateConfig: async (empresaId, d: UpdateEmpresaConfigInput): Promise<EmpresaConfig | null> => {
      // Atualiza `empresas` (nome/cnpj) e `empresas_config` (fiscal/design/etc) separadamente.
      const empresaUpdates: Record<string, unknown> = {}
      const configUpdates: Record<string, unknown> = {}

      if (d.nome !== undefined) empresaUpdates.nome = d.nome
      if (d.cnpj !== undefined) empresaUpdates.cnpj = d.cnpj

      if (d.razao_social !== undefined) configUpdates.razao_social = d.razao_social
      if (d.endereco !== undefined) configUpdates.endereco = d.endereco
      if (d.telefone !== undefined) configUpdates.telefone = d.telefone
      if (d.email !== undefined) configUpdates.email = d.email
      if (d.logo !== undefined) configUpdates.logo = d.logo
      if (d.cor_primaria !== undefined) configUpdates.cor_primaria = d.cor_primaria
      if ((d as { impressora_cupom?: unknown }).impressora_cupom !== undefined) {
        configUpdates.impressora_cupom = (d as { impressora_cupom?: unknown }).impressora_cupom
      }
      if ((d as { cupom_layout_pagina?: unknown }).cupom_layout_pagina !== undefined) {
        configUpdates.cupom_layout_pagina = (d as { cupom_layout_pagina?: unknown }).cupom_layout_pagina
      }

      if (d.modulos !== undefined) {
        configUpdates.modulos_json = JSON.stringify(d.modulos)
      }

      if (Object.keys(empresaUpdates).length > 0) {
        const { error: errEmpresa } = await supabase
          .from('empresas')
          .update(empresaUpdates)
          .eq('id', empresaId)
        if (errEmpresa) throw errEmpresa
      }

      if (Object.keys(configUpdates).length > 0) {
        const payload = { empresa_id: empresaId, ...configUpdates }

        const upsertAttempt = async (p: Record<string, unknown>) => {
          const { error: errCfg } = await supabase
            .from('empresas_config')
            .upsert(p, { onConflict: 'empresa_id' })
          if (errCfg) throw errCfg
        }

        let attemptPayload: Record<string, unknown> = { ...payload }
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            await upsertAttempt(attemptPayload)
            break
          } catch (err) {
            const msg = String((err as { message?: unknown })?.message ?? err)
            if (msg.includes('impressora_cupom')) {
              const { impressora_cupom: _i, ...rest } = attemptPayload
              attemptPayload = rest
              continue
            }
            if (msg.includes('cupom_layout_pagina')) {
              const { cupom_layout_pagina: _c, ...rest } = attemptPayload
              attemptPayload = rest
              continue
            }
            throw err
          }
        }
      }

      // Recarrega a configuração completa (gera resposta consistente com o getConfig).
      const { data: empresa, error: errEmpresa } = await supabase
        .from('empresas')
        .select('id, nome, cnpj, created_at')
        .eq('id', empresaId)
        .maybeSingle()
      if (errEmpresa) throw errEmpresa
      if (!empresa) return null

      const { data: config, error: errConfig } = await supabase
        .from('empresas_config')
        .select('*')
        .eq('empresa_id', empresaId)
        .maybeSingle()
      if (errConfig) throw errConfig

      const merged = { ...(empresa as Record<string, unknown>), ...(config ?? {}) } as Record<string, unknown>
      const rawLayout = merged.cupom_layout_pagina
      if (typeof rawLayout !== 'string' || !String(rawLayout).trim()) {
        merged.cupom_layout_pagina = 'compat'
      }
      return merged as EmpresaConfig
    },
    getFiscalConfig: async (empresaId): Promise<EmpresaFiscalConfig | null> => {
      const { data, error } = await supabase
        .from('empresa_fiscal_config')
        .select('*')
        .eq('empresa_id', empresaId)
        .maybeSingle()
      if (error) throw error
      return data as EmpresaFiscalConfig | null
    },
    updateFiscalConfig: async (empresaId, d: UpdateFiscalConfigInput): Promise<EmpresaFiscalConfig | null> => {
      const { data, error } = await supabase
        .from('empresa_fiscal_config')
        .upsert({ ...d, empresa_id: empresaId }, { onConflict: 'empresa_id' })
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data as EmpresaFiscalConfig | null
    },
  },

  // ── Usuários ──────────────────────────────────────────────────────────────
  usuarios: {
    list: async (empresaId): Promise<Usuario[]> => {
      const rows = await selectUsuariosByEmpresa(empresaId)
      return rows.map((r) => ({
        id: r.id as string,
        empresa_id: r.empresa_id as string,
        nome: r.nome as string,
        login: r.login as string,
        role: r.role as string,
        modulos_json: (r.modulos_json as string | null) ?? null,
        created_at: r.created_at as string,
      }))
    },
    get: async (id): Promise<Usuario | null> => {
      const row = await selectUsuarioById(id)
      if (!row) return null
      return {
        id: row.id as string,
        empresa_id: row.empresa_id as string,
        nome: row.nome as string,
        login: row.login as string,
        role: row.role as string,
        modulos_json: (row.modulos_json as string | null) ?? null,
        created_at: row.created_at as string,
      } as Usuario
    },
    create: async (d) => {
      // Hashing de senha não disponível no frontend - requer backend/Edge Function
      notSupported('usuarios.create')
    },
    update: async (id, d) => {
      notSupported('usuarios.update')
    },
  },

  // ── Produtos ──────────────────────────────────────────────────────────────
  produtos: {
    list: async (empresaId, options): Promise<Produto[]> => {
      let query = supabase
        .from('produtos')
        .select('*')
        .eq('empresa_id', empresaId)
      if (options?.apenasAtivos) query = query.eq('ativo', 1)
      if (options?.search) {
        query = query.or(`nome.ilike.%${options.search}%,codigo_barras.ilike.%${options.search}%`)
      }
      query = query.order('nome')
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as Produto[]
    },
    get: async (id): Promise<Produto | null> => {
      const { data, error } = await supabase.from('produtos').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data as Produto | null
    },
    getNextCodigo: async (empresaId): Promise<number> => {
      const { data, error } = await supabase
        .from('produtos')
        .select('codigo')
        .eq('empresa_id', empresaId)
        .order('codigo', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return ((data?.codigo as number | null) ?? 0) + 1
    },
    create: async (d: CreateProdutoInput): Promise<Produto> => {
      const { data, error } = await supabase
        .from('produtos')
        .insert({ ...d, id: crypto.randomUUID() })
        .select('*')
        .single()
      if (error) throw error
      return data as Produto
    },
    update: async (id, d: UpdateProdutoInput): Promise<Produto | null> => {
      const { data, error } = await supabase
        .from('produtos')
        .update({ ...d, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data as Produto | null
    },
    ensureNfeAvulsa: async (_empresaId: string): Promise<{ ok: false; error: string }> => ({
      ok: false,
      error: 'NF-e avulsa disponível apenas no aplicativo desktop (banco local).',
    }),
  },

  // ── Clientes ──────────────────────────────────────────────────────────────
  clientes: {
    list: async (empresaId): Promise<Cliente[]> => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nome')
      if (error) throw error
      return (data ?? []) as Cliente[]
    },
    create: async (d) => {
      const { data, error } = await supabase
        .from('clientes')
        .insert({ ...d, id: crypto.randomUUID() })
        .select('*')
        .single()
      if (error) throw error
      return data as Cliente
    },
    update: async (id, d) => {
      const { data, error } = await supabase
        .from('clientes')
        .update(d)
        .eq('id', id)
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data as Cliente | null
    },
  },

  // ── Fornecedores ──────────────────────────────────────────────────────────
  fornecedores: {
    list: async (empresaId): Promise<Fornecedor[]> => {
      const { data, error } = await supabase
        .from('fornecedores')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('razao_social')
      if (error) throw error
      return (data ?? []) as Fornecedor[]
    },
    get: async (id): Promise<Fornecedor | null> => {
      const { data, error } = await supabase.from('fornecedores').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data as Fornecedor | null
    },
    historico: async (id): Promise<FornecedorHistoricoItem[]> => {
      const { data, error } = await supabase
        .from('fornecedores_historico')
        .select('*')
        .eq('fornecedor_id', id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as FornecedorHistoricoItem[]
    },
    create: async (d: CreateFornecedorInput): Promise<Fornecedor> => {
      const row = { ...d, id: crypto.randomUUID() }
      const { data, error } = await supabase.from('fornecedores').insert(row).select('*').single()
      if (error) throw error
      return data as Fornecedor
    },
    update: async (id, d: UpdateFornecedorInput): Promise<Fornecedor | null> => {
      const { data, error } = await supabase.from('fornecedores').update(d).eq('id', id).select('*').maybeSingle()
      if (error) throw error
      return data as Fornecedor | null
    },
    delete: async (id): Promise<{ ok: boolean; error?: string }> => {
      const { count, error: errCount } = await supabase
        .from('produtos')
        .select('id', { count: 'exact', head: true })
        .eq('fornecedor_id', id)
      if (errCount) throw errCount
      if ((count ?? 0) > 0) {
        return { ok: false, error: 'Há produtos vinculados. Inative o cadastro em vez de excluir.' }
      }
      const { error } = await supabase.from('fornecedores').delete().eq('id', id)
      if (error) throw error
      return { ok: true }
    },
  },

  // ── Categorias ────────────────────────────────────────────────────────────
  categorias: {
    list: async (empresaId): Promise<Categoria[]> => {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('ordem')
      if (error) throw error
      return (data ?? []) as Categoria[]
    },
    listTree: async (empresaId): Promise<CategoriaTreeNode[]> => {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('ordem')
      if (error) throw error
      return buildCategoriaTree((data ?? []) as Categoria[])
    },
    listFolha: async (empresaId): Promise<Categoria[]> => {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('ordem')
      if (error) throw error
      const all = (data ?? []) as Categoria[]
      const parentIds = new Set(all.map((c) => c.parent_id).filter(Boolean))
      return all.filter((c) => !parentIds.has(c.id))
    },
    get: async (id): Promise<Categoria | null> => {
      const { data, error } = await supabase.from('categorias').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data as Categoria | null
    },
    getPath: async (id): Promise<string> => {
      // Resolve o caminho completo da categoria (pai > filho > ...)
      const parts: string[] = []
      let currentId: string | null = id
      while (currentId) {
        const { data } = await supabase.from('categorias').select('id, nome, parent_id').eq('id', currentId).maybeSingle()
        if (!data) break
        parts.unshift(data.nome as string)
        currentId = data.parent_id as string | null
      }
      return parts.join(' > ')
    },
    create: async (d) => {
      const { data, error } = await supabase
        .from('categorias')
        .insert({ ...d, id: crypto.randomUUID() })
        .select('*')
        .single()
      if (error) throw error
      return data as Categoria
    },
    update: async (id, d) => {
      const { data, error } = await supabase
        .from('categorias')
        .update(d)
        .eq('id', id)
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data as Categoria | null
    },
    delete: async (id): Promise<boolean> => {
      const { error } = await supabase.from('categorias').delete().eq('id', id)
      return !error
    },
  },

  // ── Marcas ────────────────────────────────────────────────────────────────
  marcas: {
    list: async (empresaId): Promise<Marca[]> => {
      const { data, error } = await supabase
        .from('marcas')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nome')
      if (error) throw error
      return (data ?? []) as Marca[]
    },
    get: async (id): Promise<Marca | null> => {
      const { data, error } = await supabase.from('marcas').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data as Marca | null
    },
    create: async (d) => {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('marcas')
        .insert({ ...d, id: crypto.randomUUID(), created_at: now, updated_at: now })
        .select('*')
        .single()
      if (error) throw error
      return data as Marca
    },
    update: async (id, d) => {
      const { data, error } = await supabase
        .from('marcas')
        .update({ ...d, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data as Marca | null
    },
    delete: async (id): Promise<boolean> => {
      const { error } = await supabase.from('marcas').delete().eq('id', id)
      return !error
    },
  },

  // ── Estoque ───────────────────────────────────────────────────────────────
  estoque: {
    listMovimentos: async (empresaId, options): Promise<EstoqueMovimento[]> => {
      let query = supabase
        .from('estoque_movimentos')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
      if (options?.produtoId) query = query.eq('produto_id', options.produtoId)
      if (options?.limit) query = query.limit(options.limit)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as EstoqueMovimento[]
    },
    getSaldo: async (empresaId, produtoId): Promise<number> => {
      return getSaldoProdutoFromMovimentos(empresaId, produtoId)
    },
    listSaldos: async (empresaId): Promise<ProdutoSaldo[]> => {
      const [prodRes, movRes] = await Promise.all([
        supabase
          .from('produtos')
          .select('id, nome, unidade, estoque_minimo')
          .eq('empresa_id', empresaId)
          .eq('ativo', 1)
          .eq('controla_estoque', 1)
          .order('nome'),
        supabase.from('estoque_movimentos').select('produto_id, tipo, quantidade').eq('empresa_id', empresaId),
      ])
      if (prodRes.error) throw prodRes.error
      if (movRes.error) throw movRes.error
      const saldoMap = new Map<string, number>()
      for (const row of movRes.data ?? []) {
        const r = row as { produto_id?: string; tipo?: string; quantidade?: unknown }
        if (!r.produto_id) continue
        const q = Number(r.quantidade)
        if (!Number.isFinite(q)) continue
        const delta = contribuicaoSaldoFromTipo(String(r.tipo ?? ''), q)
        saldoMap.set(r.produto_id, (saldoMap.get(r.produto_id) ?? 0) + delta)
      }
      return (prodRes.data ?? []).map((r: Record<string, unknown>) => ({
        produto_id: r.id as string,
        nome: r.nome as string,
        unidade: r.unidade as string,
        saldo: saldoMap.get(r.id as string) ?? 0,
        estoque_minimo: (r.estoque_minimo as number | null) ?? 0,
      }))
    },
    registrarMovimento: async (d: RegistrarMovimentoInput): Promise<EstoqueMovimento> => {
      const { data, error } = await supabase
        .from('estoque_movimentos')
        .insert({ ...d, id: crypto.randomUUID(), created_at: new Date().toISOString() })
        .select('*')
        .single()
      if (error) throw error
      const novoSaldo = await getSaldoProdutoFromMovimentos(d.empresa_id, d.produto_id)
      const up = await supabase
        .from('produtos')
        .update({ estoque_atual: novoSaldo })
        .eq('id', d.produto_id)
        .eq('empresa_id', d.empresa_id)
      if (up.error) throw up.error
      return data as EstoqueMovimento
    },
    ajustarSaldoPara: async (): Promise<void> => {
      notSupported('estoque.ajustarSaldoPara')
    },
  },

  // ── Caixa ─────────────────────────────────────────────────────────────────
  caixa: {
    getAberto: async (empresaId): Promise<Caixa | null> => {
      const { data, error } = await supabase
        .from('caixas')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('status', 'ABERTO')
        .maybeSingle()
      if (error) throw error
      return data as Caixa | null
    },
    abrir: async (empresaId, usuarioId, valorInicial): Promise<Caixa> => {
      const { data, error } = await supabase
        .from('caixas')
        .insert({
          id: crypto.randomUUID(),
          empresa_id: empresaId,
          usuario_id: usuarioId,
          status: 'ABERTO',
          valor_inicial: valorInicial,
          aberto_em: new Date().toISOString(),
        })
        .select('*')
        .single()
      if (error) throw error
      return data as Caixa
    },
    fechar: async (caixaId): Promise<Caixa | null> => {
      const { data, error } = await supabase
        .from('caixas')
        .update({ status: 'FECHADO', fechado_em: new Date().toISOString() })
        .eq('id', caixaId)
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data as Caixa | null
    },
    list: async (empresaId, limit): Promise<Caixa[]> => {
      let query = supabase
        .from('caixas')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('aberto_em', { ascending: false })
      if (limit) query = query.limit(limit)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as Caixa[]
    },
    getSaldo: async (caixaId): Promise<number> => {
      const { data: caixa, error: errCaixa } = await supabase
        .from('caixas')
        .select('valor_inicial')
        .eq('id', caixaId)
        .maybeSingle()
      if (errCaixa) throw errCaixa
      const valorInicial = (caixa?.valor_inicial as number | null) ?? 0

      const { data: movs, error: errMovs } = await supabase
        .from('caixa_movimentos')
        .select('tipo, valor')
        .eq('caixa_id', caixaId)
      if (errMovs) throw errMovs

      let saldo = valorInicial
      for (const m of movs ?? []) {
        if ((m as { tipo: string }).tipo === 'SUPRIMENTO') saldo += (m as { valor: number }).valor
        else saldo -= (m as { valor: number }).valor
      }
      return saldo
    },
    getResumoFechamento: async (caixaId): Promise<CaixaResumoFechamento> => {
      const { data: caixa } = await supabase.from('caixas').select('valor_inicial').eq('id', caixaId).maybeSingle()
      const { data: movs } = await supabase.from('caixa_movimentos').select('tipo, valor').eq('caixa_id', caixaId)

      let saldo_base = (caixa?.valor_inicial as number | null) ?? 0
      for (const m of movs ?? []) {
        if ((m as { tipo: string }).tipo === 'SUPRIMENTO') saldo_base += (m as { valor: number }).valor
        else saldo_base -= (m as { valor: number }).valor
      }

      const { data: vendasRows } = await supabase
        .from('vendas')
        .select('id, total, status, venda_a_prazo')
        .eq('caixa_id', caixaId)
        .eq('status', 'CONCLUIDA')

      const vendaIds = (vendasRows ?? []).map((v: { id: string }) => v.id)
      const prazoPorPagamento = new Set<string>()
      if (vendaIds.length > 0) {
        const { data: pagsPrazo } = await supabase.from('pagamentos').select('venda_id').eq('forma', 'A_PRAZO').in('venda_id', vendaIds)
        for (const p of pagsPrazo ?? []) {
          prazoPorPagamento.add((p as { venda_id: string }).venda_id)
        }
      }

      const isVendaPrazo = (v: { id: string; venda_a_prazo?: number }) =>
        Number(v.venda_a_prazo) === 1 || prazoPorPagamento.has(v.id)

      let total_vendas_caixa = 0
      for (const v of vendasRows ?? []) {
        if (!isVendaPrazo(v as { id: string; venda_a_prazo?: number })) {
          total_vendas_caixa += Number((v as { total: number }).total)
        }
      }

      let total_recebimentos_prazo = 0
      const { data: recRows, error: recErr } = await supabase
        .from('contas_receber')
        .select('valor, forma_recebimento')
        .eq('recebimento_caixa_id', caixaId)
        .eq('status', 'RECEBIDA')
      if (!recErr && recRows) {
        for (const r of recRows) {
          total_recebimentos_prazo += Number((r as { valor: number }).valor)
        }
      }

      const saldo_atual = saldo_base + total_vendas_caixa + total_recebimentos_prazo

      const totaisMap: Record<string, number> = {}
      if (vendaIds.length > 0) {
        const { data: pags } = await supabase.from('pagamentos').select('venda_id, forma, valor').in('venda_id', vendaIds)
        for (const p of pags ?? []) {
          const pv = p as { venda_id: string; forma: string; valor: number }
          const rowV = (vendasRows ?? []).find((x: { id: string }) => x.id === pv.venda_id)
          if (!rowV || isVendaPrazo(rowV as { id: string; venda_a_prazo?: number })) continue
          if (pv.forma === 'A_PRAZO') continue
          totaisMap[pv.forma] = (totaisMap[pv.forma] ?? 0) + Number(pv.valor)
        }
        if (!recErr && recRows) {
          for (const r of recRows) {
            const fr = (r as { forma_recebimento: string | null; valor: number }).forma_recebimento
            if (fr) {
              totaisMap[fr] = (totaisMap[fr] ?? 0) + Number((r as { valor: number }).valor)
            }
          }
        }
      }

      const totais_por_forma = Object.entries(totaisMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([forma, total]) => ({
          forma: forma as CaixaResumoFechamento['totais_por_forma'][number]['forma'],
          total,
        }))

      return { saldo_atual, totais_por_forma }
    },
    imprimirFechamento: async () => ({ ok: false, error: 'Impressão não disponível no modo web.' }),
    getHtmlFechamento: async () => null,
    listMovimentos: async (caixaId): Promise<CaixaMovimento[]> => {
      const { data, error } = await supabase
        .from('caixa_movimentos')
        .select('*')
        .eq('caixa_id', caixaId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as CaixaMovimento[]
    },
    registrarMovimento: async (d: RegistrarMovimentoCaixaInput): Promise<CaixaMovimento> => {
      const { data, error } = await supabase
        .from('caixa_movimentos')
        .insert({ ...d, id: crypto.randomUUID(), created_at: new Date().toISOString() })
        .select('*')
        .single()
      if (error) throw error
      return data as CaixaMovimento
    },
  },

  // ── Vendas ────────────────────────────────────────────────────────────────
  vendas: {
    finalizar: async (_d: FinalizarVendaInput): Promise<Venda> => {
      notSupported('vendas.finalizar')
    },
    list: async (empresaId, options): Promise<VendaComNfce[]> => {
      let query = supabase
        .from('vendas')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
      if (options?.limit) query = query.limit(options.limit)
      if (options?.dataInicio) query = query.gte('created_at', options.dataInicio)
      if (options?.dataFim) query = query.lte('created_at', options.dataFim)
      if (options?.periodo === 'hoje') {
        const hoje = new Date()
        hoje.setHours(0, 0, 0, 0)
        query = query.gte('created_at', hoje.toISOString())
      } else if (options?.periodo === 'semana') {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        query = query.gte('created_at', d.toISOString())
      } else if (options?.periodo === 'mes') {
        const d = new Date()
        d.setDate(1)
        d.setHours(0, 0, 0, 0)
        query = query.gte('created_at', d.toISOString())
      }
      const { data, error } = await query
      if (error) throw error
      const rows = (data ?? []) as VendaComNfce[]
      const ids = rows.map((v) => v.id)
      if (ids.length === 0) return rows
      const { data: pagsPrazo } = await supabase.from('pagamentos').select('venda_id').eq('forma', 'A_PRAZO').in('venda_id', ids)
      const prazoSet = new Set((pagsPrazo ?? []).map((p: { venda_id: string }) => p.venda_id))
      return rows.map((v) => ({
        ...v,
        venda_a_prazo: prazoSet.has(v.id) || Number(v.venda_a_prazo) === 1 ? 1 : 0,
      }))
    },
    get: async (id): Promise<Venda | null> => {
      const { data, error } = await supabase.from('vendas').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data as Venda | null
    },
    cancelar: async (vendaId, _usuarioId): Promise<Venda | null> => {
      const { data, error } = await supabase
        .from('vendas')
        .update({ status: 'CANCELADA' })
        .eq('id', vendaId)
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data as Venda | null
    },
    updateCliente: async (vendaId, clienteId): Promise<Venda | null> => {
      const { data, error } = await supabase
        .from('vendas')
        .update({ cliente_id: clienteId })
        .eq('id', vendaId)
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data as Venda | null
    },
    getStatusNfce: async (_vendaId): Promise<StatusNfce | null> => null,
    emitirNfce: async () => ({ ok: false, error: 'Emissão NFC-e não disponível no modo web.' }),
    emitirNfe: async () => ({ ok: false, error: 'Emissão NF-e não disponível no modo web.' }),
  },

  // ── NFC-e ─────────────────────────────────────────────────────────────────
  nfce: {
    list: async (empresaId, options): Promise<NfceListItem[]> => {
      // Espelho Supabase: tabela `venda_nfce` (não `nfce`), FK em `vendas` — alinhado ao SQLite local.
      let vQuery = supabase
        .from('vendas')
        .select('id, numero, created_at, total, cliente_id, clientes(nome)')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
      if (options?.dataInicio) vQuery = vQuery.gte('created_at', options.dataInicio)
      if (options?.dataFim) vQuery = vQuery.lte('created_at', `${options.dataFim}T23:59:59.999`)
      const { data: vendasRows, error: vErr } = await vQuery
      if (vErr || !vendasRows?.length) return []
      const vendaIds = (vendasRows as { id: string }[]).map((v) => v.id)
      const notas = await supabaseSelectInChunks<Record<string, unknown>>(
        'venda_nfce',
        'venda_id, numero_nfce, status, chave, mensagem_sefaz',
        'venda_id',
        vendaIds,
        options?.status ? (q) => q.eq('status', options.status as string) : undefined
      )
      if (!notas.length) return []
      const vmap = new Map((vendasRows as Record<string, unknown>[]).map((v) => [v.id as string, v]))
      let rows: NfceListItem[] = notas.map((n) => {
        const v = vmap.get(n.venda_id as string)
        if (!v) return null
        return {
          venda_id: n.venda_id as string,
          numero_nfce: n.numero_nfce as number,
          status: n.status as NfceListItem['status'],
          chave: (n.chave as string) ?? null,
          mensagem_sefaz: (n.mensagem_sefaz as string) ?? null,
          venda_numero: v.numero as number,
          venda_created_at: String(v.created_at ?? ''),
          venda_total: Number(v.total),
          cliente_nome: webClienteNomeFromJoin(v.clientes),
        }
      }).filter((x): x is NfceListItem => x != null)
      if (options?.search?.trim()) {
        const t = options.search.trim().toLowerCase()
        rows = rows.filter(
          (r) =>
            String(r.numero_nfce).toLowerCase().includes(t) ||
            String(r.venda_numero).toLowerCase().includes(t) ||
            (r.cliente_nome && r.cliente_nome.toLowerCase().includes(t))
        )
      }
      rows.sort((a, b) => {
        const da = new Date(a.venda_created_at).getTime()
        const db = new Date(b.venda_created_at).getTime()
        return (Number.isFinite(db) ? db : 0) - (Number.isFinite(da) ? da : 0)
      })
      const lim = options?.limit ?? 1000
      return rows.slice(0, lim)
    },
  },

  // ── NF-e ──────────────────────────────────────────────────────────────────
  nfe: {
    previewDanfeA4: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
    getDanfePdfPath: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
    getDanfePdfDataUrl: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
    imprimirDanfeA4: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
    gerarDanfeA4: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
    list: async (empresaId, options): Promise<NfeListItem[]> => {
      // Espelho Supabase: `venda_nfe` (não `nfe`), mesma lógica que NFC-e / backend local.
      let vQuery = supabase
        .from('vendas')
        .select('id, numero, created_at, total, cliente_id, clientes(nome)')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
      if (options?.dataInicio) vQuery = vQuery.gte('created_at', options.dataInicio)
      if (options?.dataFim) vQuery = vQuery.lte('created_at', `${options.dataFim}T23:59:59.999`)
      const { data: vendasRows, error: vErr } = await vQuery
      if (vErr || !vendasRows?.length) return []
      const vendaIds = (vendasRows as { id: string }[]).map((v) => v.id)
      const notas = await supabaseSelectInChunks<Record<string, unknown>>(
        'venda_nfe',
        'venda_id, numero_nfe, status, chave, mensagem_sefaz, created_at',
        'venda_id',
        vendaIds,
        options?.status ? (q) => q.eq('status', options.status as string) : undefined
      )
      if (!notas.length) return []
      const vmap = new Map((vendasRows as Record<string, unknown>[]).map((v) => [v.id as string, v]))
      let rows: NfeListItem[] = notas.map((n) => {
        const v = vmap.get(n.venda_id as string)
        if (!v) return null
        return {
          venda_id: n.venda_id as string,
          numero_nfe: n.numero_nfe as number,
          status: n.status as NfeStatus,
          chave: (n.chave as string) ?? null,
          mensagem_sefaz: (n.mensagem_sefaz as string) ?? null,
          nfe_created_at: n.created_at != null ? String(n.created_at) : null,
          venda_numero: v.numero as number,
          venda_created_at: String(v.created_at ?? ''),
          venda_total: Number(v.total),
          cliente_nome: webClienteNomeFromJoin(v.clientes),
        }
      }).filter((x): x is NfeListItem => x != null)
      if (options?.search?.trim()) {
        const t = options.search.trim().toLowerCase()
        rows = rows.filter(
          (r) =>
            String(r.numero_nfe).toLowerCase().includes(t) ||
            String(r.venda_numero).toLowerCase().includes(t) ||
            (r.cliente_nome && r.cliente_nome.toLowerCase().includes(t))
        )
      }
      rows.sort((a, b) => {
        const da = new Date(a.nfe_created_at || a.venda_created_at).getTime()
        const db = new Date(b.nfe_created_at || b.venda_created_at).getTime()
        return (Number.isFinite(db) ? db : 0) - (Number.isFinite(da) ? da : 0)
      })
      const lim = options?.limit ?? 1000
      return rows.slice(0, lim)
    },
  },

  // ── App ───────────────────────────────────────────────────────────────────
  app: {
    getVersion: async () => 'web',
    getInstallMode: async () => 'unknown' as const,
    getUpdateState: async () => ({ phase: 'idle' as const }),
    checkForUpdates: async () => ({ phase: 'idle' as const }),
    installUpdateNow: async () => ({ ok: false, message: 'Não disponível no modo web.' }),
  },

  // ── Sync ─────────────────────────────────────────────────────────────────
  sync: {
    run: async () => ({ success: true, sent: 0, errors: 0, message: 'Sync não disponível no modo web.' }),
    getPendingCount: async () => 0,
    checkOnline: async () => true,
  },

  // ── Cupom ─────────────────────────────────────────────────────────────────
  cupom: {
    imprimir: async () => ({ ok: false, error: 'Impressão não disponível no modo web.' }),
    imprimirReciboRecebimento: async () => ({ ok: false, error: 'Impressão não disponível no modo web.' }),
    imprimirNfce: async () => ({ ok: false, error: 'Impressão não disponível no modo web.' }),
    getDetalhes: async () => null,
    getHtml: async () => null,
    getHtmlNfce: async () => null,
    listPrinters: async () => [],
    getPreviewHtml: async () => '',
  },

  cashback: {
    getConfig: async () => ({}),
    updateConfig: async () => ({}),
    listRegras: async () => [],
    createRegra: async () => ({}),
    deleteRegra: async () => false,
    getSaldoCliente: async () => null,
    getSaldoCpf: async () => null,
    listMovimentacoes: async () => [],
    listClientes: async () => [],
    ajusteManual: async () => ({ ok: false }),
    setBloqueio: async () => ({ ok: false }),
    relatorio: async () => ({
      total_gerado: 0,
      total_usado: 0,
      total_expirado: 0,
      total_ajuste_credito: 0,
      total_ajuste_debito: 0,
    }),
  },

  // ── Etiquetas ─────────────────────────────────────────────────────────────
  etiquetas: {
    listTemplates: async () => [],
    listPrinters: async () => [],
    getPrinterStatus: async (name) => ({ name, online: false, detail: 'Não disponível no modo web.' }),
    preview: async () => notSupported('etiquetas.preview'),
    print: async () => ({ ok: false, error: 'Impressão não disponível no modo web.' }),
    imprimir: async () => ({ ok: false, error: 'Impressão não disponível no modo web.' }),
  },

  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: {
    login: async (empresaId: string, login: string, senha: string): Promise<UsuarioSession | null> => {
      const normalizedLogin = login.trim()
      if (!normalizedLogin) throw new Error('Informe o login.')
      let candidateRows = await selectUsuariosForAuth(empresaId, normalizedLogin)
      if (candidateRows.length === 0) {
        // Fallback para casos em que o usuário existe no Supabase, mas a empresa
        // selecionada no login não corresponde ao vínculo do registro.
        candidateRows = await selectUsuariosFallbackByLogin(normalizedLogin)
        if (candidateRows.length === 0) throw new Error('Usuario nao encontrado no Supabase.')
      }
      const rowsByLogin = candidateRows.filter((r) => {
        const dbLogin = String(r.login ?? '').trim().toLowerCase()
        return dbLogin === normalizedLogin.toLowerCase()
      })
      if (rowsByLogin.length === 0) throw new Error('Usuario nao encontrado apos normalizacao do login.')
      let row: Record<string, unknown> | null = null
      for (const candidate of rowsByLogin) {
        const senhaHash = candidate.senha_hash as string | null
        if (!senhaHash) continue
        const ok = await verificarSenhaWeb(senha, senhaHash)
        if (ok) {
          row = candidate
          break
        }
      }
      if (!row) throw new Error('Senha invalida para o formato de hash salvo no Supabase.')
      const session: UsuarioSession = {
        id: row.id as string,
        empresa_id: row.empresa_id as string,
        nome: row.nome as string,
        login: row.login as string,
        role: row.role as string,
        modulos_json: (row.modulos_json as string | null) ?? null,
        created_at: row.created_at as string,
      }
      saveSession(session)
      return session
    },
    supportLogin: async (_login: string, _senha: string) => {
      // Login de suporte não disponível no modo web (suporte_usuarios não é sincronizado)
      return null
    },
    getSession: async (): Promise<AppSession | null> => loadSession(),
    logout: async (): Promise<void> => saveSession(null),
  },

  // ── Backup ───────────────────────────────────────────────────────────────
  backup: {
    getDbPath: async () => ({ path: null, folder: null }),
    openDbFolder: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
    exportToFolder: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
    uploadToSupabase: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
    restoreFromFile: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
    restoreFromSupabase: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
    listEmpresasSupabase: async () => [],
    listBackupsByEmpresa: async () => [],
    downloadBackup: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
    runAutoBackup: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
    runManualBackupForEmpresa: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
  },

  importSqliteToPostgres: {
    listEmpresas: async () => ({ ok: false as const, path: '', error: 'Disponível apenas no app desktop.' }),
    pickSqliteFile: async () => ({ ok: false as const, error: 'Disponível apenas no app desktop.' }),
    run: async () => ({ ok: false, error: 'Disponível apenas no app desktop.' }),
  },

  // ── Certificado ───────────────────────────────────────────────────────────
  certificado: {
    getStatus: async () => ({ hasCertificado: false, path: null, updatedAt: null }),
    selectAndUpload: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
    remove: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
  },

  // ── Config ────────────────────────────────────────────────────────────────
  config: {
    get: async () => null,
    set: async () => ({ ok: false }),
    setDbPath: async () => ({ ok: false }),
  },

  // ── Server ────────────────────────────────────────────────────────────────
  network: {
    getLocalIPv4s: async () => [],
  },
  terminais: {
    listConectados: async () =>
      ({
        ok: false,
        error: 'Disponível apenas no app desktop.',
        terminais: [],
        total: 0,
        apiBase: null,
        installMode: 'unknown' as const,
      } as const),
  },
  server: {
    getUrl: async () => null,
    discover: async () => ({ found: false } as const),
    onUrlUpdated: (_callback: (url: string) => void) => () => {},
  },
}
