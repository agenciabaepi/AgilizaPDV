# Módulo de Fornecedores — arquitetura

## Visão geral

O cadastro segue o mesmo padrão dos demais domínios do Agiliza PDV:

1. **SQLite local** (`backend/db/migrations`) + **serviço** (`backend/services/fornecedores.service.ts`)
2. **IPC** (`electron/ipc/index.ts`) → **preload** (`electron/preload.ts`)
3. **UI React** (`renderer/pages/Fornecedores.tsx`) usando `Layout`, `Dialog`, abas (`form-tabs` em `index.css`)
4. **Modo servidor** opcional: **store-server** (`store-server/src/routes/fornecedores.ts` + `schema/002_fornecedores_completo.sql`)
5. **Modo web (Supabase)**: `renderer/lib/web-electron-api.ts` — requer tabelas/colunas espelhadas no projeto Supabase

## Multi-tenant e auditoria

- Todos os registros têm `empresa_id`; listagens e gravações respeitam a empresa da sessão.
- `created_by` / `updated_by` preenchidos no desktop quando há usuário logado (não suporte).
- `fornecedores_historico` registra `CREATE`, `UPDATE`, `INATIVAR`, `REATIVAR`.

## Regras de negócio

- **CPF/CNPJ** único por empresa (normalização por dígitos).
- **Razão social / nome** único por empresa (comparação case-insensitive, mín. 3 caracteres para checagem de duplicidade).
- **Exclusão física** apenas se **não** houver `produtos.fornecedor_id` apontando para o fornecedor; caso contrário, usar **inativação**.
- **Bloqueio de compras** exige **motivo** no formulário.

## Validações compartilhadas

- `renderer/lib/validators.ts` — CPF, CNPJ, e-mail, telefone, formatação.
- `renderer/lib/cep.ts` — ViaCEP no blur do CEP (somente renderer / rede).

## PostgreSQL / Supabase

O arquivo `backend/db/migrations/020_fornecedores_completo.sql` é **somente SQLite** (`datetime('now')` etc.). No Supabase use **`docs/supabase-fornecedores-migracao.sql`**, que é **idempotente** (consulta `information_schema` antes de cada `ADD COLUMN`, seguro após migração parcial ou reexecução). Alternativa: `store-server/src/schema/002_fornecedores_completo.sql` (`ADD COLUMN IF NOT EXISTS`).

## Sincronização Supabase

- `sync/sync-engine.ts`: entidade `fornecedores` no `ENTITY_SYNC_ORDER`, `applyToMirror` envia **apenas colunas legadas** (`id`, `empresa_id`, `razao_social`, `cnpj`, `contato`, `observacoes`, `created_at`) até que o espelho no Supabase seja migrado com todas as colunas.
- Para espelho completo, alinhar o schema do Supabase com `store-server/src/schema/002_fornecedores_completo.sql` (ou equivalente) e estender o filtro em `applyToMirror` se desejar sync total.

## Próximas integrações sugeridas

- Pedidos de compra / contas a pagar / NF-e entrada: referenciar `fornecedores.id` e incluir checagens na exclusão.
- Anexos binários: tabela `fornecedores_anexos` + storage (fora do escopo desta entrega; hoje há tags e observações internas).
