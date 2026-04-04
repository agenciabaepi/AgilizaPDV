-- =============================================================================
-- Buckets Storage para XML autorizado NFC-e e NF-e (upload pelo app Electron)
-- Execute no SQL Editor do Supabase (Storage usa tabelas internas).
-- Sem isto, o upload no código falha e só fica cópia local.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('nfce-xml', 'nfce-xml', false, 52428800),
  ('nfe-xml', 'nfe-xml', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Upload (anon = chave do app no instalador)
DROP POLICY IF EXISTS "Allow anon upload nfce-xml" ON storage.objects;
CREATE POLICY "Allow anon upload nfce-xml" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'nfce-xml');

DROP POLICY IF EXISTS "Allow anon upload nfe-xml" ON storage.objects;
CREATE POLICY "Allow anon upload nfe-xml" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'nfe-xml');

-- Leitura (download no outro PC / exportação ZIP)
DROP POLICY IF EXISTS "Allow anon read nfce-xml" ON storage.objects;
CREATE POLICY "Allow anon read nfce-xml" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'nfce-xml');

DROP POLICY IF EXISTS "Allow anon read nfe-xml" ON storage.objects;
CREATE POLICY "Allow anon read nfe-xml" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'nfe-xml');

-- Update/upsert (o cliente usa upload com upsert: true)
DROP POLICY IF EXISTS "Allow anon update nfce-xml" ON storage.objects;
CREATE POLICY "Allow anon update nfce-xml" ON storage.objects
  FOR UPDATE TO anon USING (bucket_id = 'nfce-xml') WITH CHECK (bucket_id = 'nfce-xml');

DROP POLICY IF EXISTS "Allow anon update nfe-xml" ON storage.objects;
CREATE POLICY "Allow anon update nfe-xml" ON storage.objects
  FOR UPDATE TO anon USING (bucket_id = 'nfe-xml') WITH CHECK (bucket_id = 'nfe-xml');
