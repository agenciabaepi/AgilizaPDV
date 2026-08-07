import type { LojaOnlineCupomValidado, LojaOnlineOpcaoFrete } from './loja-online-types'

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/loja-online/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as { ok?: boolean; error?: string } & T
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || 'Falha na requisição.')
  }
  return data
}

export async function calcularFreteLojaOnline(
  slug: string,
  cepDestino: string,
  pesoKg?: number
): Promise<{ tipo: string; opcoes: LojaOnlineOpcaoFrete[] }> {
  const data = await postJson<{ tipo: string; opcoes: LojaOnlineOpcaoFrete[] }>('calcular-frete', {
    slug,
    cepDestino,
    pesoKg,
  })
  return { tipo: data.tipo, opcoes: data.opcoes }
}

export async function validarCupomLojaOnline(
  slug: string,
  codigo: string,
  subtotal: number
): Promise<LojaOnlineCupomValidado> {
  const data = await postJson<{ cupom: LojaOnlineCupomValidado }>('validar-cupom', {
    slug,
    codigo,
    subtotal,
  })
  return data.cupom
}

export async function enviarEmailPedidoLojaOnline(input: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  await fetch('/api/loja-online/enviar-email-pedido', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).catch(() => null)
}
