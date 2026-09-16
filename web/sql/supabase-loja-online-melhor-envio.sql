-- =============================================================================
-- Agiliza PDV — Loja online: token Melhor Envio (cotação PAC/SEDEX)
-- Execute após supabase-loja-online-frete-cupom-cashback.sql
--
-- O access_token (e, no OAuth, também o refresh_token em JSON) fica em
-- loja_online_melhor_envio_token. Client ID/Secret ficam só no servidor (.env).
-- =============================================================================

ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_melhor_envio_token TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_melhor_envio_sandbox INTEGER NOT NULL DEFAULT 0;
