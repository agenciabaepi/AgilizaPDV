import { WEB_SESSION_KEY } from './auth-session'

function sessionHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem(WEB_SESSION_KEY)
    if (!raw) return {}
    return { 'X-Agiliza-Session': btoa(raw) }
  } catch {
    return {}
  }
}

export type GerarEtiquetaResponse = {
  ok: boolean
  skipped?: boolean
  cartId?: string
  url?: string | null
  tracking?: string | null
}

export async function gerarEtiquetaLojaOnline(
  empresaId: string,
  pedidoId: string
): Promise<GerarEtiquetaResponse> {
  const res = await fetch('/api/loja-online/gerar-etiqueta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
    body: JSON.stringify({ empresaId, pedidoId }),
  })
  const data = (await res.json()) as GerarEtiquetaResponse & { error?: string }
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || 'Não foi possível gerar a etiqueta.')
  }
  return data
}

/** Consulta o Melhor Envio e grava o código de rastreio no pedido, se já disponível. */
export async function sincronizarRastreioLojaOnline(
  empresaId: string,
  pedidoId: string
): Promise<string | null> {
  const res = await fetch('/api/loja-online/gerar-etiqueta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
    body: JSON.stringify({ empresaId, pedidoId, apenasRastreio: true }),
  })
  const data = (await res.json()) as GerarEtiquetaResponse & { error?: string }
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || 'Não foi possível consultar o rastreio.')
  }
  return data.tracking ?? null
}
