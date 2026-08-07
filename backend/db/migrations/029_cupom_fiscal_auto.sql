-- Emissão automática de cupom fiscal (NFC-e) no PDV
ALTER TABLE empresas_config ADD COLUMN cupom_fiscal_auto_emitir INTEGER NOT NULL DEFAULT 0;
ALTER TABLE empresas_config ADD COLUMN cupom_fiscal_auto_formas_json TEXT;
