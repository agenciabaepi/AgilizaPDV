-- =============================================================================
-- Agiliza PDV – Backup automático por empresa (Storage + registro)
-- Execute no Supabase após supabase-setup.sql (bucket pdv-backups já existe)
-- =============================================================================

-- Tabela de registro dos backups (empresa, data, tamanho, status)
CREATE TABLE IF NOT EXISTS pdv_backup_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  backup_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  file_size_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','error','uploading'))
);

CREATE INDEX IF NOT EXISTS idx_pdv_backup_registry_empresa ON pdv_backup_registry(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pdv_backup_registry_date ON pdv_backup_registry(backup_date DESC);

ALTER TABLE pdv_backup_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon insert backup registry" ON pdv_backup_registry;
CREATE POLICY "Allow anon insert backup registry" ON pdv_backup_registry FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon select backup registry" ON pdv_backup_registry;
CREATE POLICY "Allow anon select backup registry" ON pdv_backup_registry FOR SELECT TO anon USING (true);

-- Storage: permitir upload em backups/empresa_id/* (estrutura por empresa)
-- O bucket pdv-backups já existe; políticas atuais podem ser genéricas.
-- Se precisar restringir por path, use WITH CHECK (bucket_id = 'pdv-backups' AND (name LIKE 'backups/%'));
