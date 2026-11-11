import { contextBridge, ipcRenderer } from 'electron'

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

const api = {
  auth: {
    login: (email: string, senha: string): Promise<UsuarioSession> =>
      ipcRenderer.invoke('auth:login', email, senha)
  },
  produtos: {
    list: (
      empresaId: string,
      options?: { search?: string }
    ): Promise<{ items: Produto[]; preferredVariacaoByPai: Record<string, string> }> =>
      ipcRenderer.invoke('produtos:list', empresaId, options),
    listVariacoes: (empresaId: string, produtoPaiId: string): Promise<Produto[]> =>
      ipcRenderer.invoke('produtos:listVariacoes', empresaId, produtoPaiId)
  },
  etiquetas: {
    listTemplates: (): Promise<LabelTemplate[]> =>
      ipcRenderer.invoke('etiquetas:listTemplates'),
    listPrinters: (): Promise<PrinterInfo[]> =>
      ipcRenderer.invoke('etiquetas:listPrinters'),
    getPrinterStatus: (printerName: string): Promise<PrinterStatus> =>
      ipcRenderer.invoke('etiquetas:getPrinterStatus', printerName),
    preview: (payload: {
      empresaId: string
      templateId: string
      items: { produtoId: string; quantidade: number }[]
    }) => ipcRenderer.invoke('etiquetas:preview', payload),
    print: (payload: {
      empresaId: string
      templateId?: string
      printerName: string
      items: { produtoId: string; quantidade: number }[]
    }): Promise<{ ok: boolean; labels?: number; error?: string }> =>
      ipcRenderer.invoke('etiquetas:print', payload)
  },
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
    getUpdateState: (): Promise<UpdateState> => ipcRenderer.invoke('app:getUpdateState'),
    checkForUpdates: (): Promise<UpdateState> => ipcRenderer.invoke('app:checkForUpdates'),
    installUpdateNow: (): Promise<{ ok: boolean; message: string }> =>
      ipcRenderer.invoke('app:installUpdateNow'),
    onUpdateStatus: (callback: (state: UpdateState) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: UpdateState) => callback(state)
      ipcRenderer.on('app:updateStatus', listener)
      return () => ipcRenderer.removeListener('app:updateStatus', listener)
    }
  }
}

contextBridge.exposeInMainWorld('etiquetaAPI', api)

export type EtiquetaAPI = typeof api
