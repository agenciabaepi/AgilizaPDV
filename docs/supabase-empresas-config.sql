-- Configurações da loja (espelho Supabase/PostgreSQL)
-- Execute no SQL Editor do Supabase após supabase-mirror-tables.sql

CREATE TABLE IF NOT EXISTS empresas_config (
  empresa_id TEXT PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  razao_social TEXT,
  endereco TEXT,
  telefone TEXT,
  email TEXT,
  logo TEXT,
  cor_primaria TEXT DEFAULT '#ea1d2c',
  modulos_json TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_empresas_config_empresa ON empresas_config(empresa_id);
