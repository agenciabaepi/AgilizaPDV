# Build Windows via GitHub

Fluxo recomendado quando o desenvolvimento e feito no macOS/Linux.

## Como publicar

1. Commit/push das alteracoes.
2. Criar e enviar tag semantica:
   - `git tag v0.1.5`
   - `git push origin v0.1.5`
3. O workflow `Build/release Agiliza PDV` roda no `windows-latest` e gera o instalador.

Tambem e possivel disparar manualmente em **Actions > workflow_dispatch**.

## Pre-condicao obrigatoria

Os binarios do PostgreSQL embarcado devem existir no repositório:

- `build/windows/postgres/bin/postgres.exe`
- `build/windows/postgres/bin/pg_ctl.exe`
- `build/windows/postgres/bin/initdb.exe`
- `build/windows/postgres/bin/psql.exe`
- `build/windows/postgres/bin/createdb.exe`

O CI valida isso no primeiro passo com:

- `node scripts/windows/check-embedded-postgres.cjs`

Se faltar qualquer arquivo, o build para imediatamente.

## Saidas do workflow

- Artifact: `agiliza-pdv-windows`
- Release assets (quando rodar por tag): `release/**/*.exe` e `release/**/*.blockmap`

