-- =============================================================================
-- TESTE — Reativar trial (desfazer expirar-trial-teste.sql)
-- =============================================================================

UPDATE empresa_assinaturas
SET
  status = 'trial',
  trial_fim = now() + interval '7 days',
  periodo_fim = NULL,
  asaas_payment_id = NULL,
  updated_at = now()
WHERE status IN ('pending_payment', 'expired');
