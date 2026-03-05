-- Execute no SQL Editor do Supabase para receber eventos do PDV

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
