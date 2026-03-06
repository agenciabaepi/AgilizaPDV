import { contextBridge, ipcRenderer } from 'electron'

export type UsuarioSession = {
  id: string
  empresa_id: string
  nome: string
  login: string
  role: string
  created_at: string
}

export type SuporteSession = {
  suporte: true
  id: string
  nome: string
  login: string
}

export type Empresa = {
  id: string
  nome: string
  cnpj: string | null
  created_at: string
}

export type Produto = {
  id: string
  empresa_id: string
  codigo: number | null
  nome: string
  sku: string | null
  codigo_barras: string | null
  fornecedor_id: string | null
  categoria_id: string | null
  descricao: string | null
  imagem: string | null
  custo: number
  markup: number
  preco: number
  unidade: string
  controla_estoque: number
  estoque_minimo: number
  ativo: number
  ncm: string | null
  cfop: string | null
  created_at: string
  updated_at: string
}

export type CreateProdutoInput = {
  empresa_id: string
  nome: string
  sku?: string
  codigo_barras?: string
  fornecedor_id?: string
  categoria_id?: string | null
  descricao?: string
  imagem?: string
  custo?: number
  markup?: number
  preco?: number
  unidade?: string
  controla_estoque?: number
  estoque_minimo?: number
  ativo?: number
  ncm?: string
  cfop?: string
}

export type Categoria = {
  id: string
  empresa_id: string
  nome: string
  parent_id: string | null
  nivel: number
  ordem: number
  ativo: number
  created_at: string
}

export type CategoriaTreeNode = Categoria & { children: CategoriaTreeNode[] }

export type Cliente = {
  id: string
  empresa_id: string
  nome: string
  cpf_cnpj: string | null
  telefone: string | null
  email: string | null
  endereco: string | null
  observacoes: string | null
  created_at: string
}

export type Fornecedor = {
  id: string
  empresa_id: string
  razao_social: string
  cnpj: string | null
  contato: string | null
  observacoes: string | null
  created_at: string
}

export type UpdateProdutoInput = Partial<Omit<CreateProdutoInput, 'empresa_id'>>

export type TipoMovimento = 'ENTRADA' | 'SAIDA' | 'AJUSTE' | 'DEVOLUCAO'

export type EstoqueMovimento = {
  id: string
  empresa_id: string
  produto_id: string
  tipo: TipoMovimento
  quantidade: number
  custo_unitario: number | null
  referencia_tipo: string | null
  referencia_id: string | null
  usuario_id: string | null
  created_at: string
}

export type ProdutoSaldo = {
  produto_id: string
  nome: string
  unidade: string
  saldo: number
  estoque_minimo: number
}

export type Caixa = {
  id: string
  empresa_id: string
  usuario_id: string
  status: 'ABERTO' | 'FECHADO'
  valor_inicial: number
  aberto_em: string
  fechado_em: string | null
}

export type CaixaMovimento = {
  id: string
  empresa_id: string
  caixa_id: string
  tipo: 'SANGRIA' | 'SUPRIMENTO'
  valor: number
  motivo: string | null
  usuario_id: string
  created_at: string
}

export type Venda = {
  id: string
  empresa_id: string
  caixa_id: string
  usuario_id: string
  cliente_id: string | null
  numero: number
  status: string
  subtotal: number
  desconto_total: number
  total: number
  troco: number
  created_at: string
}

const api = {
  ping: () => ipcRenderer.invoke('app:ping'),
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion') as Promise<string>,
    getInstallMode: () => ipcRenderer.invoke('app:getInstallMode') as Promise<'server' | 'terminal' | 'unknown'>,
    getUpdateState: () =>
      ipcRenderer.invoke('app:getUpdateState') as Promise<{
        phase: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'
        message?: string
        version?: string
        percent?: number
      }>,
    checkForUpdates: () =>
      ipcRenderer.invoke('app:checkForUpdates') as Promise<{
        phase: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'
        message?: string
        version?: string
        percent?: number
      }>,
    installUpdateNow: () =>
      ipcRenderer.invoke('app:installUpdateNow') as Promise<{ ok: boolean; message: string }>,
    onUpdateStatusChange: (
      callback: (payload: {
        phase: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'
        message?: string
        version?: string
        percent?: number
      }) => void
    ) => {
      const handler = (_: unknown, payload: {
        phase: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'
        message?: string
        version?: string
        percent?: number
      }) => callback(payload)
      ipcRenderer.on('app:updateStatus', handler)
      return () => ipcRenderer.removeListener('app:updateStatus', handler)
    }
  },
  empresas: {
    list: () => ipcRenderer.invoke('empresas:list') as Promise<Empresa[]>,
    create: (data: { nome: string; cnpj?: string }) => ipcRenderer.invoke('empresas:create', data)
  },
  usuarios: {
    list: (empresaId: string) => ipcRenderer.invoke('usuarios:list', empresaId),
    create: (data: {
      empresa_id: string
      nome: string
      login: string
      senha: string
      role: 'admin' | 'gerente' | 'caixa' | 'estoque'
    }) => ipcRenderer.invoke('usuarios:create', data)
  },
  auth: {
    login: (empresaId: string, login: string, senha: string) =>
      ipcRenderer.invoke('auth:login', empresaId, login, senha) as Promise<UsuarioSession | null>,
    supportLogin: (login: string, senha: string) =>
      ipcRenderer.invoke('auth:supportLogin', login, senha) as Promise<SuporteSession | null>,
    getSession: () => ipcRenderer.invoke('auth:getSession') as Promise<UsuarioSession | SuporteSession | null>,
    logout: () => ipcRenderer.invoke('auth:logout')
  },
  config: {
    get: () => ipcRenderer.invoke('config:get') as Promise<{ dbPath?: string; syncOnChange?: boolean; serverUrl?: string } | null>,
    set: (partial: { dbPath?: string | null; syncOnChange?: boolean; serverUrl?: string | null }) => ipcRenderer.invoke('config:set', partial) as Promise<{ ok: boolean }>,
    setDbPath: (folderPath: string | null) => ipcRenderer.invoke('config:setDbPath', folderPath) as Promise<{ ok: boolean }>
  },
  server: {
    getUrl: () => ipcRenderer.invoke('server:getUrl') as Promise<string | null>,
    discover: () => ipcRenderer.invoke('server:discover') as Promise<{ found: false } | { found: true; name: string; url: string }>
  },
  produtos: {
    list: (empresaId: string, options?: { search?: string; apenasAtivos?: boolean; ordenarPorMaisVendidos?: boolean }) =>
      ipcRenderer.invoke('produtos:list', empresaId, options) as Promise<Produto[]>,
    get: (id: string) => ipcRenderer.invoke('produtos:get', id) as Promise<Produto | null>,
    getNextCodigo: (empresaId: string) => ipcRenderer.invoke('produtos:getNextCodigo', empresaId) as Promise<number>,
    create: (data: CreateProdutoInput) => ipcRenderer.invoke('produtos:create', data) as Promise<Produto>,
    update: (id: string, data: UpdateProdutoInput) => ipcRenderer.invoke('produtos:update', id, data) as Promise<Produto | null>
  },
  clientes: {
    list: (empresaId: string) => ipcRenderer.invoke('clientes:list', empresaId) as Promise<Cliente[]>
  },
  fornecedores: {
    list: (empresaId: string) => ipcRenderer.invoke('fornecedores:list', empresaId) as Promise<Fornecedor[]>
  },
  categorias: {
    list: (empresaId: string) => ipcRenderer.invoke('categorias:list', empresaId) as Promise<Categoria[]>,
    listTree: (empresaId: string) => ipcRenderer.invoke('categorias:listTree', empresaId) as Promise<CategoriaTreeNode[]>,
    listFolha: (empresaId: string) => ipcRenderer.invoke('categorias:listFolha', empresaId) as Promise<Categoria[]>,
    get: (id: string) => ipcRenderer.invoke('categorias:get', id) as Promise<Categoria | null>,
    getPath: (id: string) => ipcRenderer.invoke('categorias:getPath', id) as Promise<string>,
    create: (data: { empresa_id: string; nome: string; parent_id?: string | null; ordem?: number; ativo?: number }) =>
      ipcRenderer.invoke('categorias:create', data) as Promise<Categoria>,
    update: (id: string, data: { nome?: string; ordem?: number; ativo?: number }) =>
      ipcRenderer.invoke('categorias:update', id, data) as Promise<Categoria | null>,
    delete: (id: string) => ipcRenderer.invoke('categorias:delete', id) as Promise<boolean>
  },
  estoque: {
    listMovimentos: (empresaId: string, options?: { produtoId?: string; limit?: number }) =>
      ipcRenderer.invoke('estoque:listMovimentos', empresaId, options) as Promise<EstoqueMovimento[]>,
    getSaldo: (empresaId: string, produtoId: string) =>
      ipcRenderer.invoke('estoque:getSaldo', empresaId, produtoId) as Promise<number>,
    listSaldos: (empresaId: string) =>
      ipcRenderer.invoke('estoque:listSaldos', empresaId) as Promise<ProdutoSaldo[]>,
    registrarMovimento: (data: { empresa_id: string; produto_id: string; tipo: TipoMovimento; quantidade: number; custo_unitario?: number; referencia_tipo?: string; referencia_id?: string; usuario_id?: string }) =>
      ipcRenderer.invoke('estoque:registrarMovimento', data) as Promise<EstoqueMovimento>,
    ajustarSaldoPara: (empresaId: string, produtoId: string, novoSaldo: number) =>
      ipcRenderer.invoke('estoque:ajustarSaldoPara', empresaId, produtoId, novoSaldo) as Promise<void>
  },
  caixa: {
    getAberto: (empresaId: string) => ipcRenderer.invoke('caixa:getAberto', empresaId) as Promise<Caixa | null>,
    abrir: (empresaId: string, usuarioId: string, valorInicial: number) =>
      ipcRenderer.invoke('caixa:abrir', empresaId, usuarioId, valorInicial) as Promise<Caixa>,
    fechar: (caixaId: string) => ipcRenderer.invoke('caixa:fechar', caixaId) as Promise<Caixa | null>,
    list: (empresaId: string, limit?: number) => ipcRenderer.invoke('caixa:list', empresaId, limit) as Promise<Caixa[]>,
    getSaldo: (caixaId: string) => ipcRenderer.invoke('caixa:getSaldo', caixaId) as Promise<number>,
    listMovimentos: (caixaId: string) => ipcRenderer.invoke('caixa:listMovimentos', caixaId) as Promise<CaixaMovimento[]>,
    registrarMovimento: (data: { caixa_id: string; empresa_id: string; tipo: 'SANGRIA' | 'SUPRIMENTO'; valor: number; motivo?: string; usuario_id: string }) =>
      ipcRenderer.invoke('caixa:registrarMovimento', data) as Promise<CaixaMovimento>
  },
  vendas: {
    finalizar: (data: { empresa_id: string; usuario_id: string; cliente_id?: string; itens: { produto_id: string; descricao: string; preco_unitario: number; quantidade: number; desconto?: number }[]; pagamentos: { forma: string; valor: number }[]; desconto_total?: number; troco?: number }) =>
      ipcRenderer.invoke('vendas:finalizar', data) as Promise<Venda>,
    list: (empresaId: string, options?: { limit?: number }) =>
      ipcRenderer.invoke('vendas:list', empresaId, options) as Promise<Venda[]>,
    get: (id: string) => ipcRenderer.invoke('vendas:get', id) as Promise<Venda | null>,
    cancelar: (vendaId: string, usuarioId: string) =>
      ipcRenderer.invoke('vendas:cancelar', vendaId, usuarioId) as Promise<Venda | null>
  },
  sync: {
    run: () => ipcRenderer.invoke('sync:run') as Promise<{ success: boolean; sent: number; errors: number; message: string }>,
    getPendingCount: () => ipcRenderer.invoke('sync:getPendingCount') as Promise<number>,
    getErrorCount: () => ipcRenderer.invoke('sync:getErrorCount') as Promise<number>,
    resetErrorsAndRun: () => ipcRenderer.invoke('sync:resetErrorsAndRun') as Promise<{ success: boolean; sent: number; errors: number; message: string }>,
    checkOnline: () => ipcRenderer.invoke('sync:checkOnline') as Promise<boolean>,
    onOnlineStatusChange: (callback: (online: boolean) => void) => {
      const handler = (_: unknown, online: boolean) => callback(online)
      ipcRenderer.on('sync:onlineStatus', handler)
      return () => ipcRenderer.removeListener('sync:onlineStatus', handler)
    },
    onAutoSyncStatusChange: (
      callback: (payload: { status: 'syncing' | 'success' | 'error'; message: string }) => void
    ) => {
      const handler = (_: unknown, payload: { status: 'syncing' | 'success' | 'error'; message: string }) =>
        callback(payload)
      ipcRenderer.on('sync:autoStatus', handler)
      return () => ipcRenderer.removeListener('sync:autoStatus', handler)
    }
  },
  backup: {
    getDbPath: () => ipcRenderer.invoke('backup:getDbPath') as Promise<{ path: string | null; folder: string | null }>,
    openDbFolder: () => ipcRenderer.invoke('backup:openDbFolder') as Promise<{ ok: boolean; error?: string }>,
    exportToFolder: () => ipcRenderer.invoke('backup:exportToFolder') as Promise<{ ok: boolean; path?: string; error?: string }>,
    uploadToSupabase: () => ipcRenderer.invoke('backup:uploadToSupabase') as Promise<{ ok: boolean; path?: string; error?: string }>,
    restoreFromFile: () => ipcRenderer.invoke('backup:restoreFromFile') as Promise<{ ok: boolean; error?: string }>,
    restoreFromSupabase: () => ipcRenderer.invoke('backup:restoreFromSupabase') as Promise<{ ok: boolean; error?: string }>
  },
  cupom: {
    imprimir: (vendaId: string) => ipcRenderer.invoke('cupom:imprimir', vendaId) as Promise<{ ok: boolean; error?: string }>,
    getDetalhes: (vendaId: string) => ipcRenderer.invoke('cupom:getDetalhes', vendaId),
    getHtml: (vendaId: string) => ipcRenderer.invoke('cupom:getHtml', vendaId) as Promise<string | null>
  },
  etiquetas: {
    imprimir: (produtoIds: string[]) => ipcRenderer.invoke('etiquetas:imprimir', produtoIds) as Promise<{ ok: boolean; error?: string }>
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
