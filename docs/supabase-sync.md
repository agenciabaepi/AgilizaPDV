# Sincronização com Supabase

O PDV grava tudo primeiro no SQLite (offline first). Opcionalmente, eventos são enviados ao Supabase para backup/replicação.

Para **backup completo do banco** (arquivo .db) na nuvem e restauração em outra máquina, veja [supabase-backup-storage.md](./supabase-backup-storage.md).

Para **tabelas espelho** (mesma estrutura do SQLite) no Supabase e uso no painel web, execute também **[supabase-mirror-tables.sql](./supabase-mirror-tables.sql)**. O sync envia os dados para essas tabelas (empresas, produtos, vendas, venda_itens, pagamentos).

## Configuração

1. **Variáveis de ambiente** (no processo Electron):
   - `SUPABASE_URL`: URL do projeto (ex: `https://xxxx.supabase.co`)
   - `SUPABASE_ANON_KEY`: chave anônima do projeto

   No desenvolvimento, crie um arquivo `.env` na raiz do projeto (ou defina no sistema). O Electron carrega via `dotenv` automaticamente.

2. **Supabase: tabela + Storage (recomendado)**

   Execute **um único script** no SQL Editor do Supabase para criar a tabela de sync, RLS e o bucket de backup com políticas:

   **[docs/supabase-setup.sql](./supabase-setup.sql)**

   Ou, se quiser só a tabela de sync, execute manualmente:

```sql
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
```

3. **Políticas (RLS)**  
   O script [supabase-setup.sql](./supabase-setup.sql) já habilita RLS em `pdv_sync_events` e cria a política de INSERT para `anon`. Se configurar a tabela manualmente, crie uma política que permita insert para o role anon.

## Fluxo

- Ao criar/atualizar **empresas**, **produtos** e **vendas** (incluindo cancelamento), um registro é inserido em `sync_outbox` (SQLite) com status PENDING.
- O botão **Sincronizar agora** no Dashboard (ou chamada a `sync:run`) busca os pendentes, envia cada um para a tabela `pdv_sync_events` no Supabase e marca como SENT ou ERROR no outbox.

## Tabela `pdv_sync_events`

| Coluna       | Tipo        | Descrição                          |
|-------------|-------------|------------------------------------|
| id          | UUID        | Chave primária (gerada no Supabase)|
| source_id   | TEXT        | ID do registro no outbox local     |
| entity      | TEXT        | Ex: empresas, produtos, vendas      |
| entity_id   | TEXT        | ID da entidade                     |
| operation   | TEXT        | CREATE, UPDATE, CANCEL             |
| payload_json| JSONB       | Conteúdo do evento                  |
| created_at  | TIMESTAMPTZ | Data do evento                     |
