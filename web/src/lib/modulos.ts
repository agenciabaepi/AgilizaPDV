export type ModuloId =
  | 'dashboard'
  | 'produtos'
  | 'etiquetas'
  | 'categorias'
  | 'marcas'
  | 'clientes'
  | 'fornecedores'
  | 'usuarios'
  | 'estoque'
  | 'caixa'
  | 'vendas'
  | 'nfce'
  | 'nfe'
  | 'fluxo_caixa'
  | 'contas_pagar'
  | 'contas_receber'
  | 'cashback'
  | 'comissoes'
  | 'demonstrativos'
  | 'pdv'
  | 'loja_online'
  | 'configuracoes'
  | 'capa_personalizada'

/** Empresa autorizada a usar o módulo exclusivo de capa personalizada. */
export const EMPRESA_IDS_CAPA_PERSONALIZADA = ['b77415cb-b4ed-4fb6-982a-bae60940ed10'] as const

export function empresaPodeUsarCapaPersonalizada(empresaId: string | null | undefined): boolean {
  if (!empresaId) return false
  return (EMPRESA_IDS_CAPA_PERSONALIZADA as readonly string[]).includes(empresaId)
}

/**
 * Capa personalizada só liga se a empresa for a exclusiva e o flag estiver ativo.
 * JSON legado (sem a chave) na empresa exclusiva continua ligado até desativar no SaaS.
 */
export function isCapaPersonalizadaAtiva(
  empresaId: string | null | undefined,
  modulosJsonOrRecord: string | Record<string, boolean> | null | undefined
): boolean {
  if (!empresaPodeUsarCapaPersonalizada(empresaId)) return false
  let parsed: Record<string, boolean> | null = null
  if (modulosJsonOrRecord == null) {
    parsed = null
  } else if (typeof modulosJsonOrRecord === 'string') {
    if (!modulosJsonOrRecord.trim()) return true
    try {
      parsed = JSON.parse(modulosJsonOrRecord) as Record<string, boolean>
    } catch {
      return true
    }
  } else {
    parsed = modulosJsonOrRecord
  }
  if (!parsed || !('capa_personalizada' in parsed)) return true
  return parsed.capa_personalizada === true
}

/** Força o flag off fora da empresa exclusiva (antes de persistir modulos_json). */
export function sanitizeModulosCapaPersonalizada(
  empresaId: string | null | undefined,
  modulos: Record<string, boolean>
): Record<string, boolean> {
  const next = { ...modulos }
  if (!empresaPodeUsarCapaPersonalizada(empresaId)) {
    next.capa_personalizada = false
  }
  return next
}

export const MODULOS_USUARIO: { id: ModuloId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'pdv', label: 'PDV' },
  { id: 'produtos', label: 'Produtos' },
  { id: 'etiquetas', label: 'Etiquetas' },
  { id: 'categorias', label: 'Categorias' },
  { id: 'marcas', label: 'Marcas' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'fornecedores', label: 'Fornecedores' },
  { id: 'usuarios', label: 'Usuários' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'caixa', label: 'Caixa' },
  { id: 'vendas', label: 'Vendas' },
  { id: 'nfce', label: 'NFC-e' },
  { id: 'nfe', label: 'NF-e' },
  { id: 'fluxo_caixa', label: 'Fluxo de caixa' },
  { id: 'contas_pagar', label: 'Contas a pagar' },
  { id: 'contas_receber', label: 'Contas a receber' },
  { id: 'cashback', label: 'Cashback' },
  { id: 'comissoes', label: 'Comissões' },
  { id: 'demonstrativos', label: 'Demonstrativos' },
  { id: 'loja_online', label: 'Loja online' },
  { id: 'configuracoes', label: 'Configurações' },
]

/** Módulos só gerenciados no painel SaaS (não aparecem em Usuários). */
export const MODULOS_SAAS_ESPECIAIS: { id: ModuloId; label: string; descricao?: string }[] = [
  {
    id: 'capa_personalizada',
    label: 'Capa personalizada',
    descricao: 'Editor de capas na loja online (exclusivo desta empresa).',
  },
]

const FINANCE_SUB_MODULOS: ModuloId[] = [
  'nfce',
  'nfe',
  'fluxo_caixa',
  'contas_pagar',
  'contas_receber',
  'cashback',
  'comissoes',
  'demonstrativos',
]

export function defaultModulosRecord(allEnabled = true): Record<ModuloId, boolean> {
  const result = MODULOS_USUARIO.reduce(
    (acc, m) => ({ ...acc, [m.id]: allEnabled }),
    {} as Record<ModuloId, boolean>
  )
  // Sempre opt-in via SaaS; nunca liberar por padrão em novas empresas.
  result.capa_personalizada = false
  return result
}

/** Herda sub-módulos financeiros de `vendas` e admin de `dashboard` em JSON legado. */
function applyLegacyModuloDefaults(parsed: Record<string, boolean>, result: Record<ModuloId, boolean>) {
  if ('vendas' in parsed) {
    for (const id of FINANCE_SUB_MODULOS) {
      if (!(id in parsed)) result[id] = parsed.vendas
    }
  }
  if ('dashboard' in parsed) {
    if (!('loja_online' in parsed)) result.loja_online = parsed.dashboard
    if (!('configuracoes' in parsed)) result.configuracoes = parsed.dashboard
  }
}

export function parseModulos(json: string | null | undefined): Record<ModuloId, boolean> {
  const defaults = defaultModulosRecord(true)
  if (!json?.trim()) return defaults
  try {
    const parsed = JSON.parse(json) as Record<string, boolean>
    const result = { ...defaults, ...parsed } as Record<ModuloId, boolean>
    applyLegacyModuloDefaults(parsed, result)
    return result
  } catch {
    return defaults
  }
}

export const DEFAULT_MODULOS_BY_ROLE: Record<string, Record<ModuloId, boolean>> = {
  admin: defaultModulosRecord(true),
  gerente: defaultModulosRecord(true),
  caixa: {
    ...defaultModulosRecord(false),
    dashboard: true,
    pdv: true,
    caixa: true,
    clientes: true,
    vendas: true,
    nfce: true,
    nfe: true,
    fluxo_caixa: true,
    contas_pagar: true,
    contas_receber: true,
    comissoes: true,
    demonstrativos: true,
  },
  estoque: {
    ...defaultModulosRecord(false),
    dashboard: true,
    produtos: true,
    etiquetas: true,
    categorias: true,
    marcas: true,
    fornecedores: true,
    estoque: true,
  },
}
