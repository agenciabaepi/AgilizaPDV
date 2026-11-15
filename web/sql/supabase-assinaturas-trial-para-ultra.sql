-- =============================================================================
-- Migrar trials ativos do Basic (ou outro plano) para Ultra
-- =============================================================================
-- O teste gratuito de 7 dias libera o plano Ultra completo.
-- Rode no SQL Editor do Supabase se precisar reaplicar.

UPDATE empresa_assinaturas
SET
  plano = 'ultra',
  valor_mensal = 249.90,
  updated_at = now()
WHERE status = 'trial'
  AND plano IS DISTINCT FROM 'ultra';
