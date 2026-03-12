-- UF, IE e município do emitente (obrigatórios para emissão NFC-e/NF-e)
ALTER TABLE empresas_config ADD COLUMN uf_emitente TEXT DEFAULT 'SP';
ALTER TABLE empresas_config ADD COLUMN ie_emitente TEXT DEFAULT 'ISENTO';
ALTER TABLE empresas_config ADD COLUMN c_mun_emitente INTEGER;
