-- Código numérico para login no PDV (sem listar empresas na tela de login).
ALTER TABLE empresas ADD COLUMN codigo_acesso INTEGER UNIQUE;
