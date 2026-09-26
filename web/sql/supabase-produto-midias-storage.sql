-- Galeria de mídia do produto (vídeos / arquivos grandes da loja online).
-- Execute no SQL Editor do Supabase (pode rodar de novo para atualizar o limite).
--
-- Nota: no plano Free o Supabase limita uploads a ~50 MB no projeto.
-- Para vídeos maiores (ex.: 91 MB), use plano Pro (ou superior) e rode este SQL.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'produto-midias',
  'produto-midias',
  true,
  524288000, -- 500 MB (teto do bucket; o plano da conta ainda pode limitar)
  NULL -- qualquer tipo (mp4, mov, webm, etc.)
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

UPDATE storage.buckets
SET file_size_limit = 524288000,
    public = true,
    allowed_mime_types = NULL
WHERE id = 'produto-midias';

DROP POLICY IF EXISTS "Allow anon upload produto-midias" ON storage.objects;
CREATE POLICY "Allow anon upload produto-midias" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'produto-midias');

DROP POLICY IF EXISTS "Allow anon read produto-midias" ON storage.objects;
CREATE POLICY "Allow anon read produto-midias" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'produto-midias');

DROP POLICY IF EXISTS "Allow anon update produto-midias" ON storage.objects;
CREATE POLICY "Allow anon update produto-midias" ON storage.objects
  FOR UPDATE TO anon
  USING (bucket_id = 'produto-midias')
  WITH CHECK (bucket_id = 'produto-midias');

DROP POLICY IF EXISTS "Allow anon delete produto-midias" ON storage.objects;
CREATE POLICY "Allow anon delete produto-midias" ON storage.objects
  FOR DELETE TO anon USING (bucket_id = 'produto-midias');

DROP POLICY IF EXISTS "Allow authenticated upload produto-midias" ON storage.objects;
CREATE POLICY "Allow authenticated upload produto-midias" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'produto-midias');

DROP POLICY IF EXISTS "Allow authenticated read produto-midias" ON storage.objects;
CREATE POLICY "Allow authenticated read produto-midias" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'produto-midias');

DROP POLICY IF EXISTS "Allow authenticated update produto-midias" ON storage.objects;
CREATE POLICY "Allow authenticated update produto-midias" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'produto-midias')
  WITH CHECK (bucket_id = 'produto-midias');

DROP POLICY IF EXISTS "Allow authenticated delete produto-midias" ON storage.objects;
CREATE POLICY "Allow authenticated delete produto-midias" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'produto-midias');
