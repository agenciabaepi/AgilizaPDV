-- =============================================================================
-- Agiliza PDV — Trial para empresas que já existiam antes das assinaturas
--
-- Execute DEPOIS de supabase-assinaturas.sql
-- Cria registro trial (7 dias) para empresas sem assinatura
-- =============================================================================

INSERT INTO empresa_assinaturas (
  empresa_id,
  status,
  plano,
  valor_mensal,
  periodo_inicio,
  trial_fim,
  created_at,
  updated_at
)
SELECT
  e.id,
  'trial',
  'mensal',
  99.90,
  now(),
  now() + interval '7 days',
  now(),
  now()
FROM empresas e
LEFT JOIN empresa_assinaturas a ON a.empresa_id = e.id
WHERE a.empresa_id IS NULL;
