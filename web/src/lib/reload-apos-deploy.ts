const RELOAD_KEY = 'agiliza:reload-apos-deploy'

export function isErroDeArquivoAntigo(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /preload CSS|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk|MIME type/i.test(msg)
}

/** Depois de um deploy, a página aberta ainda aponta para arquivos que não existem mais: recarrega uma vez. */
export function recarregarAposDeploy(): boolean {
  try {
    const ultimo = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
    if (Date.now() - ultimo < 30_000) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}
