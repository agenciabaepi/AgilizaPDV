-- Promoção de frete grátis por valor mínimo do carrinho (barra estilo iFood)
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_frete_gratis_ativo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_frete_gratis_minimo REAL NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.empresas_config.loja_online_frete_gratis_ativo IS '1 = ativa promoção de frete grátis a partir de um valor de pedido';
COMMENT ON COLUMN public.empresas_config.loja_online_frete_gratis_minimo IS 'Valor mínimo do carrinho (R$) para ganhar frete grátis';
