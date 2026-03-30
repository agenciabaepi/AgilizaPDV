-- Marcas de produto + coluna produtos.marca_id (espelho Supabase / sync com o PDV)
-- empresas.id no espelho é TEXT (igual supabase-mirror-tables.sql), não UUID.
-- Execute no SQL Editor do Supabase após fazer backup.

CREATE TABLE IF NOT EXISTS marcas (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  empresa_id TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_marcas_empresa ON marcas(empresa_id);

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS marca_id TEXT REFERENCES marcas(id);
CREATE INDEX IF NOT EXISTS idx_produtos_marca ON produtos(marca_id);
