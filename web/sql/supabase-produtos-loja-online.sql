-- Exibir produto na loja online (0 = não, 1 = sim)
-- Default 1 mantém produtos existentes visíveis na vitrine até o lojista desmarcar.

ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS loja_online INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN produtos.loja_online IS '1 = exibir na loja online; 0 = ocultar da vitrine pública';
