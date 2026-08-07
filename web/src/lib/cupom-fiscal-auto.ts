import type { EmpresaConfig } from '../vite-env'

export type FormaPagamentoCupomAuto =
  | 'DINHEIRO'
  | 'PIX'
  | 'DEBITO'
  | 'CREDITO'
  | 'OUTROS'
  | 'CASHBACK'
  | 'A_PRAZO'

export const FORMAS_CUPOM_FISCAL_AUTO: { value: FormaPagamentoCupomAuto; label: string }[] = [
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'PIX', label: 'Pix' },
  { value: 'CREDITO', label: 'Cartão de crédito' },
  { value: 'DEBITO', label: 'Cartão de débito' },
  { value: 'OUTROS', label: 'Outros' },
  { value: 'CASHBACK', label: 'Cashback' },
  { value: 'A_PRAZO', label: 'A prazo' },
]

const FORMAS_VALIDAS = new Set<string>(FORMAS_CUPOM_FISCAL_AUTO.map((f) => f.value))

export function parseCupomFiscalAutoFormas(json: string | null | undefined): {
  todas: boolean
  formas: FormaPagamentoCupomAuto[]
} {
  if (!json?.trim()) return { todas: true, formas: [] }
  try {
    const parsed = JSON.parse(json) as { todas?: boolean; formas?: string[] }
    if (parsed.todas === true) return { todas: true, formas: [] }
    const formas = (parsed.formas ?? [])
      .filter((f) => FORMAS_VALIDAS.has(f))
      .map((f) => f as FormaPagamentoCupomAuto)
    return { todas: false, formas }
  } catch {
    return { todas: true, formas: [] }
  }
}

export function buildCupomFiscalAutoFormasJson(
  todas: boolean,
  formas: FormaPagamentoCupomAuto[]
): string {
  if (todas) return JSON.stringify({ todas: true })
  return JSON.stringify({ formas })
}

export function cupomFiscalAutoAtivo(config: EmpresaConfig | null | undefined): boolean {
  if (!config) return false
  const raw = (config as { cupom_fiscal_auto_emitir?: number | boolean | string | null }).cupom_fiscal_auto_emitir
  if (raw === 1 || raw === true || raw === '1') return true
  const n = Number(raw)
  return Number.isFinite(n) && n === 1
}

export function deveEmitirCupomFiscalAutomatico(
  config: EmpresaConfig | null | undefined,
  pagamentos: { forma: string }[]
): boolean {
  if (!cupomFiscalAutoAtivo(config)) return false
  if (pagamentos.length === 0) return false

  const json = (config as { cupom_fiscal_auto_formas_json?: string | null }).cupom_fiscal_auto_formas_json
  const { todas, formas } = parseCupomFiscalAutoFormas(json)
  if (todas) return true
  if (formas.length === 0) return false
  return pagamentos.some((p) => formas.includes(p.forma as FormaPagamentoCupomAuto))
}
