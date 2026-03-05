-- Categorias hierárquicas (grupo → categoria → subcategoria) e produto.categoria_id
-- parent_id NULL = grupo (nivel 1), parent_id aponta para grupo = categoria (nivel 2), para categoria = subcategoria (nivel 3)

CREATE TABLE IF NOT EXISTS categorias (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL,
  parent_id TEXT REFERENCES categorias(id),
  nivel INTEGER NOT NULL DEFAULT 1 CHECK (nivel >= 1),
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_categorias_empresa ON categorias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_categorias_parent ON categorias(parent_id);
CREATE INDEX IF NOT EXISTS idx_categorias_empresa_parent_ordem ON categorias(empresa_id, parent_id, ordem);

-- Produtos passam a ter categoria_id (referência à categoria folha)
ALTER TABLE produtos ADD COLUMN categoria_id TEXT REFERENCES categorias(id);
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id);
