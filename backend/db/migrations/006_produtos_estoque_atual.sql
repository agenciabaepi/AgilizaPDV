-- Coluna estoque_atual em produtos (espelho do Supabase); usada para exibir saldo após pull e manter em sync com movimentos locais
ALTER TABLE produtos ADD COLUMN estoque_atual REAL;
