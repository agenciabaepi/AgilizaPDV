# Sincronização com Supabase

O PDV grava tudo primeiro no SQLite (offline first). Opcionalmente, eventos são enviados ao Supabase para backup/replicação.

Para **backup completo do banco** (arquivo .db) na nuvem e restauração em outra máquina, veja [supabase-backup-storage.md](./supabase-backup-storage.md).

Para **tabelas espelho** (mesma estrutura do SQLite) no Supabase e uso no painel web, use a ordem abaixo no SQL Editor:

1. **[supabase-mirror-tables.sql](./supabase-mirror-tables.sql)** — base (`empresas`, `produtos`, `vendas`, …).
2. **[supabase-marcas-migracao.sql](./supabase-marcas-migracao.sql)** — se usar marcas nos produtos.
3. **[supabase-empresas-config.sql](./supabase-empresas-config.sql)** — configuração da loja e fiscal espelhada (pull/push alinhados ao app).
4. **[supabase-venda-a-prazo-migracao.sql](./supabase-venda-a-prazo-migracao.sql)** — se usar venda a prazo / `contas_receber`.
5. **[supabase-mirror-venda-nfce-nfe.sql](./supabase-mirror-venda-nfce-nfe.sql)** — metadados NFC-e / NF-e no espelho (listagem em qualquer terminal).
6. **[supabase-storage-nfce-nfe-xml.sql](./supabase-storage-nfce-nfe-xml.sql)** — buckets `nfce-xml` e `nfe-xml` para o app enviar/baixar XML.
7. **[supabase-sync-clock.sql](./supabase-sync-clock.sql)** — relógio + **triggers** (inclui `venda_nfce` / `venda_nfe` após criar essas tabelas).

O **pull** no app replica também `empresas_config`, `contas_receber`, **`venda_nfce`**, **`venda_nfe`** (quando existirem no projeto), `limite_credito` em `clientes` e colunas de venda a prazo em `vendas`, desde que o espelho no Supabase tenha essas tabelas/colunas.

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

- Ao criar/atualizar **empresas**, **empresas_config** (loja, fiscal, contadores após NFC-e/NF-e autorizada), **categorias**, **marcas**, **produtos**, **clientes**, **vendas** (incluindo cancelamento), **contas a receber**, etc., um registro é inserido em `sync_outbox` (SQLite) com status PENDING e o relógio local (`sync_clock`) é atualizado.
- O botão **Sincronizar agora** (ou chamada a `sync:run`) executa **sincronização bidirecional**:
  - Compara o relógio local (`sync_clock.last_local_update`) com o remoto (`pdv_sync_clock.last_update`).
  - Se o **Supabase** estiver mais atualizado → faz **pull**: copia todas as tabelas espelho do Supabase para o SQLite e atualiza o relógio local.
  - Se o **local** estiver mais atualizado (ou houver eventos pendentes) → faz **push**: envia os pendentes para as tabelas espelho e para `pdv_sync_events`, e atualiza o relógio remoto.
- O sync automático (após cada alteração) continua fazendo apenas **push** dos eventos pendentes.
- **Tempo real (web → app):** o app inscreve **Realtime** apenas em `pdv_sync_clock`. Qualquer INSERT/UPDATE/DELETE nas tabelas espelho listadas no script de sync deve atualizar esse relógio via trigger. Há ainda **polling ~15s** comparando `last_update` remoto com o relógio local e, quando não há itens pendentes na outbox, **pull completo ~20s** como redundância.
- **Notas fiscais:** o **XML** autorizado vai para **Storage** (`nfce-xml` / `nfe-xml`) quando os buckets existem. Os metadados (`venda_nfce`, `venda_nfe`: chave, status, caminho no Storage) são **espelhados** nas tabelas homónimas no Postgres; após sync/pull, o Windows lista as mesmas notas e pode **baixar o XML** do Storage (ex.: exportação ZIP). O caminho de ficheiro **local** (`xml_local_path`) não é replicado entre máquinas.

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
