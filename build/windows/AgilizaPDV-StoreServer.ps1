# Launcher manual: inicia API + WebSocket (porta 3000) sem depender do Agendador de Tarefas.
# Instalado na mesma pasta que AgilizaPDV.exe (duplo clique ou atalho "Iniciar servidor da loja").
$ErrorActionPreference = "Stop"
$InstallDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppExe = Join-Path $InstallDir "AgilizaPDV.exe"
$EnvFile = Join-Path $env:ProgramData "AgilizaPDV\store-server.env"
$StartScript = Join-Path $InstallDir "resources\windows\start-store-server.ps1"

if (-not (Test-Path $AppExe)) {
  Write-Host "AgilizaPDV.exe nao encontrado em: $InstallDir" -ForegroundColor Red
  Read-Host "Enter para fechar"
  exit 1
}
if (-not (Test-Path $StartScript)) {
  Write-Host "Pacote incompleto (falta $StartScript)." -ForegroundColor Red
  Read-Host "Enter para fechar"
  exit 1
}
if (-not (Test-Path $EnvFile)) {
  Write-Host "Aviso: $EnvFile nao encontrado. Instale no modo Servidor ou crie o arquivo com DATABASE_URL e PORT." -ForegroundColor Yellow
}

try {
  & $StartScript -AppExe $AppExe -EnvFile $EnvFile -PreferNode
} catch {
  Write-Host ""
  Write-Host $_.Exception.Message -ForegroundColor Red
  Read-Host "Enter para fechar"
  exit 1
}
