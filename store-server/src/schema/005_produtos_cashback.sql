-- Cashback por produto (Postgres / Supabase)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cashback_ativo INTEGER NOT NULL DEFAULT 1;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cashback_percentual NUMERIC(8, 4);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS permitir_resgate_cashback_no_produto INTEGER NOT NULL DEFAULT 1;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cashback_observacao TEXT;
