import { readWebStoredSession } from './auth-session'

const INTERNAL_FLAG_PREFIX = 'agiliza:loja-internal:'
const INTERNAL_QUERY = 'agiliza_internal'

/** Marca o navegador como acesso interno (dono/equipe) — não conta na dashboard. */
export function markLojaOnlineInternalAccess(empresaId: string): void {
  if (!empresaId || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(`${INTERNAL_FLAG_PREFIX}${empresaId}`, '1')
  } catch {
    /* ignore */
  }
}

export function clearLojaOnlineInternalAccess(empresaId: string): void {
  if (!empresaId || typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(`${INTERNAL_FLAG_PREFIX}${empresaId}`)
  } catch {
    /* ignore */
  }
}

function hasInternalFlag(empresaId: string): boolean {
  try {
    return localStorage.getItem(`${INTERNAL_FLAG_PREFIX}${empresaId}`) === '1'
  } catch {
    return false
  }
}

/** Sessão do PDV da mesma empresa = equipe, não cliente. */
function isStaffOfEmpresa(empresaId: string): boolean {
  const session = readWebStoredSession()
  if (!session || typeof session !== 'object') return false
  if (!('empresa_id' in session)) return false
  const sid = String((session as { empresa_id?: string }).empresa_id ?? '')
  return Boolean(sid && sid === empresaId)
}

/**
 * Captura ?agiliza_internal=1 na URL e persiste no navegador.
 * Links de prévia do admin devem incluir esse parâmetro.
 */
export function captureLojaOnlineInternalFromUrl(empresaId: string, search?: string): void {
  if (!empresaId || typeof window === 'undefined') return
  const params = new URLSearchParams(search ?? window.location.search)
  if (params.get(INTERNAL_QUERY) === '1' || params.get('preview') === '1') {
    markLojaOnlineInternalAccess(empresaId)
  }
}

/** True = não registrar visita/evento (nem Pixel first-party mirror). */
export function shouldSkipLojaOnlineAnalytics(empresaId: string | null | undefined): boolean {
  if (!empresaId) return true
  if (typeof window === 'undefined') return true
  captureLojaOnlineInternalFromUrl(empresaId)
  if (isStaffOfEmpresa(empresaId)) return true
  if (hasInternalFlag(empresaId)) return true
  return false
}

export function appendLojaOnlineInternalQuery(url: string): string {
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://agilizapdv.app')
    u.searchParams.set(INTERNAL_QUERY, '1')
    // Se for URL absoluta externa, devolve completa; senão path+search+hash
    if (/^https?:\/\//i.test(url)) return u.toString()
    return `${u.pathname}${u.search}${u.hash}`
  } catch {
    const sep = url.includes('?') ? '&' : '?'
    return `${url}${sep}${INTERNAL_QUERY}=1`
  }
}
