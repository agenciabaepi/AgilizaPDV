export type UsuarioSession = {
  id: string
  empresa_id: string
  nome: string
  login: string
  email?: string | null
  role: string
  created_at: string
}

export type Produto = {
  id: string
  empresa_id: string
  codigo: number | null
  nome: string
  sku: string | null
  codigo_barras: string | null
  preco: number
  unidade: string | null
  ativo: number
  produto_pai_id?: string | null
  variacao_valores_json?: string | null
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
}

export type PrinterInfo = { name: string; isDefault: boolean }
export type PrinterStatus = { name: string; online: boolean; detail: string }

export type UpdateState = {
  phase: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'
  message?: string
  version?: string
  percent?: number
}

export type EtiquetaAPI = {
  auth: {
    login: (email: string, senha: string) => Promise<UsuarioSession>
  }
  produtos: {
    list: (
      empresaId: string,
      options?: { search?: string }
    ) => Promise<{ items: Produto[]; preferredVariacaoByPai: Record<string, string> }>
    listVariacoes: (empresaId: string, produtoPaiId: string) => Promise<Produto[]>
  }
  etiquetas: {
    listTemplates: () => Promise<LabelTemplate[]>
    listPrinters: () => Promise<PrinterInfo[]>
    getPrinterStatus: (printerName: string) => Promise<PrinterStatus>
    preview: (payload: {
      empresaId: string
      templateId: string
      items: { produtoId: string; quantidade: number }[]
    }) => Promise<{
      preview: { html: string }
      totalLabels: number
      language: string
    }>
    print: (payload: {
      empresaId: string
      templateId?: string
      printerName: string
      items: { produtoId: string; quantidade: number }[]
    }) => Promise<{ ok: boolean; labels?: number; error?: string }>
  }
  app: {
    getVersion: () => Promise<string>
    getUpdateState: () => Promise<UpdateState>
    checkForUpdates: () => Promise<UpdateState>
    installUpdateNow: () => Promise<{ ok: boolean; message: string }>
    onUpdateStatus: (callback: (state: UpdateState) => void) => () => void
  }
}

declare global {
  interface Window {
    etiquetaAPI: EtiquetaAPI
  }
}

export {}
