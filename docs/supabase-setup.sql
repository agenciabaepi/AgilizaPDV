-- =============================================================================
-- Agiliza PDV – Setup Supabase (sync + backup em nuvem)
-- Execute este script no SQL Editor do seu projeto: https://supabase.com/dashboard
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela de eventos de sincronização (sync)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pdv_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pdv_sync_events_created ON pdv_sync_events(created_at);

-- RLS: permitir que o app (anon) insira eventos
ALTER TABLE pdv_sync_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon insert sync events" ON pdv_sync_events;
CREATE POLICY "Allow anon insert sync events"
ON pdv_sync_events FOR INSERT
TO anon
WITH CHECK (true);

-- Opcional: permitir leitura (ex.: para relatórios ou outro app)
-- DROP POLICY IF EXISTS "Allow anon select sync events" ON pdv_sync_events;
-- CREATE POLICY "Allow anon select sync events"
-- ON pdv_sync_events FOR SELECT TO anon USING (true);


-- -----------------------------------------------------------------------------
-- 2. Bucket de backup do banco (Storage)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'pdv-backups',
  'pdv-backups',
  false,
  52428800
)
ON CONFLICT (id) DO NOTHING;
-- file_size_limit = 50MB (ajuste se precisar de backups maiores)


-- -----------------------------------------------------------------------------
-- 3. Políticas do Storage (anon pode enviar e baixar o backup)
-- -----------------------------------------------------------------------------
-- Upload: anon pode enviar arquivos para o bucket pdv-backups
DROP POLICY IF EXISTS "Allow upload backup" ON storage.objects;
CREATE POLICY "Allow upload backup"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'pdv-backups');

-- Download: anon pode baixar do bucket pdv-backups
DROP POLICY IF EXISTS "Allow download backup" ON storage.objects;
CREATE POLICY "Allow download backup"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'pdv-backups');
