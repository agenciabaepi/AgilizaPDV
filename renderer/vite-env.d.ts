/// <reference types="vite/client" />

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

export type AppSession = UsuarioSession | SuporteSession

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

export type RegistrarMovimentoInput = {
  empresa_id: string
  produto_id: string
  tipo: TipoMovimento
  quantidade: number
  custo_unitario?: number
  referencia_tipo?: string
  referencia_id?: string
  usuario_id?: string
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

export type RegistrarMovimentoCaixaInput = {
  caixa_id: string
  empresa_id: string
  tipo: 'SANGRIA' | 'SUPRIMENTO'
  valor: number
  motivo?: string
  usuario_id: string
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

export type ItemVendaInput = {
  produto_id: string
  descricao: string
  preco_unitario: number
  quantidade: number
  desconto?: number
}

export type PagamentoInput = {
  forma: 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'OUTROS'
  valor: number
}

export type FinalizarVendaInput = {
  empresa_id: string
  usuario_id: string
  cliente_id?: string
  itens: ItemVendaInput[]
  pagamentos: PagamentoInput[]
  desconto_total?: number
  troco?: number
}

declare global {
  interface Window {
    electronAPI: {
      ping: () => Promise<string>
      empresas: { list: () => Promise<Empresa[]>; create: (d: { nome: string; cnpj?: string }) => Promise<Empresa> }
      usuarios: {
        list: (empresaId: string) => Promise<unknown[]>
        create: (d: { empresa_id: string; nome: string; login: string; senha: string; role: string }) => Promise<unknown>
      }
      produtos: {
        list: (empresaId: string, options?: { search?: string; apenasAtivos?: boolean; ordenarPorMaisVendidos?: boolean }) => Promise<Produto[]>
        get: (id: string) => Promise<Produto | null>
        getNextCodigo: (empresaId: string) => Promise<number>
        create: (d: CreateProdutoInput) => Promise<Produto>
        update: (id: string, d: UpdateProdutoInput) => Promise<Produto | null>
      }
      clientes: {
        list: (empresaId: string) => Promise<Cliente[]>
      }
      fornecedores: {
        list: (empresaId: string) => Promise<Fornecedor[]>
      }
      categorias: {
        list: (empresaId: string) => Promise<Categoria[]>
        listTree: (empresaId: string) => Promise<CategoriaTreeNode[]>
        listFolha: (empresaId: string) => Promise<Categoria[]>
        get: (id: string) => Promise<Categoria | null>
        getPath: (id: string) => Promise<string>
        create: (d: { empresa_id: string; nome: string; parent_id?: string | null; ordem?: number; ativo?: number }) => Promise<Categoria>
        update: (id: string, d: { nome?: string; ordem?: number; ativo?: number }) => Promise<Categoria | null>
        delete: (id: string) => Promise<boolean>
      }
      estoque: {
        listMovimentos: (empresaId: string, options?: { produtoId?: string; limit?: number }) => Promise<EstoqueMovimento[]>
        getSaldo: (empresaId: string, produtoId: string) => Promise<number>
        listSaldos: (empresaId: string) => Promise<ProdutoSaldo[]>
        registrarMovimento: (d: RegistrarMovimentoInput) => Promise<EstoqueMovimento>
        ajustarSaldoPara: (empresaId: string, produtoId: string, novoSaldo: number) => Promise<void>
      }
      caixa: {
        getAberto: (empresaId: string) => Promise<Caixa | null>
        abrir: (empresaId: string, usuarioId: string, valorInicial: number) => Promise<Caixa>
        fechar: (caixaId: string) => Promise<Caixa | null>
        list: (empresaId: string, limit?: number) => Promise<Caixa[]>
        getSaldo: (caixaId: string) => Promise<number>
        listMovimentos: (caixaId: string) => Promise<CaixaMovimento[]>
        registrarMovimento: (d: RegistrarMovimentoCaixaInput) => Promise<CaixaMovimento>
      }
      vendas: {
        finalizar: (d: FinalizarVendaInput) => Promise<Venda>
        list: (empresaId: string, options?: { limit?: number; dataInicio?: string; dataFim?: string; periodo?: 'hoje' | 'semana' | 'mes' }) => Promise<Venda[]>
        get: (id: string) => Promise<Venda | null>
        cancelar: (vendaId: string, usuarioId: string) => Promise<Venda | null>
      }
      sync: {
        run: () => Promise<{ success: boolean; sent: number; errors: number; message: string }>
        getPendingCount: () => Promise<number>
        checkOnline: () => Promise<boolean>
        onOnlineStatusChange?: (callback: (online: boolean) => void) => () => void
      }
      cupom: {
        imprimir: (vendaId: string) => Promise<{ ok: boolean; error?: string }>
        getDetalhes: (vendaId: string) => Promise<unknown>
        getHtml: (vendaId: string) => Promise<string | null>
      }
      etiquetas: {
        imprimir: (produtoIds: string[]) => Promise<{ ok: boolean; error?: string }>
      }
      auth: {
        login: (empresaId: string, login: string, senha: string) => Promise<UsuarioSession | null>
        supportLogin: (login: string, senha: string) => Promise<SuporteSession | null>
        getSession: () => Promise<AppSession | null>
        logout: () => Promise<void>
      }
      backup: {
        getDbPath: () => Promise<{ path: string | null; folder: string | null }>
        openDbFolder: () => Promise<{ ok: boolean; error?: string }>
        exportToFolder: () => Promise<{ ok: boolean; path?: string; error?: string }>
        uploadToSupabase: () => Promise<{ ok: boolean; path?: string; error?: string }>
        restoreFromFile: () => Promise<{ ok: boolean; error?: string }>
        restoreFromSupabase: () => Promise<{ ok: boolean; error?: string }>
      }
      config: {
        get: () => Promise<{ dbPath?: string; syncOnChange?: boolean } | null>
        set: (partial: { dbPath?: string | null; syncOnChange?: boolean }) => Promise<{ ok: boolean }>
        setDbPath: (folderPath: string | null) => Promise<{ ok: boolean }>
      }
      sync: {
        onAutoSyncStatusChange?: (
          callback: (payload: { status: 'syncing' | 'success' | 'error'; message: string }) => void
        ) => () => void
      }
    }
  }
}

export {}
