# Release Windows - Servidor + Terminal

Checklist objetivo para gerar release Windows sem falhas de runtime.

## 1) Preparar binarios PostgreSQL embarcado

Copie os executaveis para:

- `build/windows/postgres/bin/postgres.exe`
- `build/windows/postgres/bin/pg_ctl.exe`
- `build/windows/postgres/bin/initdb.exe`
- `build/windows/postgres/bin/psql.exe`
- `build/windows/postgres/bin/createdb.exe`

Validar:

- `npm run check:embedded-postgres`

## 2) Gerar build Windows

- `npm run build:win`
- ou `npm run build:win:localtest` (gera build e imprime proximo roteiro)

Obs.: o script `build:win` ja valida automaticamente os binarios embarcados.

## 3) Teste rapido local (1 maquina)

1. Instalar em modo **Servidor**.
2. Verificar:
   - `schtasks /Query /TN "AgilizaPDV Store Server"`
   - `Test-NetConnection localhost -Port 3000`
   - `Invoke-RestMethod http://localhost:3000/health`

## 4) Homologacao em 2 maquinas

Seguir:

- `docs/windows-homologacao-servidor-terminal.md`

Opcional (smoke):

- `scripts/windows/homologacao-smoke.ps1`

## 5) Diagnostico para suporte

Quando cliente reportar falha, rodar:

- `scripts/windows/diagnostico-runtime.ps1`

Esse script gera ZIP com dados de tarefa, firewall, processos e porta 3000.

