-- Assinaturas SaaS (espelho Supabase — controle no painel web)
CREATE TABLE IF NOT EXISTS empresa_assinaturas (
  empresa_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'trial',
  plano TEXT NOT NULL DEFAULT 'mensal',
  valor_mensal REAL NOT NULL DEFAULT 99.90,
  asaas_customer_id TEXT,
  asaas_subscription_id TEXT,
  asaas_payment_id TEXT,
  periodo_inicio TEXT,
  periodo_fim TEXT,
  trial_fim TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS assinatura_pagamentos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL,
  asaas_payment_id TEXT NOT NULL,
  valor REAL NOT NULL,
  status TEXT NOT NULL,
  pago_em TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_empresa_assinaturas_status ON empresa_assinaturas(status);
CREATE INDEX IF NOT EXISTS idx_assinatura_pagamentos_empresa ON assinatura_pagamentos(empresa_id);
