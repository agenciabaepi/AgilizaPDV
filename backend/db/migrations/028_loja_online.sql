-- Loja online: catálogo público por subdomínio (slug)

ALTER TABLE empresas_config ADD COLUMN loja_online_ativa INTEGER NOT NULL DEFAULT 0;
ALTER TABLE empresas_config ADD COLUMN loja_online_slug TEXT;
ALTER TABLE empresas_config ADD COLUMN loja_online_titulo TEXT;
ALTER TABLE empresas_config ADD COLUMN loja_online_descricao TEXT;
ALTER TABLE empresas_config ADD COLUMN loja_online_whatsapp TEXT;
ALTER TABLE empresas_config ADD COLUMN loja_online_mostrar_preco INTEGER NOT NULL DEFAULT 1;
ALTER TABLE empresas_config ADD COLUMN loja_online_ocultar_sem_estoque INTEGER NOT NULL DEFAULT 0;
ALTER TABLE empresas_config ADD COLUMN loja_online_banner TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_config_loja_online_slug
  ON empresas_config(loja_online_slug)
  WHERE loja_online_slug IS NOT NULL AND TRIM(loja_online_slug) <> '';
