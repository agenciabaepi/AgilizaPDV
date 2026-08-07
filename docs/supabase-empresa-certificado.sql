-- =============================================================================
-- Agiliza PDV — Certificado digital A1 por empresa (modo web)
-- Execute no SQL Editor do Supabase após supabase-mirror-tables.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.empresa_certificado (
  empresa_id TEXT PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  senha_encrypted TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_empresa_certificado_empresa ON public.empresa_certificado(empresa_id);

ALTER TABLE public.empresa_certificado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all mirror empresa_certificado" ON public.empresa_certificado;
CREATE POLICY "Allow anon all mirror empresa_certificado" ON public.empresa_certificado
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Bucket privado para arquivos .pfx / .p12
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('certificados', 'certificados', false, 5242880)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow anon upload certificados" ON storage.objects;
CREATE POLICY "Allow anon upload certificados" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'certificados');

DROP POLICY IF EXISTS "Allow anon read certificados" ON storage.objects;
CREATE POLICY "Allow anon read certificados" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'certificados');

DROP POLICY IF EXISTS "Allow anon update certificados" ON storage.objects;
CREATE POLICY "Allow anon update certificados" ON storage.objects
  FOR UPDATE TO anon USING (bucket_id = 'certificados') WITH CHECK (bucket_id = 'certificados');

DROP POLICY IF EXISTS "Allow anon delete certificados" ON storage.objects;
CREATE POLICY "Allow anon delete certificados" ON storage.objects
  FOR DELETE TO anon USING (bucket_id = 'certificados');
