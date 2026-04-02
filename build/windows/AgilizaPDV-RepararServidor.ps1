# Reparo: embarcado = recria cluster; global = alinha senha postgres + store-server.env
# Texto ASCII nas strings criticas (PowerShell 5.1 / encoding Windows).
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms | Out-Null
Add-Type -AssemblyName Microsoft.VisualBasic | Out-Null

$InstallDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ResourcesDir = Join-Path $InstallDir "resources"
$RuntimeScript = Join-Path $ResourcesDir "windows\install-runtime.ps1"
$AppExe = Join-Path $InstallDir "AgilizaPDV.exe"

$programData = Join-Path $env:ProgramData "AgilizaPDV"
$envFile = Join-Path $programData "store-server.env"
$serverRoot = Join-Path $programData "server"
$pgDataDefault = Join-Path $serverRoot "postgres\data"

function Test-IsAdministrator {
  $wi = [Security.Principal.WindowsIdentity]::GetCurrent()
  $wp = New-Object Security.Principal.WindowsPrincipal($wi)
  return $wp.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

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

function Find-PsqlPath {
  $cmd = Get-Command psql -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }
  foreach ($v in @("16", "15", "14", "13")) {
    $p = "C:\Program Files\PostgreSQL\$v\bin\psql.exe"
    if (Test-Path $p) { return $p }
  }
  return $null
}

function Get-PostgresDataDirectory {
  $svc = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*postgres*' } | Select-Object -First 1
  if ($svc) {
    $key = "HKLM:\SYSTEM\CurrentControlSet\Services\$($svc.Name)"
    if (Test-Path $key) {
      $img = (Get-ItemProperty $key -ErrorAction SilentlyContinue).ImagePath
      if ($img) {
        if ($img -match '-D\s+"([^"]+)"') { return $matches[1] }
        if ($img -match "-D\s+(\S+)") { return $matches[1].Trim('"') }
      }
    }
  }
  foreach ($regRoot in @("HKLM:\SOFTWARE\PostgreSQL\Installations", "HKLM:\SOFTWARE\WOW6432Node\PostgreSQL\Installations")) {
    if (-not (Test-Path $regRoot)) { continue }
    Get-ChildItem $regRoot -ErrorAction SilentlyContinue | ForEach-Object {
      $p = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
      $dd = $p.'Data Directory'
      if ($dd -and (Test-Path (Join-Path $dd "pg_hba.conf"))) { return $dd }
    }
  }
  foreach ($v in @("16", "15", "14")) {
    $dd = "C:\Program Files\PostgreSQL\$v\data"
    if (Test-Path (Join-Path $dd "pg_hba.conf")) { return $dd }
  }
  return $null
}

function Get-PostgresServiceName {
  $s = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*postgres*' } | Select-Object -First 1
  if ($s) { return $s.Name }
  return $null
}

function Escape-SqlPasswordForLiteral([string]$s) {
  return $s.Replace("'", "''")
}

function Write-StoreServerEnvGlobal([string]$Path, [string]$PlainPassword) {
  New-Item -ItemType Directory -Force -Path (Split-Path $Path -Parent) | Out-Null
  $enc = [System.Uri]::EscapeDataString($PlainPassword)
  $dbUrl = "postgresql://postgres:${enc}@127.0.0.1:5432/agiliza_pdv"
  $lines = @(
    "PG_MODE=global",
    "DATABASE_URL=$dbUrl",
    "PORT=3000",
    "AGILIZA_SERVER_NAME=AGILIZA-SERVER"
  )
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllLines($Path, $lines, $utf8)
}

# Copia antiga aqui sobrescrevia ProgramData no Electron (dotenv override).
function Remove-StaleUserDataStoreServerEnv {
  $ud = Join-Path $env:APPDATA "agiliza-pdv\store-server.env"
  if (-not (Test-Path $ud)) { return }
  $bak = $ud + ".removido." + (Get-Date -Format "yyyyMMddHHmmss")
  Copy-Item $ud $bak -Force -ErrorAction SilentlyContinue
  Remove-Item $ud -Force -ErrorAction SilentlyContinue
}

function Test-PgConnection([string]$Psql, [string]$Password) {
  $env:PGPASSWORD = $Password
  $r = & $Psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -tAc "SELECT 1" 2>&1
  return ($LASTEXITCODE -eq 0)
}

function Ensure-AgilizaDatabase([string]$Psql, [string]$Password) {
  $env:PGPASSWORD = $Password
  $exists = & $Psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='agiliza_pdv';" 2>&1
  if ($exists -ne "1") {
    & $Psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "CREATE DATABASE agiliza_pdv;" 2>&1 | Out-Null
  }
}

function Invoke-GlobalRepair {
  $ok = $false
  $psql = Find-PsqlPath
  if (-not $psql) {
    [System.Windows.Forms.MessageBox]::Show(
      "Nao encontrei psql.exe (PostgreSQL). Instale o PostgreSQL para Windows ou reinstale o Agiliza PDV em modo servidor.",
      "Agiliza PDV",
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
    return $false
  }

  $go = [System.Windows.Forms.MessageBox]::Show(
    "Este PC usa PostgreSQL do Windows (modo global).`n`nVamos definir uma senha NOVA para o usuario postgres, atualizar o arquivo store-server.env e garantir o banco agiliza_pdv.`n`nContinuar?",
    "Agiliza PDV - Reparar (global)",
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Question
  )
  if ($go -ne [System.Windows.Forms.DialogResult]::Yes) { return $false }

  $newPass = [Guid]::NewGuid().ToString("N").Substring(0, 16) + "a1"

  $currentPw = [Microsoft.VisualBasic.Interaction]::InputBox(
    "Digite a senha ATUAL do usuario postgres (a do PostgreSQL no Windows).`n`nSe NAO souber: deixe em branco e clique OK - o assistente tentara modo automatico (precisa deste script como Administrador).",
    "Agiliza PDV - Senha atual postgres",
    ""
  )

  $usedTrust = $false
  $pghbaPath = $null
  $pghbaBackup = $null

  try {
    if (-not [string]::IsNullOrWhiteSpace($currentPw)) {
      if (-not (Test-PgConnection $psql $currentPw)) {
        $retry = [System.Windows.Forms.MessageBox]::Show(
          "A senha informada nao conectou no PostgreSQL.`n`nTentar modo automatico (Administrador / pg_hba)?",
          "Agiliza PDV",
          [System.Windows.Forms.MessageBoxButtons]::YesNo,
          [System.Windows.Forms.MessageBoxIcon]::Question
        )
        if ($retry -ne [System.Windows.Forms.DialogResult]::Yes) { return $false }
        $currentPw = $null
      }
    }

    if ([string]::IsNullOrWhiteSpace($currentPw)) {
      if (-not (Test-IsAdministrator)) {
        [System.Windows.Forms.MessageBox]::Show(
          "Sem a senha atual, o reparo precisa alterar pg_hba.conf e reiniciar o servico PostgreSQL.`n`nFeche esta janela, clique com o botao direito em AgilizaPDV-RepararServidor.cmd e escolha Executar como administrador.",
          "Agiliza PDV",
          [System.Windows.Forms.MessageBoxButtons]::OK,
          [System.Windows.Forms.MessageBoxIcon]::Warning
        ) | Out-Null
        return $false
      }
      $dataDir = Get-PostgresDataDirectory
      if (-not $dataDir) {
        [System.Windows.Forms.MessageBox]::Show("Nao encontrei a pasta data do PostgreSQL (pg_hba.conf).", "Agiliza PDV", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
        return $false
      }
      $pghbaPath = Join-Path $dataDir "pg_hba.conf"
      if (-not (Test-Path $pghbaPath)) {
        [System.Windows.Forms.MessageBox]::Show("Arquivo pg_hba.conf nao encontrado.", "Agiliza PDV", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
        return $false
      }
      $pghbaBackup = $pghbaPath + ".agiliza-bak." + (Get-Date -Format "yyyyMMddHHmmss")
      Copy-Item $pghbaPath $pghbaBackup -Force
      $trustLine = "host    all    all    127.0.0.1/32    trust`n"
      $utf8NoBom = New-Object System.Text.UTF8Encoding $false
      [System.IO.File]::WriteAllText($pghbaPath, $trustLine + [System.IO.File]::ReadAllText($pghbaPath), $utf8NoBom)
      $usedTrust = $true
      $svcName = Get-PostgresServiceName
      if (-not $svcName) {
        throw "Servico PostgreSQL nao encontrado."
      }
      Restart-Service -Name $svcName -Force
      Start-Sleep -Seconds 3
      $env:PGPASSWORD = $null
      $lit = Escape-SqlPasswordForLiteral $newPass
      $sql = "ALTER USER postgres WITH PASSWORD '$lit';"
      $sql | & $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres 2>&1 | Out-Null
      if ($LASTEXITCODE -ne 0) {
        throw "Falha ao executar ALTER USER postgres."
      }
    } else {
      $lit = Escape-SqlPasswordForLiteral $newPass
      $sql = "ALTER USER postgres WITH PASSWORD '$lit';"
      $env:PGPASSWORD = $currentPw
      $sql | & $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres 2>&1 | Out-Null
      if ($LASTEXITCODE -ne 0) {
        [System.Windows.Forms.MessageBox]::Show("Falha ao alterar senha (ALTER USER).", "Agiliza PDV", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
        return $false
      }
    }

    Ensure-AgilizaDatabase $psql $newPass
    if (Test-Path $envFile) {
      Copy-Item $envFile ($envFile + ".bak." + (Get-Date -Format "yyyyMMddHHmmss")) -Force
    }
    Write-StoreServerEnvGlobal $envFile $newPass
    $ok = $true
  } finally {
    if ($usedTrust -and $pghbaBackup -and (Test-Path $pghbaBackup) -and $pghbaPath) {
      Copy-Item $pghbaBackup $pghbaPath -Force
      $svcName = Get-PostgresServiceName
      if ($svcName) {
        try { Restart-Service -Name $svcName -Force } catch { }
      }
      Start-Sleep -Seconds 2
    }
  }
  if (-not $ok) { return $false }
  Start-Sleep -Seconds 2
  if (-not (Test-PgConnection $psql $newPass)) {
    [System.Windows.Forms.MessageBox]::Show(
      "A nova senha nao conectou no Postgres apos o reparo (127.0.0.1:5432). Reinicie o servico PostgreSQL e tente de novo.",
      "Agiliza PDV",
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
    return $false
  }
  Remove-StaleUserDataStoreServerEnv
  return $true
}

function Show-RepairOk {
  $okMsg = @'
Reparo concluido.

1) Abra de novo "Iniciar servidor da loja" (ou AgilizaPDV-StoreServer.cmd).
2) No navegador: http://127.0.0.1:3000/status (deve mostrar db ok).
3) No PDV, use Acesso suporte se precisar recriar empresa.
'@
  [System.Windows.Forms.MessageBox]::Show($okMsg, "Agiliza PDV", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
}

if (-not (Test-Path $AppExe)) {
  [System.Windows.Forms.MessageBox]::Show(
    "Nao encontrei AgilizaPDV.exe nesta pasta.",
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
    "OK",
    "Error"
  ) | Out-Null
  exit 1
}

$pgMode = if (Test-Path $envFile) { Get-EnvValue $envFile "PG_MODE" } else { $null }

if ($pgMode -eq "global") {
  $ok = Invoke-GlobalRepair
  if ($ok) { Show-RepairOk }
  exit $(if ($ok) { 0 } else { 1 })
}

$confirm = [System.Windows.Forms.MessageBox]::Show(
  "ISTO APAGA TODOS OS DADOS DA LOJA NESTE COMPUTADOR (banco embarcado).`n`nDepois o sistema cria banco e senha novos.`n`nContinuar?",
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
  try { & $pgCtl -D $pgData stop -m fast 2>$null | Out-Null } catch { }
}
Start-Sleep -Seconds 1

if (Test-Path $envFile) {
  Copy-Item -Path $envFile -Destination ($envFile + ".bak." + (Get-Date -Format "yyyyMMdd-HHmmss")) -Force
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
if ($p.ExitCode -ne 0) {
  $nl = [Environment]::NewLine
  $errMsg = 'Configuracao retornou codigo ' + [string]$p.ExitCode + '.' + $nl + $nl + 'Tente Executar como administrador.'
  [System.Windows.Forms.MessageBox]::Show($errMsg, "Agiliza PDV", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
  exit 1
}

Remove-StaleUserDataStoreServerEnv
Show-RepairOk
