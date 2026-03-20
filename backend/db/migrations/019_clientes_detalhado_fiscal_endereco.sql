-- Clientes - detalhes completos para uso em NF-e/NFC-e
-- Esta migration enriquece a tabela existente `clientes` com campos fiscais
-- e de endereço estruturado, mantendo compatibilidade com dados já salvos.

ALTER TABLE clientes
  ADD COLUMN tipo_pessoa TEXT NOT NULL DEFAULT 'F' CHECK (tipo_pessoa IN ('F','J'));

ALTER TABLE clientes
  ADD COLUMN razao_social TEXT;

ALTER TABLE clientes
  ADD COLUMN nome_fantasia TEXT;

ALTER TABLE clientes
  ADD COLUMN inscricao_estadual TEXT;

ALTER TABLE clientes
  ADD COLUMN indicador_ie_dest TEXT NOT NULL DEFAULT '9' CHECK (indicador_ie_dest IN ('1','2','9'));

ALTER TABLE clientes
  ADD COLUMN email_nfe TEXT;

ALTER TABLE clientes
  ADD COLUMN endereco_cep TEXT;

ALTER TABLE clientes
  ADD COLUMN endereco_logradouro TEXT;

ALTER TABLE clientes
  ADD COLUMN endereco_numero TEXT;

ALTER TABLE clientes
  ADD COLUMN endereco_complemento TEXT;

ALTER TABLE clientes
  ADD COLUMN endereco_bairro TEXT;

ALTER TABLE clientes
  ADD COLUMN endereco_municipio TEXT;

ALTER TABLE clientes
  ADD COLUMN endereco_municipio_codigo INTEGER;

ALTER TABLE clientes
  ADD COLUMN endereco_uf TEXT;

ALTER TABLE clientes
  ADD COLUMN endereco_pais_codigo INTEGER;

ALTER TABLE clientes
  ADD COLUMN endereco_pais_nome TEXT;

