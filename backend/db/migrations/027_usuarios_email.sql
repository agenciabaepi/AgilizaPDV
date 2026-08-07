-- E-mail do usuário (login web). Caixa/PDV pode continuar usando apenas login.
ALTER TABLE usuarios ADD COLUMN email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email_unique
  ON usuarios (email)
  WHERE email IS NOT NULL AND TRIM(email) <> '';
