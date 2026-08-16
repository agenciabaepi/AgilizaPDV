-- Altura do logo do cabeçalho da loja online no celular (px)
ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_logo_header_size INTEGER;

COMMENT ON COLUMN public.empresas_config.loja_online_logo_header_size IS
  'Altura do logo no header mobile, em pixels (24–72). Padrão 36.';
