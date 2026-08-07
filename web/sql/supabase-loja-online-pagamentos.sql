-- Pagamentos na loja online (Asaas + Mercado Pago por lojista)

ALTER TABLE empresas_config ADD COLUMN IF NOT EXISTS loja_online_pag_manual INTEGER NOT NULL DEFAULT 1;
ALTER TABLE empresas_config ADD COLUMN IF NOT EXISTS loja_online_pag_asaas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE empresas_config ADD COLUMN IF NOT EXISTS loja_online_asaas_api_key TEXT;
ALTER TABLE empresas_config ADD COLUMN IF NOT EXISTS loja_online_asaas_sandbox INTEGER NOT NULL DEFAULT 0;
ALTER TABLE empresas_config ADD COLUMN IF NOT EXISTS loja_online_pag_mercadopago INTEGER NOT NULL DEFAULT 0;
ALTER TABLE empresas_config ADD COLUMN IF NOT EXISTS loja_online_mercadopago_public_key TEXT;
ALTER TABLE empresas_config ADD COLUMN IF NOT EXISTS loja_online_mercadopago_access_token TEXT;
ALTER TABLE empresas_config ADD COLUMN IF NOT EXISTS loja_online_mp_pronto INTEGER NOT NULL DEFAULT 0;
ALTER TABLE empresas_config ADD COLUMN IF NOT EXISTS loja_online_asaas_pronto INTEGER NOT NULL DEFAULT 0;

-- Marca lojas que já tinham credencial salva antes das colunas *_pronto
UPDATE empresas_config
SET loja_online_mp_pronto = 1
WHERE loja_online_pag_mercadopago = 1
  AND loja_online_mercadopago_access_token IS NOT NULL
  AND TRIM(loja_online_mercadopago_access_token) <> '';

UPDATE empresas_config
SET loja_online_asaas_pronto = 1
WHERE loja_online_pag_asaas = 1
  AND loja_online_asaas_api_key IS NOT NULL
  AND TRIM(loja_online_asaas_api_key) <> '';

ALTER TABLE loja_online_pedidos ADD COLUMN IF NOT EXISTS forma_pagamento TEXT
  DEFAULT 'manual' CHECK (forma_pagamento IN ('manual', 'asaas_pix', 'mercadopago'));
ALTER TABLE loja_online_pedidos ADD COLUMN IF NOT EXISTS pagamento_status TEXT
  NOT NULL DEFAULT 'pendente' CHECK (pagamento_status IN ('pendente', 'pago', 'cancelado', 'na_entrega'));
ALTER TABLE loja_online_pedidos ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT;
ALTER TABLE loja_online_pedidos ADD COLUMN IF NOT EXISTS gateway_checkout_url TEXT;

CREATE INDEX IF NOT EXISTS idx_loja_pedidos_pagamento
  ON loja_online_pedidos(empresa_id, pagamento_status, created_at DESC);
