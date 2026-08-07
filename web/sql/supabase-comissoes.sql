-- Comissão de vendedores: percentual por usuário, meta mensal e padrão da empresa

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS comissao_percentual REAL;

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS meta_vendas_mes REAL;

ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS comissao_percentual_padrao REAL DEFAULT 0;

COMMENT ON COLUMN public.usuarios.comissao_percentual IS 'Percentual de comissão sobre vendas concluídas (PDV). NULL usa o padrão da empresa.';
COMMENT ON COLUMN public.usuarios.meta_vendas_mes IS 'Meta de vendas mensal em R$ para acompanhamento no relatório de comissões.';
COMMENT ON COLUMN public.empresas_config.comissao_percentual_padrao IS 'Percentual de comissão padrão quando o vendedor não tem valor individual.';
