-- =============================================================================
-- Agiliza PDV – Coluna email em usuarios (Supabase)
-- Execute no SQL Editor do Supabase em projetos que já tinham a tabela usuarios.
-- =============================================================================

ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS email TEXT;

-- Preenche email a partir do login quando o login parece um e-mail (cadastros web antigos).
UPDATE public.usuarios
SET email = LOWER(TRIM(login))
WHERE (email IS NULL OR TRIM(email) = '')
  AND login ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$';

-- E-mail único entre usuários (ignora NULL/vazio — caixa PDV pode não ter e-mail).
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email_unique
  ON public.usuarios (LOWER(TRIM(email)))
  WHERE email IS NOT NULL AND TRIM(email) <> '';
