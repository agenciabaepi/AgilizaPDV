-- Relógio de sincronização bidirecional: identifica qual banco está mais atualizado
-- Execute no Supabase após supabase-mirror-tables.sql

CREATE TABLE IF NOT EXISTS pdv_sync_clock (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_update TIMESTAMPTZ DEFAULT now()
);

INSERT INTO pdv_sync_clock (id, last_update) VALUES (1, now())
ON CONFLICT (id) DO NOTHING;

ALTER TABLE pdv_sync_clock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read and update sync_clock" ON pdv_sync_clock;
CREATE POLICY "Allow anon read and update sync_clock" ON pdv_sync_clock
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- =============================================================================
-- Trigger: qualquer alteração nas tabelas espelho atualiza o relógio
-- Assim, edições manuais no painel web (ou por API) são detectadas pelo app.
-- =============================================================================
CREATE OR REPLACE FUNCTION pdv_touch_sync_clock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE pdv_sync_clock SET last_update = now() WHERE id = 1;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'empresas','usuarios','categorias','produtos','clientes','fornecedores',
    'estoque_movimentos','caixas','caixa_movimentos','vendas','venda_itens','pagamentos'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS pdv_sync_clock_touch ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER pdv_sync_clock_touch AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION pdv_touch_sync_clock()',
      t
    );
  END LOOP;
END $$;

-- Habilitar Realtime para o app receber alterações em tempo real
-- (Se der erro "already member of publication", a tabela já está habilitada — pode ignorar.)
ALTER PUBLICATION supabase_realtime ADD TABLE pdv_sync_clock;
