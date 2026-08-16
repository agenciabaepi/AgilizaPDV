-- Faixa de avisos acima do header da loja online (cupons, promoções, etc.)
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_faixa_ativa INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_faixa_avisos_json TEXT;

COMMENT ON COLUMN public.empresas_config.loja_online_faixa_ativa IS '1 = exibe faixa de avisos rotativos no topo da loja';
COMMENT ON COLUMN public.empresas_config.loja_online_faixa_avisos_json IS 'JSON: array legado [{ id, texto, link?, ordem? }] ou { avisos, efeito, sentido, velocidade, cor }';
