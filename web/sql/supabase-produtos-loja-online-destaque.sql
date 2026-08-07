-- Produtos em destaque na vitrine da loja online (carrossel abaixo do banner)
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS loja_online_destaque INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS loja_online_destaque_ordem INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.produtos.loja_online_destaque IS '1 = exibir no carrossel de destaques da loja online';
COMMENT ON COLUMN public.produtos.loja_online_destaque_ordem IS 'Ordem no carrossel (menor = primeiro)';
