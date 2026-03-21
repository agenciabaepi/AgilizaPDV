/**
 * True quando o renderer roda dentro do Electron (instalador / app desktop).
 * False no navegador (site / modo web com Supabase).
 */
export function isElectronShell(): boolean {
  if (typeof navigator === 'undefined') return false
  return /\belectron\//i.test(navigator.userAgent)
}
