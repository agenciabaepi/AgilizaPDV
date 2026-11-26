-- Metas de vendas da loja (exibidas no Dashboard)
-- meta_vendas_mensal: valor (R$) que a loja quer vender no mês
-- meta_vendas_diaria: valor (R$) que a loja quer vender por dia
-- NULL = sem meta definida

ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS meta_vendas_mensal NUMERIC(12, 2);

ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS meta_vendas_diaria NUMERIC(12, 2);

COMMENT ON COLUMN public.empresas_config.meta_vendas_mensal IS
  'Meta de vendas do mês em R$ (vendas concluídas). NULL = sem meta.';

COMMENT ON COLUMN public.empresas_config.meta_vendas_diaria IS
  'Meta de vendas do dia em R$ (vendas concluídas). NULL = sem meta.';
