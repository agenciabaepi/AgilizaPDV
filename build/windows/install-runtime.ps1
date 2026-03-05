param(
  [string]$Mode = "terminal",
  [string]$InstallDir,
  [string]$ResourcesDir
)

$ErrorActionPreference = "Stop"

function Write-Info([string]$msg) {
  Write-Host "[AgilizaInstaller] $msg"
}

function Ensure-FirewallRule {
  param([int]$Port)
  try {
    netsh advfirewall firewall add rule name="AgilizaPDV Store Server" dir=in action=allow protocol=TCP localport=$Port profile=private | Out-Null
  } catch {
    Write-Info "Falha ao criar regra de firewall: $($_.Exception.Message)"
  }
}

function Ensure-EmbeddedPostgres {
  param(
    [string]$ResourcesDir,
    [string]$ServerRoot,
    [string]$PostgresPassword
  )

  $pgBin = Join-Path $ResourcesDir "windows\postgres\bin"
  $initdb = Join-Path $pgBin "initdb.exe"
  $pgCtl = Join-Path $pgBin "pg_ctl.exe"
  $psql = Join-Path $pgBin "psql.exe"
  $createdb = Join-Path $pgBin "createdb.exe"

  if (-not (Test-Path $initdb) -or -not (Test-Path $pgCtl) -or -not (Test-Path $psql) -or -not (Test-Path $createdb)) {
    throw "PostgreSQL embarcado não encontrado em '$pgBin'. Inclua os binários em build/windows/postgres/bin."
  }

  $pgData = Join-Path $ServerRoot "postgres\data"
  $pgRun = Join-Path $ServerRoot "postgres\run"
  New-Item -ItemType Directory -Force -Path $pgData | Out-Null
  New-Item -ItemType Directory -Force -Path $pgRun | Out-Null

  $pgVersion = Join-Path $pgData "PG_VERSION"
  if (-not (Test-Path $pgVersion)) {
    Write-Info "Inicializando cluster PostgreSQL embarcado..."
    $pwFile = Join-Path $pgRun "pgpass-init.txt"
    Set-Content -Path $pwFile -Value $PostgresPassword -Encoding ASCII
    & $initdb -D $pgData -U postgres -A scram-sha-256 --pwfile $pwFile | Out-Null
    Remove-Item $pwFile -ErrorAction SilentlyContinue

    $postgresConf = Join-Path $pgData "postgresql.conf"
    Add-Content -Path $postgresConf -Value "listen_addresses='*'"
    Add-Content -Path $postgresConf -Value "port=5432"
  }

  return @{
    PgBin = $pgBin
    PgCtl = $pgCtl
    Psql = $psql
    CreateDb = $createdb
    PgData = $pgData
  }
}

function Ensure-Database {
  param(
    [string]$PgCtl,
    [string]$PsqlPath,
    [string]$CreateDbPath,
    [string]$PgData,
    [string]$PostgresPassword
  )

  $env:PGPASSWORD = $PostgresPassword
  & $PgCtl -D $PgData -l (Join-Path $PgData "bootstrap.log") -o "-p 5432 -h 127.0.0.1" start -w | Out-Null
  try {
    $exists = & $PsqlPath -h 127.0.0.1 -p 5432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='agiliza_pdv';"
    if ($exists -ne "1") {
      & $CreateDbPath -h 127.0.0.1 -p 5432 -U postgres agiliza_pdv | Out-Null
    }
  } finally {
    & $PgCtl -D $PgData stop -m fast | Out-Null
  }
}

if (-not $InstallDir) {
  throw "InstallDir não informado."
}

$programData = Join-Path $env:ProgramData "AgilizaPDV"
$serverRoot = Join-Path $programData "server"
New-Item -ItemType Directory -Force -Path $programData | Out-Null
New-Item -ItemType Directory -Force -Path $serverRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $serverRoot "api") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $serverRoot "sync") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $serverRoot "app") | Out-Null

$modeFile = Join-Path $programData "install-mode.txt"
Set-Content -Path $modeFile -Value $Mode -Encoding UTF8

if ($Mode -ne "server") {
  Write-Info "Modo terminal: nenhuma instalação de runtime de servidor necessária."
  exit 0
}

$appExe = Join-Path $InstallDir "AgilizaPDV.exe"
if (-not (Test-Path $appExe)) {
  throw "Executável não encontrado: $appExe"
}

$postgresPassword = [Guid]::NewGuid().ToString("N").Substring(0, 16) + "!"
$pg = Ensure-EmbeddedPostgres -ResourcesDir $ResourcesDir -ServerRoot $serverRoot -PostgresPassword $postgresPassword
Ensure-Database -PgCtl $pg.PgCtl -PsqlPath $pg.Psql -CreateDbPath $pg.CreateDb -PgData $pg.PgData -PostgresPassword $postgresPassword

$envFile = Join-Path $programData "store-server.env"
@(
  "PG_BIN=$($pg.PgBin)",
  "PGDATA=$($pg.PgData)",
  "DATABASE_URL=postgresql://postgres:$postgresPassword@localhost:5432/agiliza_pdv",
  "PORT=3000",
  "AGILIZA_SERVER_NAME=AGILIZA-SERVER"
) | Set-Content -Path $envFile -Encoding UTF8

$startScript = Join-Path $ResourcesDir "windows\start-store-server.ps1"
if (-not (Test-Path $startScript)) {
  throw "Script de inicialização do servidor não encontrado: $startScript"
}

$taskCmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$startScript`" -AppExe `"$appExe`" -EnvFile `"$envFile`""
Start-Process -FilePath "schtasks.exe" -ArgumentList @("/Create","/F","/TN","AgilizaPDV Store Server","/SC","ONSTART","/RU","SYSTEM","/TR",$taskCmd) -Wait -NoNewWindow
Start-Process -FilePath "schtasks.exe" -ArgumentList @("/Run","/TN","AgilizaPDV Store Server") -Wait -NoNewWindow

Ensure-FirewallRule -Port 3000
Write-Info "Modo servidor configurado com sucesso."

