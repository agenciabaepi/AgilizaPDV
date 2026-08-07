-- Emissão automática de cupom fiscal (NFC-e) após finalizar venda no PDV

ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS cupom_fiscal_auto_emitir INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS cupom_fiscal_auto_formas_json TEXT;

COMMENT ON COLUMN public.empresas_config.cupom_fiscal_auto_emitir IS '1 = emite NFC-e automaticamente no PDV após finalizar venda (quando as formas de pagamento correspondem).';
COMMENT ON COLUMN public.empresas_config.cupom_fiscal_auto_formas_json IS 'JSON: {"todas":true} ou {"formas":["PIX","DINHEIRO",...]}';
