-- Configurações de Notas Fiscais (NF-e e NFC-e) por empresa
-- Ambiente: 1 = Produção, 0 = Homologação

ALTER TABLE empresas_config ADD COLUMN ambiente_fiscal INTEGER DEFAULT 1;
ALTER TABLE empresas_config ADD COLUMN serie_nfe INTEGER DEFAULT 1;
ALTER TABLE empresas_config ADD COLUMN ultimo_numero_nfe INTEGER DEFAULT 0;
ALTER TABLE empresas_config ADD COLUMN serie_nfce INTEGER DEFAULT 1;
ALTER TABLE empresas_config ADD COLUMN ultimo_numero_nfce INTEGER DEFAULT 0;
ALTER TABLE empresas_config ADD COLUMN csc_nfce TEXT;
ALTER TABLE empresas_config ADD COLUMN csc_id_nfce TEXT;
ALTER TABLE empresas_config ADD COLUMN indicar_fonte_ibpt INTEGER DEFAULT 1;
ALTER TABLE empresas_config ADD COLUMN xml_autorizados_json TEXT;
