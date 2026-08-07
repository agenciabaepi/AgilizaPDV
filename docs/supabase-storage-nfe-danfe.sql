-- Bucket para PDFs DANFE NF-e gerados no modo web
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('nfe-danfe', 'nfe-danfe', false, 10485760)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow anon upload nfe-danfe" ON storage.objects;
CREATE POLICY "Allow anon upload nfe-danfe" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'nfe-danfe');

DROP POLICY IF EXISTS "Allow anon read nfe-danfe" ON storage.objects;
CREATE POLICY "Allow anon read nfe-danfe" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'nfe-danfe');

DROP POLICY IF EXISTS "Allow anon update nfe-danfe" ON storage.objects;
CREATE POLICY "Allow anon update nfe-danfe" ON storage.objects
  FOR UPDATE TO anon USING (bucket_id = 'nfe-danfe') WITH CHECK (bucket_id = 'nfe-danfe');
