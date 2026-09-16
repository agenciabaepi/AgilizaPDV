import { getSupabaseAdmin } from './supabase'
import {
  MELHOR_ENVIO_PAC_ID,
  MELHOR_ENVIO_SEDEX_ID,
  melhorEnvioBaseUrl,
  refreshMelhorEnvioToken,
  resolveMelhorEnvioAuth,
  saveMelhorEnvioAuth,
  type MelhorEnvioStoredAuth,
} from './melhor-envio'

export type MelhorEnvioEtiquetaStatus = 'processando' | 'gerada' | 'erro'

export type GerarEtiquetaResult = {
  ok: boolean
  skipped?: boolean
  cartId?: string
  url?: string | null
  tracking?: string | null
  error?: string
}

function digits(v: string | null | undefined): string {
  return String(v ?? '').replace(/\D/g, '')
}

function userAgent(): string {
  return process.env.MELHOR_ENVIO_USER_AGENT?.trim() || 'AgilizaPDV (contato@agilizapdv.app)'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function meError(json: unknown, fallback: string): string {
  if (!json || typeof json !== 'object') return fallback
  const o = json as Record<string, unknown>
  if (typeof o.message === 'string' && o.message.trim()) return o.message
  if (typeof o.error === 'string' && o.error.trim()) return o.error
  if (o.errors && typeof o.errors === 'object') {
    const parts: string[] = []
    for (const [k, v] of Object.entries(o.errors as Record<string, unknown>)) {
      if (Array.isArray(v)) parts.push(`${k}: ${v.join(', ')}`)
      else if (typeof v === 'string') parts.push(`${k}: ${v}`)
    }
    if (parts.length) return parts.join(' | ')
  }
  return fallback
}

function meLooksAlreadyDone(json: unknown): boolean {
  const msg = meError(json, '').toLowerCase()
  return /already|já (foi )?(pago|gerad|comprad|processad)|paid|generated/.test(msg)
}

function orderStatus(json: unknown): string {
  if (!json || typeof json !== 'object') return ''
  const o = json as Record<string, unknown>
  return String(o.status || o.status_id || '').toLowerCase()
}

function trackingFromOrder(json: unknown, fallback?: string | null): string | null {
  if (!json || typeof json !== 'object') return fallback || null
  const o = json as { tracking?: string | { code?: string } }
  if (typeof o.tracking === 'string' && o.tracking.trim()) return o.tracking
  if (o.tracking && typeof o.tracking === 'object' && o.tracking.code) return o.tracking.code
  return fallback || null
}

async function meFetch(
  token: string,
  sandbox: boolean,
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetch(`${melhorEnvioBaseUrl(sandbox)}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': userAgent(),
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(25000),
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, json }
}

type ViaCep = {
  logradouro: string
  bairro: string
  localidade: string
  uf: string
  complemento?: string
}

async function viaCep(cep: string): Promise<ViaCep | null> {
  const d = digits(cep)
  if (d.length !== 8) return null
  const res = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) return null
  const data = (await res.json()) as ViaCep & { erro?: boolean }
  if (data.erro) return null
  return data
}

function extractNumber(endereco: string): string {
  const m =
    endereco.match(/(?:n[uú]mero|n[ºo°]?\.?)\s*(\d+[A-Za-z]?)/i) ||
    endereco.match(/,\s*(\d+[A-Za-z]?)\b/) ||
    endereco.match(/\b(\d{1,5}[A-Za-z]?)\s*(?:-|–|,|$)/)
  return m?.[1] || 'S/N'
}

function serviceFromTipo(tipo: string | null | undefined): number {
  const t = (tipo || '').toLowerCase()
  if (t === '2' || t.includes('sedex')) return MELHOR_ENVIO_SEDEX_ID
  return MELHOR_ENVIO_PAC_ID
}

async function updatePedidoEtiqueta(
  pedidoId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('loja_online_pedidos').update(fields).eq('id', pedidoId)
  if (error) {
    if (/melhor_envio_/i.test(error.message)) {
      throw new Error(
        'Execute o SQL web/sql/supabase-loja-online-etiquetas.sql no Supabase para habilitar etiquetas.'
      )
    }
    throw error
  }
}

export async function gerarEtiquetaPedido(pedidoId: string, empresaId?: string): Promise<GerarEtiquetaResult> {
  const supabase = getSupabaseAdmin()
  const { data: pedido, error } = await supabase.from('loja_online_pedidos').select('*').eq('id', pedidoId).maybeSingle()
  if (error) throw error
  if (!pedido) throw new Error('Pedido não encontrado.')
  if (empresaId && String(pedido.empresa_id) !== empresaId) {
    throw new Error('Pedido não pertence a esta loja.')
  }

  if (pedido.forma_entrega !== 'entrega') {
    return { ok: true, skipped: true }
  }
  if (pedido.pagamento_status !== 'pago') {
    throw new Error('A etiqueta só é gerada depois do pagamento confirmado.')
  }
  if (pedido.melhor_envio_etiqueta_url && pedido.melhor_envio_status === 'gerada') {
    return {
      ok: true,
      cartId: pedido.melhor_envio_cart_id,
      url: pedido.melhor_envio_etiqueta_url,
      tracking: pedido.melhor_envio_tracking || pedido.codigo_rastreio,
    }
  }

  const { data: cfg, error: cfgErr } = await supabase
    .from('empresas_config')
    .select(
      'empresa_id, razao_social, endereco, telefone, email, ie_emitente, loja_online_titulo, loja_online_email_contato, loja_online_whatsapp, loja_online_frete_cep_origem, loja_online_frete_peso_padrao, loja_online_melhor_envio_token, loja_online_melhor_envio_sandbox'
    )
    .eq('empresa_id', pedido.empresa_id)
    .maybeSingle()
  if (cfgErr) throw cfgErr
  if (!cfg) throw new Error('Configuração da loja não encontrada.')

  const { data: empresa } = await supabase
    .from('empresas')
    .select('nome, cnpj')
    .eq('id', pedido.empresa_id)
    .maybeSingle()

  const resolved = resolveMelhorEnvioAuth(
    cfg.loja_online_melhor_envio_token,
    Number(cfg.loja_online_melhor_envio_sandbox) === 1
  )
  if (!resolved.auth) {
    throw new Error('Token do Melhor Envio não configurado. Cole o token em Entrega e frete.')
  }

  let auth: MelhorEnvioStoredAuth = resolved.auth
  const sandbox = resolved.sandbox

  const cepOrigem = digits(cfg.loja_online_frete_cep_origem)
  const cepDestino = digits(pedido.cep_destino)
  if (cepOrigem.length !== 8) throw new Error('CEP de origem da loja não configurado.')
  if (cepDestino.length !== 8) throw new Error('CEP de destino do pedido não informado.')

  const [origemCep, destinoCep] = await Promise.all([viaCep(cepOrigem), viaCep(cepDestino)])
  if (!origemCep?.uf) throw new Error('Não foi possível localizar o CEP de origem.')
  if (!destinoCep?.uf) throw new Error('Não foi possível localizar o CEP de destino.')

  const { data: itens } = await supabase
    .from('loja_online_pedido_itens')
    .select('nome, quantidade, preco')
    .eq('pedido_id', pedidoId)
  const itemRows = (itens ?? []) as { nome: string; quantidade: number; preco: number }[]
  if (itemRows.length === 0) throw new Error('Pedido sem itens.')

  let clienteDoc = ''
  if (pedido.cliente_id) {
    const { data: cli } = await supabase
      .from('loja_online_clientes')
      .select('cpf_cnpj')
      .eq('id', pedido.cliente_id)
      .maybeSingle()
    clienteDoc = digits(cli?.cpf_cnpj)
  }

  const cnpjLoja = digits(empresa?.cnpj)
  const fromName = String(cfg.razao_social || cfg.loja_online_titulo || empresa?.nome || 'Loja').slice(0, 60)
  const fromPhone = digits(cfg.telefone || cfg.loja_online_whatsapp)
  const fromEmail = String(cfg.email || cfg.loja_online_email_contato || 'contato@agilizapdv.app')
  const fromAddr = String(cfg.endereco || origemCep.logradouro || 'Endereço da loja')

  const toName = String(pedido.cliente_nome || 'Destinatário').slice(0, 60)
  const toPhone = digits(pedido.cliente_telefone) || fromPhone
  const toEmail = String(pedido.cliente_email || fromEmail)
  const toAddrRaw = String(pedido.endereco_entrega || destinoCep.logradouro || '')

  const from: Record<string, string> = {
    name: fromName,
    email: fromEmail,
    phone: fromPhone.slice(0, 11),
    address: origemCep.logradouro || fromAddr.split(',')[0] || fromAddr,
    complement: '',
    number: extractNumber(fromAddr),
    district: origemCep.bairro || 'Centro',
    city: origemCep.localidade,
    postal_code: cepOrigem,
    state_abbr: origemCep.uf,
    country_id: 'BR',
    state_register: 'ISENTO',
  }
  if (cnpjLoja.length === 14) from.company_document = cnpjLoja
  else if (cnpjLoja.length === 11) from.document = cnpjLoja
  else {
    throw new Error('Cadastre o CNPJ ou CPF da loja para gerar etiquetas no Melhor Envio.')
  }

  const to: Record<string, string> = {
    name: toName,
    email: toEmail,
    phone: (toPhone || '11999999999').slice(0, 11),
    address: destinoCep.logradouro || toAddrRaw.split(',')[0] || toAddrRaw || 'Endereço',
    complement: '',
    number: extractNumber(toAddrRaw),
    district: destinoCep.bairro || 'Centro',
    city: destinoCep.localidade,
    postal_code: cepDestino,
    country_id: 'BR',
    state_abbr: destinoCep.uf,
    state_register: 'ISENTO',
  }
  if (clienteDoc.length === 14) to.company_document = clienteDoc
  else if (clienteDoc.length === 11) to.document = clienteDoc
  else to.document = '00000000000'

  const insurance = itemRows.reduce((s, i) => s + Number(i.preco) * Number(i.quantidade), 0)
  const peso = Math.max(0.1, Number(cfg.loja_online_frete_peso_padrao) || 0.3)
  const payload = {
    service: serviceFromTipo(pedido.tipo_frete),
    from,
    to,
    products: itemRows.map((i) => ({
      name: String(i.nome || 'Produto').slice(0, 80),
      quantity: String(Math.max(1, Math.round(Number(i.quantidade) || 1))),
      unitary_value: String(Math.max(1, Number(i.preco) || 1).toFixed(2)),
    })),
    volumes: [{ height: 5, width: 15, length: 20, weight: peso }],
    options: {
      platform: 'AgilizaPDV',
      reminder: `Pedido ${String(pedidoId).slice(0, 8).toUpperCase()}`,
      insurance_value: Math.round(insurance * 100) / 100,
      receipt: false,
      own_hand: false,
      reverse: false,
      non_commercial: true,
      tags: [{ tag: pedidoId, url: null as string | null }],
    },
  }

  await updatePedidoEtiqueta(pedidoId, {
    melhor_envio_status: 'processando',
    melhor_envio_erro: null,
  })

  const authorizedFetch = async (path: string, init?: RequestInit) => {
    let res = await meFetch(auth.access_token, sandbox, path, init)
    if (res.status === 401 && auth.refresh_token) {
      try {
        const fresh = await refreshMelhorEnvioToken(auth.refresh_token, sandbox)
        auth = fresh
        await saveMelhorEnvioAuth(pedido.empresa_id, fresh, sandbox)
        res = await meFetch(auth.access_token, sandbox, path, init)
      } catch {
        /* keep original error */
      }
    }
    return res
  }

  let cartId = String(pedido.melhor_envio_cart_id || '')
  if (cartId) {
    const existing = await authorizedFetch(`/api/v2/me/orders/${cartId}`, { method: 'GET' })
    if (existing.ok && /cancel/.test(orderStatus(existing.json))) cartId = ''
  }

  if (!cartId) {
    const cartRes = await authorizedFetch('/api/v2/me/cart', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (!cartRes.ok) {
      const msg = meError(cartRes.json, `Não foi possível criar o envio (${cartRes.status}).`)
      await updatePedidoEtiqueta(pedidoId, { melhor_envio_status: 'erro', melhor_envio_erro: msg })
      throw new Error(msg)
    }
    const cart = cartRes.json as { id?: string }
    cartId = String(cart.id || '')
    if (!cartId) {
      const msg = 'Melhor Envio não retornou o ID da etiqueta.'
      await updatePedidoEtiqueta(pedidoId, { melhor_envio_status: 'erro', melhor_envio_erro: msg })
      throw new Error(msg)
    }
    await updatePedidoEtiqueta(pedidoId, { melhor_envio_cart_id: cartId })
  }

  const checkout = await authorizedFetch('/api/v2/me/shipment/checkout', {
    method: 'POST',
    body: JSON.stringify({ orders: [cartId] }),
  })
  if (!checkout.ok && !meLooksAlreadyDone(checkout.json)) {
    const msg = meError(
      checkout.json,
      'Não foi possível pagar a etiqueta. Verifique o saldo da carteira no Melhor Envio e as permissões do token (carrinho, compra, geração e impressão).'
    )
    await updatePedidoEtiqueta(pedidoId, { melhor_envio_status: 'erro', melhor_envio_erro: msg })
    throw new Error(msg)
  }

  let generate = await authorizedFetch('/api/v2/me/shipment/generate', {
    method: 'POST',
    body: JSON.stringify({ orders: [cartId] }),
  })
  if (!generate.ok && !meLooksAlreadyDone(generate.json)) {
    await sleep(2000)
    generate = await authorizedFetch('/api/v2/me/shipment/generate', {
      method: 'POST',
      body: JSON.stringify({ orders: [cartId] }),
    })
  }
  if (!generate.ok && !meLooksAlreadyDone(generate.json)) {
    const msg = meError(generate.json, 'Etiqueta paga, mas a geração falhou. Tente de novo em alguns segundos.')
    await updatePedidoEtiqueta(pedidoId, { melhor_envio_status: 'erro', melhor_envio_erro: msg })
    throw new Error(msg)
  }

  let url: string | null = null
  let printJson: unknown = {}
  for (let i = 0; i < 3; i++) {
    if (i > 0) await sleep(2000)
    const print = await authorizedFetch('/api/v2/me/shipment/print', {
      method: 'POST',
      body: JSON.stringify({ mode: 'public', orders: [cartId] }),
    })
    printJson = print.json
    const printUrl = (print.json as { url?: string }).url
    if (print.ok && printUrl) {
      url = printUrl
      break
    }
  }

  const info = await authorizedFetch(`/api/v2/me/orders/${cartId}`, { method: 'GET' })
  const tracking = trackingFromOrder(info.json)

  const fields: Record<string, unknown> = {
    melhor_envio_cart_id: cartId,
    melhor_envio_status: 'gerada',
    melhor_envio_etiqueta_url: url,
    melhor_envio_erro: url ? null : meError(printJson, 'Envio gerado, mas o PDF ainda não ficou pronto. Clique em Gerar de novo em alguns segundos.'),
    melhor_envio_tracking: tracking,
  }
  if (tracking) fields.codigo_rastreio = tracking
  await updatePedidoEtiqueta(pedidoId, fields)

  return { ok: true, cartId, url, tracking }
}

export async function gerarEtiquetaSePedidoPago(pedidoId: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase
      .from('loja_online_pedidos')
      .select('id, forma_entrega, pagamento_status, melhor_envio_status, melhor_envio_etiqueta_url')
      .eq('id', pedidoId)
      .maybeSingle()
    if (!data) return
    if (data.forma_entrega !== 'entrega') return
    if (data.pagamento_status !== 'pago') return
    if (data.melhor_envio_status === 'gerada' && data.melhor_envio_etiqueta_url) return
    if (data.melhor_envio_status === 'processando') return
    await gerarEtiquetaPedido(pedidoId)
  } catch (err) {
    console.error('[melhor-envio/etiqueta]', pedidoId, err)
  }
}
