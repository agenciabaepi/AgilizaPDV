-- Acelera listagens de produtos (PDV, cadastro e loja online).

CREATE INDEX IF NOT EXISTS idx_produtos_empresa_ativo
  ON produtos (empresa_id, ativo);

CREATE INDEX IF NOT EXISTS idx_produtos_empresa_loja_ativo
  ON produtos (empresa_id, loja_online, ativo);
