-- =============================================================================
-- Agiliza PDV — Loja online (colunas em empresas_config no Supabase)
-- Execute após docs/supabase-empresas-config.sql
-- Mantido alinhado a sync/empresas-config-mirror.ts
-- =============================================================================

ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_ativa INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_slug TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_titulo TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_descricao TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_whatsapp TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_mostrar_preco INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_ocultar_sem_estoque INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_banner TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_config_loja_online_slug
  ON public.empresas_config(loja_online_slug)
  WHERE loja_online_slug IS NOT NULL AND TRIM(loja_online_slug) <> '';
