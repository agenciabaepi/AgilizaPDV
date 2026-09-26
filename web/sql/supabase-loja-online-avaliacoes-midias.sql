-- Avaliações com fotos/vídeos da compra (estilo Shopee / Mercado Livre).
-- Execute no SQL Editor do Supabase.

ALTER TABLE public.loja_online_avaliacoes
  ADD COLUMN IF NOT EXISTS midias_json TEXT;

ALTER TABLE public.loja_online_avaliacoes
  ADD COLUMN IF NOT EXISTS pedido_id TEXT;

-- Uma avaliação por cliente + produto (quem já avaliou não avalia de novo).
CREATE UNIQUE INDEX IF NOT EXISTS idx_loja_online_avaliacoes_cliente_produto
  ON public.loja_online_avaliacoes (empresa_id, produto_id, cliente_id)
  WHERE cliente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loja_online_avaliacoes_pedido
  ON public.loja_online_avaliacoes (pedido_id)
  WHERE pedido_id IS NOT NULL;
