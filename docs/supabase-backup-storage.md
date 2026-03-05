# Backup do banco na nuvem (Supabase Storage)

O app pode enviar uma cópia completa do banco (`pdv.db`) para o Supabase Storage. Assim o cliente pode **restaurar o backup em outra máquina** (novo PC ou reinstalação).

## Configuração

1. **Variáveis de ambiente** (mesmas do sync):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

2. **Bucket + políticas no Supabase (recomendado)**

   Execute o script único que cria o bucket `pdv-backups`, as políticas de upload/download e a tabela de sync:

   **[docs/supabase-setup.sql](./supabase-setup.sql)** (no SQL Editor do Supabase)

   Se preferir configurar só o backup manualmente:

   - **Storage** → **New bucket** → nome **`pdv-backups`**, **Public** desmarcado.
   - Políticas (Storage → `pdv-backups` → Policies): upload (INSERT) e download (SELECT) para `anon`. Exemplo no SQL:

```sql
-- Permitir anon fazer upload no bucket pdv-backups
CREATE POLICY "Allow upload backup"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'pdv-backups');

-- Permitir anon baixar do bucket pdv-backups
CREATE POLICY "Allow download backup"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'pdv-backups');
```

## Uso no app

- **Dashboard** → card **Backup do banco de dados**:
  - **Abrir pasta**: abre a pasta onde está o `pdv.db` (ex.: `AppData/Roaming/agiliza-pdv` no Windows).
  - **Salvar backup em uma pasta**: copia o banco para uma pasta que você escolher (nome com data).
  - **Enviar backup para a nuvem**: envia o `pdv.db` atual para o bucket `pdv-backups` (arquivo `backup.db`; cada envio substitui o anterior).
  - **Restaurar de um arquivo**: escolhe um `.db` no PC e substitui o banco atual (útil para backup local).
  - **Restaurar do backup na nuvem**: baixa o `backup.db` do Supabase e substitui o banco local (use ao instalar em outra máquina).

Após restaurar, recarregue a página (F5) ou reinicie o app.
