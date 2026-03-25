-- Espelha saldo atual na linha do produto (alinhado ao SQLite local e ao sync Supabase)
-- IF NOT EXISTS: seguro se a coluna já existir (ex.: Supabase ou migração manual anterior)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS estoque_atual NUMERIC(15,4);
