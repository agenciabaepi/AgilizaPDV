-- Variações de produto (SKU filho com estoque próprio).
-- Ex.: capa de celular → Marca + Modelo + Cor, cada combinação com saldo.

ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS produto_pai_id TEXT;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS variacao_eixos_json TEXT;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS variacao_valores_json TEXT;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS variacao_chave TEXT;

CREATE INDEX IF NOT EXISTS idx_produtos_pai
  ON public.produtos (produto_pai_id)
  WHERE produto_pai_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_produtos_variacao_chave
  ON public.produtos (empresa_id, produto_pai_id, variacao_chave)
  WHERE produto_pai_id IS NOT NULL;
