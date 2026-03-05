Coloque aqui os binarios do PostgreSQL embarcado para Windows.

Estrutura esperada no pacote:

- `build/windows/postgres/bin/postgres.exe`
- `build/windows/postgres/bin/pg_ctl.exe`
- `build/windows/postgres/bin/initdb.exe`
- `build/windows/postgres/bin/psql.exe`
- `build/windows/postgres/bin/createdb.exe`

No instalador, esses arquivos serao copiados para `resources/windows/postgres/bin`.
O script `install-runtime.ps1` inicializa o cluster em:

- `C:\ProgramData\AgilizaPDV\server\postgres\data`

e cria o banco `agiliza_pdv` automaticamente.

