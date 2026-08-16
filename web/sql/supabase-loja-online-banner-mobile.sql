-- Tamanho do banner da vitrine no celular: pequeno | medio | grande
ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_banner_tamanho_mobile TEXT DEFAULT 'medio';

COMMENT ON COLUMN public.empresas_config.loja_online_banner_tamanho_mobile IS
  'Tamanho do banner no celular: pequeno, medio ou grande (proporções distintas do desktop)';
