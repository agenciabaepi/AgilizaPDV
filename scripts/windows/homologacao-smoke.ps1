param(
  [string]$ServerUrl = "http://localhost:3000",
  [string]$EmpresaId = "",
  [string]$Login = "admin",
  [string]$Senha = "admin"
)

$ErrorActionPreference = "Stop"

function Log([string]$m) { Write-Host "[SMOKE] $m" }

Log "Health check"
$health = Invoke-RestMethod "$ServerUrl/health"
if (-not $health.ok) { throw "Health falhou" }

if ([string]::IsNullOrWhiteSpace($EmpresaId)) {
  Log "Listando empresas"
  $empresas = Invoke-RestMethod "$ServerUrl/empresas"
  if ($empresas.Count -eq 0) { throw "Nenhuma empresa no servidor" }
  $EmpresaId = $empresas[0].id
}

Log "Fazendo login"
$loginResp = Invoke-RestMethod -Method Post -Uri "$ServerUrl/auth/login" -ContentType "application/json" -Body (@{ empresaId=$EmpresaId; login=$Login; senha=$Senha } | ConvertTo-Json)
if (-not $loginResp.sessionId) { throw "Login sem sessionId" }
$headers = @{ Authorization = "Bearer $($loginResp.sessionId)" }

Log "Listando produtos"
$produtos = Invoke-RestMethod -Headers $headers "$ServerUrl/produtos?empresaId=$EmpresaId"
Log "Produtos encontrados: $($produtos.Count)"

Log "Listando categorias"
$categorias = Invoke-RestMethod -Headers $headers "$ServerUrl/categorias?empresaId=$EmpresaId"
Log "Categorias encontradas: $($categorias.Count)"

Log "Checando sincronizacao"
$pending = Invoke-RestMethod -Headers $headers "$ServerUrl/sync/pending-count"
$errors = Invoke-RestMethod -Headers $headers "$ServerUrl/sync/error-count"
Log "Pending=$pending | Errors=$errors"

Write-Host "`nSMOKE TEST OK" -ForegroundColor Green

