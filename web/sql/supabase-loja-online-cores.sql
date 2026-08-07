-- Cor da vitrine online (independente da cor do painel PDV)
ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_cor_primaria TEXT;

ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_cor_fundo TEXT;
