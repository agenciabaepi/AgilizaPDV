-- =============================================================================
-- Agiliza PDV — Loja online: etiquetas Melhor Envio
-- Execute no SQL Editor do Supabase após supabase-loja-online-melhor-envio.sql
-- =============================================================================

ALTER TABLE public.loja_online_pedidos ADD COLUMN IF NOT EXISTS melhor_envio_cart_id TEXT;
ALTER TABLE public.loja_online_pedidos ADD COLUMN IF NOT EXISTS melhor_envio_status TEXT;
ALTER TABLE public.loja_online_pedidos ADD COLUMN IF NOT EXISTS melhor_envio_etiqueta_url TEXT;
ALTER TABLE public.loja_online_pedidos ADD COLUMN IF NOT EXISTS melhor_envio_erro TEXT;
ALTER TABLE public.loja_online_pedidos ADD COLUMN IF NOT EXISTS melhor_envio_tracking TEXT;
