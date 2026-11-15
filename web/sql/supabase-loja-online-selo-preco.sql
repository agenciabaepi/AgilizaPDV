-- Selo de preço na vitrine/PDP: desconto no PIX ou cashback (tipo + %)
-- Tipo global da loja; % padrão da loja; % opcional por produto

ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_selo_preco_tipo TEXT NOT NULL DEFAULT 'pix';

ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_selo_preco_pct REAL NOT NULL DEFAULT 5;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'empresas_config_loja_online_selo_preco_tipo_check'
  ) THEN
    ALTER TABLE public.empresas_config
      ADD CONSTRAINT empresas_config_loja_online_selo_preco_tipo_check
      CHECK (loja_online_selo_preco_tipo IN ('pix', 'cashback'));
  END IF;
END $$;

COMMENT ON COLUMN public.empresas_config.loja_online_selo_preco_tipo IS
  'Selo ao lado do preço: pix = X% Off no PIX; cashback = X% de cashback';

COMMENT ON COLUMN public.empresas_config.loja_online_selo_preco_pct IS
  'Percentual padrão do selo de preço na vitrine/PDP (produto pode sobrescrever)';

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS loja_online_selo_preco_pct REAL;

COMMENT ON COLUMN public.produtos.loja_online_selo_preco_pct IS
  'Percentual do selo de preço neste produto; NULL = usa o padrão da loja';
