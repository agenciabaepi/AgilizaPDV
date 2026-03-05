# Agiliza Store Server

Servidor da loja: Postgres + API REST + WebSocket. Uma máquina na rede roda este servidor; os PDVs (Electron) se conectam a ele para operar em tempo real e compartilhar o mesmo banco.

## Requisitos

- Node 18+
- PostgreSQL (ex.: 14+)

## Configuração

1. Crie o banco no Postgres:
   ```bash
   createdb agiliza_pdv
   ```

2. Copie `.env.example` para `.env` e ajuste:
   ```env
   DATABASE_URL=postgresql://usuario:senha@localhost:5432/agiliza_pdv
   PORT=3000
   # Opcional: sync com Supabase (espelho)
   SUPABASE_URL=https://seu-projeto.supabase.co
   SUPABASE_ANON_KEY=sua-anon-key
   ```

3. Instale e inicie:
   ```bash
   npm install
   npm run build
   npm start
   ```

Em desenvolvimento: `npm run dev` (watch + restart).

## API

- **Auth:** `POST /auth/login` (body: `empresaId`, `login`, `senha`) → `{ user, sessionId }`. Use o header `Authorization: Bearer <sessionId>` nas demais rotas.
- **Empresas:** `GET/POST /empresas`
- **Usuários:** `GET/POST /usuarios` (query: `empresaId`)
- **Produtos:** `GET/POST/PATCH /produtos`, `GET /produtos/next-codigo`, `GET /produtos/:id`
- **Categorias:** `GET/POST/PATCH/DELETE /categorias`, `GET /categorias/tree`, `GET /categorias/folha`, `GET /categorias/path/:id`
- **Clientes:** `GET /clientes`
- **Fornecedores:** `GET /fornecedores`
- **Estoque:** `GET /estoque/movimentos`, `GET /estoque/saldo`, `GET /estoque/saldos`, `POST /estoque/movimento`, `POST /estoque/ajustar`
- **Caixa:** `GET /caixa/aberto`, `POST /caixa/abrir`, `POST /caixa/fechar`, `GET /caixa/list`, `GET /caixa/:caixaId/saldo`, `GET /caixa/:caixaId/movimentos`, `POST /caixa/movimento`
- **Vendas:** `POST /vendas/finalizar`, `GET /vendas`, `GET /vendas/:id`, `GET /vendas/:id/detalhes`, `POST /vendas/:id/cancelar`
- **Sync (Supabase):** `GET /sync/pending-count`, `GET /sync/error-count`, `POST /sync/run`, `POST /sync/reset-errors`

## WebSocket

Conecte em `ws://host:PORT/ws`. O servidor envia eventos em tempo real:

- `produto` – criação/atualização/exclusão de produto
- `categoria` – idem para categoria
- `venda` – venda finalizada ou cancelada
- `estoque` – movimento de estoque
- `caixa` – abertura/fechamento/movimento de caixa

## Sync Supabase

Se `SUPABASE_URL` e `SUPABASE_ANON_KEY` estiverem definidos, o servidor executa sync do outbox para as tabelas espelho no Supabase a cada 1 minuto. Também é possível disparar manualmente com `POST /sync/run`.
