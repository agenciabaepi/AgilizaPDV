-- Meio de pagamento fiscal da venda (PIX, CREDITO, DEBITO, etc.) — preenchido ao confirmar gateway
ALTER TABLE loja_online_pedidos ADD COLUMN IF NOT EXISTS pagamento_meio TEXT
  CHECK (pagamento_meio IS NULL OR pagamento_meio IN ('PIX', 'CREDITO', 'DEBITO', 'DINHEIRO', 'OUTROS'));
