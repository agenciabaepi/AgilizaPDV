-- Relógio para sincronização bidirecional: identifica qual banco (local ou Supabase) está mais atualizado
CREATE TABLE IF NOT EXISTS sync_clock (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_local_update TEXT DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO sync_clock (id, last_local_update) VALUES (1, datetime('now'));
