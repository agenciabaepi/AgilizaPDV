-- Frete especial dentro da cidade (grátis ou valor fixo)
ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_frete_cidade_ativo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_frete_cidade_modo TEXT NOT NULL DEFAULT 'gratis';
ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_frete_cidade_valor REAL NOT NULL DEFAULT 0;
ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_frete_cidade_nome TEXT;

COMMENT ON COLUMN public.empresas_config.loja_online_frete_cidade_ativo IS
  '1 = ativa frete especial quando o CEP do cliente é da mesma cidade da loja';
COMMENT ON COLUMN public.empresas_config.loja_online_frete_cidade_modo IS
  'gratis | fixo — regra aplicada só dentro da cidade';
COMMENT ON COLUMN public.empresas_config.loja_online_frete_cidade_valor IS
  'Valor (R$) do frete na cidade quando o modo é fixo';
COMMENT ON COLUMN public.empresas_config.loja_online_frete_cidade_nome IS
  'Nome da cidade (opcional). Se vazio, usa a cidade do CEP de origem ou a do pagamento na entrega';
