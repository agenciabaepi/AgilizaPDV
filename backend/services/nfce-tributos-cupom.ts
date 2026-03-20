import type { VendaDetalhes } from './vendas.service'
import type { EmpresaFiscalConfig } from './empresas.service'

/** Percentuais usados na ajuda de Configurações de notas (exemplo Lei 12.741/2012) quando IBPT está ativo mas nenhum % foi cadastrado. */
const IBPT_PCT_EXEMPLO_CONFIG = { federal: 5.33, estadual: 10.03, municipal: 0 }

function num(x: unknown): number {
  const n = typeof x === 'number' ? x : Number(x)
  return Number.isFinite(n) ? n : 0
}

/**
 * Tributos aproximados para o cupom NFC-e (Lei 12.741/2012).
 * Sobre cada linha da venda aplica os % informados em `empresas_config` (Federal / Estadual / Municipal).
 * Se a soma dos três % globais for zero e `usarExemploQuandoGlobalZero` for true, usa os valores de exemplo
 * da própria tela de configuração (usuário deve substituir pelos da tabela oficial IBPT para sua UF/NCM).
 */
export function computeTributosAproxNfceCupom(
  detalhes: VendaDetalhes,
  fiscal: EmpresaFiscalConfig,
  options?: { usarExemploQuandoGlobalZero?: boolean }
): { federal: number; estadual: number; municipal: number } {
  let pctF = num(fiscal.tributo_aprox_federal_pct)
  let pctE = num(fiscal.tributo_aprox_estadual_pct)
  let pctM = num(fiscal.tributo_aprox_municipal_pct)

  const somaGlobal = pctF + pctE + pctM
  if (options?.usarExemploQuandoGlobalZero && somaGlobal <= 0) {
    pctF = IBPT_PCT_EXEMPLO_CONFIG.federal
    pctE = IBPT_PCT_EXEMPLO_CONFIG.estadual
    pctM = IBPT_PCT_EXEMPLO_CONFIG.municipal
  }

  let federal = 0
  let estadual = 0
  let municipal = 0

  for (const item of detalhes.itens) {
    const base = num(item.total)
    federal += (base * pctF) / 100
    estadual += (base * pctE) / 100
    municipal += (base * pctM) / 100
  }

  const round2 = (v: number) => Math.round(v * 100) / 100
  return {
    federal: round2(federal),
    estadual: round2(estadual),
    municipal: round2(municipal),
  }
}
