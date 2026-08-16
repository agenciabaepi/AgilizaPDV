-- Banner e cronômetro de gatilho mental no checkout da loja online
ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_checkout_oferta_json TEXT;

COMMENT ON COLUMN public.empresas_config.loja_online_checkout_oferta_json IS
  'JSON: banner, faixa e cronômetro de urgência no checkout';
