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

/** PDV conectado ao store-server (painel Terminais / suporte). */
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
  tipo_pessoa: 'F' | 'J'
  razao_social: string | null
  nome_fantasia: string | null
  inscricao_estadual: string | null
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
  /** CPF (PF) ou CNPJ (PJ) */
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

export type CaixaResumoFechamento = {
  saldo_atual: number
  totais_por_forma: { forma: 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'OUTROS'; total: number }[]
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
  nfe_emitida?: boolean
  nfe_chave?: string | null
}

export type VendaItemDetalhe = {
  produto_id?: string
  descricao: string
  preco_unitario: number
  quantidade: number
  desconto: number
  total: number
}

export type VendaPagamentoDetalhe = {
  forma: string
  valor: number
}

export type VendaDetalhes = {
  venda: Venda
  empresa_nome: string
  itens: VendaItemDetalhe[]
  pagamentos: VendaPagamentoDetalhe[]
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
  nfe_created_at: string | null
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
  labelGapMm: number
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
        ensureNfeAvulsa: (
          empresaId: string
        ) => Promise<{ ok: true; produtoId: string } | { ok: false; error: string }>
      }
      clientes: {
        list: (empresaId: string) => Promise<Cliente[]>
        create: (
          d: { empresa_id: string } & Partial<Omit<Cliente, 'id' | 'empresa_id' | 'created_at'>>
        ) => Promise<Cliente>
        update: (
          id: string,
          d: Partial<Omit<Cliente, 'id' | 'empresa_id' | 'created_at'>>
        ) => Promise<Cliente | null>
      }
      fornecedores: {
        list: (empresaId: string) => Promise<Fornecedor[]>
        get: (id: string) => Promise<Fornecedor | null>
        historico: (id: string) => Promise<FornecedorHistoricoItem[]>
        create: (d: CreateFornecedorInput) => Promise<Fornecedor>
        update: (id: string, d: UpdateFornecedorInput) => Promise<Fornecedor | null>
        delete: (id: string) => Promise<{ ok: boolean; error?: string }>
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
        getResumoFechamento: (caixaId: string) => Promise<CaixaResumoFechamento>
        imprimirFechamento: (caixaId: string, valorManterProximo?: number) => Promise<{ ok: boolean; error?: string }>
        getHtmlFechamento: (caixaId: string, valorManterProximo?: number) => Promise<string | null>
        listMovimentos: (caixaId: string) => Promise<CaixaMovimento[]>
        registrarMovimento: (d: RegistrarMovimentoCaixaInput) => Promise<CaixaMovimento>
      }
      vendas: {
        finalizar: (d: FinalizarVendaInput) => Promise<Venda>
        list: (empresaId: string, options?: { limit?: number; dataInicio?: string; dataFim?: string; periodo?: 'hoje' | 'semana' | 'mes' }) => Promise<VendaComNfce[]>
        get: (id: string) => Promise<Venda | null>
        cancelar: (vendaId: string, usuarioId: string) => Promise<Venda | null>
        updateCliente: (vendaId: string, clienteId: string) => Promise<Venda | null>
        getStatusNfce: (vendaId: string) => Promise<StatusNfce | null>
        emitirNfce: (vendaId: string) => Promise<{ ok: boolean; chave?: string; protocolo?: string; error?: string }>
        emitirNfe: (vendaId: string) => Promise<{ ok: boolean; chave?: string; protocolo?: string; error?: string }>
      }
      nfce: {
        list: (empresaId: string, options?: { dataInicio?: string; dataFim?: string; status?: string; search?: string; limit?: number }) => Promise<NfceListItem[]>
      }
      nfe: {
        previewDanfeA4: (vendaId: string) => Promise<{ ok: boolean; error?: string }>
        getDanfePdfPath: (vendaId: string) => Promise<{ ok: boolean; pdfPath?: string; error?: string }>
        getDanfePdfDataUrl: (vendaId: string) => Promise<{ ok: boolean; dataUrl?: string; error?: string }>
        imprimirDanfeA4: (vendaId: string) => Promise<{ ok: boolean; error?: string }>
        gerarDanfeA4: (vendaId: string) => Promise<{ ok: boolean; error?: string }>
        list: (
          empresaId: string,
          options?: { dataInicio?: string; dataFim?: string; status?: NfeStatus; search?: string; limit?: number }
        ) => Promise<NfeListItem[]>
      }
      network: {
        getLocalIPv4s: () => Promise<string[]>
      }
      terminais: {
        listConectados: () => Promise<
          | { ok: true; terminais: TerminaiConectado[]; total: number }
          | { ok: false; error: string; terminais: []; total: 0 }
        >
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
        print: (payload: { templateId?: string; printerName: string; printMode?: 'RAW' | 'SYSTEM'; items: { produtoId: string; quantidade: number }[] }) => Promise<{ ok: boolean; error?: string; labels?: number }>
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
        set: (partial: { dbPath?: string | null; syncOnChange?: boolean; serverUrl?: string | null }) => Promise<{ ok: boolean; error?: string }>
        setDbPath: (folderPath: string | null) => Promise<{ ok: boolean }>
      }
      server: {
        getUrl: () => Promise<string | null>
        discover: () => Promise<{ found: false } | { found: true; name: string; url: string }>
        onUrlUpdated: (callback: (url: string) => void) => () => void
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
