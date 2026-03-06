import { ipcMain, BrowserWindow, app, dialog, shell } from 'electron'
import { join, dirname } from 'path'
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
import { etiquetasToHtml, type ProdutoEtiqueta } from '../etiquetas'
import { getProdutoById } from '../../backend/services/produtos.service'
import * as syncEngine from '../../sync/sync-engine'
import * as outbox from '../../sync/outbox'
import * as backup from '../backup'
import { getDbPath } from '../../backend/db'
import * as suporteService from '../../backend/services/suporte.service'
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

let currentSession: AppSession | null = null
let remoteSessionId: string | null = null

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

  // Usuários
  ipcMain.handle('usuarios:list', async (_e, empresaId: string) => {
    if (hasRemoteServerConfigured()) {
      const qs = empresaId ? `?empresaId=${encodeURIComponent(empresaId)}` : ''
      return remoteRequest(`/usuarios${qs}`)
    }
    return usuariosService.listUsuariosByEmpresa(empresaId)
  })
  ipcMain.handle('usuarios:create', async (
    _e,
    data: { empresa_id: string; nome: string; login: string; senha: string; role: usuariosService.Role }
  ) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest('/usuarios', { method: 'POST', body: JSON.stringify(data) })
    }
    return usuariosService.createUsuario(data)
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
      return currentSession
    }
    const user = usuariosService.login(empresaId, login, senha)
    if (!user) return null
    currentSession = user as UsuarioSession
    return currentSession
  })
  ipcMain.handle('auth:supportLogin', (_e, login: string, senha: string) => {
    remoteSessionId = null
    const user = suporteService.loginSuporte(login, senha)
    if (!user) return null
    currentSession = { suporte: true, id: user.id, nome: user.nome, login: user.login }
    return currentSession
  })
  ipcMain.handle('auth:getSession', async () => {
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
    return usuariosService.ensureAdminUser(empresaId)
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

  // Clientes
  ipcMain.handle('clientes:list', async (_e, empresaId: string) => {
    if (hasRemoteServerConfigured()) {
      const qs = empresaId ? `?empresaId=${encodeURIComponent(empresaId)}` : ''
      return remoteRequest(`/clientes${qs}`)
    }
    return clientesService.listClientes(empresaId)
  })

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
    return caixaService.abrirCaixa(empresaId, usuarioId, valorInicial)
  })
  ipcMain.handle('caixa:fechar', async (_e, caixaId: string) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest('/caixa/fechar', { method: 'POST', body: JSON.stringify({ caixaId }) })
    }
    return caixaService.fecharCaixa(caixaId)
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
    return caixaService.registrarMovimentoCaixa(data)
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
    return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
  })

  // Cupom (impressão)
  ipcMain.handle('cupom:imprimir', async (_e, vendaId: string) => {
    const detalhes = hasRemoteServerConfigured()
      ? await remoteRequest(`/vendas/${encodeURIComponent(vendaId)}/detalhes`)
      : vendasService.getVendaDetalhes(vendaId)
    if (!detalhes) return { ok: false, error: 'Venda não encontrada' }
    const html = cupomToHtml(detalhes)
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

  // Etiquetas (impressão)
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
