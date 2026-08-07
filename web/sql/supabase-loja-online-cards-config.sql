-- Configuração visual dos cards da vitrine (templates, cores) — JSON extensível

ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_cards_config_json TEXT;

COMMENT ON COLUMN public.empresas_config.loja_online_cards_config_json IS 'JSON: templates e cores dos cards de produto/categoria na loja online (v1+)';
