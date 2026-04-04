-- =============================================================================
-- Agiliza PDV — `empresas_config` no Supabase (espelho do SQLite)
-- Execute após supabase-mirror-tables.sql (tabela `empresas` deve existir).
-- Mantido alinhado ao pull/push em sync/empresas-config-mirror.ts
-- =============================================================================

CREATE TABLE IF NOT EXISTS empresas_config (
  empresa_id TEXT PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  razao_social TEXT,
  endereco TEXT,
  telefone TEXT,
  email TEXT,
  logo TEXT,
  cor_primaria TEXT DEFAULT '#1d4ed8',
  modulos_json TEXT,
  impressora_cupom TEXT,
  cupom_layout_pagina TEXT DEFAULT 'compat',
  updated_at TIMESTAMPTZ DEFAULT now(),
  ambiente_fiscal INTEGER DEFAULT 1,
  serie_nfe INTEGER DEFAULT 1,
  ultimo_numero_nfe INTEGER DEFAULT 0,
  serie_nfce INTEGER DEFAULT 1,
  ultimo_numero_nfce INTEGER DEFAULT 0,
  csc_nfce TEXT,
  csc_id_nfce TEXT,
  indicar_fonte_ibpt INTEGER DEFAULT 1,
  xml_autorizados_json TEXT,
  uf_emitente TEXT DEFAULT 'SP',
  ie_emitente TEXT DEFAULT 'ISENTO',
  c_mun_emitente INTEGER,
  ncm_padrao TEXT,
  tributo_aprox_federal_pct REAL DEFAULT 0,
  tributo_aprox_estadual_pct REAL DEFAULT 0,
  tributo_aprox_municipal_pct REAL DEFAULT 0,
  caixa_valor_sugerido_abertura REAL DEFAULT 0,
  venda_prazo_usar_limite_credito INTEGER NOT NULL DEFAULT 0,
  venda_prazo_bloquear_inadimplente INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_empresas_config_empresa ON empresas_config(empresa_id);

-- ---------------------------------------------------------------------------
-- Projetos já criados antes deste script: colunas idempotentes
-- ---------------------------------------------------------------------------
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS impressora_cupom TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS cupom_layout_pagina TEXT DEFAULT 'compat';
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS ambiente_fiscal INTEGER DEFAULT 1;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS serie_nfe INTEGER DEFAULT 1;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS ultimo_numero_nfe INTEGER DEFAULT 0;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS serie_nfce INTEGER DEFAULT 1;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS ultimo_numero_nfce INTEGER DEFAULT 0;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS csc_nfce TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS csc_id_nfce TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS indicar_fonte_ibpt INTEGER DEFAULT 1;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS xml_autorizados_json TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS uf_emitente TEXT DEFAULT 'SP';
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS ie_emitente TEXT DEFAULT 'ISENTO';
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS c_mun_emitente INTEGER;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS ncm_padrao TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS tributo_aprox_federal_pct REAL DEFAULT 0;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS tributo_aprox_estadual_pct REAL DEFAULT 0;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS tributo_aprox_municipal_pct REAL DEFAULT 0;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS caixa_valor_sugerido_abertura REAL DEFAULT 0;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS venda_prazo_usar_limite_credito INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS venda_prazo_bloquear_inadimplente INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.empresas_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all mirror empresas_config" ON public.empresas_config;
CREATE POLICY "Allow anon all mirror empresas_config" ON public.empresas_config
  FOR ALL TO anon USING (true) WITH CHECK (true);
