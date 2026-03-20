import { ipcMain, BrowserWindow, app, dialog, shell, safeStorage } from 'electron'
import { join, dirname } from 'path'
import { copyFileSync, mkdirSync, existsSync, unlinkSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import * as empresasService from '../../backend/services/empresas.service'
import * as usuariosService from '../../backend/services/usuarios.service'
import * as produtosService from '../../backend/services/produtos.service'
import * as clientesService from '../../backend/services/clientes.service'
import * as fornecedoresService from '../../backend/services/fornecedores.service'
import * as categoriasService from '../../backend/services/categorias.service'
import * as estoqueService from '../../backend/services/estoque.service'
import * as caixaService from '../../backend/services/caixa.service'
import * as vendasService from '../../backend/services/vendas.service'
import { cupomToHtml } from '../cupom'
import { fechamentoCaixaToHtml } from '../caixa-fechamento'
import { nfceCupomToHtml } from '../nfce-cupom'
import { buildNfceQRCodeUrl } from '../nfce-qrcode-url'
import { etiquetasToHtml, type ProdutoEtiqueta } from '../etiquetas'
import { getProdutoById } from '../../backend/services/produtos.service'
import {
  DEFAULT_LABEL_TEMPLATE_ID,
  buildLabelArtifacts,
  createPrintAdapter,
  listLabelTemplates,
  type LabelJobItem
} from '../labels'
import * as syncEngine from '../../sync/sync-engine'
import * as outbox from '../../sync/outbox'
import * as backup from '../backup'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase-config.generated'
import { getDbPath } from '../../backend/db'
import * as suporteService from '../../backend/services/suporte.service'
import * as certificadoService from '../../backend/services/certificado.service'
import * as nfceService from '../../backend/services/nfce.service'
import { computeTributosAproxNfceCupom } from '../../backend/services/nfce-tributos-cupom'
import * as nfeService from '../../backend/services/nfe.service'
import { getConfig, setConfig, setDbPath as configSetDbPath } from '../config'
import { discoverLocalServer, normalizeServerUrl } from '../server-discovery'
import { getInstallMode } from '../install-mode'
import { checkForAppUpdates, getUpdateState, installDownloadedUpdate } from '../updater'

function sendAutoSyncStatus(status: 'syncing' | 'success' | 'error', message: string): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win || win.isDestroyed()) return
  win.webContents.send('sync:autoStatus', { status, message })
}

function maybeSyncAfterChange(): void {
  if (getConfig()?.syncOnChange === false) return
  sendAutoSyncStatus('syncing', 'Sincronizando...')
  syncEngine
    .runSync()
    .then((result) => {
      sendAutoSyncStatus(result.success ? 'success' : 'error', result.message)
    })
    .catch(() => {
      sendAutoSyncStatus('error', 'Erro ao sincronizar.')
    })
}

function buildThermalReceiptHtml(innerHtml: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: 80mm auto; margin: 0; }
      html, body {
        margin: 0;
        padding: 0;
        width: 80mm;
        background: #fff;
      }
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        font-family: monospace;
      }
    </style>
  </head>
  <body>${innerHtml}</body>
</html>`
}

function buildCupomPrintOptions(impressoraCupom: string | null): Electron.WebContentsPrintOptions {
  const base: Electron.WebContentsPrintOptions = {
    silent: Boolean(impressoraCupom),
    printBackground: true,
  }
  if (impressoraCupom) {
    base.deviceName = impressoraCupom
  }
  return base
}

function buildPdfPreviewHtml(pdfUrl: string, title: string): string {
  // Evita dependência de bibliotecas externas: embed do PDF + botão para imprimir.
  // Observação: o `window.print()` imprime o conteúdo da janela (incluindo o embed do PDF)
  // no contexto do Chromium/Electron.
  const safeTitle = title.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] as string))
  const safePdfUrl = pdfUrl.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] as string))
  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${safeTitle}</title>
      <style>
        :root { color-scheme: light; }
        body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial; }
        .bar { height: 48px; display: flex; align-items: center; gap: 12px; padding: 0 12px; border-bottom: 1px solid #e6e6e6; }
        .bar .title { font-weight: 600; }
        .bar button { padding: 8px 12px; border-radius: 8px; border: 1px solid #d9d9d9; background: #fff; cursor: pointer; }
        .bar button:hover { background: #f5f5f5; }
        .wrap { height: calc(100vh - 48px); }
        embed { width: 100%; height: 100%; border: 0; }
        @media print {
          .bar { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="bar">
        <div class="title">${safeTitle}</div>
        <div style="flex: 1"></div>
        <button onclick="window.print()">Imprimir</button>
      </div>
      <div class="wrap">
        <embed src="${safePdfUrl}" type="application/pdf" />
      </div>
    </body>
  </html>`
}

export type UsuarioSession = {
  id: string
  empresa_id: string
  nome: string
  login: string
  role: string
  modulos_json: string | null
  created_at: string
}

export type SuporteSession = {
  suporte: true
  id: string
  nome: string
  login: string
}

export type AppSession = UsuarioSession | SuporteSession

let currentSession: AppSession | null = null
let remoteSessionId: string | null = null

function getSessionFilePath(): string {
  return join(app.getPath('userData'), 'session.dat')
}

function clearPersistedSession(): void {
  const path = getSessionFilePath()
  if (existsSync(path)) {
    try {
      unlinkSync(path)
    } catch {
      // ignore
    }
  }
}

function saveSessionToDisk(): void {
  if (!currentSession || ('suporte' in currentSession)) {
    clearPersistedSession()
    return
  }
  if (!safeStorage.isEncryptionAvailable()) return
  try {
    const payload = JSON.stringify({ session: currentSession, remoteSessionId })
    const encrypted = safeStorage.encryptString(payload).toString('base64')
    writeFileSync(getSessionFilePath(), encrypted, { encoding: 'utf8' })
  } catch {
    // ignore persistence errors
  }
}

function loadSessionFromDisk(): void {
  if (!safeStorage.isEncryptionAvailable()) return
  const path = getSessionFilePath()
  if (!existsSync(path)) return
  try {
    const encryptedBase64 = readFileSync(path, { encoding: 'utf8' })
    const buf = Buffer.from(encryptedBase64, 'base64')
    const decrypted = safeStorage.decryptString(buf)
    const parsed = JSON.parse(decrypted) as { session?: AppSession; remoteSessionId?: string | null }
    if (parsed.session && !('suporte' in parsed.session)) {
      currentSession = parsed.session
      remoteSessionId = parsed.remoteSessionId ?? null
    } else {
      currentSession = null
      remoteSessionId = null
      clearPersistedSession()
    }
  } catch {
    currentSession = null
    remoteSessionId = null
    clearPersistedSession()
  }
}

function getRemoteBaseUrl(): string | null {
  const url = getConfig()?.serverUrl?.trim()
  if (!url) return null
  return url.replace(/\/+$/, '')
}

function hasRemoteServerConfigured(): boolean {
  return Boolean(getRemoteBaseUrl())
}

async function remoteRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getRemoteBaseUrl()
  if (!base) throw new Error('Servidor da loja não configurado.')
  const headers = new Headers(init?.headers ?? {})
  if (!headers.has('content-type') && init?.body != null) {
    headers.set('content-type', 'application/json')
  }
  if (remoteSessionId && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${remoteSessionId}`)
  }
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers
  })
  const text = await response.text()
  const payload = (() => {
    if (!text) return null
    try {
      return JSON.parse(text) as unknown
    } catch {
      return text
    }
  })()
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `Erro HTTP ${response.status}`
    throw new Error(message)
  }
  return payload as T
}

export function registerIpcHandlers(): void {
  // App
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:getInstallMode', () => getInstallMode())
  ipcMain.handle('app:getUpdateState', () => getUpdateState())
  ipcMain.handle('app:checkForUpdates', () =>
    checkForAppUpdates(() => BrowserWindow.getAllWindows()[0] ?? null)
  )
  ipcMain.handle('app:installUpdateNow', () => installDownloadedUpdate())

  // Empresas
  ipcMain.handle('empresas:list', async () => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest<ReturnType<typeof empresasService.listEmpresas>>('/empresas')
    }
    return empresasService.listEmpresas()
  })
  ipcMain.handle('empresas:create', async (_e, data: { nome: string; cnpj?: string }) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest('/empresas', { method: 'POST', body: JSON.stringify(data) })
    }
    const result = empresasService.createEmpresa(data)
    maybeSyncAfterChange()
    return result
  })
  ipcMain.handle('empresas:getConfig', async (_e, empresaId: string) => {
    if (hasRemoteServerConfigured()) {
      try {
        return await remoteRequest<empresasService.EmpresaConfig | null>(`/empresas/${empresaId}/config`)
      } catch {
        return null
      }
    }
    return empresasService.getEmpresaConfig(empresaId)
  })
  ipcMain.handle('empresas:updateConfig', async (_e, empresaId: string, data: empresasService.UpdateEmpresaConfigInput) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest(`/empresas/${empresaId}/config`, { method: 'PUT', body: JSON.stringify(data) })
    }
    const result = empresasService.updateEmpresaConfig(empresaId, data)
    maybeSyncAfterChange()
    return result
  })
  ipcMain.handle('empresas:getFiscalConfig', async (_e, empresaId: string) => {
    if (hasRemoteServerConfigured()) {
      try {
        return await remoteRequest<empresasService.EmpresaFiscalConfig | null>(`/empresas/${empresaId}/fiscal-config`)
      } catch {
        return null
      }
    }
    return empresasService.getFiscalConfig(empresaId)
  })
  ipcMain.handle('empresas:updateFiscalConfig', async (_e, empresaId: string, data: empresasService.UpdateFiscalConfigInput) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest(`/empresas/${empresaId}/fiscal-config`, { method: 'PUT', body: JSON.stringify(data) })
    }
    const result = empresasService.updateFiscalConfig(empresaId, data)
    maybeSyncAfterChange()
    return result
  })

  // Certificado digital A1 (apenas modo local)
  ipcMain.handle('certificado:getStatus', async (_e, empresaId: string) => {
    if (hasRemoteServerConfigured()) {
      return { hasCertificado: false, path: null, updatedAt: null }
    }
    const info = certificadoService.getCertificadoInfo(empresaId)
    if (!info) return { hasCertificado: false, path: null, updatedAt: null }
    return {
      hasCertificado: true,
      path: info.caminho_arquivo,
      updatedAt: info.updated_at,
    }
  })
  ipcMain.handle('certificado:selectAndUpload', async (_e, empresaId: string, senha: string) => {
    try {
      if (hasRemoteServerConfigured()) {
        return { ok: false, error: 'Upload de certificado disponível apenas no modo local.' }
      }
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const { canceled, filePaths } = await dialog.showOpenDialog(win ?? undefined, {
        title: 'Selecionar certificado digital (A1)',
        properties: ['openFile'],
        filters: [{ name: 'Certificado PFX/P12', extensions: ['pfx', 'p12'] }],
      })
      if (canceled || !filePaths?.length) {
        return { ok: false, error: 'Nenhum arquivo selecionado.' }
      }
      const sourcePath = filePaths[0]
      const certDir = join(app.getPath('userData'), 'certificados')
      if (!existsSync(certDir)) {
        mkdirSync(certDir, { recursive: true })
      }
      const destPath = join(certDir, `${empresaId}.pfx`)
      try {
        copyFileSync(sourcePath, destPath)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao copiar arquivo.'
        return { ok: false, error: msg }
      }
      let senhaEncrypted: string | null = null
      if (typeof safeStorage !== 'undefined' && safeStorage.isEncryptionAvailable()) {
        try {
          senhaEncrypted = safeStorage.encryptString(senha).toString('base64')
        } catch (encErr) {
          const encMsg = encErr instanceof Error ? encErr.message : 'Falha ao criptografar senha.'
          return { ok: false, error: encMsg }
        }
      } else {
        return {
          ok: false,
          error: 'Criptografia de senha não disponível neste sistema. Use um ambiente que suporte safeStorage (ex.: Windows/macOS em modo local).',
        }
      }
      const saved = certificadoService.saveCertificado(empresaId, destPath, senhaEncrypted)
      if (!saved) {
        return { ok: false, error: 'Banco de dados não disponível. Tente novamente.' }
      }
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: msg || 'Erro ao instalar certificado.' }
    }
  })
  ipcMain.handle('certificado:remove', async (_e, empresaId: string) => {
    if (hasRemoteServerConfigured()) {
      return { ok: false, error: 'Remoção de certificado disponível apenas no modo local.' }
    }
    const raw = certificadoService.getCertificadoRaw(empresaId)
    if (raw && existsSync(raw.caminho_arquivo)) {
      try {
        unlinkSync(raw.caminho_arquivo)
      } catch {
        // continua e remove do banco
      }
    }
    certificadoService.removeCertificado(empresaId)
    return { ok: true }
  })

  // Usuários
  ipcMain.handle('usuarios:list', async (_e, empresaId: string) => {
    if (hasRemoteServerConfigured()) {
      const qs = empresaId ? `?empresaId=${encodeURIComponent(empresaId)}` : ''
      return remoteRequest(`/usuarios${qs}`)
    }
    return usuariosService.listUsuariosByEmpresa(empresaId)
  })
  ipcMain.handle('usuarios:get', async (_e, id: string) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest<usuariosService.Usuario | null>(`/usuarios/${encodeURIComponent(id)}`)
    }
    return usuariosService.getUsuarioById(id)
  })
  ipcMain.handle('usuarios:create', async (
    _e,
    data: { empresa_id: string; nome: string; login: string; senha: string; role: usuariosService.Role; modulos_json?: string | null }
  ) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest('/usuarios', { method: 'POST', body: JSON.stringify(data) })
    }
    const result = usuariosService.createUsuario(data)
    maybeSyncAfterChange()
    return result
  })
  ipcMain.handle('usuarios:update', async (_e, id: string, data: usuariosService.UpdateUsuarioInput) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest(`/usuarios/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      })
    }
    const result = usuariosService.updateUsuario(id, data)
    if (result) maybeSyncAfterChange()
    return result
  })

  // Auth
  ipcMain.handle('auth:login', async (_e, empresaId: string, login: string, senha: string) => {
    if (hasRemoteServerConfigured()) {
      const result = await remoteRequest<{ user: UsuarioSession | null; sessionId?: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ empresaId, login, senha })
      })
      if (!result?.user || !result.sessionId) return null
      remoteSessionId = result.sessionId
      currentSession = result.user
      saveSessionToDisk()
      return currentSession
    }
    const user = usuariosService.login(empresaId, login, senha)
    if (!user) return null
    currentSession = user as UsuarioSession
    saveSessionToDisk()
    return currentSession
  })
  ipcMain.handle('auth:supportLogin', (_e, login: string, senha: string) => {
    remoteSessionId = null
    const user = suporteService.loginSuporte(login, senha)
    if (!user) return null
    currentSession = { suporte: true, id: user.id, nome: user.nome, login: user.login }
    saveSessionToDisk()
    return currentSession
  })
  ipcMain.handle('auth:getSession', async () => {
    if (!currentSession) {
      loadSessionFromDisk()
    }
    if (remoteSessionId && hasRemoteServerConfigured() && (!currentSession || !('suporte' in currentSession))) {
      try {
        const result = await remoteRequest<{ user?: UsuarioSession }>('/auth/session')
        if (result?.user) currentSession = result.user
      } catch {
        remoteSessionId = null
      }
    }
    return currentSession
  })
  ipcMain.handle('auth:ensureAdminUser', async (_e, empresaId: string) => {
    if (!currentSession || !('suporte' in currentSession)) {
      return { ok: false, message: 'Apenas suporte pode usar esta função.' }
    }
    const result = usuariosService.ensureAdminUser(empresaId)
    if (result.ok) maybeSyncAfterChange()
    return result
  })
  ipcMain.handle('auth:logout', async () => {
    if (remoteSessionId && hasRemoteServerConfigured()) {
      try {
        await remoteRequest('/auth/logout', { method: 'POST' })
      } catch {
        // ignore remote logout failures
      }
    }
    remoteSessionId = null
    currentSession = null
    clearPersistedSession()
    return undefined
  })

  // Produtos
  ipcMain.handle('produtos:list', async (_e, empresaId: string, options?: { search?: string; apenasAtivos?: boolean; ordenarPorMaisVendidos?: boolean }) => {
    if (hasRemoteServerConfigured()) {
      const qs = new URLSearchParams()
      if (empresaId) qs.set('empresaId', empresaId)
      if (options?.search) qs.set('search', options.search)
      if (options?.apenasAtivos !== undefined) qs.set('apenasAtivos', String(options.apenasAtivos))
      if (options?.ordenarPorMaisVendidos !== undefined) qs.set('ordenarPorMaisVendidos', String(options.ordenarPorMaisVendidos))
      return remoteRequest(`/produtos?${qs.toString()}`)
    }
    return produtosService.listProdutos(empresaId, options)
  })
  ipcMain.handle('produtos:get', async (_e, id: string) => {
    if (hasRemoteServerConfigured()) return remoteRequest(`/produtos/${encodeURIComponent(id)}`)
    return produtosService.getProdutoById(id)
  })
  ipcMain.handle('produtos:getNextCodigo', async (_e, empresaId: string) => {
    if (hasRemoteServerConfigured()) {
      const qs = empresaId ? `?empresaId=${encodeURIComponent(empresaId)}` : ''
      return remoteRequest<number>(`/produtos/next-codigo${qs}`)
    }
    return produtosService.getNextCodigo(empresaId)
  })
  ipcMain.handle('produtos:create', async (_e, data: produtosService.CreateProdutoInput) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest('/produtos', { method: 'POST', body: JSON.stringify(data) })
    }
    const result = produtosService.createProduto(data)
    maybeSyncAfterChange()
    return result
  })
  ipcMain.handle('produtos:update', async (_e, id: string, data: produtosService.UpdateProdutoInput) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest(`/produtos/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      })
    }
    const result = produtosService.updateProduto(id, data)
    maybeSyncAfterChange()
    return result
  })
  ipcMain.handle('produtos:ensureNfeAvulsa', async (_e, empresaId: string) => {
    if (hasRemoteServerConfigured()) {
      return { ok: false as const, error: 'Produto interno NF-e: disponível apenas com banco local.' }
    }
    try {
      const produtoId = produtosService.ensureProdutoNfeAvulsa(empresaId)
      maybeSyncAfterChange()
      return { ok: true as const, produtoId }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false as const, error: message }
    }
  })

  // Clientes
  ipcMain.handle('clientes:list', async (_e, empresaId: string) => {
    if (hasRemoteServerConfigured()) {
      const qs = empresaId ? `?empresaId=${encodeURIComponent(empresaId)}` : ''
      return remoteRequest(`/clientes${qs}`)
    }
    return clientesService.listClientes(empresaId)
  })

  ipcMain.handle('clientes:create', async (_e, data: clientesService.CreateClienteInput) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest('/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    }
    const result = clientesService.createCliente(data)
    maybeSyncAfterChange()
    return result
  })

  ipcMain.handle(
    'clientes:update',
    async (_e, id: string, data: clientesService.UpdateClienteInput) => {
      if (hasRemoteServerConfigured()) {
        return remoteRequest(`/clientes/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      }
      const result = clientesService.updateCliente(id, data)
      maybeSyncAfterChange()
      return result
    }
  )

  // Fornecedores
  ipcMain.handle('fornecedores:list', async (_e, empresaId: string) => {
    if (hasRemoteServerConfigured()) {
      const qs = empresaId ? `?empresaId=${encodeURIComponent(empresaId)}` : ''
      return remoteRequest(`/fornecedores${qs}`)
    }
    return fornecedoresService.listFornecedores(empresaId)
  })

  // Categorias (hierárquicas: grupo → categoria → subcategoria)
  ipcMain.handle('categorias:list', async (_e, empresaId: string) => {
    if (hasRemoteServerConfigured()) {
      const qs = empresaId ? `?empresaId=${encodeURIComponent(empresaId)}` : ''
      return remoteRequest(`/categorias${qs}`)
    }
    return categoriasService.listCategorias(empresaId)
  })
  ipcMain.handle('categorias:listTree', async (_e, empresaId: string) => {
    if (hasRemoteServerConfigured()) {
      const qs = empresaId ? `?empresaId=${encodeURIComponent(empresaId)}` : ''
      return remoteRequest(`/categorias/tree${qs}`)
    }
    return categoriasService.listCategoriasTree(empresaId)
  })
  ipcMain.handle('categorias:listFolha', async (_e, empresaId: string) => {
    if (hasRemoteServerConfigured()) {
      const qs = empresaId ? `?empresaId=${encodeURIComponent(empresaId)}` : ''
      return remoteRequest(`/categorias/folha${qs}`)
    }
    return categoriasService.listCategoriasFolha(empresaId)
  })
  ipcMain.handle('categorias:get', async (_e, id: string) => {
    if (hasRemoteServerConfigured()) return remoteRequest(`/categorias/${encodeURIComponent(id)}`)
    return categoriasService.getCategoriaById(id)
  })
  ipcMain.handle('categorias:getPath', async (_e, id: string) => {
    if (hasRemoteServerConfigured()) return remoteRequest(`/categorias/path/${encodeURIComponent(id)}`)
    return categoriasService.getCategoriaPath(id)
  })
  ipcMain.handle('categorias:create', async (_e, data: categoriasService.CreateCategoriaInput) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest('/categorias', { method: 'POST', body: JSON.stringify(data) })
    }
    const result = categoriasService.createCategoria(data)
    maybeSyncAfterChange()
    return result
  })
  ipcMain.handle('categorias:update', async (_e, id: string, data: categoriasService.UpdateCategoriaInput) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest(`/categorias/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      })
    }
    const result = categoriasService.updateCategoria(id, data)
    maybeSyncAfterChange()
    return result
  })
  ipcMain.handle('categorias:delete', async (_e, id: string) => {
    if (hasRemoteServerConfigured()) {
      const result = await remoteRequest<{ ok: boolean }>(`/categorias/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      })
      return result.ok
    }
    const result = categoriasService.deleteCategoria(id)
    maybeSyncAfterChange()
    return result
  })

  // Estoque
  ipcMain.handle('estoque:listMovimentos', async (_e, empresaId: string, options?: { produtoId?: string; limit?: number }) => {
    if (hasRemoteServerConfigured()) {
      const qs = new URLSearchParams()
      if (empresaId) qs.set('empresaId', empresaId)
      if (options?.produtoId) qs.set('produtoId', options.produtoId)
      if (options?.limit) qs.set('limit', String(options.limit))
      return remoteRequest(`/estoque/movimentos?${qs.toString()}`)
    }
    return estoqueService.listMovimentos(empresaId, options)
  })
  ipcMain.handle('estoque:getSaldo', async (_e, empresaId: string, produtoId: string) => {
    if (hasRemoteServerConfigured()) {
      const qs = new URLSearchParams()
      if (empresaId) qs.set('empresaId', empresaId)
      if (produtoId) qs.set('produtoId', produtoId)
      return remoteRequest<number>(`/estoque/saldo?${qs.toString()}`)
    }
    return estoqueService.getSaldo(empresaId, produtoId)
  })
  ipcMain.handle('estoque:listSaldos', async (_e, empresaId: string) => {
    if (hasRemoteServerConfigured()) {
      const qs = empresaId ? `?empresaId=${encodeURIComponent(empresaId)}` : ''
      return remoteRequest(`/estoque/saldos${qs}`)
    }
    return estoqueService.listSaldosPorProduto(empresaId)
  })
  ipcMain.handle('estoque:registrarMovimento', async (_e, data: estoqueService.RegistrarMovimentoInput) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest('/estoque/movimento', { method: 'POST', body: JSON.stringify(data) })
    }
    const result = estoqueService.registrarMovimento(data)
    maybeSyncAfterChange()
    return result
  })
  ipcMain.handle('estoque:ajustarSaldoPara', async (_e, empresaId: string, produtoId: string, novoSaldo: number) => {
    if (hasRemoteServerConfigured()) {
      await remoteRequest('/estoque/ajustar', {
        method: 'POST',
        body: JSON.stringify({ empresaId, produtoId, novoSaldo })
      })
      return
    }
    estoqueService.ajustarSaldoPara(empresaId, produtoId, novoSaldo)
    maybeSyncAfterChange()
  })

  // Caixa
  ipcMain.handle('caixa:getAberto', async (_e, empresaId: string) => {
    if (hasRemoteServerConfigured()) {
      const qs = empresaId ? `?empresaId=${encodeURIComponent(empresaId)}` : ''
      return remoteRequest(`/caixa/aberto${qs}`)
    }
    return caixaService.getCaixaAberto(empresaId)
  })
  ipcMain.handle('caixa:abrir', async (_e, empresaId: string, usuarioId: string, valorInicial: number) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest('/caixa/abrir', {
        method: 'POST',
        body: JSON.stringify({ empresaId, usuarioId, valorInicial })
      })
    }
    const result = caixaService.abrirCaixa(empresaId, usuarioId, valorInicial)
    maybeSyncAfterChange()
    return result
  })
  ipcMain.handle('caixa:fechar', async (_e, caixaId: string) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest('/caixa/fechar', { method: 'POST', body: JSON.stringify({ caixaId }) })
    }
    const result = caixaService.fecharCaixa(caixaId)
    maybeSyncAfterChange()
    return result
  })
  ipcMain.handle('caixa:list', async (_e, empresaId: string, limit?: number) => {
    if (hasRemoteServerConfigured()) {
      const qs = new URLSearchParams()
      if (empresaId) qs.set('empresaId', empresaId)
      if (limit) qs.set('limit', String(limit))
      return remoteRequest(`/caixa/list?${qs.toString()}`)
    }
    return caixaService.listCaixas(empresaId, limit)
  })
  ipcMain.handle('caixa:getSaldo', async (_e, caixaId: string) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest<number>(`/caixa/${encodeURIComponent(caixaId)}/saldo`)
    }
    return caixaService.getSaldoCaixa(caixaId)
  })
  ipcMain.handle('caixa:getResumoFechamento', async (_e, caixaId: string) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest(`/caixa/${encodeURIComponent(caixaId)}/resumo-fechamento`)
    }
    return caixaService.getResumoFechamentoCaixa(caixaId)
  })
  ipcMain.handle('caixa:listMovimentos', async (_e, caixaId: string) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest(`/caixa/${encodeURIComponent(caixaId)}/movimentos`)
    }
    return caixaService.listMovimentosCaixa(caixaId)
  })
  ipcMain.handle('caixa:registrarMovimento', async (_e, data: caixaService.RegistrarMovimentoCaixaInput) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest('/caixa/movimento', { method: 'POST', body: JSON.stringify(data) })
    }
    const result = caixaService.registrarMovimentoCaixa(data)
    maybeSyncAfterChange()
    return result
  })

  // Vendas (PDV)
  ipcMain.handle('vendas:finalizar', async (_e, data: vendasService.FinalizarVendaInput) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest('/vendas/finalizar', { method: 'POST', body: JSON.stringify(data) })
    }
    const result = vendasService.finalizarVenda(data)
    maybeSyncAfterChange()
    return result
  })
  ipcMain.handle('vendas:list', async (_e, empresaId: string, options?: Parameters<typeof vendasService.listVendas>[1]) => {
    if (hasRemoteServerConfigured()) {
      const qs = new URLSearchParams()
      if (empresaId) qs.set('empresaId', empresaId)
      if (options?.limit) qs.set('limit', String(options.limit))
      if (options?.dataInicio) qs.set('dataInicio', options.dataInicio)
      if (options?.dataFim) qs.set('dataFim', options.dataFim)
      if (options?.periodo) qs.set('periodo', options.periodo)
      return remoteRequest(`/vendas?${qs.toString()}`)
    }
    return vendasService.listVendas(empresaId, options)
  })
  ipcMain.handle('vendas:get', async (_e, id: string) => {
    if (hasRemoteServerConfigured()) return remoteRequest(`/vendas/${encodeURIComponent(id)}`)
    return vendasService.getVendaById(id)
  })
  ipcMain.handle('vendas:cancelar', async (_e, vendaId: string, usuarioId: string) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest(`/vendas/${encodeURIComponent(vendaId)}/cancelar`, {
        method: 'POST',
        body: JSON.stringify({ usuarioId })
      })
    }
    const result = vendasService.cancelarVenda(vendaId, usuarioId)
    maybeSyncAfterChange()
    return result
  })
  ipcMain.handle('vendas:updateCliente', async (_e, vendaId: string, clienteId: string) => {
    if (hasRemoteServerConfigured()) return null
    const updated = vendasService.updateClienteVenda(vendaId, clienteId)
    if (updated) maybeSyncAfterChange()
    return updated
  })
  ipcMain.handle('vendas:getStatusNfce', async (_e, vendaId: string) => {
    if (hasRemoteServerConfigured()) return null
    return nfceService.getStatusNfce(vendaId)
  })
  ipcMain.handle('vendas:emitirNfce', async (_e, vendaId: string) => {
    if (hasRemoteServerConfigured()) {
      return { ok: false, error: 'Emissão de NFC-e disponível apenas no modo local.' }
    }
    const venda = vendasService.getVendaById(vendaId)
    if (!venda) return { ok: false, error: 'Venda não encontrada.' }
    const raw = certificadoService.getCertificadoRaw(venda.empresa_id)
    if (!raw?.caminho_arquivo) return { ok: false, error: 'Certificado digital não instalado. Configure em Notas fiscais.' }
    let certSenha = ''
    if (raw.senha_encrypted && typeof safeStorage !== 'undefined' && safeStorage.isEncryptionAvailable()) {
      try {
        const buf = Buffer.from(raw.senha_encrypted, 'base64')
        certSenha = safeStorage.decryptString(buf)
      } catch {
        return { ok: false, error: 'Não foi possível descriptografar a senha do certificado.' }
      }
    } else {
      return { ok: false, error: 'Senha do certificado não disponível.' }
    }
    return nfceService.emitirNfce(vendaId, raw.caminho_arquivo, certSenha)
  })
  ipcMain.handle('vendas:emitirNfe', async (_e, vendaId: string) => {
    if (hasRemoteServerConfigured()) {
      return { ok: false, error: 'Emissão de NF-e disponível apenas no modo local.' }
    }
    const venda = vendasService.getVendaById(vendaId)
    if (!venda) return { ok: false, error: 'Venda não encontrada.' }
    const raw = certificadoService.getCertificadoRaw(venda.empresa_id)
    if (!raw?.caminho_arquivo) {
      return { ok: false, error: 'Certificado digital não instalado. Configure em Notas fiscais.' }
    }
    let certSenha = ''
    if (raw.senha_encrypted && typeof safeStorage !== 'undefined' && safeStorage.isEncryptionAvailable()) {
      try {
        const buf = Buffer.from(raw.senha_encrypted, 'base64')
        certSenha = safeStorage.decryptString(buf)
      } catch {
        return { ok: false, error: 'Não foi possível descriptografar a senha do certificado.' }
      }
    } else {
      return { ok: false, error: 'Senha do certificado não disponível.' }
    }
    return nfeService.emitirNfe(vendaId, raw.caminho_arquivo, certSenha)
  })
  ipcMain.handle('nfce:list', async (_e, empresaId: string, options?: Parameters<typeof nfceService.listNfce>[1]) => {
    return nfceService.listNfce(empresaId, options)
  })
  ipcMain.handle('nfe:list', async (_e, empresaId: string, options?: Parameters<typeof nfeService.listNfe>[1]) => {
    return nfeService.listNfe(empresaId, options)
  })
  ipcMain.handle('nfce:exportXmlZip', async (_e, empresaId: string, vendaIds: string[]) => {
    if (hasRemoteServerConfigured()) {
      return { ok: false, error: 'Exportação de XML NFC-e disponível apenas no modo local.' }
    }
    try {
      if (!Array.isArray(vendaIds) || vendaIds.length === 0) {
        return { ok: false, error: 'Nenhuma NFC-e selecionada.' }
      }

      const rows = nfceService.getNfceXmlRowsForVendas(empresaId, vendaIds)
      const existing = rows.filter((r) => r.xml_local_path && existsSync(r.xml_local_path))
      if (existing.length === 0) {
        return { ok: false, error: 'Nenhum XML autorizado encontrado para as NFC-e selecionadas.' }
      }

      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const { canceled, filePath } = await dialog.showSaveDialog(win ?? undefined, {
        title: 'Salvar XML das NFC-e',
        defaultPath: `nfce-xml-${new Date().toISOString().slice(0, 10)}.zip`,
        filters: [{ name: 'Arquivo ZIP', extensions: ['zip'] }]
      })
      if (canceled || !filePath) {
        return { ok: false, error: 'Exportação cancelada.' }
      }

      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()

      for (const row of existing) {
        const xmlPath = row.xml_local_path!
        const xmlContent = readFileSync(xmlPath, { encoding: 'utf-8' })
        const fileName =
          row.chave && row.chave.length >= 44 ? `${row.chave}.xml` : `${row.venda_id}.xml`
        zip.file(fileName, xmlContent)
      }

      const buffer = await zip.generateAsync({ type: 'nodebuffer' })
      writeFileSync(filePath, buffer)

      return { ok: true, count: existing.length }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: msg || 'Erro ao exportar XML das NFC-e.' }
    }
  })

  // Sync (Supabase)
  ipcMain.handle('sync:run', async () => {
    if (hasRemoteServerConfigured()) return remoteRequest('/sync/run', { method: 'POST' })
    const r = await syncEngine.compareAndSync()
    return {
      success: r.success,
      sent: r.action === 'push' ? 1 : 0,
      errors: r.success ? 0 : 1,
      message: r.message
    }
  })
  ipcMain.handle('sync:getPendingCount', () => {
    if (hasRemoteServerConfigured()) return remoteRequest<number>('/sync/pending-count')
    return outbox.getPendingCount()
  })
  ipcMain.handle('sync:getErrorCount', () => {
    if (hasRemoteServerConfigured()) return remoteRequest<number>('/sync/error-count')
    return outbox.getErrorCount()
  })
  ipcMain.handle('sync:resetErrorsAndRun', async () => {
    if (hasRemoteServerConfigured()) return remoteRequest('/sync/reset-errors', { method: 'POST' })
    outbox.resetErrorsToPending()
    return syncEngine.runSync()
  })
  ipcMain.handle('sync:pullFromSupabase', async () => {
    if (hasRemoteServerConfigured()) return { success: false, message: 'Use o servidor remoto para sync.' }
    const result = await syncEngine.forcePullFromSupabase()
    if (result.success) {
      const win = BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) win.webContents.send('sync:dataUpdated')
    }
    return result
  })

  // Backup e restauro
  ipcMain.handle('backup:getDbPath', () => {
    const path = getDbPath()
    if (!path) return { path: null, folder: null }
    return { path, folder: dirname(path) }
  })
  ipcMain.handle('backup:openDbFolder', async () => {
    const path = getDbPath()
    if (!path) return { ok: false, error: 'Banco não inicializado' }
    await shell.openPath(dirname(path))
    return { ok: true }
  })
  ipcMain.handle('backup:exportToFolder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow() ?? undefined, {
      title: 'Escolha a pasta para salvar o backup',
      properties: ['openDirectory']
    })
    if (canceled || !filePaths?.length) return { ok: false, error: 'Nenhuma pasta escolhida.' }
    return backup.exportToFolder(filePaths[0])
  })
  ipcMain.handle('backup:uploadToSupabase', () => backup.uploadToSupabase())
  ipcMain.handle('backup:restoreFromFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow() ?? undefined, {
      title: 'Escolha o arquivo de backup (.db)',
      properties: ['openFile'],
      filters: [{ name: 'Banco de dados', extensions: ['db'] }]
    })
    if (canceled || !filePaths?.length) return { ok: false, error: 'Nenhum arquivo escolhido.' }
    const dbPath = getDbPath()
    const dbFolder = dbPath ? dirname(dbPath) : app.getPath('userData')
    return backup.restoreFromFile(
      filePaths[0],
      dbFolder,
      join(app.getAppPath(), 'backend', 'db', 'migrations')
    )
  })
  ipcMain.handle('backup:restoreFromSupabase', async () => {
    const dbPath = getDbPath()
    const dbFolder = dbPath ? dirname(dbPath) : app.getPath('userData')
    return backup.restoreFromSupabase(
      dbFolder,
      join(app.getAppPath(), 'backend', 'db', 'migrations'),
      app.getPath('temp')
    )
  })

  // Backup automático por empresa (somente suporte)
  ipcMain.handle('backup:listEmpresasSupabase', async () => {
    if (!currentSession || !('suporte' in currentSession)) return []
    return backup.listEmpresasFromSupabase()
  })
  ipcMain.handle('backup:listBackupsByEmpresa', async (_e, empresaId: string) => {
    if (!currentSession || !('suporte' in currentSession)) return []
    return backup.listBackupsByEmpresa(empresaId)
  })
  ipcMain.handle('backup:downloadBackup', async (_e, filePath: string) => {
    if (!currentSession || !('suporte' in currentSession)) {
      return { ok: false, error: 'Acesso restrito ao suporte.' }
    }
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const { canceled, filePath: destPath } = await dialog.showSaveDialog(win ?? undefined, {
      title: 'Salvar backup',
      defaultPath: filePath.split('/').pop() ?? `backup-${Date.now()}.db`,
      filters: [{ name: 'Banco de dados', extensions: ['db'] }]
    })
    if (canceled || !destPath) return { ok: false, error: 'Salvar cancelado.' }
    return backup.downloadBackupToPath(filePath, destPath)
  })
  ipcMain.handle('backup:runAutoBackup', async () => {
    if (!currentSession || !('suporte' in currentSession)) {
      return { ok: false, count: 0, error: 'Acesso restrito ao suporte.' }
    }
    return backup.runAutoBackup()
  })
  ipcMain.handle('backup:runManualBackupForEmpresa', async (_e, empresaId: string) => {
    if (!currentSession || !('suporte' in currentSession)) {
      return { ok: false, count: 0, error: 'Acesso restrito ao suporte.' }
    }
    return backup.runManualBackupForEmpresa(empresaId)
  })

  // Configurações do sistema (acesso suporte)
  ipcMain.handle('config:get', () => getConfig())
  ipcMain.handle('config:set', (_e, partial: { dbPath?: string; syncOnChange?: boolean; serverUrl?: string | null }) => {
    if (partial.dbPath !== undefined) configSetDbPath(partial.dbPath ?? null)
    if (partial.syncOnChange !== undefined) setConfig({ syncOnChange: partial.syncOnChange })
    if (partial.serverUrl !== undefined) setConfig({ serverUrl: normalizeServerUrl(partial.serverUrl) ?? undefined })
    return { ok: true }
  })
  ipcMain.handle('config:setDbPath', (_e, folderPath: string | null) => {
    configSetDbPath(folderPath ?? null)
    return { ok: true }
  })
  ipcMain.handle('server:getUrl', () => {
    return getConfig()?.serverUrl ?? null
  })
  ipcMain.handle('server:discover', async () => {
    const found = await discoverLocalServer(4000)
    if (!found) return { found: false as const }
    setConfig({ serverUrl: found.url })
    return { found: true as const, name: found.name, url: found.url }
  })

  // Online/offline: aqui consideramos "online" se as variáveis do Supabase estiverem definidas.
  // A conexão real e eventuais erros (RLS, schema, etc.) aparecem na mensagem do botão "Sincronizar agora".
  ipcMain.handle('sync:checkOnline', () => {
    return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
  })

  // Cupom (impressão)
  ipcMain.handle('cupom:imprimir', async (_e, vendaId: string) => {
    const detalhes = hasRemoteServerConfigured()
      ? await remoteRequest(`/vendas/${encodeURIComponent(vendaId)}/detalhes`)
      : vendasService.getVendaDetalhes(vendaId)
    if (!detalhes) return { ok: false, error: 'Venda não encontrada' }
    const config = hasRemoteServerConfigured()
      ? await remoteRequest<{ impressora_cupom?: string | null }>(`/empresas/${encodeURIComponent(detalhes.venda.empresa_id)}/config`).catch(() => null)
      : empresasService.getEmpresaConfig(detalhes.venda.empresa_id)
    const impressoraCupom = config?.impressora_cupom?.trim() || null
    const html = cupomToHtml(detalhes)
    const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } })
    const fullHtml = buildThermalReceiptHtml(html)
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      win.webContents.once('did-finish-load', () => {
        const printOpts = buildCupomPrintOptions(impressoraCupom)
        win.webContents.print(printOpts, (success) => {
          win.close()
          resolve(success ? { ok: true } : { ok: false, error: 'Impressão cancelada ou falhou' })
        })
      })
      win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml))
    })
  })
  ipcMain.handle('cupom:listPrinters', async () => {
    const adapter = createPrintAdapter()
    return adapter.listAllPrinters()
  })

  // Relatório de fechamento de caixa (impressão)
  ipcMain.handle('caixa:imprimirFechamento', async (_e, caixaId: string, valorManterProximo?: number) => {
    if (hasRemoteServerConfigured()) {
      // No modo servidor, por enquanto abrimos um alerta simples informando que não está disponível.
      return { ok: false, error: 'Impressão de fechamento de caixa disponível apenas no modo local.' }
    }
    const caixaRow = caixaService.getCaixaById(caixaId)
    if (!caixaRow) return { ok: false, error: 'Caixa não encontrado.' }
    const resumo = caixaService.getResumoFechamentoCaixa(caixaId)
    const empresa = empresasService.getEmpresaConfig(caixaRow.empresa_id)
    const operador = usuariosService.getUsuarioById(caixaRow.usuario_id)
    const htmlInner = fechamentoCaixaToHtml({ empresa, caixa: caixaRow, resumo, operador, valorManterProximo })
    const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } })
    const fullHtml = buildThermalReceiptHtml(htmlInner)
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      win.webContents.once('did-finish-load', () => {
        const config = empresasService.getEmpresaConfig(caixaRow.empresa_id)
        const impressoraCupom = config?.impressora_cupom?.trim() || null
        const printOpts = buildCupomPrintOptions(impressoraCupom)
        win.webContents.print(printOpts, (success) => {
          win.close()
          resolve(success ? { ok: true } : { ok: false, error: 'Impressão cancelada ou falhou' })
        })
      })
      win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml))
    })
  })
  ipcMain.handle('caixa:getHtmlFechamento', async (_e, caixaId: string, valorManterProximo?: number) => {
    if (hasRemoteServerConfigured()) {
      return null
    }
    const caixaRow = caixaService.getCaixaById(caixaId)
    if (!caixaRow) return null
    const resumo = caixaService.getResumoFechamentoCaixa(caixaId)
    const empresa = empresasService.getEmpresaConfig(caixaRow.empresa_id)
    const operador = usuariosService.getUsuarioById(caixaRow.usuario_id)
    return fechamentoCaixaToHtml({ empresa, caixa: caixaRow, resumo, operador, valorManterProximo })
  })
  ipcMain.handle('cupom:getDetalhes', (_e, vendaId: string) => {
    if (hasRemoteServerConfigured()) return remoteRequest(`/vendas/${encodeURIComponent(vendaId)}/detalhes`)
    return vendasService.getVendaDetalhes(vendaId)
  })
  ipcMain.handle('cupom:getHtml', async (_e, vendaId: string) => {
    const detalhes = hasRemoteServerConfigured()
      ? await remoteRequest(`/vendas/${encodeURIComponent(vendaId)}/detalhes`)
      : vendasService.getVendaDetalhes(vendaId)
    if (!detalhes) return null
    return cupomToHtml(detalhes)
  })

  /** Retorna o HTML do cupom fiscal NFC-e para pré-visualização (modo local). */
  ipcMain.handle('cupom:getHtmlNfce', async (_e, vendaId: string) => {
    if (hasRemoteServerConfigured()) return null
    const detalhes = vendasService.getVendaDetalhes(vendaId)
    if (!detalhes) return null
    const status = nfceService.getStatusNfce(vendaId)
    if (!status?.emitida) return null
    const empresaConfig = empresasService.getEmpresaConfig(detalhes.venda.empresa_id)
    const fiscalConfig = empresasService.getFiscalConfig(detalhes.venda.empresa_id)
    const empresaParaCupom = empresaConfig
      ? { ...empresaConfig, ie_emitente: fiscalConfig?.ie_emitente }
      : null
    let qrCodeDataUrl: string | undefined
    if (status.chave && fiscalConfig) {
      const consultaUrl = buildNfceQRCodeUrl({
        chave: status.chave,
        ambiente: fiscalConfig.ambiente,
        csc_id_nfce: fiscalConfig.csc_id_nfce ?? '',
        csc_nfce: fiscalConfig.csc_nfce ?? '',
      })
      if (consultaUrl) {
        try {
          const QRCode = await import('qrcode')
          qrCodeDataUrl = await QRCode.toDataURL(consultaUrl, { width: 200, margin: 1 })
        } catch {
          qrCodeDataUrl = undefined
        }
      }
    }
    const tributosAprox =
      fiscalConfig != null
        ? computeTributosAproxNfceCupom(detalhes, fiscalConfig, {
            usarExemploQuandoGlobalZero: !!(
              fiscalConfig.indicar_fonte_ibpt &&
              (Number(fiscalConfig.tributo_aprox_federal_pct) || 0) +
                (Number(fiscalConfig.tributo_aprox_estadual_pct) || 0) +
                (Number(fiscalConfig.tributo_aprox_municipal_pct) || 0) <=
                0
            ),
          })
        : undefined
    const options = {
      indicar_fonte_ibpt: fiscalConfig?.indicar_fonte_ibpt ?? false,
      qrCodeDataUrl,
      tributosAprox,
    }
    const html = nfceCupomToHtml(detalhes, status, empresaParaCupom, options)
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`
    return fullHtml
  })

  ipcMain.handle('cupom:imprimirNfce', async (_e, vendaId: string) => {
    if (hasRemoteServerConfigured()) return { ok: false, error: 'Impressão de cupom NFC-e disponível apenas no modo local.' }
    const detalhes = vendasService.getVendaDetalhes(vendaId)
    if (!detalhes) return { ok: false, error: 'Venda não encontrada.' }
    const status = nfceService.getStatusNfce(vendaId)
    if (!status?.emitida) return { ok: false, error: 'NFC-e não emitida para esta venda. Emita a nota antes de imprimir o cupom fiscal.' }
    const empresaConfig = empresasService.getEmpresaConfig(detalhes.venda.empresa_id)
    const fiscalConfig = empresasService.getFiscalConfig(detalhes.venda.empresa_id)
    const empresaParaCupom = empresaConfig
      ? { ...empresaConfig, ie_emitente: fiscalConfig?.ie_emitente }
      : null

    let qrCodeDataUrl: string | undefined
    if (status.chave && fiscalConfig) {
      const consultaUrl = buildNfceQRCodeUrl({
        chave: status.chave,
        ambiente: fiscalConfig.ambiente,
        csc_id_nfce: fiscalConfig.csc_id_nfce ?? '',
        csc_nfce: fiscalConfig.csc_nfce ?? '',
      })
      if (consultaUrl) {
        try {
          const QRCode = await import('qrcode')
          qrCodeDataUrl = await QRCode.toDataURL(consultaUrl, { width: 200, margin: 1 })
        } catch {
          qrCodeDataUrl = undefined
        }
      }
    }

    const tributosAprox =
      fiscalConfig != null
        ? computeTributosAproxNfceCupom(detalhes, fiscalConfig, {
            usarExemploQuandoGlobalZero: !!(
              fiscalConfig.indicar_fonte_ibpt &&
              (Number(fiscalConfig.tributo_aprox_federal_pct) || 0) +
                (Number(fiscalConfig.tributo_aprox_estadual_pct) || 0) +
                (Number(fiscalConfig.tributo_aprox_municipal_pct) || 0) <=
                0
            ),
          })
        : undefined
    const options = {
      indicar_fonte_ibpt: fiscalConfig?.indicar_fonte_ibpt ?? false,
      qrCodeDataUrl,
      tributosAprox,
    }
    const html = nfceCupomToHtml(detalhes, status, empresaParaCupom, options)
    const config = empresasService.getEmpresaConfig(detalhes.venda.empresa_id)
    const impressoraCupom = config?.impressora_cupom?.trim() || null
    const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } })
    const fullHtml = buildThermalReceiptHtml(html)
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      win.webContents.once('did-finish-load', () => {
        const printOpts = buildCupomPrintOptions(impressoraCupom)
        win.webContents.print(printOpts, (success) => {
          win.close()
          resolve(success ? { ok: true } : { ok: false, error: 'Impressão cancelada ou falhou' })
        })
      })
      win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml))
    })
  })

  /**
   * Gera uma "DANFE" A4 simplificada em HTML a partir da NFC-e autorizada e abre a tela de impressão.
   * Não usa bibliotecas nativas, apenas BrowserWindow + print.
   */
  ipcMain.handle('nfce:gerarDanfeA4', async (_e, vendaId: string) => {
    if (hasRemoteServerConfigured()) {
      return { ok: false, error: 'Geração de DANFE disponível apenas no modo local.' }
    }

    const detalhes = vendasService.getVendaDetalhes(vendaId)
    if (!detalhes) return { ok: false, error: 'Venda não encontrada.' }

    const status = nfceService.getStatusNfce(vendaId)
    if (!status?.emitida || !status.chave) {
      return { ok: false, error: 'NFC-e não autorizada para esta venda.' }
    }

    const empresa = empresasService.getEmpresaConfig(detalhes.venda.empresa_id)
    const dataHora = new Date(detalhes.venda.created_at).toLocaleString('pt-BR')

    const itensRows = detalhes.itens
      .map(
        (i, idx) =>
          `<tr>
             <td>${idx + 1}</td>
             <td>${i.descricao}</td>
             <td style="text-align:right;">${i.quantidade}</td>
             <td style="text-align:right;">${(i.total / (i.quantidade || 1)).toFixed(2)}</td>
             <td style="text-align:right;">${i.total.toFixed(2)}</td>
           </tr>`
      )
      .join('')

    const pagRows = detalhes.pagamentos
      .map(
        (p) =>
          `<tr>
             <td>${p.forma}</td>
             <td style="text-align:right;">${p.valor.toFixed(2)}</td>
           </tr>`
      )
      .join('')

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>DANFE NFC-e</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 16px; }
      .danfe-container { width: 800px; margin: 0 auto; }
      h1 { font-size: 18px; margin-bottom: 4px; }
      h2 { font-size: 14px; margin: 8px 0 4px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #999; padding: 4px; }
      th { background: #f5f5f5; }
      .totais { margin-top: 8px; float: right; width: 260px; }
    </style>
  </head>
  <body>
    <div class="danfe-container">
      <h1>DANFE NFC-e (A4 simplificada)</h1>
      <div><strong>Emitente:</strong> ${empresa?.nome ?? detalhes.empresa_nome}</div>
      <div><strong>CNPJ:</strong> ${empresa?.cnpj ?? '-'}</div>
      <div><strong>Data/Hora:</strong> ${dataHora}</div>
      <div><strong>Chave de acesso:</strong> ${status.chave.replace(/(.{4})/g, '$1 ').trim()}</div>
      ${
        status.protocolo
          ? `<div><strong>Protocolo:</strong> ${status.protocolo}</div>`
          : ''
      }

      <h2>Produtos</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Descrição</th>
            <th>Qtd</th>
            <th>Vlr Unit.</th>
            <th>Vlr Total</th>
          </tr>
        </thead>
        <tbody>
          ${itensRows}
        </tbody>
      </table>

      <div class="totais">
        <table>
          <tbody>
            <tr><td><strong>Subtotal</strong></td><td style="text-align:right;">${detalhes.venda.subtotal.toFixed(
              2
            )}</td></tr>
            ${
              detalhes.venda.desconto_total > 0
                ? `<tr><td><strong>Descontos</strong></td><td style="text-align:right;">-${detalhes.venda.desconto_total.toFixed(
                    2
                  )}</td></tr>`
                : ''
            }
            <tr><td><strong>Total</strong></td><td style="text-align:right;">${detalhes.venda.total.toFixed(
              2
            )}</td></tr>
            ${
              detalhes.venda.troco > 0
                ? `<tr><td><strong>Troco</strong></td><td style="text-align:right;">${detalhes.venda.troco.toFixed(
                    2
                  )}</td></tr>`
                : ''
            }
          </tbody>
        </table>
      </div>

      <h2 style="clear: both; margin-top: 32px;">Pagamentos</h2>
      <table>
        <thead>
          <tr>
            <th>Forma</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          ${pagRows}
        </tbody>
      </table>
    </div>
  </body>
</html>`

    const win = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false },
    })

    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      win.webContents.once('did-finish-load', () => {
        win.webContents.print(
          { silent: false, printBackground: true },
          (success) => {
            win.close()
            resolve(success ? { ok: true } : { ok: false, error: 'Impressão cancelada ou falhou' })
          }
        )
      })
      win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    })
  })

  /**
   * Pré-visualização da DANFE NF-e (sem enviar nada para a SEFAZ).
   * Usa apenas os dados atuais da venda para montar um layout A4 simples em HTML.
   */
  ipcMain.handle('nfe:previewDanfeA4', async (_e, vendaId: string) => {
    if (hasRemoteServerConfigured()) {
      return { ok: false, error: 'Pré-visualização de DANFE NF-e disponível apenas no modo local.' }
    }

    const result = await nfeService.gerarPreviewDanfePdf(vendaId)
    if (!result.ok || !result.pdfPath) {
      return { ok: false, error: result.error ?? 'Erro ao gerar DANFE de prévia.' }
    }

    const pdfWin = new BrowserWindow({
      width: 860,
      height: 1100,
      title: 'Pré-visualização DANFE NF-e',
      autoHideMenuBar: true,
      webPreferences: { plugins: true },
    })

    const pdfUrl = `file://${encodeURI(result.pdfPath)}`
    const html = buildPdfPreviewHtml(pdfUrl, 'Pré-visualização DANFE NF-e')
    await pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    pdfWin.show()
    return { ok: true }
  })

  /**
   * Gera (se necessário) e retorna o caminho do PDF DANFE NF-e (modelo 55).
   * Não abre janelas externas; serve para pré-visualização em modal no renderer.
   */
  ipcMain.handle('nfe:getDanfePdfPath', async (_e, vendaId: string) => {
    if (hasRemoteServerConfigured()) {
      return { ok: false, error: 'Pré-visualização de DANFE NF-e disponível apenas no modo local.' }
    }

    const status = nfeService.getStatusNfe(vendaId)
    if (!status?.emitida || !status.chave) return { ok: false, error: 'NF-e não autorizada para esta venda.' }

    const dbPath = getDbPath()
    if (!dbPath) return { ok: false, error: 'Banco de dados não inicializado.' }

    const detalhes = vendasService.getVendaDetalhes(vendaId)
    if (!detalhes) return { ok: false, error: 'Venda não encontrada.' }

    const empresaDanfeDir = join(dirname(dbPath), 'nfe-danfe', detalhes.venda.empresa_id)
    if (!existsSync(empresaDanfeDir)) mkdirSync(empresaDanfeDir, { recursive: true })

    const pdfPath = join(empresaDanfeDir, `${status.chave}.pdf`)

    if (!existsSync(pdfPath)) {
      const regenResult = await nfeService.regenerarDanfePdf(vendaId)
      if (!regenResult.ok || !regenResult.pdfPath) {
        return { ok: false, error: regenResult.error ?? 'Não foi possível gerar/regerar o DANFE.' }
      }
      return { ok: true, pdfPath: regenResult.pdfPath }
    }

    return { ok: true, pdfPath }
  })

  /**
   * Retorna o DANFE como data URL base64 para renderizar dentro de modais.
   * Isso evita problemas de visualização quando o renderer tenta carregar `file://...pdf`.
   */
  ipcMain.handle('nfe:getDanfePdfDataUrl', async (_e, vendaId: string) => {
    const pdfRes = await (async (): Promise<{ ok: boolean; pdfPath?: string; error?: string }> => {
      const status = nfeService.getStatusNfe(vendaId)
      if (!status?.emitida || !status.chave) return { ok: false, error: 'NF-e não autorizada para esta venda.' }

      const dbPath = getDbPath()
      if (!dbPath) return { ok: false, error: 'Banco de dados não inicializado.' }

      const detalhes = vendasService.getVendaDetalhes(vendaId)
      if (!detalhes) return { ok: false, error: 'Venda não encontrada.' }

      const empresaDanfeDir = join(dirname(dbPath), 'nfe-danfe', detalhes.venda.empresa_id)
      if (!existsSync(empresaDanfeDir)) mkdirSync(empresaDanfeDir, { recursive: true })

      const pdfPath = join(empresaDanfeDir, `${status.chave}.pdf`)
      if (!existsSync(pdfPath)) {
        const regenResult = await nfeService.regenerarDanfePdf(vendaId)
        if (!regenResult.ok || !regenResult.pdfPath) {
          return { ok: false, error: regenResult.error ?? 'Não foi possível gerar/regerar o DANFE.' }
        }
        return { ok: true, pdfPath: regenResult.pdfPath }
      }

      return { ok: true, pdfPath }
    })()

    if (!pdfRes.ok || !pdfRes.pdfPath) return { ok: false, error: pdfRes.error ?? 'Erro ao gerar preview do PDF.' }

    try {
      const bytes = readFileSync(pdfRes.pdfPath)
      const base64 = bytes.toString('base64')
      return { ok: true, dataUrl: `data:application/pdf;base64,${base64}` }
    } catch {
      return { ok: false, error: 'Não foi possível ler o arquivo PDF para a pré-visualização.' }
    }
  })

  /**
   * Abre uma janela externa com o PDF DANFE NF-e e dispara o diálogo de impressão.
   * Usado após o usuário clicar em "Imprimir" dentro da modal.
   */
  ipcMain.handle('nfe:imprimirDanfeA4', async (_e, vendaId: string) => {
    if (hasRemoteServerConfigured()) {
      return { ok: false, error: 'Impressão de DANFE NF-e disponível apenas no modo local.' }
    }

    const pdfRes = await (async () => {
      const status = nfeService.getStatusNfe(vendaId)
      if (!status?.emitida || !status.chave) return { ok: false as const, error: 'NF-e não autorizada para esta venda.' }

      const dbPath = getDbPath()
      if (!dbPath) return { ok: false as const, error: 'Banco de dados não inicializado.' }

      const detalhes = vendasService.getVendaDetalhes(vendaId)
      if (!detalhes) return { ok: false as const, error: 'Venda não encontrada.' }

      const empresaDanfeDir = join(dirname(dbPath), 'nfe-danfe', detalhes.venda.empresa_id)
      if (!existsSync(empresaDanfeDir)) mkdirSync(empresaDanfeDir, { recursive: true })

      const pdfPath = join(empresaDanfeDir, `${status.chave}.pdf`)

      if (!existsSync(pdfPath)) {
        const regenResult = await nfeService.regenerarDanfePdf(vendaId)
        if (!regenResult.ok || !regenResult.pdfPath) {
          return { ok: false as const, error: regenResult.error ?? 'Não foi possível gerar/regerar o DANFE.' }
        }
        return { ok: true as const, pdfPath: regenResult.pdfPath }
      }

      return { ok: true as const, pdfPath }
    })()

    if (!pdfRes.ok) return { ok: false, error: pdfRes.error }

    const pdfUrl = `file://${encodeURI(pdfRes.pdfPath)}`
    const pdfWin = new BrowserWindow({
      width: 860,
      height: 1100,
      title: 'Imprimir DANFE NF-e',
      autoHideMenuBar: true,
      webPreferences: { plugins: true },
    })

    await new Promise<void>((resolve) => {
      pdfWin.webContents.once('did-finish-load', () => {
        // Abre diálogo de impressão e deixa a janela aberta.
        pdfWin.webContents.print({ silent: false }, () => resolve())
      })
      pdfWin.loadURL(pdfUrl)
    })

    return { ok: true }
  })

  /**
   * Gera uma DANFE NF-e (A4 simples) a partir da NF-e autorizada.
   * Abre o visualizador de impressão padrão.
   */
  ipcMain.handle('nfe:gerarDanfeA4', async (_e, vendaId: string) => {
    if (hasRemoteServerConfigured()) {
      return { ok: false, error: 'Geração de DANFE NF-e disponível apenas no modo local.' }
    }

    const status = nfeService.getStatusNfe(vendaId)
    if (!status?.emitida || !status.chave) {
      return { ok: false, error: 'NF-e não autorizada para esta venda.' }
    }

    const dbPath = getDbPath()
    if (!dbPath) return { ok: false, error: 'Banco de dados não inicializado.' }
    const baseDir = dirname(dbPath)
    const detalhes = vendasService.getVendaDetalhes(vendaId)
    if (!detalhes) return { ok: false, error: 'Venda não encontrada.' }
    const empresaDanfeDir = join(baseDir, 'nfe-danfe', detalhes.venda.empresa_id)
    const pdfPath = join(empresaDanfeDir, `${status.chave}.pdf`)
    try {
      // Se o PDF não existe, regenera a partir dos dados da venda no banco
      if (!existsSync(pdfPath)) {
        const regenResult = await nfeService.regenerarDanfePdf(vendaId)
        if (!regenResult.ok || !regenResult.pdfPath) {
          return {
            ok: false,
            error: regenResult.error ?? 'Não foi possível regerar o DANFE.',
          }
        }
      }
      const pdfWin = new BrowserWindow({
        width: 860,
        height: 1100,
        title: 'DANFE NF-e',
        autoHideMenuBar: true,
        webPreferences: { plugins: true },
      })

      const pdfUrl = `file://${encodeURI(pdfPath)}`
      const html = buildPdfPreviewHtml(pdfUrl, 'DANFE NF-e')
      await pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
      pdfWin.show()
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: msg || 'Erro ao abrir DANFE NF-e.' }
    }
  })

  // Etiquetas (impressão)
  ipcMain.handle('etiquetas:listTemplates', () => {
    return listLabelTemplates()
  })
  ipcMain.handle('etiquetas:listPrinters', async () => {
    const adapter = createPrintAdapter()
    return adapter.listPrinters()
  })
  ipcMain.handle('etiquetas:getPrinterStatus', async (_e, printerName: string) => {
    const adapter = createPrintAdapter()
    return adapter.getPrinterStatus(printerName)
  })
  ipcMain.handle('etiquetas:preview', async (
    _e,
    payload: { templateId?: string; items: { produtoId: string; quantidade: number }[] }
  ) => {
    const items: LabelJobItem[] = []
    for (const item of payload.items ?? []) {
      const p = hasRemoteServerConfigured()
        ? await remoteRequest<ReturnType<typeof getProdutoById>>(`/produtos/${encodeURIComponent(item.produtoId)}`)
        : getProdutoById(item.produtoId)
      if (!p) continue
      items.push({
        quantity: item.quantidade,
        product: {
          id: p.id,
          nome: p.nome,
          preco: p.preco,
          codigoInterno: String(p.codigo ?? p.id.slice(0, 8)),
          codigoBarras: p.codigo_barras,
          unidade: p.unidade
        }
      })
    }
    const artifacts = buildLabelArtifacts(payload.templateId || DEFAULT_LABEL_TEMPLATE_ID, items)
    return {
      preview: artifacts.preview,
      totalLabels: artifacts.layout.totalLabels,
      language: artifacts.payload.language
    }
  })
  ipcMain.handle('etiquetas:print', async (
    _e,
    payload: {
      templateId?: string
      printerName: string
      items: { produtoId: string; quantidade: number }[]
    }
  ) => {
    const items: LabelJobItem[] = []
    for (const item of payload.items ?? []) {
      const p = hasRemoteServerConfigured()
        ? await remoteRequest<ReturnType<typeof getProdutoById>>(`/produtos/${encodeURIComponent(item.produtoId)}`)
        : getProdutoById(item.produtoId)
      if (!p) continue
      items.push({
        quantity: item.quantidade,
        product: {
          id: p.id,
          nome: p.nome,
          preco: p.preco,
          codigoInterno: String(p.codigo ?? p.id.slice(0, 8)),
          codigoBarras: p.codigo_barras,
          unidade: p.unidade
        }
      })
    }
    if (items.length === 0) return { ok: false, error: 'Nenhum produto encontrado.' }
    const artifacts = buildLabelArtifacts(payload.templateId || DEFAULT_LABEL_TEMPLATE_ID, items)
    const adapter = createPrintAdapter()
    const status = await adapter.getPrinterStatus(payload.printerName)
    if (!status.online) {
      return { ok: false, error: `Impressora offline: ${status.detail}` }
    }
    try {
      const debugRawEnabled = process.env.AGILIZA_LABEL_DEBUG_RAW === '1'
      let debugRawPath: string | null = null
      if (debugRawEnabled) {
        const safePrinterName = String(payload.printerName).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80)
        const ext = artifacts.payload.language === 'PPLA' ? 'ppla' : artifacts.payload.language === 'PPLB' ? 'pplb' : 'ppl'
        const rawStr = artifacts.payload.raw.toString('ascii')
        const normalized = Buffer.from(rawStr.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'), 'ascii')
        const outDir = join(tmpdir(), 'agiliza-label-debug')
        mkdirSync(outDir, { recursive: true })
        debugRawPath = join(outDir, `agiliza-${Date.now()}-${ext}-${safePrinterName}.txt`)
        writeFileSync(debugRawPath, normalized)
        // Ajuda a reproduzir o caso fora do app com `lp -d <fila> -o raw <arquivo>`
        console.log('[Etiquetas] debugRawPath=', debugRawPath)
      }

      await adapter.sendRaw(payload.printerName, artifacts.payload.raw)
      return debugRawPath ? { ok: true, labels: artifacts.layout.totalLabels, debugRawPath } : { ok: true, labels: artifacts.layout.totalLabels }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      return {
        ok: false,
        error:
          `Falha ao enviar etiqueta RAW para "${payload.printerName}": ${detail}. ` +
          `Verifique se a linguagem do modelo (${artifacts.payload.language}) é a mesma emulação ativa na impressora (PPLA/PPLB) e se o driver/fila está em RAW.`
      }
    }
  })

  // Legado (HTML) mantido para transição controlada
  ipcMain.handle('etiquetas:imprimir', async (_e, produtoIds: string[]) => {
    const produtos: ProdutoEtiqueta[] = []
    for (const id of produtoIds) {
      const p = hasRemoteServerConfigured()
        ? await remoteRequest<ReturnType<typeof getProdutoById>>(`/produtos/${encodeURIComponent(id)}`)
        : getProdutoById(id)
      if (p) produtos.push({ nome: p.nome, preco: p.preco, codigo_barras: p.codigo_barras, unidade: p.unidade })
    }
    if (produtos.length === 0) return { ok: false, error: 'Nenhum produto encontrado' }
    const html = etiquetasToHtml(produtos)
    const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } })
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      win.webContents.once('did-finish-load', () => {
        win.webContents.print({ silent: false }, (success) => {
          win.close()
          resolve(success ? { ok: true } : { ok: false, error: 'Impressão cancelada ou falhou' })
        })
      })
      win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml))
    })
  })
}
