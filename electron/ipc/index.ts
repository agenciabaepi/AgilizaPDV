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

export function registerIpcHandlers(): void {
  // App
  ipcMain.handle('app:getVersion', () => app.getVersion())

  // Empresas
  ipcMain.handle('empresas:list', () => empresasService.listEmpresas())
  ipcMain.handle('empresas:create', async (_e, data: { nome: string; cnpj?: string }) => {
    const result = empresasService.createEmpresa(data)
    maybeSyncAfterChange()
    return result
  })

  // Usuários
  ipcMain.handle('usuarios:list', (_e, empresaId: string) =>
    usuariosService.listUsuariosByEmpresa(empresaId)
  )
  ipcMain.handle('usuarios:create', (
    _e,
    data: { empresa_id: string; nome: string; login: string; senha: string; role: usuariosService.Role }
  ) => usuariosService.createUsuario(data))

  // Auth
  ipcMain.handle('auth:login', (_e, empresaId: string, login: string, senha: string) => {
    const user = usuariosService.login(empresaId, login, senha)
    if (!user) return null
    currentSession = user as UsuarioSession
    return currentSession
  })
  ipcMain.handle('auth:supportLogin', (_e, login: string, senha: string) => {
    const user = suporteService.loginSuporte(login, senha)
    if (!user) return null
    currentSession = { suporte: true, id: user.id, nome: user.nome, login: user.login }
    return currentSession
  })
  ipcMain.handle('auth:getSession', () => currentSession)
  ipcMain.handle('auth:logout', () => {
    currentSession = null
    return undefined
  })

  // Produtos
  ipcMain.handle('produtos:list', (_e, empresaId: string, options?: { search?: string; apenasAtivos?: boolean; ordenarPorMaisVendidos?: boolean }) =>
    produtosService.listProdutos(empresaId, options)
  )
  ipcMain.handle('produtos:get', (_e, id: string) => produtosService.getProdutoById(id))
  ipcMain.handle('produtos:getNextCodigo', (_e, empresaId: string) => produtosService.getNextCodigo(empresaId))
  ipcMain.handle('produtos:create', async (_e, data: produtosService.CreateProdutoInput) => {
    const result = produtosService.createProduto(data)
    maybeSyncAfterChange()
    return result
  })
  ipcMain.handle('produtos:update', async (_e, id: string, data: produtosService.UpdateProdutoInput) => {
    const result = produtosService.updateProduto(id, data)
    maybeSyncAfterChange()
    return result
  })

  // Clientes
  ipcMain.handle('clientes:list', (_e, empresaId: string) =>
    clientesService.listClientes(empresaId)
  )

  // Fornecedores
  ipcMain.handle('fornecedores:list', (_e, empresaId: string) =>
    fornecedoresService.listFornecedores(empresaId)
  )

  // Categorias (hierárquicas: grupo → categoria → subcategoria)
  ipcMain.handle('categorias:list', (_e, empresaId: string) =>
    categoriasService.listCategorias(empresaId)
  )
  ipcMain.handle('categorias:listTree', (_e, empresaId: string) =>
    categoriasService.listCategoriasTree(empresaId)
  )
  ipcMain.handle('categorias:listFolha', (_e, empresaId: string) =>
    categoriasService.listCategoriasFolha(empresaId)
  )
  ipcMain.handle('categorias:get', (_e, id: string) => categoriasService.getCategoriaById(id))
  ipcMain.handle('categorias:getPath', (_e, id: string) => categoriasService.getCategoriaPath(id))
  ipcMain.handle('categorias:create', async (_e, data: categoriasService.CreateCategoriaInput) => {
    const result = categoriasService.createCategoria(data)
    maybeSyncAfterChange()
    return result
  })
  ipcMain.handle('categorias:update', async (_e, id: string, data: categoriasService.UpdateCategoriaInput) => {
    const result = categoriasService.updateCategoria(id, data)
    maybeSyncAfterChange()
    return result
  })
  ipcMain.handle('categorias:delete', async (_e, id: string) => {
    const result = categoriasService.deleteCategoria(id)
    maybeSyncAfterChange()
    return result
  })

  // Estoque
  ipcMain.handle('estoque:listMovimentos', (_e, empresaId: string, options?: { produtoId?: string; limit?: number }) =>
    estoqueService.listMovimentos(empresaId, options)
  )
  ipcMain.handle('estoque:getSaldo', (_e, empresaId: string, produtoId: string) =>
    estoqueService.getSaldo(empresaId, produtoId)
  )
  ipcMain.handle('estoque:listSaldos', (_e, empresaId: string) =>
    estoqueService.listSaldosPorProduto(empresaId)
  )
  ipcMain.handle('estoque:registrarMovimento', async (_e, data: estoqueService.RegistrarMovimentoInput) => {
    const result = estoqueService.registrarMovimento(data)
    maybeSyncAfterChange()
    return result
  })
  ipcMain.handle('estoque:ajustarSaldoPara', async (_e, empresaId: string, produtoId: string, novoSaldo: number) => {
    estoqueService.ajustarSaldoPara(empresaId, produtoId, novoSaldo)
    maybeSyncAfterChange()
  })

  // Caixa
  ipcMain.handle('caixa:getAberto', (_e, empresaId: string) => caixaService.getCaixaAberto(empresaId))
  ipcMain.handle('caixa:abrir', (_e, empresaId: string, usuarioId: string, valorInicial: number) =>
    caixaService.abrirCaixa(empresaId, usuarioId, valorInicial)
  )
  ipcMain.handle('caixa:fechar', (_e, caixaId: string) => caixaService.fecharCaixa(caixaId))
  ipcMain.handle('caixa:list', (_e, empresaId: string, limit?: number) =>
    caixaService.listCaixas(empresaId, limit)
  )
  ipcMain.handle('caixa:getSaldo', (_e, caixaId: string) => caixaService.getSaldoCaixa(caixaId))
  ipcMain.handle('caixa:listMovimentos', (_e, caixaId: string) =>
    caixaService.listMovimentosCaixa(caixaId)
  )
  ipcMain.handle('caixa:registrarMovimento', (_e, data: caixaService.RegistrarMovimentoCaixaInput) =>
    caixaService.registrarMovimentoCaixa(data)
  )

  // Vendas (PDV)
  ipcMain.handle('vendas:finalizar', async (_e, data: vendasService.FinalizarVendaInput) => {
    const result = vendasService.finalizarVenda(data)
    maybeSyncAfterChange()
    return result
  })
  ipcMain.handle('vendas:list', (_e, empresaId: string, options?: Parameters<typeof vendasService.listVendas>[1]) =>
    vendasService.listVendas(empresaId, options)
  )
  ipcMain.handle('vendas:get', (_e, id: string) => vendasService.getVendaById(id))
  ipcMain.handle('vendas:cancelar', async (_e, vendaId: string, usuarioId: string) => {
    const result = vendasService.cancelarVenda(vendaId, usuarioId)
    maybeSyncAfterChange()
    return result
  })

  // Sync (Supabase)
  ipcMain.handle('sync:run', () => syncEngine.runSync())
  ipcMain.handle('sync:getPendingCount', () => outbox.getPendingCount())
  ipcMain.handle('sync:getErrorCount', () => outbox.getErrorCount())
  ipcMain.handle('sync:resetErrorsAndRun', async () => {
    outbox.resetErrorsToPending()
    return syncEngine.runSync()
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
  ipcMain.handle('config:set', (_e, partial: { dbPath?: string; syncOnChange?: boolean }) => {
    if (partial.dbPath !== undefined) configSetDbPath(partial.dbPath ?? null)
    if (partial.syncOnChange !== undefined) setConfig({ syncOnChange: partial.syncOnChange })
    return { ok: true }
  })
  ipcMain.handle('config:setDbPath', (_e, folderPath: string | null) => {
    configSetDbPath(folderPath ?? null)
    return { ok: true }
  })

  // Online/offline: aqui consideramos "online" se as variáveis do Supabase estiverem definidas.
  // A conexão real e eventuais erros (RLS, schema, etc.) aparecem na mensagem do botão "Sincronizar agora".
  ipcMain.handle('sync:checkOnline', () => {
    return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
  })

  // Cupom (impressão)
  ipcMain.handle('cupom:imprimir', async (_e, vendaId: string) => {
    const detalhes = vendasService.getVendaDetalhes(vendaId)
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
  ipcMain.handle('cupom:getDetalhes', (_e, vendaId: string) => vendasService.getVendaDetalhes(vendaId))
  ipcMain.handle('cupom:getHtml', (_e, vendaId: string) => {
    const detalhes = vendasService.getVendaDetalhes(vendaId)
    if (!detalhes) return null
    return cupomToHtml(detalhes)
  })

  // Etiquetas (impressão)
  ipcMain.handle('etiquetas:imprimir', async (_e, produtoIds: string[]) => {
    const produtos: ProdutoEtiqueta[] = []
    for (const id of produtoIds) {
      const p = getProdutoById(id)
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
