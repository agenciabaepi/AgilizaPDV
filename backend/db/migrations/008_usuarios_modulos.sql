-- Permissões por usuário: quais módulos o usuário pode acessar (JSON: ModuloId -> boolean).
-- Se NULL, o usuário usa as permissões da empresa (empresas_config.modulos_json).
ALTER TABLE usuarios ADD COLUMN modulos_json TEXT;
