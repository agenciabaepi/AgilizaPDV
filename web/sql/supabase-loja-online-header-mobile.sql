-- Layout do cabeçalho da loja online no celular (classic | center | inverted)
ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_header_mobile TEXT;

COMMENT ON COLUMN public.empresas_config.loja_online_header_mobile IS
  'Template do header mobile: classic, center ou inverted';
