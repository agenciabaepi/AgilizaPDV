export const PUBLIC_LEGAL_PATHS = ['/politica-privacidade', '/termos-servico'] as const

export function normalizePublicPath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname || '/'
}

export function isPublicLegalPath(pathname: string): boolean {
  return (PUBLIC_LEGAL_PATHS as readonly string[]).includes(normalizePublicPath(pathname))
}

/** Endereço limpo (/politica-privacidade), fora do HashRouter do painel. */
export function isCleanUrlNavigation(): boolean {
  if (typeof window === 'undefined') return false
  const path = normalizePublicPath(window.location.pathname)
  return isPublicLegalPath(path) && !window.location.hash.startsWith('#/')
}
