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

export type EmpresaConfig = Empresa & {
  razao_social: string | null
  endereco: string | null
  telefone: string | null
  email: string | null
  logo: string | null
  cor_primaria: string | null
  modulos_json: string | null
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
  modulos?: Record<string, boolean>
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
  cashback_ativo: number
  cashback_percentual: number | null
  permitir_resgate_cashback_no_produto: number
  cashback_observacao: string | null
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
  cashback_ativo?: number
  cashback_percentual?: number | null
  permitir_resgate_cashback_no_produto?: number
  cashback_observacao?: string | null
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

export type FornecedorHistoricoItem = {
  id: string
  fornecedor_id: string
  empresa_id: string
  operacao: 'CREATE' | 'UPDATE' | 'INATIVAR' | 'REATIVAR'
  campos_alterados: string | null
  usuario_id: string | null
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

export type CreateFornecedorInput = {
  empresa_id: string
  razao_social: string
  usuario_id?: string | null
} & Partial<Omit<Fornecedor, 'id' | 'empresa_id' | 'razao_social' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>>

export type UpdateFornecedorInput = Partial<Omit<Fornecedor, 'id' | 'empresa_id' | 'created_at'>>

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

export type CaixaResumoFechamento = {
  saldo_atual: number
  totais_por_forma: { forma: 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'OUTROS' | 'CASHBACK'; total: number }[]
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
  cashback_gerado: number
  cashback_usado: number
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
  xml_local_path?: string | null
}

export type NfceListItem = {
  venda_id: string
  numero_nfce: number
  status: 'PENDENTE' | 'AUTORIZADA' | 'REJEITADA' | 'ERRO' | 'CANCELADA'
  chave: string | null
  mensagem_sefaz: string | null
  venda_numero: number
  venda_created_at: string
  venda_total: number
  cliente_nome: string | null
}

export type StatusNfe = {
  emitida: boolean
  status: 'PENDENTE' | 'AUTORIZADA' | 'REJEITADA' | 'ERRO' | 'CANCELADA' | null
  chave: string | null
  protocolo: string | null
  numero_nfe: number | null
  mensagem: string | null
  xml_local_path?: string | null
}

export type NfeStatus = 'PENDENTE' | 'AUTORIZADA' | 'REJEITADA' | 'ERRO' | 'CANCELADA'

export type NfeListItem = {
  venda_id: string
  numero_nfe: number
  status: NfeStatus
  chave: string | null
  mensagem_sefaz: string | null
  venda_numero: number
  venda_created_at: string
  venda_total: number
  cliente_nome: string | null
}

export type TerminaiConectado = {
  id: string
  connectedAt: string
  remoteAddress: string | null
  remotePort: number | null
  appVersion?: string
  installMode?: string
  hostname?: string
  platform?: string
  lastHelloAt?: string
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
    create: (data: { nome: string; cnpj?: string }) => ipcRenderer.invoke('empresas:create', data),
    getConfig: (empresaId: string) => ipcRenderer.invoke('empresas:getConfig', empresaId) as Promise<EmpresaConfig | null>,
    updateConfig: (empresaId: string, data: UpdateEmpresaConfigInput) =>
      ipcRenderer.invoke('empresas:updateConfig', empresaId, data) as Promise<EmpresaConfig | null>,
    getFiscalConfig: (empresaId: string) =>
      ipcRenderer.invoke('empresas:getFiscalConfig', empresaId) as Promise<EmpresaFiscalConfig | null>,
    updateFiscalConfig: (empresaId: string, data: UpdateFiscalConfigInput) =>
      ipcRenderer.invoke('empresas:updateFiscalConfig', empresaId, data) as Promise<EmpresaFiscalConfig | null>
  },
  certificado: {
    getStatus: (empresaId: string) =>
      ipcRenderer.invoke('certificado:getStatus', empresaId) as Promise<{ hasCertificado: boolean; path: string | null; updatedAt: string | null }>,
    selectAndUpload: (empresaId: string, senha: string) =>
      ipcRenderer.invoke('certificado:selectAndUpload', empresaId, senha) as Promise<{ ok: boolean; error?: string }>,
    remove: (empresaId: string) =>
      ipcRenderer.invoke('certificado:remove', empresaId) as Promise<{ ok: boolean; error?: string }>
  },
  usuarios: {
    list: (empresaId: string) => ipcRenderer.invoke('usuarios:list', empresaId),
    get: (id: string) => ipcRenderer.invoke('usuarios:get', id),
    create: (data: {
      empresa_id: string
      nome: string
      login: string
      senha: string
      role: 'admin' | 'gerente' | 'caixa' | 'estoque'
      modulos_json?: string | null
    }) => ipcRenderer.invoke('usuarios:create', data),
    update: (id: string, data: { nome?: string; login?: string; role?: string; senha?: string; modulos_json?: string | null }) =>
      ipcRenderer.invoke('usuarios:update', id, data)
  },
  auth: {
    login: (empresaId: string, login: string, senha: string) =>
      ipcRenderer.invoke('auth:login', empresaId, login, senha) as Promise<UsuarioSession | null>,
    supportLogin: (login: string, senha: string) =>
      ipcRenderer.invoke('auth:supportLogin', login, senha) as Promise<SuporteSession | null>,
    getSession: () => ipcRenderer.invoke('auth:getSession') as Promise<UsuarioSession | SuporteSession | null>,
    logout: () => ipcRenderer.invoke('auth:logout'),
    ensureAdminUser: (empresaId: string) =>
      ipcRenderer.invoke('auth:ensureAdminUser', empresaId) as Promise<{ ok: boolean; message: string }>
  },
  config: {
    get: () => ipcRenderer.invoke('config:get') as Promise<{ dbPath?: string; syncOnChange?: boolean; serverUrl?: string } | null>,
    set: (partial: { dbPath?: string | null; syncOnChange?: boolean; serverUrl?: string | null }) =>
      ipcRenderer.invoke('config:set', partial) as Promise<{ ok: boolean; error?: string }>,
    setDbPath: (folderPath: string | null) => ipcRenderer.invoke('config:setDbPath', folderPath) as Promise<{ ok: boolean }>
  },
  server: {
    getUrl: () => ipcRenderer.invoke('server:getUrl') as Promise<string | null>,
    discover: () => ipcRenderer.invoke('server:discover') as Promise<{ found: false } | { found: true; name: string; url: string }>,
    onUrlUpdated: (callback: (url: string) => void) => {
      const handler = (_: unknown, url: string) => callback(url)
      ipcRenderer.on('server:urlUpdated', handler)
      return () => ipcRenderer.removeListener('server:urlUpdated', handler)
    }
  },
  network: {
    getLocalIPv4s: () => ipcRenderer.invoke('network:getLocalIPv4s') as Promise<string[]>
  },
  terminais: {
    listConectados: () =>
      ipcRenderer.invoke('terminais:listConectados') as Promise<
        | { ok: true; terminais: TerminaiConectado[]; total: number }
        | { ok: false; error: string; terminais: []; total: 0 }
      >
  },
  produtos: {
    list: (empresaId: string, options?: { search?: string; apenasAtivos?: boolean; ordenarPorMaisVendidos?: boolean }) =>
      ipcRenderer.invoke('produtos:list', empresaId, options) as Promise<Produto[]>,
    get: (id: string) => ipcRenderer.invoke('produtos:get', id) as Promise<Produto | null>,
    getNextCodigo: (empresaId: string) => ipcRenderer.invoke('produtos:getNextCodigo', empresaId) as Promise<number>,
    create: (data: CreateProdutoInput) => ipcRenderer.invoke('produtos:create', data) as Promise<Produto>,
    update: (id: string, data: UpdateProdutoInput) => ipcRenderer.invoke('produtos:update', id, data) as Promise<Produto | null>,
    ensureNfeAvulsa: (empresaId: string) =>
      ipcRenderer.invoke('produtos:ensureNfeAvulsa', empresaId) as Promise<
        { ok: true; produtoId: string } | { ok: false; error: string }
      >
  },
  clientes: {
    list: (empresaId: string) => ipcRenderer.invoke('clientes:list', empresaId) as Promise<Cliente[]>,
    create: (data: { empresa_id: string } & Partial<Omit<Cliente, 'id' | 'empresa_id' | 'created_at'>>) =>
      ipcRenderer.invoke('clientes:create', data) as Promise<Cliente>,
    update: (
      id: string,
      data: Partial<Omit<Cliente, 'id' | 'empresa_id' | 'created_at'>>
    ) => ipcRenderer.invoke('clientes:update', id, data) as Promise<Cliente | null>,
  },
  fornecedores: {
    list: (empresaId: string) => ipcRenderer.invoke('fornecedores:list', empresaId) as Promise<Fornecedor[]>,
    get: (id: string) => ipcRenderer.invoke('fornecedores:get', id) as Promise<Fornecedor | null>,
    historico: (id: string) => ipcRenderer.invoke('fornecedores:historico', id) as Promise<FornecedorHistoricoItem[]>,
    create: (data: CreateFornecedorInput) =>
      ipcRenderer.invoke('fornecedores:create', data) as Promise<Fornecedor>,
    update: (id: string, data: UpdateFornecedorInput) =>
      ipcRenderer.invoke('fornecedores:update', id, data) as Promise<Fornecedor | null>,
    delete: (id: string) =>
      ipcRenderer.invoke('fornecedores:delete', id) as Promise<{ ok: boolean; error?: string }>
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
    getResumoFechamento: (caixaId: string) =>
      ipcRenderer.invoke('caixa:getResumoFechamento', caixaId) as Promise<CaixaResumoFechamento>,
    imprimirFechamento: (caixaId: string, valorManterProximo?: number) =>
      ipcRenderer.invoke('caixa:imprimirFechamento', caixaId, valorManterProximo) as Promise<{ ok: boolean; error?: string }>,
    getHtmlFechamento: (caixaId: string, valorManterProximo?: number) =>
      ipcRenderer.invoke('caixa:getHtmlFechamento', caixaId, valorManterProximo) as Promise<string | null>,
    listMovimentos: (caixaId: string) => ipcRenderer.invoke('caixa:listMovimentos', caixaId) as Promise<CaixaMovimento[]>,
    registrarMovimento: (data: { caixa_id: string; empresa_id: string; tipo: 'SANGRIA' | 'SUPRIMENTO'; valor: number; motivo?: string; usuario_id: string }) =>
      ipcRenderer.invoke('caixa:registrarMovimento', data) as Promise<CaixaMovimento>
  },
  vendas: {
    finalizar: (data: { empresa_id: string; usuario_id: string; cliente_id?: string; itens: { produto_id: string; descricao: string; preco_unitario: number; quantidade: number; desconto?: number }[]; pagamentos: { forma: string; valor: number }[]; desconto_total?: number; troco?: number }) =>
      ipcRenderer.invoke('vendas:finalizar', data) as Promise<Venda>,
    list: (empresaId: string, options?: { limit?: number; dataInicio?: string; dataFim?: string; periodo?: 'hoje' | 'semana' | 'mes' }) =>
      ipcRenderer.invoke('vendas:list', empresaId, options) as Promise<VendaComNfce[]>,
    get: (id: string) => ipcRenderer.invoke('vendas:get', id) as Promise<Venda | null>,
    cancelar: (vendaId: string, usuarioId: string) =>
      ipcRenderer.invoke('vendas:cancelar', vendaId, usuarioId) as Promise<Venda | null>,
    updateCliente: (vendaId: string, clienteId: string) =>
      ipcRenderer.invoke('vendas:updateCliente', vendaId, clienteId) as Promise<Venda | null>,
    getStatusNfce: (vendaId: string) =>
      ipcRenderer.invoke('vendas:getStatusNfce', vendaId) as Promise<StatusNfce | null>,
    emitirNfce: (vendaId: string) =>
      ipcRenderer.invoke('vendas:emitirNfce', vendaId) as Promise<{ ok: boolean; chave?: string; protocolo?: string; error?: string }>,
    emitirNfe: (vendaId: string) =>
      ipcRenderer.invoke('vendas:emitirNfe', vendaId) as Promise<{ ok: boolean; chave?: string; protocolo?: string; error?: string }>
  },
  nfce: {
    list: (empresaId: string, options?: { dataInicio?: string; dataFim?: string; status?: string; search?: string; limit?: number }) =>
      ipcRenderer.invoke('nfce:list', empresaId, options) as Promise<NfceListItem[]>,
    gerarDanfeA4: (vendaId: string) =>
      ipcRenderer.invoke('nfce:gerarDanfeA4', vendaId) as Promise<{ ok: boolean; path?: string; warning?: string; error?: string }>,
    exportXmlZip: (empresaId: string, vendaIds: string[]) =>
      ipcRenderer.invoke('nfce:exportXmlZip', empresaId, vendaIds) as Promise<{ ok: boolean; count?: number; error?: string }>,
  },
  nfe: {
    previewDanfeA4: (vendaId: string) =>
      ipcRenderer.invoke('nfe:previewDanfeA4', vendaId) as Promise<{ ok: boolean; error?: string }>,
    getDanfePdfPath: (vendaId: string) =>
      ipcRenderer.invoke('nfe:getDanfePdfPath', vendaId) as Promise<{ ok: boolean; pdfPath?: string; error?: string }>,
    getDanfePdfDataUrl: (vendaId: string) =>
      ipcRenderer.invoke('nfe:getDanfePdfDataUrl', vendaId) as Promise<{ ok: boolean; dataUrl?: string; error?: string }>,
    imprimirDanfeA4: (vendaId: string) =>
      ipcRenderer.invoke('nfe:imprimirDanfeA4', vendaId) as Promise<{ ok: boolean; error?: string }>,
    gerarDanfeA4: (vendaId: string) =>
      ipcRenderer.invoke('nfe:gerarDanfeA4', vendaId) as Promise<{ ok: boolean; error?: string }>,
    list: (empresaId: string, options?: { dataInicio?: string; dataFim?: string; status?: NfeStatus; search?: string; limit?: number }) =>
      ipcRenderer.invoke('nfe:list', empresaId, options) as Promise<NfeListItem[]>,
  },
  sync: {
    run: () => ipcRenderer.invoke('sync:run') as Promise<{ success: boolean; sent: number; errors: number; message: string }>,
    getPendingCount: () => ipcRenderer.invoke('sync:getPendingCount') as Promise<number>,
    getErrorCount: () => ipcRenderer.invoke('sync:getErrorCount') as Promise<number>,
    resetErrorsAndRun: () => ipcRenderer.invoke('sync:resetErrorsAndRun') as Promise<{ success: boolean; sent: number; errors: number; message: string }>,
    pullFromSupabase: () => ipcRenderer.invoke('sync:pullFromSupabase') as Promise<{ success: boolean; message: string }>,
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
    },
    onSyncDataUpdated: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('sync:dataUpdated', handler)
      return () => ipcRenderer.removeListener('sync:dataUpdated', handler)
    }
  },
  backup: {
    getDbPath: () => ipcRenderer.invoke('backup:getDbPath') as Promise<{ path: string | null; folder: string | null }>,
    openDbFolder: () => ipcRenderer.invoke('backup:openDbFolder') as Promise<{ ok: boolean; error?: string }>,
    exportToFolder: () => ipcRenderer.invoke('backup:exportToFolder') as Promise<{ ok: boolean; path?: string; error?: string }>,
    uploadToSupabase: () => ipcRenderer.invoke('backup:uploadToSupabase') as Promise<{ ok: boolean; path?: string; error?: string }>,
    restoreFromFile: () => ipcRenderer.invoke('backup:restoreFromFile') as Promise<{ ok: boolean; error?: string }>,
    restoreFromSupabase: () => ipcRenderer.invoke('backup:restoreFromSupabase') as Promise<{ ok: boolean; error?: string }>,
    listEmpresasSupabase: () => ipcRenderer.invoke('backup:listEmpresasSupabase') as Promise<{ id: string; nome: string }[]>,
    listBackupsByEmpresa: (empresaId: string) =>
      ipcRenderer.invoke('backup:listBackupsByEmpresa', empresaId) as Promise<BackupRegistryEntry[]>,
    downloadBackup: (filePath: string) =>
      ipcRenderer.invoke('backup:downloadBackup', filePath) as Promise<{ ok: boolean; path?: string; error?: string }>,
    runAutoBackup: () => ipcRenderer.invoke('backup:runAutoBackup') as Promise<{ ok: boolean; count?: number; error?: string }>,
    runManualBackupForEmpresa: (empresaId: string) =>
      ipcRenderer.invoke('backup:runManualBackupForEmpresa', empresaId) as Promise<{ ok: boolean; count?: number; error?: string }>
  },
  cupom: {
    imprimir: (vendaId: string) => ipcRenderer.invoke('cupom:imprimir', vendaId) as Promise<{ ok: boolean; error?: string }>,
    imprimirReciboRecebimento: (contaId: string) =>
      ipcRenderer.invoke('cupom:imprimirReciboRecebimento', contaId) as Promise<{ ok: boolean; error?: string }>,
    imprimirNfce: (vendaId: string) => ipcRenderer.invoke('cupom:imprimirNfce', vendaId) as Promise<{ ok: boolean; error?: string }>,
    getDetalhes: (vendaId: string) => ipcRenderer.invoke('cupom:getDetalhes', vendaId),
    getHtml: (vendaId: string) => ipcRenderer.invoke('cupom:getHtml', vendaId) as Promise<string | null>,
    getHtmlNfce: (vendaId: string) => ipcRenderer.invoke('cupom:getHtmlNfce', vendaId) as Promise<string | null>,
    listPrinters: () => ipcRenderer.invoke('cupom:listPrinters') as Promise<PrinterInfo[]>
  },
  etiquetas: {
    listTemplates: () => ipcRenderer.invoke('etiquetas:listTemplates') as Promise<LabelTemplate[]>,
    listPrinters: () => ipcRenderer.invoke('etiquetas:listPrinters') as Promise<PrinterInfo[]>,
    getPrinterStatus: (printerName: string) =>
      ipcRenderer.invoke('etiquetas:getPrinterStatus', printerName) as Promise<PrinterStatus>,
    preview: (payload: { templateId?: string; items: { produtoId: string; quantidade: number }[] }) =>
      ipcRenderer.invoke('etiquetas:preview', payload) as Promise<{
        preview: LabelPreview
        totalLabels: number
        language: 'PPLA' | 'PPLB' | 'PPLZ'
      }>,
    print: (payload: { templateId?: string; printerName: string; printMode?: 'RAW' | 'SYSTEM'; items: { produtoId: string; quantidade: number }[] }) =>
      ipcRenderer.invoke('etiquetas:print', payload) as Promise<{ ok: boolean; error?: string; labels?: number }>,
    imprimir: (produtoIds: string[]) =>
      ipcRenderer.invoke('etiquetas:imprimir', produtoIds) as Promise<{ ok: boolean; error?: string }>
  },
  cashback: {
    getConfig: (empresaId: string) => ipcRenderer.invoke('cashback:getConfig', empresaId),
    updateConfig: (empresaId: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('cashback:updateConfig', empresaId, data),
    listRegras: (empresaId: string) => ipcRenderer.invoke('cashback:listRegras', empresaId),
    createRegra: (payload: Record<string, unknown>) => ipcRenderer.invoke('cashback:createRegra', payload),
    deleteRegra: (empresaId: string, regraId: string) => ipcRenderer.invoke('cashback:deleteRegra', empresaId, regraId),
    getSaldoCliente: (empresaId: string, clienteId: string) =>
      ipcRenderer.invoke('cashback:getSaldoCliente', empresaId, clienteId),
    getSaldoCpf: (empresaId: string, cpf: string) => ipcRenderer.invoke('cashback:getSaldoCpf', empresaId, cpf),
    listMovimentacoes: (empresaId: string, clienteId: string, limit?: number) =>
      ipcRenderer.invoke('cashback:listMovimentacoes', empresaId, clienteId, limit),
    listCreditosCliente: (empresaId: string, clienteId: string, limit?: number) =>
      ipcRenderer.invoke('cashback:listCreditosCliente', empresaId, clienteId, limit) as Promise<
        {
          id: string
          venda_id_origem: string | null
          valor_inicial: number
          valor_restante: number
          expira_em: string | null
          status: string
          created_at: string
        }[]
      >,
    listClientes: (empresaId: string, opts?: Record<string, unknown>) =>
      ipcRenderer.invoke('cashback:listClientes', empresaId, opts),
    ajusteManual: (payload: Record<string, unknown>) => ipcRenderer.invoke('cashback:ajusteManual', payload),
    setBloqueio: (empresaId: string, clienteId: string, bloqueado: boolean) =>
      ipcRenderer.invoke('cashback:setBloqueio', empresaId, clienteId, bloqueado),
    relatorio: (empresaId: string, dataInicio?: string, dataFim?: string) =>
      ipcRenderer.invoke('cashback:relatorio', empresaId, dataInicio, dataFim)
  },
  contasReceber: {
    getVendaPrazoConfig: (empresaId: string) => ipcRenderer.invoke('contasReceber:getVendaPrazoConfig', empresaId),
    updateVendaPrazoConfig: (empresaId: string, data: { usar_limite_credito?: boolean; bloquear_inadimplente?: boolean }) =>
      ipcRenderer.invoke('contasReceber:updateVendaPrazoConfig', empresaId, data),
    list: (empresaId: string, options?: { cliente_id?: string; status?: string; limit?: number }) =>
      ipcRenderer.invoke('contasReceber:list', empresaId, options),
    receber: (data: {
      conta_id: string
      empresa_id: string
      caixa_id: string
      usuario_id: string
      forma: string
    }) => ipcRenderer.invoke('contasReceber:receber', data),
    listHistoricoPrazo: (empresaId: string, clienteId: string) =>
      ipcRenderer.invoke('contasReceber:listHistoricoPrazo', empresaId, clienteId),
    getTotalAbertoCliente: (empresaId: string, clienteId: string) =>
      ipcRenderer.invoke('contasReceber:getTotalAbertoCliente', empresaId, clienteId)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type BackupRegistryEntry = {
  id: string
  empresa_id: string
  file_path: string
  backup_date: string
  file_size_bytes: number | null
  status: string
}

export type ElectronAPI = typeof api
