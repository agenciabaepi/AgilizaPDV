-- Habilita Supabase Realtime na tabela de pedidos online (confirmação instantânea de PIX/cartão).
ALTER TABLE loja_online_pedidos REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE loja_online_pedidos;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
