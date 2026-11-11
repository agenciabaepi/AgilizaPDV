import { app, ipcMain, BrowserWindow } from 'electron'
import { authenticateByEmail } from './auth'
import { getProdutosByIds, listProdutos, listVariacoes } from './produtos'
import {
  buildLabelArtifacts,
  createPrintAdapter,
  listLabelTemplates,
  DEFAULT_LABEL_TEMPLATE_ID,
  type LabelJobItem,
  type ProductLabelData
} from './labels'
import type { Produto } from './produtos'
import {
  checkForAppUpdates,
  getUpdateState,
  installDownloadedUpdate
} from './updater'

type PrintItemInput = { produtoId: string; quantidade: number }

function toLabelProduct(p: Produto): ProductLabelData {
  return {
    id: p.id,
    nome: p.nome,
    preco: Number(p.preco) || 0,
    codigoInterno: String(p.codigo ?? p.id.slice(0, 8)),
    codigoBarras: p.codigo_barras,
    unidade: p.unidade ?? 'UN'
  }
}

async function resolveJobItems(
  empresaId: string,
  items: PrintItemInput[]
): Promise<LabelJobItem[]> {
  const ids = [...new Set(items.map((i) => i.produtoId))]
  const produtos = await getProdutosByIds(empresaId, ids)
  const map = new Map(produtos.map((p) => [p.id, p]))
  return items
    .map((item) => {
      const p = map.get(item.produtoId)
      if (!p) return null
      return {
        product: toLabelProduct(p),
        quantity: Math.max(1, Math.floor(item.quantidade || 1))
      }
    })
    .filter((x): x is LabelJobItem => Boolean(x))
}

function inferLanguageFromPrinterName(printerName: string): 'PPLA' | 'PPLB' | null {
  const name = (printerName || '').toLowerCase()
  if (name.includes('ppla')) return 'PPLA'
  if (name.includes('pplb')) return 'PPLB'
  return null
}

function getMainWindow(): BrowserWindow | null {
  return BrowserWindow.getAllWindows()[0] ?? null
}

export function registerIpcHandlers(): void {
  const adapter = createPrintAdapter()

  ipcMain.handle('auth:login', async (_e, email: string, senha: string) => {
    return authenticateByEmail(email, senha)
  })

  ipcMain.handle('produtos:list', async (_e, empresaId: string, options?: { search?: string }) => {
    return listProdutos(empresaId, { apenasAtivos: true, search: options?.search })
  })

  ipcMain.handle('produtos:listVariacoes', async (_e, empresaId: string, produtoPaiId: string) => {
    return listVariacoes(empresaId, produtoPaiId)
  })

  ipcMain.handle('etiquetas:listTemplates', async () => listLabelTemplates())

  ipcMain.handle('etiquetas:listPrinters', async () => adapter.listPrinters())

  ipcMain.handle('etiquetas:getPrinterStatus', async (_e, printerName: string) => {
    return adapter.getPrinterStatus(printerName)
  })

  ipcMain.handle(
    'etiquetas:preview',
    async (
      _e,
      payload: { empresaId: string; templateId: string; items: PrintItemInput[] }
    ) => {
      const jobItems = await resolveJobItems(payload.empresaId, payload.items)
      const artifacts = buildLabelArtifacts(payload.templateId, jobItems)
      return {
        preview: artifacts.preview,
        totalLabels: artifacts.layout.totalLabels,
        language: artifacts.template.language
      }
    }
  )

  ipcMain.handle(
    'etiquetas:print',
    async (
      _e,
      payload: {
        empresaId: string
        templateId?: string
        printerName: string
        items: PrintItemInput[]
      }
    ) => {
      try {
        const templates = listLabelTemplates()
        let templateId = payload.templateId || DEFAULT_LABEL_TEMPLATE_ID
        const inferred = inferLanguageFromPrinterName(payload.printerName)
        // Força o idioma do modelo conforme a fila (ex.: "... PPLA ..." → template PPLA).
        // Enviar PPLB para uma Argox em PPLA trava o job em "Enviando dados".
        if (inferred) {
          const match = templates.find((t) => t.language === inferred)
          if (match) templateId = match.id
        }

        const jobItems = await resolveJobItems(payload.empresaId, payload.items)
        if (jobItems.length === 0) {
          return { ok: false, error: 'Nenhum produto válido na fila.' }
        }

        const artifacts = buildLabelArtifacts(templateId, jobItems)
        await adapter.sendRaw(payload.printerName, artifacts.payload.raw)
        return {
          ok: true,
          labels: artifacts.layout.totalLabels,
          language: artifacts.template.language
        }
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err)
        }
      }
    }
  )

  ipcMain.handle('app:getVersion', async () => app.getVersion())
  ipcMain.handle('app:getUpdateState', async () => getUpdateState())
  ipcMain.handle('app:checkForUpdates', async () => checkForAppUpdates(getMainWindow))
  ipcMain.handle('app:installUpdateNow', async () => installDownloadedUpdate())
}

export function sendToRenderer(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, ...args)
  }
}
