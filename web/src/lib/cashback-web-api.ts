import { supabase } from './supabase'

export type CashbackConfigRow = {
  ativo: number
  percentual_padrao: number
  modo_validade: string
  dias_validade: number | null
  data_validade_fixa: string | null
  valor_minimo_compra_gerar: number
  valor_minimo_compra_usar: number
  valor_maximo_uso_por_venda: number | null
  permitir_quitar_total: number
  permitir_uso_mesma_compra: number
  calcular_sobre: string
  excluir_itens_com_desconto: number
  excluir_itens_promocionais: number
  gerar_sobre_valor_apos_cashback: number
  modo_lista: string
  arredondamento: string
  dias_alerta_expiracao: number
}

type UpdateCashbackConfigInput = Partial<{
  ativo: boolean
  percentual_padrao: number
  modo_validade: string
  dias_validade: number | null
  data_validade_fixa: string | null
  valor_minimo_compra_gerar: number
  valor_minimo_compra_usar: number
  valor_maximo_uso_por_venda: number | null
  permitir_quitar_total: boolean
  permitir_uso_mesma_compra: boolean
  calcular_sobre: string
  excluir_itens_com_desconto: boolean
  excluir_itens_promocionais: boolean
  gerar_sobre_valor_apos_cashback: boolean
  modo_lista: string
  arredondamento: string
  dias_alerta_expiracao: number
}>

function boolToInt(v: boolean | undefined, fallback: number): number {
  if (v === undefined) return fallback
  return v ? 1 : 0
}

function mapConfig(r: Record<string, unknown>): CashbackConfigRow {
  return {
    ativo: Number(r.ativo) || 0,
    percentual_padrao: Number(r.percentual_padrao) || 0,
    modo_validade: (r.modo_validade as string) || 'NUNCA',
    dias_validade: r.dias_validade != null ? Number(r.dias_validade) : null,
    data_validade_fixa: (r.data_validade_fixa as string) ?? null,
    valor_minimo_compra_gerar: Number(r.valor_minimo_compra_gerar) || 0,
    valor_minimo_compra_usar: Number(r.valor_minimo_compra_usar) || 0,
    valor_maximo_uso_por_venda:
      r.valor_maximo_uso_por_venda != null ? Number(r.valor_maximo_uso_por_venda) : null,
    permitir_quitar_total: Number(r.permitir_quitar_total) !== 0 ? 1 : 0,
    permitir_uso_mesma_compra: Number(r.permitir_uso_mesma_compra) !== 0 ? 1 : 0,
    calcular_sobre: (r.calcular_sobre as string) || 'LIQUIDO',
    excluir_itens_com_desconto: Number(r.excluir_itens_com_desconto) || 0,
    excluir_itens_promocionais: Number(r.excluir_itens_promocionais) || 0,
    gerar_sobre_valor_apos_cashback: Number(r.gerar_sobre_valor_apos_cashback) || 0,
    modo_lista: (r.modo_lista as string) || 'TODOS_EXCETO_EXCLUIDOS',
    arredondamento: (r.arredondamento as string) || 'PADRAO',
    dias_alerta_expiracao: Number(r.dias_alerta_expiracao) || 7,
  }
}

export async function getCashbackConfig(empresaId: string): Promise<CashbackConfigRow> {
  const { data, error } = await supabase
    .from('cashback_configuracoes')
    .select('*')
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return mapConfig(data as Record<string, unknown>)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const { data: inserted, error: insertErr } = await supabase
    .from('cashback_configuracoes')
    .insert({
      id,
      empresa_id: empresaId,
      ativo: 0,
      percentual_padrao: 0,
      modo_validade: 'NUNCA',
      valor_minimo_compra_gerar: 0,
      valor_minimo_compra_usar: 0,
      permitir_quitar_total: 1,
      permitir_uso_mesma_compra: 1,
      calcular_sobre: 'LIQUIDO',
      excluir_itens_com_desconto: 0,
      excluir_itens_promocionais: 0,
      gerar_sobre_valor_apos_cashback: 0,
      modo_lista: 'TODOS_EXCETO_EXCLUIDOS',
      arredondamento: 'PADRAO',
      dias_alerta_expiracao: 7,
      updated_at: now,
    })
    .select('*')
    .single()
  if (insertErr) {
    // Outra aba/request pode ter criado a linha no meio do caminho.
    if (insertErr.code === '23505') {
      const { data: again, error: againErr } = await supabase
        .from('cashback_configuracoes')
        .select('*')
        .eq('empresa_id', empresaId)
        .single()
      if (againErr) throw new Error(againErr.message)
      return mapConfig(again as Record<string, unknown>)
    }
    throw new Error(insertErr.message)
  }
  return mapConfig(inserted as Record<string, unknown>)
}

export async function updateCashbackConfig(
  empresaId: string,
  data: UpdateCashbackConfigInput
): Promise<CashbackConfigRow> {
  const cur = await getCashbackConfig(empresaId)
  const next = {
    ativo: boolToInt(data.ativo, cur.ativo),
    percentual_padrao: data.percentual_padrao ?? cur.percentual_padrao,
    modo_validade: data.modo_validade ?? cur.modo_validade,
    dias_validade: data.dias_validade !== undefined ? data.dias_validade : cur.dias_validade,
    data_validade_fixa:
      data.data_validade_fixa !== undefined ? data.data_validade_fixa : cur.data_validade_fixa,
    valor_minimo_compra_gerar: data.valor_minimo_compra_gerar ?? cur.valor_minimo_compra_gerar,
    valor_minimo_compra_usar: data.valor_minimo_compra_usar ?? cur.valor_minimo_compra_usar,
    valor_maximo_uso_por_venda:
      data.valor_maximo_uso_por_venda !== undefined
        ? data.valor_maximo_uso_por_venda
        : cur.valor_maximo_uso_por_venda,
    permitir_quitar_total: boolToInt(data.permitir_quitar_total, cur.permitir_quitar_total),
    permitir_uso_mesma_compra: boolToInt(data.permitir_uso_mesma_compra, cur.permitir_uso_mesma_compra),
    calcular_sobre: data.calcular_sobre ?? cur.calcular_sobre,
    excluir_itens_com_desconto: boolToInt(
      data.excluir_itens_com_desconto,
      cur.excluir_itens_com_desconto
    ),
    excluir_itens_promocionais: boolToInt(
      data.excluir_itens_promocionais,
      cur.excluir_itens_promocionais
    ),
    gerar_sobre_valor_apos_cashback: boolToInt(
      data.gerar_sobre_valor_apos_cashback,
      cur.gerar_sobre_valor_apos_cashback
    ),
    modo_lista: data.modo_lista ?? cur.modo_lista,
    arredondamento: data.arredondamento ?? cur.arredondamento,
    dias_alerta_expiracao: data.dias_alerta_expiracao ?? cur.dias_alerta_expiracao,
    updated_at: new Date().toISOString(),
  }

  const { data: updated, error } = await supabase
    .from('cashback_configuracoes')
    .update(next)
    .eq('empresa_id', empresaId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return mapConfig(updated as Record<string, unknown>)
}
