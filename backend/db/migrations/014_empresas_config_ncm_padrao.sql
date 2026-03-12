-- NCM padrão (8 dígitos) para produtos sem NCM cadastrado na emissão NFC-e/NF-e
ALTER TABLE empresas_config ADD COLUMN ncm_padrao TEXT;
