-- Espelho Supabase → Postgres (pull). Alinhado ao SQLite local e a `sync/sync-engine.ts`.

CREATE TABLE IF NOT EXISTS empresas_config (
  empresa_id TEXT PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  razao_social TEXT,
  endereco TEXT,
  telefone TEXT,
  email TEXT,
  logo TEXT,
  cor_primaria TEXT DEFAULT '#1d4ed8',
  modulos_json TEXT,
  impressora_cupom TEXT,
  cupom_layout_pagina TEXT,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ambiente_fiscal INTEGER DEFAULT 1,
  serie_nfe INTEGER DEFAULT 1,
  ultimo_numero_nfe INTEGER DEFAULT 0,
  serie_nfce INTEGER DEFAULT 1,
  ultimo_numero_nfce INTEGER DEFAULT 0,
  csc_nfce TEXT,
  csc_id_nfce TEXT,
  indicar_fonte_ibpt INTEGER DEFAULT 1,
  xml_autorizados_json TEXT,
  uf_emitente TEXT DEFAULT 'SP',
  ie_emitente TEXT DEFAULT 'ISENTO',
  c_mun_emitente INTEGER,
  ncm_padrao TEXT,
  tributo_aprox_federal_pct NUMERIC(15, 6) DEFAULT 0,
  tributo_aprox_estadual_pct NUMERIC(15, 6) DEFAULT 0,
  tributo_aprox_municipal_pct NUMERIC(15, 6) DEFAULT 0,
  caixa_valor_sugerido_abertura NUMERIC(15, 4) DEFAULT 0,
  venda_prazo_usar_limite_credito INTEGER NOT NULL DEFAULT 0,
  venda_prazo_bloquear_inadimplente INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_empresas_config_empresa_pg ON empresas_config(empresa_id);

CREATE TABLE IF NOT EXISTS venda_nfce (
  venda_id TEXT PRIMARY KEY REFERENCES vendas(id) ON DELETE CASCADE,
  numero_nfce INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  chave TEXT,
  protocolo TEXT,
  mensagem_sefaz TEXT,
  xml_local_path TEXT,
  xml_supabase_path TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_venda_nfce_status_store ON venda_nfce(status);

CREATE TABLE IF NOT EXISTS venda_nfe (
  venda_id TEXT PRIMARY KEY REFERENCES vendas(id) ON DELETE CASCADE,
  modelo INTEGER NOT NULL DEFAULT 55,
  serie INTEGER NOT NULL,
  numero_nfe INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  chave TEXT,
  protocolo TEXT,
  mensagem_sefaz TEXT,
  xml_local_path TEXT,
  xml_supabase_path TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_venda_nfe_status_store ON venda_nfe(status);
