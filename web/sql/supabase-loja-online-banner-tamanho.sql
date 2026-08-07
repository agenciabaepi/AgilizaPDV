-- Tamanho do banner da vitrine: pequeno | medio | grande
ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_banner_tamanho TEXT DEFAULT 'medio';
