-- =============================================================================
-- TESTE — Expirar trial e forçar bloqueio do sistema
--
-- Execute no Supabase > SQL Editor para simular assinatura vencida.
-- Reverter: veja supabase-assinaturas-reativar-trial-teste.sql
-- =============================================================================

UPDATE empresa_assinaturas
SET
  trial_fim = now() - interval '1 day',
  periodo_fim = NULL,
  status = 'pending_payment',
  updated_at = now()
WHERE status IN ('trial', 'active');
