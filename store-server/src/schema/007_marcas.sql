CREATE TABLE IF NOT EXISTS marcas (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, nome)
);
CREATE INDEX IF NOT EXISTS idx_marcas_empresa ON marcas(empresa_id);

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS marca_id TEXT REFERENCES marcas(id);
CREATE INDEX IF NOT EXISTS idx_produtos_marca ON produtos(marca_id);
