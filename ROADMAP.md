# Roadmap — Agiliza PDV

Seguindo o `pdv_spec.txt`. Desenvolvimento por etapas para evitar código e páginas duplicados.

| # | Etapa | Status |
|---|--------|--------|
| 1 | Setup Electron + Vite | ✅ Concluída |
| 2 | SQLite + migrations | ✅ Concluída |
| 3 | Empresas e usuários | ✅ Concluída |
| 4 | Produtos | ✅ Concluída |
| 5 | Estoque | ✅ Concluída |
| 6 | Sistema de caixa | ✅ Concluída |
| 7 | PDV vendas | ✅ Concluída |
| 8 | Cancelamento de venda | ✅ Concluída |
| 9 | Sincronização Supabase | ✅ Concluída |

## Etapa 1 — Concluída

- **Electron** + **electron-vite**: main, preload e renderer em pastas separadas.
- **React** + **Vite** + **TypeScript** no `renderer/`.
- **Rotas** (React Router) e uma página por tela do spec, sem duplicar:
  - `/login` → Login
  - `/dashboard` → Dashboard
  - `/produtos` → Produtos
  - `/estoque` → Estoque
  - `/clientes` → Clientes
  - `/fornecedores` → Fornecedores
  - `/caixa` → Caixa
  - `/pdv` → PDV (vendas)
- **Estrutura** conforme spec: `electron/`, `renderer/`, `backend/`, `sync/` com stubs para as próximas etapas.

### Comandos

- `npm run dev` — desenvolvimento (Electron + Vite HMR).
- `npm run build` — build para produção.
- `npm run preview` — preview do build.

---

## Etapa 2 — Concluída

- **better-sqlite3** instalado e recompilado para Electron (`electron-rebuild` no `postinstall`).
- **backend/db/index.ts**: `initDb(dbPath, migrationsDir?)`, `getDb()`, `closeDb()`, runner de migrations (tabela `_migrations`).
- **backend/db/migrations/001_initial.sql**: todas as tabelas do spec com IDs TEXT (UUID), FKs e CHECKs:
  - empresas, usuarios, produtos, clientes, fornecedores
  - estoque_movimentos, caixas, caixa_movimentos
  - vendas, venda_itens, pagamentos
  - sync_outbox
- **Electron main**: chama `initDb(app.getPath('userData'), ...)` em `app.whenReady()` e `closeDb()` em `window-all-closed`.
- Banco criado em `userData/pdv.db` (WAL, foreign_keys ON).

---

## Etapa 3 — Concluída

- **backend/services/empresas.service.ts**: `listEmpresas()`, `createEmpresa()`, `getEmpresaById()`.
- **backend/services/usuarios.service.ts**: senha com PBKDF2 (salt+hash), `listUsuariosByEmpresa()`, `createUsuario()`, `findByLogin()`, `login(empresaId, login, senha)`.
- **electron/ipc**: handlers `empresas:list`, `empresas:create`, `usuarios:list`, `usuarios:create`, `auth:login`, `auth:getSession`, `auth:logout`; sessão em memória no main.
- **Preload**: expõe `empresas`, `usuarios`, `auth` no `window.electronAPI`.
- **renderer**: `useAuth` (AuthProvider, session, login, logout), `ProtectedRoute`, `Layout` (menu + sair).
- **Login**: fluxo primeira configuração (criar empresa → criar usuário admin) ou login com empresa (select se várias).
- Rotas protegidas: só `/dashboard`, `/produtos`, etc. com sessão; sem sessão redireciona para `/login`.

---

## Etapa 4 — Concluída

- **backend/services/produtos.service.ts**: `listProdutos(empresaId, { search, apenasAtivos })`, `getProdutoById()`, `createProduto()`, `updateProduto()`; busca por nome, SKU, código de barras e categoria.
- **IPC**: `produtos:list`, `produtos:get`, `produtos:create`, `produtos:update`.
- **Tela Produtos**: listagem em tabela, filtro por texto e “apenas ativos”, botão “Novo produto”, formulário (nome, SKU, código de barras, categoria, custo, preço, unidade, controla estoque, estoque mínimo, ativo), editar por linha.

---

## Etapa 5 — Concluída

- **backend/services/estoque.service.ts**: `listMovimentos(empresaId, { produtoId?, limit? })`, `getSaldo(empresaId, produtoId)`, `listSaldosPorProduto(empresaId)`, `registrarMovimento(data)`. Tipos ENTRADA, SAIDA, AJUSTE, DEVOLUCAO; saldo = soma das contribuições; validação para não deixar saldo negativo.
- **IPC**: `estoque:listMovimentos`, `estoque:getSaldo`, `estoque:listSaldos`, `estoque:registrarMovimento`.
- **Tela Estoque**: tabela de saldos por produto (com estoque mínimo e alerta “abaixo do mínimo”), filtro de movimentos por produto, formulário “Novo movimento” (tipo, produto, quantidade, custo unitário), tabela dos últimos movimentos.

---

## Etapa 6 — Concluída

- **backend/services/caixa.service.ts**: `getCaixaAberto(empresaId)`, `abrirCaixa(empresaId, usuarioId, valorInicial)` (um caixa aberto por empresa), `fecharCaixa(caixaId)`, `listCaixas(empresaId, limit)`, `getSaldoCaixa(caixaId)` (valor_inicial + SUPRIMENTO - SANGRIA), `listMovimentosCaixa(caixaId)`, `registrarMovimentoCaixa(data)` (SANGRIA/SUPRIMENTO com validação de saldo).
- **IPC**: `caixa:getAberto`, `caixa:abrir`, `caixa:fechar`, `caixa:list`, `caixa:getSaldo`, `caixa:listMovimentos`, `caixa:registrarMovimento`.
- **Tela Caixa**: sem caixa aberto → formulário “Abrir caixa” (valor inicial); com caixa aberto → dados do caixa, saldo, botões Sangria/Suprimento (valor + motivo), Fechar caixa, tabela de movimentos e histórico de caixas.

---

## Etapa 7 — Concluída

- **backend/services/vendas.service.ts**: `finalizarVenda(data)` em transação: valida caixa aberto, próximo número por empresa, insere venda (CONCLUIDA), venda_itens, pagamentos e, para cada item com controle de estoque, registra movimento SAIDA (referencia_tipo VENDA). `listVendas(empresaId)`, `getVendaById(id)`.
- **IPC**: `vendas:finalizar`, `vendas:list`, `vendas:get`.
- **Tela PDV**: aviso se não houver caixa aberto; coluna esquerda: busca de produtos e botões para adicionar ao carrinho; coluna direita: carrinho (itens com quantidade, desconto, remover), desconto total, total, pagamentos (forma + valor), valor recebido e troco (para DINHEIRO), botão Finalizar venda. Total dos pagamentos deve igualar ao total; estoque baixa automaticamente ao finalizar.

---

## Etapa 8 — Concluída

- **backend/services/vendas.service.ts**: `cancelarVenda(vendaId, usuarioId)`: valida venda CONCLUIDA; em transação atualiza status para CANCELADA e, para cada item com controle de estoque, registra movimento DEVOLUCAO (referencia_tipo CANCELAMENTO_VENDA) estornando a quantidade.
- **IPC**: `vendas:cancelar(vendaId, usuarioId)`.
- **Tela PDV**: seção "Últimas vendas" com tabela (número, data, total, status) e botão "Cancelar" para vendas CONCLUIDA; confirmação antes de cancelar; mensagem de sucesso e atualização da lista.

---

## Etapa 9 — Concluída

- **sync/outbox.ts**: `addToOutbox(entity, entityId, operation, payload)`, `getPending(limit)`, `markSent(id)`, `markError(id)`, `getPendingCount()`; grava na tabela `sync_outbox` do SQLite.
- **sync/sync-engine.ts**: `runSync()` lê variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY`, busca pendentes, envia cada um para a tabela `pdv_sync_events` no Supabase (source_id, entity, entity_id, operation, payload_json, created_at) e atualiza status no outbox (SENT/ERROR).
- **Integração**: outbox chamado em empresas (create), produtos (create/update), vendas (finalizar → CREATE, cancelar → CANCEL).
- **IPC**: `sync:run`, `sync:getPendingCount`.
- **Dashboard**: bloco “Sincronização Supabase” com quantidade pendente, botão “Sincronizar agora” e mensagem do resultado.
- **docs/supabase-sync.md** e **docs/supabase-table.sql**: instruções e script SQL para criar a tabela no Supabase.

---

## Etapa 10 (Futuro) — Impressão de cupom ✅

- **vendas.service**: `getVendaDetalhes(vendaId)` retorna venda, empresa_nome, itens, pagamentos.
- **electron/cupom.ts**: `cupomToHtml(detalhes)` gera HTML do cupom (empresa, nº venda, itens, totais, pagamentos, troco).
- **IPC** `cupom:imprimir(vendaId)`: main abre janela oculta com o HTML e dispara o diálogo de impressão do sistema.
- **PDV**: botão "Imprimir cupom" em cada venda CONCLUIDA e ao lado da mensagem de sucesso após finalizar.

---

## Etapa 11 (Futuro) — Impressão de etiquetas ✅

- **electron/etiquetas.ts**: `etiquetasToHtml(produtos)` gera HTML em grid de etiquetas (~48×28mm): nome, preço, código de barras (texto), unidade.
- **IPC** `etiquetas:imprimir(produtoIds)`: main busca produtos, monta HTML e abre diálogo de impressão (igual cupom).
- **Tela Produtos**: coluna de seleção (checkbox), "Selecionar todos", botão "Imprimir etiquetas (N)" para selecionados; botão "Etiqueta" por linha para imprimir uma etiqueta do produto.

**Próximos (Futuro):** multi-loja, NFC-e, dashboard online. Próximos passos possíveis: impressão de cupom, etiquetas, multi-loja, NFC-e (conforme “Futuro” no spec).
