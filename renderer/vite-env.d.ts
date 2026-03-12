/// <reference types="vite/client" />

export type UsuarioSession = {
  id: string
  empresa_id: string
  nome: string
  login: string
  role: string
  modulos_json?: string | null
  created_at: string
}

export type Usuario = {
  id: string
  empresa_id: string
  nome: string
  login: string
  role: string
  modulos_json?: string | null
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

export type EmpresaConfig = Empresa & {
  razao_social: string | null
  endereco: string | null
  telefone: string | null
  email: string | null
  logo: string | null
  cor_primaria: string | null
  modulos_json: string | null
  impressora_cupom: string | null
}

export type EmpresaFiscalConfig = {
  ambiente: 'homologacao' | 'producao'
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

export type UpdateFiscalConfigInput = {
  ambiente?: 'homologacao' | 'producao'
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

export type ModuloId = 'dashboard' | 'produtos' | 'etiquetas' | 'categorias' | 'clientes' | 'fornecedores' | 'usuarios' | 'estoque' | 'caixa' | 'vendas' | 'pdv'

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
  impressora_cupom?: string | null
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

export type VendaComNfce = Venda & {
  nfce_emitida?: boolean
  nfce_chave?: string | null
}

export type StatusNfce = {
  emitida: boolean
  status: 'PENDENTE' | 'AUTORIZADA' | 'REJEITADA' | 'ERRO' | 'CANCELADA' | null
  chave: string | null
  protocolo: string | null
  numero_nfce: number | null
  mensagem: string | null
}

export type NfceStatus = 'PENDENTE' | 'AUTORIZADA' | 'REJEITADA' | 'ERRO' | 'CANCELADA'

export type NfceListItem = {
  venda_id: string
  numero_nfce: number
  status: NfceStatus
  chave: string | null
  mensagem_sefaz: string | null
  venda_numero: number
  venda_created_at: string
  venda_total: number
  cliente_nome: string | null
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

export type LabelTemplate = {
  id: string
  name: string
  printerModel: string
  language: 'PPLA' | 'PPLB' | 'PPLZ'
  dpi: number
  labelWidthMm: number
  labelHeightMm: number
  columns: number
  columnGapMm: number
  rowGapMm: number
  marginTopMm: number
  marginRightMm: number
  marginBottomMm: number
  marginLeftMm: number
}

export type PrinterInfo = {
  name: string
  isDefault: boolean
}

export type PrinterStatus = {
  name: string
  online: boolean
  detail: string
}

export type LabelPreview = {
  templateId: string
  mediaWidthMm: number
  mediaHeightMm: number
  totalLabels: number
  html: string
}

export type BackupRegistryEntry = {
  id: string
  empresa_id: string
  file_path: string
  backup_date: string
  file_size_bytes: number | null
  status: string
}

declare global {
  interface Window {
    electronAPI: {
      ping: () => Promise<string>
      empresas: {
        list: () => Promise<Empresa[]>
        create: (d: { nome: string; cnpj?: string }) => Promise<Empresa>
        getConfig: (empresaId: string) => Promise<EmpresaConfig | null>
        updateConfig: (empresaId: string, d: UpdateEmpresaConfigInput) => Promise<EmpresaConfig | null>
        getFiscalConfig: (empresaId: string) => Promise<EmpresaFiscalConfig | null>
        updateFiscalConfig: (empresaId: string, d: UpdateFiscalConfigInput) => Promise<EmpresaFiscalConfig | null>
      }
      usuarios: {
        list: (empresaId: string) => Promise<Usuario[]>
        get: (id: string) => Promise<Usuario | null>
        create: (d: { empresa_id: string; nome: string; login: string; senha: string; role: string; modulos_json?: string | null }) => Promise<Usuario>
        update: (id: string, d: { nome?: string; login?: string; role?: string; senha?: string; modulos_json?: string | null }) => Promise<Usuario | null>
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
        list: (empresaId: string, options?: { limit?: number; dataInicio?: string; dataFim?: string; periodo?: 'hoje' | 'semana' | 'mes' }) => Promise<VendaComNfce[]>
        get: (id: string) => Promise<Venda | null>
        cancelar: (vendaId: string, usuarioId: string) => Promise<Venda | null>
        getStatusNfce: (vendaId: string) => Promise<StatusNfce | null>
        emitirNfce: (vendaId: string) => Promise<{ ok: boolean; chave?: string; protocolo?: string; error?: string }>
      }
      nfce: {
        list: (empresaId: string, options?: { dataInicio?: string; dataFim?: string; status?: string; search?: string; limit?: number }) => Promise<NfceListItem[]>
      }
      app: {
        getVersion: () => Promise<string>
        getInstallMode: () => Promise<'server' | 'terminal' | 'unknown'>
        getUpdateState: () => Promise<{
          phase: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'
          message?: string
          version?: string
          percent?: number
        }>
        checkForUpdates: () => Promise<{
          phase: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'
          message?: string
          version?: string
          percent?: number
        }>
        installUpdateNow: () => Promise<{ ok: boolean; message: string }>
        onUpdateStatusChange?: (
          callback: (payload: {
            phase: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'
            message?: string
            version?: string
            percent?: number
          }) => void
        ) => () => void
      }
      sync: {
        run: () => Promise<{ success: boolean; sent: number; errors: number; message: string }>
        getPendingCount: () => Promise<number>
        checkOnline: () => Promise<boolean>
        onOnlineStatusChange?: (callback: (online: boolean) => void) => () => void
      }
      cupom: {
        imprimir: (vendaId: string) => Promise<{ ok: boolean; error?: string }>
        imprimirNfce: (vendaId: string) => Promise<{ ok: boolean; error?: string }>
        getDetalhes: (vendaId: string) => Promise<unknown>
        getHtml: (vendaId: string) => Promise<string | null>
        getHtmlNfce: (vendaId: string) => Promise<string | null>
        listPrinters: () => Promise<PrinterInfo[]>
      }
      etiquetas: {
        listTemplates: () => Promise<LabelTemplate[]>
        listPrinters: () => Promise<PrinterInfo[]>
        getPrinterStatus: (printerName: string) => Promise<PrinterStatus>
        preview: (payload: { templateId?: string; items: { produtoId: string; quantidade: number }[] }) => Promise<{
          preview: LabelPreview
          totalLabels: number
          language: 'PPLA' | 'PPLB' | 'PPLZ'
        }>
        print: (payload: { templateId?: string; printerName: string; items: { produtoId: string; quantidade: number }[] }) => Promise<{ ok: boolean; error?: string; labels?: number }>
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
        listEmpresasSupabase: () => Promise<{ id: string; nome: string }[]>
        listBackupsByEmpresa: (empresaId: string) => Promise<BackupRegistryEntry[]>
        downloadBackup: (filePath: string) => Promise<{ ok: boolean; path?: string; error?: string }>
        runAutoBackup: () => Promise<{ ok: boolean; count?: number; error?: string }>
        runManualBackupForEmpresa: (empresaId: string) => Promise<{ ok: boolean; count?: number; error?: string }>
      }
      certificado: {
        getStatus: (empresaId: string) => Promise<{ hasCertificado: boolean; path: string | null; updatedAt: string | null }>
        selectAndUpload: (empresaId: string, senha: string) => Promise<{ ok: boolean; error?: string }>
        remove: (empresaId: string) => Promise<{ ok: boolean; error?: string }>
      }
      config: {
        get: () => Promise<{ dbPath?: string; syncOnChange?: boolean; serverUrl?: string } | null>
        set: (partial: { dbPath?: string | null; syncOnChange?: boolean; serverUrl?: string | null }) => Promise<{ ok: boolean }>
        setDbPath: (folderPath: string | null) => Promise<{ ok: boolean }>
      }
      server: {
        getUrl: () => Promise<string | null>
        discover: () => Promise<{ found: false } | { found: true; name: string; url: string }>
      }
      sync: {
        pullFromSupabase?: () => Promise<{ success: boolean; message: string }>
        onAutoSyncStatusChange?: (
          callback: (payload: { status: 'syncing' | 'success' | 'error'; message: string }) => void
        ) => () => void
        onSyncDataUpdated?: (callback: () => void) => () => void
      }
    }
  }
}

export {}
