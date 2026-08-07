-- =============================================================================
-- Agiliza PDV — Planos SaaS (valores e configuração exibidos no site / checkout)
--
-- Execute após supabase-assinaturas.sql (ou standalone)
-- =============================================================================

CREATE TABLE IF NOT EXISTS saas_planos (
  id TEXT PRIMARY KEY CHECK (id IN ('basic', 'pro', 'ultra')),
  nome TEXT NOT NULL,
  valor_mensal REAL NOT NULL,
  descricao TEXT,
  notas_fiscais INTEGER NOT NULL DEFAULT 0,
  loja_online INTEGER NOT NULL DEFAULT 0,
  destaque INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  recursos_json TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO saas_planos (id, nome, valor_mensal, descricao, notas_fiscais, loja_online, destaque, ativo, recursos_json, ordem)
VALUES
  (
    'basic',
    'Basic',
    89.90,
    'PDV completo para o dia a dia da loja.',
    0,
    0,
    0,
    1,
    '["Dashboard, PDV e vendas","Produtos, estoque e caixa","Clientes, fornecedores e usuários","Financeiro e cashback"]',
    1
  ),
  (
    'pro',
    'Pro',
    189.90,
    'Tudo do Basic com emissão fiscal integrada.',
    1,
    0,
    1,
    1,
    '["Tudo do plano Basic","Emissão de NFC-e e NF-e","Configuração fiscal completa"]',
    2
  ),
  (
    'ultra',
    'Ultra',
    249.90,
    'Pacote completo com loja virtual.',
    1,
    1,
    0,
    1,
    '["Tudo do plano Pro","Loja online com catálogo","Subdomínio personalizado"]',
    3
  )
ON CONFLICT (id) DO NOTHING;

ALTER TABLE saas_planos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saas_planos_anon_read" ON saas_planos;
CREATE POLICY "saas_planos_anon_read" ON saas_planos
  FOR SELECT TO anon USING (ativo = 1);

DROP POLICY IF EXISTS "saas_planos_anon_all" ON saas_planos;
CREATE POLICY "saas_planos_anon_all" ON saas_planos
  FOR ALL USING (true) WITH CHECK (true);
