-- =============================================================================
-- Adicionar coluna estoque_atual na tabela produtos (Supabase)
-- Execute no SQL Editor se a tabela produtos já existir sem essa coluna.
-- O sync do app passa a preencher este valor (saldo calculado dos movimentos).
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'produtos' AND column_name = 'estoque_atual'
  ) THEN
    ALTER TABLE produtos ADD COLUMN estoque_atual REAL NOT NULL DEFAULT 0;
  END IF;
END $$;
