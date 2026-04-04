/**
 * Deve permanecer alinhado com `sync/empresas-config-mirror.ts` (store-server compila só `src/`).
 * Colunas do espelho `empresas_config` no Supabase.
 */
export const EMPRESAS_CONFIG_MIRROR_FIELD_KEYS = [
  'empresa_id',
  'razao_social',
  'endereco',
  'telefone',
  'email',
  'logo',
  'cor_primaria',
  'modulos_json',
  'impressora_cupom',
  'cupom_layout_pagina',
  'updated_at',
  'ambiente_fiscal',
  'serie_nfe',
  'ultimo_numero_nfe',
  'serie_nfce',
  'ultimo_numero_nfce',
  'csc_nfce',
  'csc_id_nfce',
  'indicar_fonte_ibpt',
  'xml_autorizados_json',
  'uf_emitente',
  'ie_emitente',
  'c_mun_emitente',
  'ncm_padrao',
  'tributo_aprox_federal_pct',
  'tributo_aprox_estadual_pct',
  'tributo_aprox_municipal_pct',
  'caixa_valor_sugerido_abertura',
  'venda_prazo_usar_limite_credito',
  'venda_prazo_bloquear_inadimplente',
] as const

export type EmpresasConfigMirrorFieldKey = (typeof EMPRESAS_CONFIG_MIRROR_FIELD_KEYS)[number]

/** Mesma ordem do pull SQLite / Supabase (`sync/empresas-config-mirror.ts`). */
export const EMPRESAS_CONFIG_PG_PULL_COLUMNS = [...EMPRESAS_CONFIG_MIRROR_FIELD_KEYS] as string[]

export const EMPRESAS_CONFIG_PULL_PG_DEFAULTS: Partial<Record<EmpresasConfigMirrorFieldKey, string | number>> = {
  cor_primaria: '#1d4ed8',
  ambiente_fiscal: 1,
  serie_nfe: 1,
  ultimo_numero_nfe: 0,
  serie_nfce: 1,
  ultimo_numero_nfce: 0,
  indicar_fonte_ibpt: 1,
  uf_emitente: 'SP',
  ie_emitente: 'ISENTO',
  tributo_aprox_federal_pct: 0,
  tributo_aprox_estadual_pct: 0,
  tributo_aprox_municipal_pct: 0,
  caixa_valor_sugerido_abertura: 0,
  venda_prazo_usar_limite_credito: 0,
  venda_prazo_bloquear_inadimplente: 0,
  cupom_layout_pagina: 'compat',
}
