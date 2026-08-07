-- =============================================================================
-- Agiliza PDV — Planos Basic / Pro / Ultra
-- Execute após supabase-assinaturas.sql
-- =============================================================================

ALTER TABLE empresa_assinaturas DROP CONSTRAINT IF EXISTS empresa_assinaturas_plano_check;

UPDATE empresa_assinaturas
SET plano = CASE
  WHEN valor_mensal >= 240 THEN 'ultra'
  WHEN valor_mensal >= 150 THEN 'pro'
  ELSE 'basic'
END
WHERE plano IS NULL OR plano = 'mensal' OR plano NOT IN ('basic', 'pro', 'ultra');

UPDATE empresa_assinaturas
SET valor_mensal = CASE plano
  WHEN 'ultra' THEN 249.90
  WHEN 'pro' THEN 189.90
  ELSE 89.90
END;

ALTER TABLE empresa_assinaturas
  ADD CONSTRAINT empresa_assinaturas_plano_check
  CHECK (plano IN ('basic', 'pro', 'ultra'));

ALTER TABLE empresa_assinaturas ALTER COLUMN plano SET DEFAULT 'basic';
ALTER TABLE empresa_assinaturas ALTER COLUMN valor_mensal SET DEFAULT 89.90;
