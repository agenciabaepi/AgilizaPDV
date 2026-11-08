-- =============================================================================
-- Agiliza PDV — Contas a pagar (categorias de despesa, fixas e lançamentos)
--
-- Execute no Supabase SQL Editor (ou psql) DEPOIS da base espelho (empresas, caixas).
-- Categorias financeiras são INDEPENDENTES de categorias de produto.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.categorias_despesa (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  sistema INTEGER NOT NULL DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categorias_despesa_empresa_nome
  ON public.categorias_despesa (empresa_id, lower(nome));
CREATE INDEX IF NOT EXISTS idx_categorias_despesa_empresa_ativo
  ON public.categorias_despesa (empresa_id, ativo);

CREATE TABLE IF NOT EXISTS public.contas_pagar_fixas (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  categoria_id TEXT REFERENCES public.categorias_despesa(id) ON DELETE SET NULL,
  fornecedor_id TEXT,
  descricao TEXT NOT NULL,
  valor_padrao NUMERIC(15, 4) NOT NULL DEFAULT 0,
  dia_vencimento INTEGER NOT NULL DEFAULT 10
    CHECK (dia_vencimento >= 1 AND dia_vencimento <= 28),
  ativa INTEGER NOT NULL DEFAULT 1,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_fixas_empresa
  ON public.contas_pagar_fixas (empresa_id, ativa);

CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  categoria_id TEXT REFERENCES public.categorias_despesa(id) ON DELETE SET NULL,
  conta_fixa_id TEXT REFERENCES public.contas_pagar_fixas(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(15, 4) NOT NULL,
  vencimento DATE NOT NULL,
  competencia TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'AVULSA'
    CHECK (tipo IN ('FIXA', 'AVULSA')),
  status TEXT NOT NULL DEFAULT 'PENDENTE'
    CHECK (status IN ('PENDENTE', 'PAGA', 'CANCELADA')),
  pago_em TIMESTAMPTZ,
  forma_pagamento TEXT,
  pagamento_caixa_id TEXT REFERENCES public.caixas(id) ON DELETE SET NULL,
  caixa_movimento_id TEXT,
  usuario_pagamento_id TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_status
  ON public.contas_pagar (empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_vencimento
  ON public.contas_pagar (empresa_id, vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_competencia
  ON public.contas_pagar (empresa_id, competencia);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contas_pagar_fixa_competencia
  ON public.contas_pagar (conta_fixa_id, competencia)
  WHERE conta_fixa_id IS NOT NULL AND status <> 'CANCELADA';

ALTER TABLE public.categorias_despesa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_pagar_fixas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all mirror categorias_despesa" ON public.categorias_despesa;
CREATE POLICY "Allow anon all mirror categorias_despesa" ON public.categorias_despesa
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all mirror contas_pagar_fixas" ON public.contas_pagar_fixas;
CREATE POLICY "Allow anon all mirror contas_pagar_fixas" ON public.contas_pagar_fixas
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all mirror contas_pagar" ON public.contas_pagar;
CREATE POLICY "Allow anon all mirror contas_pagar" ON public.contas_pagar
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated all mirror categorias_despesa" ON public.categorias_despesa;
CREATE POLICY "Allow authenticated all mirror categorias_despesa" ON public.categorias_despesa
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated all mirror contas_pagar_fixas" ON public.contas_pagar_fixas;
CREATE POLICY "Allow authenticated all mirror contas_pagar_fixas" ON public.contas_pagar_fixas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated all mirror contas_pagar" ON public.contas_pagar;
CREATE POLICY "Allow authenticated all mirror contas_pagar" ON public.contas_pagar
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.categorias_despesa IS 'Categorias financeiras de despesa (separadas de categorias de produto).';
COMMENT ON TABLE public.contas_pagar_fixas IS 'Templates de contas fixas/recorrentes que geram títulos por competência.';
COMMENT ON TABLE public.contas_pagar IS 'Títulos/lançamentos a pagar (avulsos ou gerados de fixas).';
