-- =============================================================================
-- Agiliza PDV — Loja online: token Melhor Envio (cotação PAC/SEDEX)
-- Execute após supabase-loja-online-frete-cupom-cashback.sql
-- =============================================================================

ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_melhor_envio_token TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_melhor_envio_sandbox INTEGER NOT NULL DEFAULT 0;
