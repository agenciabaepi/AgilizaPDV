-- Execute se já rodou supabase-loja-online-pagamentos.sql antes desta atualização
ALTER TABLE empresas_config ADD COLUMN IF NOT EXISTS loja_online_mp_pronto INTEGER NOT NULL DEFAULT 0;
ALTER TABLE empresas_config ADD COLUMN IF NOT EXISTS loja_online_asaas_pronto INTEGER NOT NULL DEFAULT 0;

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
