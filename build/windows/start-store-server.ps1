param(
  [Parameter(Mandatory = $true)]
  [string]$AppExe,
  [Parameter(Mandatory = $true)]
  [string]$EnvFile,
  # Se true e `node` estiver no PATH, sobe só o store-server (sem Electron). Útil para diagnóstico e menos RAM.
  [switch]$PreferNode = $false
)

$ErrorActionPreference = "Stop"

$installDir = Split-Path -Parent $AppExe
$ssRoot = Join-Path $installDir "resources\store-server"
$ssModules = Join-Path $ssRoot "node_modules"
if (Test-Path $ssModules) {
  $env:NODE_PATH = if ($env:NODE_PATH) { "$ssModules;$env:NODE_PATH" } else { $ssModules }
}

if (Test-Path $EnvFile) {
  Get-Content $EnvFile | ForEach-Object {
    if ([string]::IsNullOrWhiteSpace($_)) { return }
    if ($_.TrimStart().StartsWith("#")) { return }
    $parts = $_.Split("=", 2)
    if ($parts.Count -eq 2) {
      [Environment]::SetEnvironmentVariable($parts[0], $parts[1], "Process")
    }
  }
}

function Ensure-PostgresRunning {
  if ($env:PG_MODE -eq "global") {
    # PostgreSQL global e gerenciado pelo próprio serviço do instalador do PostgreSQL.
    return
  }
  $pgBin = $env:PG_BIN
  $pgData = $env:PGDATA
  if ([string]::IsNullOrWhiteSpace($pgBin) -or [string]::IsNullOrWhiteSpace($pgData)) {
    throw "PG_BIN/PGDATA não configurados em store-server.env."
  }
  $pgCtl = Join-Path $pgBin "pg_ctl.exe"
  if (-not (Test-Path $pgCtl)) {
    throw "pg_ctl.exe não encontrado em $pgCtl"
  }
  & $pgCtl -D $pgData status | Out-Null
  if ($LASTEXITCODE -ne 0) {
    New-Item -ItemType Directory -Force -Path (Join-Path $pgData "..\run") | Out-Null
    $logFile = Join-Path $pgData "postgres.log"
    & $pgCtl -D $pgData -l $logFile -o "-p 5432 -h *" start -w | Out-Null
  }
}

Ensure-PostgresRunning

$indexJs = Join-Path $ssRoot "dist\index.js"
if ($PreferNode -and (Get-Command node -ErrorAction SilentlyContinue) -and (Test-Path $indexJs)) {
  Push-Location $ssRoot
  try {
    node .\dist\index.js
  } finally {
    Pop-Location
  }
} else {
  & $AppExe --store-server
}

