# Reparo automatico: recria PostgreSQL embarcado + store-server.env (senha alinhada).
# NAO use se PG_MODE=global (Postgres do Windows) - aviso na tela.
# Salvo em UTF-8; use apenas ASCII nas strings criticas para evitar erro de encoding no PowerShell 5.1.
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms | Out-Null

$InstallDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ResourcesDir = Join-Path $InstallDir "resources"
$RuntimeScript = Join-Path $ResourcesDir "windows\install-runtime.ps1"
$AppExe = Join-Path $InstallDir "AgilizaPDV.exe"

$programData = Join-Path $env:ProgramData "AgilizaPDV"
$envFile = Join-Path $programData "store-server.env"
$serverRoot = Join-Path $programData "server"
$pgDataDefault = Join-Path $serverRoot "postgres\data"

function Get-EnvValue([string]$Path, [string]$Key) {
  if (-not (Test-Path $Path)) { return $null }
  foreach ($line in Get-Content $Path) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    if ($line.TrimStart().StartsWith("#")) { continue }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { continue }
    $k = $line.Substring(0, $eq).Trim()
    if ($k -ne $Key) { continue }
    return $line.Substring($eq + 1).Trim()
  }
  return $null
}

if (-not (Test-Path $AppExe)) {
  [System.Windows.Forms.MessageBox]::Show(
    "Nao encontrei AgilizaPDV.exe nesta pasta.`n`nExecute este arquivo na pasta onde o programa foi instalado (mesmo lugar do AgilizaPDV.exe).",
    "Agiliza PDV",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Error
  ) | Out-Null
  exit 1
}

if (-not (Test-Path $RuntimeScript)) {
  [System.Windows.Forms.MessageBox]::Show(
    "Instalacao incompleta: falta resources\windows\install-runtime.ps1",
    "Agiliza PDV",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Error
  ) | Out-Null
  exit 1
}

$pgMode = if (Test-Path $envFile) { Get-EnvValue $envFile "PG_MODE" } else { $null }
if ($pgMode -eq "global") {
  [System.Windows.Forms.MessageBox]::Show(
    "Este computador usa o PostgreSQL instalado no Windows (modo global), nao o banco embarcado.`n`nEste reparo automatico nao se aplica. Entre em contato com o suporte Agiliza.",
    "Agiliza PDV",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
  ) | Out-Null
  exit 0
}

$confirm = [System.Windows.Forms.MessageBox]::Show(
  "ISTO APAGA TODOS OS DADOS DA LOJA NESTE COMPUTADOR (vendas, produtos, cadastros no banco local).`n`nDepois, o sistema cria um banco novo e uma senha nova automaticamente.`n`nSo use se o servidor nao conecta ou pediu erro de senha do postgres.`n`nDeseja continuar?",
  "Agiliza PDV - Reparar servidor",
  [System.Windows.Forms.MessageBoxButtons]::YesNo,
  [System.Windows.Forms.MessageBoxIcon]::Warning
)
if ($confirm -ne [System.Windows.Forms.DialogResult]::Yes) {
  exit 0
}

Start-Process -FilePath "schtasks.exe" -ArgumentList @("/End", "/TN", "AgilizaPDV Store Server", "/F") -Wait -NoNewWindow 2>$null | Out-Null
Get-Process -Name "AgilizaPDV" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$pgData = $pgDataDefault
$pgBin = Join-Path $ResourcesDir "windows\postgres\bin"
if (Test-Path $envFile) {
  $pgDataEnv = Get-EnvValue $envFile "PGDATA"
  if (-not [string]::IsNullOrWhiteSpace($pgDataEnv)) { $pgData = $pgDataEnv }
  $pgBinEnv = Get-EnvValue $envFile "PG_BIN"
  if (-not [string]::IsNullOrWhiteSpace($pgBinEnv)) { $pgBin = $pgBinEnv }
}

$pgCtl = Join-Path $pgBin "pg_ctl.exe"
if ((Test-Path $pgCtl) -and (Test-Path $pgData)) {
  try {
    & $pgCtl -D $pgData stop -m fast 2>$null | Out-Null
  } catch { }
}
Start-Sleep -Seconds 1

if (Test-Path $envFile) {
  $bak = "$envFile.bak." + (Get-Date -Format "yyyyMMdd-HHmmss")
  Copy-Item -Path $envFile -Destination $bak -Force
}

if (Test-Path $pgData) {
  Remove-Item -Path $pgData -Recurse -Force
}

if (Test-Path $envFile) {
  Remove-Item -Path $envFile -Force
}

$p = Start-Process -FilePath "powershell.exe" -ArgumentList @(
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $RuntimeScript,
  "-Mode", "server", "-InstallDir", $InstallDir, "-ResourcesDir", $ResourcesDir
) -Wait -PassThru
$exitCode = $p.ExitCode
if ($exitCode -ne 0) {
  $nl = [Environment]::NewLine
  $errMsg = 'A configuracao retornou codigo ' + [string]$exitCode + '.' + $nl + $nl + 'Tente botao direito neste arquivo > Executar como administrador.'
  [System.Windows.Forms.MessageBox]::Show(
    $errMsg,
    "Agiliza PDV",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Error
  ) | Out-Null
  exit 1
}

$okMsg = @'
Reparo concluido.

1) Abra de novo "Iniciar servidor da loja" (ou AgilizaPDV-StoreServer.cmd).
2) No navegador, confira se a URL abaixo mostra db ligado ao banco:
   http://127.0.0.1:3000/status
3) No PDV, use Acesso suporte para criar a empresa de novo se necessario.
'@
[System.Windows.Forms.MessageBox]::Show(
  $okMsg,
  "Agiliza PDV",
  [System.Windows.Forms.MessageBoxButtons]::OK,
  [System.Windows.Forms.MessageBoxIcon]::Information
) | Out-Null
