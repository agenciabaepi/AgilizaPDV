-- Vendas originadas na loja online + vínculo com pedidos

ALTER TABLE vendas
  ADD COLUMN IF NOT EXISTS venda_online INTEGER NOT NULL DEFAULT 0;

ALTER TABLE loja_online_pedidos
  ADD COLUMN IF NOT EXISTS venda_id TEXT;

COMMENT ON COLUMN vendas.venda_online IS '1 = venda finalizada pela loja online';
COMMENT ON COLUMN loja_online_pedidos.venda_id IS 'Venda gerada no PDV quando o pedido é confirmado/entregue';

CREATE INDEX IF NOT EXISTS idx_vendas_venda_online
  ON vendas(empresa_id, created_at DESC)
  WHERE venda_online = 1;

CREATE INDEX IF NOT EXISTS idx_loja_online_pedidos_venda
  ON loja_online_pedidos(venda_id)
  WHERE venda_id IS NOT NULL;

-- Forma de pagamento para vendas originadas na loja online
ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS pagamentos_forma_check;
ALTER TABLE pagamentos ADD CONSTRAINT pagamentos_forma_check CHECK (
  forma IN ('DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'OUTROS', 'CASHBACK', 'A_PRAZO', 'LOJA_ONLINE')
);
