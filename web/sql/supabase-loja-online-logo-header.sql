-- Logo exclusivo do cabeçalho da loja online (independente do logo do sistema)
ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_logo_header TEXT;

COMMENT ON COLUMN public.empresas_config.loja_online_logo_header IS
  'Logo do cabeçalho da loja online (data URL). Se vazio, usa o logo do sistema.';
