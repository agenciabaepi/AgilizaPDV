# Sincronização com Supabase

O PDV grava tudo primeiro no SQLite (offline first). Opcionalmente, eventos são enviados ao Supabase para backup/replicação.

Para **backup completo do banco** (arquivo .db) na nuvem e restauração em outra máquina, veja [supabase-backup-storage.md](./supabase-backup-storage.md).

Para **tabelas espelho** (mesma estrutura do SQLite) no Supabase e uso no painel web, execute **[supabase-mirror-tables.sql](./supabase-mirror-tables.sql)** e, para sincronização bidirecional (comparar qual banco está mais atualizado), **[supabase-sync-clock.sql](./supabase-sync-clock.sql)**. O sync envia os dados para essas tabelas (empresas, categorias, produtos, vendas, venda_itens, pagamentos, etc.).

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

- Ao criar/atualizar **empresas**, **categorias**, **produtos** e **vendas** (incluindo cancelamento), um registro é inserido em `sync_outbox` (SQLite) com status PENDING e o relógio local (`sync_clock`) é atualizado.
- O botão **Sincronizar agora** (ou chamada a `sync:run`) executa **sincronização bidirecional**:
  - Compara o relógio local (`sync_clock.last_local_update`) com o remoto (`pdv_sync_clock.last_update`).
  - Se o **Supabase** estiver mais atualizado → faz **pull**: copia todas as tabelas espelho do Supabase para o SQLite e atualiza o relógio local.
  - Se o **local** estiver mais atualizado (ou houver eventos pendentes) → faz **push**: envia os pendentes para as tabelas espelho e para `pdv_sync_events`, e atualiza o relógio remoto.
- O sync automático (após cada alteração) continua fazendo apenas **push** dos eventos pendentes.
- **Tempo real (web → app):** o app escuta alterações no relógio remoto (Realtime) e ainda faz **polling a cada 30s**. Para alterações manuais no painel web (Table Editor) aparecerem no app, é obrigatório ter executado o **[supabase-sync-clock.sql](supabase-sync-clock.sql)** completo (tabela + **trigger** em todas as tabelas espelho + Realtime). Sem o trigger, editar `produtos` (ou outras tabelas) no Supabase não atualiza o relógio e o app não detecta a mudança.

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
