$ErrorActionPreference = "SilentlyContinue"

$outDir = Join-Path $env:TEMP ("agiliza-diagnostico-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

"=== INFO SISTEMA ===" | Out-File (Join-Path $outDir "sistema.txt")
Get-ComputerInfo | Out-File -Append (Join-Path $outDir "sistema.txt")

"=== TAREFA STORE SERVER ===" | Out-File (Join-Path $outDir "runtime.txt")
schtasks /Query /TN "AgilizaPDV Store Server" /V /FO LIST | Out-File -Append (Join-Path $outDir "runtime.txt")

"=== FIREWALL ===" | Out-File -Append (Join-Path $outDir "runtime.txt")
netsh advfirewall firewall show rule name="AgilizaPDV Store Server" | Out-File -Append (Join-Path $outDir "runtime.txt")

"=== PROCESSOS ===" | Out-File -Append (Join-Path $outDir "runtime.txt")
Get-Process | Where-Object { $_.ProcessName -match "AgilizaPDV|postgres" } | Format-Table -AutoSize | Out-File -Append (Join-Path $outDir "runtime.txt")

"=== TESTE PORTA 3000 ===" | Out-File -Append (Join-Path $outDir "runtime.txt")
Test-NetConnection -ComputerName localhost -Port 3000 | Out-File -Append (Join-Path $outDir "runtime.txt")

$envFile = Join-Path $env:ProgramData "AgilizaPDV\\store-server.env"
if (Test-Path $envFile) {
  Copy-Item $envFile (Join-Path $outDir "store-server.env.txt") -Force
}

$zip = "$outDir.zip"
Compress-Archive -Path "$outDir\\*" -DestinationPath $zip -Force
Write-Host "Diagnostico gerado em: $zip" -ForegroundColor Green

