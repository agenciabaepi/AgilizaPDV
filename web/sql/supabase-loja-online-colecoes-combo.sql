-- =============================================================================
-- Agiliza PDV — Combos nas coleções da loja online
-- Permite marcar uma coleção como combo (ex.: powerbank + cabo) com preço
-- especial ao comprar todos os produtos juntos.
-- =============================================================================

ALTER TABLE loja_online_colecoes
  ADD COLUMN IF NOT EXISTS eh_combo INTEGER NOT NULL DEFAULT 0;

ALTER TABLE loja_online_colecoes
  ADD COLUMN IF NOT EXISTS preco_combo REAL;

COMMENT ON COLUMN loja_online_colecoes.eh_combo IS
  '1 = coleção vendida como combo (kit) com preço especial.';
COMMENT ON COLUMN loja_online_colecoes.preco_combo IS
  'Preço do combo ao comprar todos os produtos juntos. NULL se não for combo.';
