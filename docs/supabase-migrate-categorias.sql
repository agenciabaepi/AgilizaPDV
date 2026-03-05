-- =============================================================================
-- Migração: adicionar categorias hierárquicas e produto.categoria_id no Supabase
-- Execute este script no Supabase (SQL Editor) se você já tem o espelho criado
-- com o schema antigo (produtos com categoria/subcategoria em vez de categoria_id).
-- =============================================================================

-- 1) Criar tabela categorias (se não existir)
CREATE TABLE IF NOT EXISTS categorias (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  parent_id TEXT REFERENCES categorias(id),
  nivel INTEGER NOT NULL DEFAULT 1 CHECK (nivel >= 1),
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categorias_empresa ON categorias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_categorias_parent ON categorias(parent_id);

-- 2) Adicionar coluna categoria_id em produtos (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produtos' AND column_name = 'categoria_id'
  ) THEN
    ALTER TABLE produtos ADD COLUMN categoria_id TEXT REFERENCES categorias(id);
    CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id);
  END IF;
END $$;

-- 3) (Opcional) Remover colunas antigas categoria e subcategoria depois de migrar dados
-- Descomente apenas se você já migrou os dados e não precisa mais delas:
-- ALTER TABLE produtos DROP COLUMN IF EXISTS categoria;
-- ALTER TABLE produtos DROP COLUMN IF EXISTS subcategoria;

-- 4) Habilitar RLS na tabela categorias (se usar RLS)
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
