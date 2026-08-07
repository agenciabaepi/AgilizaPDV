import { WEB_SESSION_KEY } from './auth-session'
import type { AssinaturaPublicStatus, AssinaturaPixQrCode, PlanoId } from '../vite-env'

function sessionHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem(WEB_SESSION_KEY)
    if (!raw) return {}
    return { 'X-Agiliza-Session': btoa(raw) }
  } catch {
    return {}
  }
}

async function assinaturaApiPost<T extends { ok: boolean; error?: string }>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`/api/assinaturas/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!text.trim()) {
    return {
      ok: false,
      error:
        res.status === 404
          ? 'API de assinaturas não encontrada. Faça deploy ou reinicie o servidor.'
          : `Servidor retornou resposta vazia (HTTP ${res.status}).`,
    } as T
  }
  try {
    return JSON.parse(text) as T
  } catch {
    const isHtml = text.trimStart().startsWith('<')
    return {
      ok: false,
      error: isHtml
        ? 'API de assinaturas indisponível. Faça deploy da API ou use o app em produção.'
        : 'Resposta inválida do servidor de assinaturas.',
    } as T
  }
}

export async function fetchAssinaturaStatus(empresaId: string): Promise<{
  ok: boolean
  status?: AssinaturaPublicStatus
  error?: string
}> {
  return assinaturaApiPost('status', { empresaId })
}

export async function fetchAssinaturaCheckout(empresaId: string, planoId?: PlanoId): Promise<{
  ok: boolean
  status?: AssinaturaPublicStatus
  paymentId?: string
  valor?: number
  pix?: AssinaturaPixQrCode
  error?: string
}> {
  return assinaturaApiPost('checkout', { empresaId, planoId })
}
