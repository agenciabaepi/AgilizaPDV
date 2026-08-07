-- =============================================================================
-- Agiliza PDV — Assinaturas SaaS (Asaas + PIX mensal)
--
-- Onde executar: Supabase > SQL Editor > New query > colar e Run
-- Pré-requisito: tabela `empresas` já existir (supabase-mirror-tables.sql)
-- =============================================================================

CREATE TABLE IF NOT EXISTS empresa_assinaturas (
  empresa_id TEXT PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'trial'
    CHECK (status IN ('trial', 'active', 'pending_payment', 'expired', 'cancelled')),
  plano TEXT NOT NULL DEFAULT 'basic'
    CHECK (plano IN ('basic', 'pro', 'ultra')),
  valor_mensal REAL NOT NULL DEFAULT 89.90,
  asaas_customer_id TEXT,
  asaas_subscription_id TEXT,
  asaas_payment_id TEXT,
  periodo_inicio TIMESTAMPTZ,
  periodo_fim TIMESTAMPTZ,
  trial_fim TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_empresa_assinaturas_status ON empresa_assinaturas(status);
CREATE INDEX IF NOT EXISTS idx_empresa_assinaturas_asaas_customer ON empresa_assinaturas(asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_empresa_assinaturas_asaas_payment ON empresa_assinaturas(asaas_payment_id);

CREATE TABLE IF NOT EXISTS assinatura_pagamentos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  asaas_payment_id TEXT NOT NULL,
  valor REAL NOT NULL,
  status TEXT NOT NULL,
  pago_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assinatura_pagamentos_empresa ON assinatura_pagamentos(empresa_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assinatura_pagamentos_asaas ON assinatura_pagamentos(asaas_payment_id);

ALTER TABLE empresa_assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE assinatura_pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empresa_assinaturas_anon_all" ON empresa_assinaturas;
CREATE POLICY "empresa_assinaturas_anon_all" ON empresa_assinaturas
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "assinatura_pagamentos_anon_all" ON assinatura_pagamentos;
CREATE POLICY "assinatura_pagamentos_anon_all" ON assinatura_pagamentos
  FOR ALL USING (true) WITH CHECK (true);
