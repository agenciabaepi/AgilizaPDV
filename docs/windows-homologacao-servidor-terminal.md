# Homologacao Windows (Servidor + Terminal)

Checklist rapido para validar instalacao e operacao em 2 maquinas Windows na mesma rede.

## 1) Preparacao

- Maquina A: instalar como **Servidor**
- Maquina B: instalar como **Computador terminal**
- Mesmo segmento de rede local
- Firewall do Windows ativo (teste real)

## 2) Validacao no Servidor (Maquina A)

1. Abrir app e fazer login suporte.
2. Em `Configuracoes do sistema`, confirmar `URL do servidor` preenchida ou descoberta.
3. No PowerShell (admin), validar tarefa:
   - `schtasks /Query /TN "AgilizaPDV Store Server"`
4. Validar porta:
   - `Test-NetConnection -ComputerName localhost -Port 3000`
5. Validar health API:
   - `Invoke-RestMethod http://localhost:3000/health`

Esperado: `TcpTestSucceeded=True` e `{ ok: true }`.

## 3) Descoberta no Terminal (Maquina B)

1. Abrir app e entrar em `Configuracoes do sistema` (suporte).
2. Clicar em `Descobrir automaticamente`.
3. Confirmar URL retornada (`http://<ip-servidor>:3000`).

Esperado: servidor encontrado sem digitar IP manualmente.

## 4) Fluxo em tempo real (offline de internet)

1. Desconectar internet (manter LAN).
2. Na Maquina B, alterar preco de um produto.
3. Na Maquina A, abrir lista de produtos.

Esperado: alteracao refletida imediatamente (WebSocket/local server).

## 5) Vendas simultaneas

1. Abrir caixa na Maquina A.
2. Fazer venda 1 na Maquina A.
3. Fazer venda 2 na Maquina B.
4. Validar em ambos os terminais:
   - lista de vendas
   - saldo de estoque

Esperado: consistencia unica no servidor local.

## 6) Sync para Supabase

1. Configurar `SUPABASE_URL` e `SUPABASE_ANON_KEY` no servidor (arquivo env do runtime).
2. Com internet ativa, chamar:
   - `POST /sync/run`
3. Conferir contadores pendentes/erro no app.

Esperado: pendentes = 0, sem erros.

## 7) Reboot e resiliencia

1. Reiniciar Maquina A.
2. Aguardar boot completo.
3. Validar novamente:
   - tarefa ativa
   - `http://localhost:3000/health`

Esperado: servidor sobe automaticamente no boot.

## 8) Criterio de aprovacao

A release esta homologada quando:

- descoberta automatica funciona
- tempo real entre terminais funciona sem internet
- vendas e estoque consistentes
- sync com Supabase funcionando
- servidor reinicia sozinho apos reboot

