-- Cores do cabeçalho da loja e do header do menu lateral
ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_cor_header TEXT;

ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_cor_menu TEXT;

COMMENT ON COLUMN public.empresas_config.loja_online_cor_header IS
  'Cor de fundo do cabeçalho da loja online (#RRGGBB)';

COMMENT ON COLUMN public.empresas_config.loja_online_cor_menu IS
  'Cor de fundo do header do menu lateral mobile (#RRGGBB)';
