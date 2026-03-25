-- Venda a prazo (PostgreSQL / store-server)

ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS pagamentos_forma_check;
ALTER TABLE pagamentos ADD CONSTRAINT pagamentos_forma_check CHECK (forma IN ('DINHEIRO','PIX','DEBITO','CREDITO','OUTROS','CASHBACK','A_PRAZO'));

ALTER TABLE vendas ADD COLUMN IF NOT EXISTS venda_a_prazo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS data_vencimento TEXT;

CREATE TABLE IF NOT EXISTS contas_receber (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  venda_id TEXT NOT NULL UNIQUE REFERENCES vendas(id),
  cliente_id TEXT NOT NULL REFERENCES clientes(id),
  valor NUMERIC(15,4) NOT NULL,
  vencimento DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','RECEBIDA','CANCELADA')),
  recebido_em TIMESTAMPTZ,
  recebimento_caixa_id TEXT REFERENCES caixas(id),
  forma_recebimento TEXT,
  usuario_recebimento_id TEXT REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contas_receber_empresa_cliente ON contas_receber(empresa_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_empresa_status ON contas_receber(empresa_id, status);

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS limite_credito NUMERIC(15,4);

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS venda_prazo_usar_limite_credito INTEGER NOT NULL DEFAULT 0;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS venda_prazo_bloquear_inadimplente INTEGER NOT NULL DEFAULT 0;
