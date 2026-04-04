import { ipcMain } from 'electron'
import * as fornecedoresService from '../../backend/services/fornecedores.service'

export type FornecedoresIpcContext = {
  hasRemoteServerConfigured: () => boolean
  remoteRequest: <T>(path: string, init?: RequestInit) => Promise<T>
  remoteMutate: <T>(path: string, init?: RequestInit) => Promise<T>
  getUsuarioIdFromSession: () => string | null
  maybeSyncAfterChange: () => void
}

/**
 * Registra todos os canais IPC de fornecedores.
 * Módulo separado para garantir inclusão no bundle do processo principal.
 */
export function registerFornecedoresIpcHandlers(ctx: FornecedoresIpcContext): void {
  const { hasRemoteServerConfigured, remoteRequest, remoteMutate, getUsuarioIdFromSession, maybeSyncAfterChange } = ctx

  ipcMain.handle('fornecedores:list', async (_e, empresaId: string) => {
    if (hasRemoteServerConfigured()) {
      const qs = empresaId ? `?empresaId=${encodeURIComponent(empresaId)}` : ''
      return remoteRequest(`/fornecedores${qs}`)
    }
    return fornecedoresService.listFornecedores(empresaId)
  })

  ipcMain.handle('fornecedores:get', async (_e, id: string) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest(`/fornecedores/${encodeURIComponent(id)}`)
    }
    return fornecedoresService.getFornecedorById(id)
  })

  ipcMain.handle('fornecedores:historico', async (_e, id: string) => {
    if (hasRemoteServerConfigured()) {
      return remoteRequest(`/fornecedores/${encodeURIComponent(id)}/historico`)
    }
    return fornecedoresService.listHistoricoFornecedor(id)
  })

  ipcMain.handle('fornecedores:create', async (_e, data: fornecedoresService.CreateFornecedorInput) => {
    if (hasRemoteServerConfigured()) {
      return remoteMutate('/fornecedores', { method: 'POST', body: JSON.stringify(data) })
    }
    const uid = getUsuarioIdFromSession()
    const result = fornecedoresService.createFornecedor({
      ...data,
      usuario_id: data.usuario_id ?? uid ?? undefined
    })
    maybeSyncAfterChange()
    return result
  })

  ipcMain.handle(
    'fornecedores:update',
    async (_e, id: string, data: fornecedoresService.UpdateFornecedorInput) => {
      if (hasRemoteServerConfigured()) {
        return remoteMutate(`/fornecedores/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        })
      }
      const uid = getUsuarioIdFromSession()
      const result = fornecedoresService.updateFornecedor(id, data, { usuario_id: uid })
      if (result) maybeSyncAfterChange()
      return result
    }
  )

  ipcMain.handle('fornecedores:delete', async (_e, id: string) => {
    if (hasRemoteServerConfigured()) {
      return remoteMutate<{ ok: boolean; error?: string }>(
        `/fornecedores/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      )
    }
    const result = fornecedoresService.deleteFornecedor(id)
    if (result.ok) maybeSyncAfterChange()
    return result
  })
}
