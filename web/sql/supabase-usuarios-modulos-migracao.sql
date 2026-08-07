-- =============================================================================
-- Agiliza PDV – Coluna modulos_json em usuarios (Supabase)
-- Execute no SQL Editor do Supabase em projetos que já tinham a tabela usuarios.
-- Permissões por usuário (JSON). Se NULL, usa empresas_config.modulos_json.
-- =============================================================================

ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS modulos_json TEXT;
