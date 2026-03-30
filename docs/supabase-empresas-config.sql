-- Configurações da loja (espelho Supabase/PostgreSQL)
-- Execute no SQL Editor do Supabase após supabase-mirror-tables.sql

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
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_empresas_config_empresa ON empresas_config(empresa_id);

-- ── Bancos já criados antes desta coluna: rode também (ou use docs/supabase-impressora-cupom-migracao.sql)
-- ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS impressora_cupom TEXT;
-- ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS cupom_layout_pagina TEXT DEFAULT 'compat';
