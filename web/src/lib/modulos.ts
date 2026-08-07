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
  | 'pdv'
  | 'loja_online'
  | 'configuracoes'

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
  { id: 'loja_online', label: 'Loja online' },
  { id: 'configuracoes', label: 'Configurações' },
]

const FINANCE_SUB_MODULOS: ModuloId[] = [
  'nfce',
  'nfe',
  'fluxo_caixa',
  'contas_pagar',
  'contas_receber',
  'cashback',
  'comissoes',
]

export function defaultModulosRecord(allEnabled = true): Record<ModuloId, boolean> {
  return MODULOS_USUARIO.reduce(
    (acc, m) => ({ ...acc, [m.id]: allEnabled }),
    {} as Record<ModuloId, boolean>
  )
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
