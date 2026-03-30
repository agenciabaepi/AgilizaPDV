-- Marcas de produto (por empresa)
CREATE TABLE IF NOT EXISTS marcas (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(empresa_id, nome)
);
CREATE INDEX IF NOT EXISTS idx_marcas_empresa ON marcas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_marcas_empresa_ativo ON marcas(empresa_id, ativo);

ALTER TABLE produtos ADD COLUMN marca_id TEXT REFERENCES marcas(id);
CREATE INDEX IF NOT EXISTS idx_produtos_marca ON produtos(marca_id);
