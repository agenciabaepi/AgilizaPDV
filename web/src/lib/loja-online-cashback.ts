import { supabase } from './supabase'

export function normalizeDocDigits(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const d = raw.replace(/\D/g, '')
  if (d.length === 11 || d.length === 14) return d
  return null
}

export type CashbackSaldoOnline = {
  saldo_disponivel: number
  bloqueado: boolean
  total_gerado: number
  total_utilizado: number
}

export async function ensureClientePdvForOnline(input: {
  empresaId: string
  nome: string
  email: string
  telefone?: string | null
  cpf_cnpj?: string | null
  endereco?: string | null
}): Promise<string | null> {
  const cpfNorm = normalizeDocDigits(input.cpf_cnpj)
  const email = input.email.trim().toLowerCase()

  const { data: rows, error } = await supabase
    .from('clientes')
    .select('id, cpf_cnpj, email')
    .eq('empresa_id', input.empresaId)
  if (error) throw error

  const list = rows ?? []
  const byCpf = cpfNorm
    ? list.find((c) => normalizeDocDigits(c.cpf_cnpj as string) === cpfNorm)
    : null
  if (byCpf?.id) return byCpf.id as string

  const byEmail = list.find((c) => String(c.email ?? '').trim().toLowerCase() === email)
  if (byEmail?.id) {
    if (cpfNorm && !normalizeDocDigits(byEmail.cpf_cnpj as string)) {
      await supabase.from('clientes').update({ cpf_cnpj: cpfNorm }).eq('id', byEmail.id)
    }
    return byEmail.id as string
  }

  const id = crypto.randomUUID()
  const { error: insErr } = await supabase.from('clientes').insert({
    id,
    empresa_id: input.empresaId,
    nome: input.nome.trim(),
    cpf_cnpj: cpfNorm,
    telefone: input.telefone?.trim() || null,
    email,
    endereco: input.endereco?.trim() || null,
  })
  if (insErr) throw insErr
  return id
}

export async function fetchCashbackSaldoOnline(
  empresaId: string,
  clientePdvId: string
): Promise<CashbackSaldoOnline | null> {
  const { data, error } = await supabase
    .from('cashback_saldos')
    .select('saldo_disponivel, bloqueado, total_gerado, total_utilizado')
    .eq('empresa_id', empresaId)
    .eq('cliente_id', clientePdvId)
    .maybeSingle()
  if (error) throw error
  if (!data) return { saldo_disponivel: 0, bloqueado: false, total_gerado: 0, total_utilizado: 0 }
  return {
    saldo_disponivel: Number(data.saldo_disponivel) || 0,
    bloqueado: Number(data.bloqueado) === 1,
    total_gerado: Number(data.total_gerado) || 0,
    total_utilizado: Number(data.total_utilizado) || 0,
  }
}

export async function debitarCashbackOnline(input: {
  empresaId: string
  clientePdvId: string
  cpfNorm: string
  valor: number
  pedidoId: string
}): Promise<void> {
  if (input.valor <= 0) return

  const saldo = await fetchCashbackSaldoOnline(input.empresaId, input.clientePdvId)
  if (!saldo || saldo.bloqueado) throw new Error('Cashback indisponível para este cliente.')
  if (saldo.saldo_disponivel < input.valor) throw new Error('Saldo de cashback insuficiente.')

  const novoSaldo = Math.round((saldo.saldo_disponivel - input.valor) * 100) / 100
  const { error: updErr } = await supabase
    .from('cashback_saldos')
    .update({
      saldo_disponivel: novoSaldo,
      total_utilizado: Math.round((saldo.total_utilizado + input.valor) * 100) / 100,
      updated_at: new Date().toISOString(),
    })
    .eq('empresa_id', input.empresaId)
    .eq('cliente_id', input.clientePdvId)
  if (updErr) throw updErr

  const { error: movErr } = await supabase.from('cashback_movimentacoes').insert({
    id: crypto.randomUUID(),
    empresa_id: input.empresaId,
    cliente_id: input.clientePdvId,
    cpf_normalizado: input.cpfNorm,
    tipo: 'DEBITO_USO',
    origem: 'LOJA_ONLINE',
    venda_id: null,
    valor: input.valor,
    saldo_disponivel_apos: novoSaldo,
    observacao: `Uso no pedido online ${input.pedidoId.slice(0, 8)}`,
    idempotency_key: `loja-online-debito-${input.pedidoId}`,
  })
  if (movErr) throw movErr
}

export async function gerarCashbackPedidoOnline(input: {
  empresaId: string
  clientePdvId: string
  cpfNorm: string
  vendaId: string
  valorBase: number
}): Promise<number> {
  const { data: cfg } = await supabase
    .from('cashback_configuracoes')
    .select('ativo, percentual_padrao, valor_minimo_compra_gerar, modo_validade, dias_validade')
    .eq('empresa_id', input.empresaId)
    .maybeSingle()

  if (!cfg || Number(cfg.ativo) !== 1) return 0
  const minCompra = Number(cfg.valor_minimo_compra_gerar) || 0
  if (input.valorBase < minCompra) return 0

  const pct = Number(cfg.percentual_padrao) || 0
  if (pct <= 0) return 0

  let valor = (input.valorBase * pct) / 100
  valor = Math.round(valor * 100) / 100
  if (valor <= 0) return 0

  let expiraEm: string | null = null
  if (cfg.modo_validade === 'DIAS' && cfg.dias_validade) {
    const d = new Date()
    d.setDate(d.getDate() + Number(cfg.dias_validade))
    expiraEm = d.toISOString()
  }

  const creditoId = crypto.randomUUID()
  const { error: credErr } = await supabase.from('cashback_creditos').insert({
    id: creditoId,
    empresa_id: input.empresaId,
    cliente_id: input.clientePdvId,
    cpf_normalizado: input.cpfNorm,
    venda_id_origem: input.vendaId,
    valor_inicial: valor,
    valor_restante: valor,
    expira_em: expiraEm,
    status: 'ATIVO',
  })
  if (credErr) throw credErr

  const saldoAtual = await fetchCashbackSaldoOnline(input.empresaId, input.clientePdvId)
  const novoSaldo = Math.round(((saldoAtual?.saldo_disponivel ?? 0) + valor) * 100) / 100

  const { data: existSaldo } = await supabase
    .from('cashback_saldos')
    .select('cliente_id')
    .eq('empresa_id', input.empresaId)
    .eq('cliente_id', input.clientePdvId)
    .maybeSingle()

  if (existSaldo) {
    await supabase
      .from('cashback_saldos')
      .update({
        saldo_disponivel: novoSaldo,
        total_gerado: Math.round(((saldoAtual?.total_gerado ?? 0) + valor) * 100) / 100,
        updated_at: new Date().toISOString(),
      })
      .eq('empresa_id', input.empresaId)
      .eq('cliente_id', input.clientePdvId)
  } else {
    await supabase.from('cashback_saldos').insert({
      empresa_id: input.empresaId,
      cliente_id: input.clientePdvId,
      cpf_normalizado: input.cpfNorm,
      saldo_disponivel: novoSaldo,
      total_gerado: valor,
    })
  }

  await supabase.from('cashback_movimentacoes').insert({
    id: crypto.randomUUID(),
    empresa_id: input.empresaId,
    cliente_id: input.clientePdvId,
    cpf_normalizado: input.cpfNorm,
    tipo: 'CREDITO_VENDA',
    origem: 'LOJA_ONLINE',
    venda_id: input.vendaId,
    credito_id: creditoId,
    valor,
    saldo_disponivel_apos: novoSaldo,
    observacao: 'Cashback gerado na venda online',
    idempotency_key: `loja-online-credito-${input.vendaId}`,
  })

  return valor
}
