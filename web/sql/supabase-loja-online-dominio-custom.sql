-- Domínio próprio da loja online: índice único (www e sem www são tratados no app).
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_dominio_custom TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_config_loja_online_dominio_custom
  ON public.empresas_config (LOWER(TRIM(loja_online_dominio_custom)))
  WHERE loja_online_dominio_custom IS NOT NULL AND TRIM(loja_online_dominio_custom) <> '';
