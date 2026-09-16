-- Variações de produto (SKU filho com estoque próprio)
ALTER TABLE produtos ADD COLUMN produto_pai_id TEXT REFERENCES produtos(id);
ALTER TABLE produtos ADD COLUMN variacao_eixos_json TEXT;
ALTER TABLE produtos ADD COLUMN variacao_valores_json TEXT;
ALTER TABLE produtos ADD COLUMN variacao_chave TEXT;
CREATE INDEX IF NOT EXISTS idx_produtos_pai ON produtos(produto_pai_id);
CREATE INDEX IF NOT EXISTS idx_produtos_variacao_chave ON produtos(empresa_id, produto_pai_id, variacao_chave);
