$ErrorActionPreference = "SilentlyContinue"

schtasks.exe /Delete /TN "AgilizaPDV Store Server" /F | Out-Null
netsh advfirewall firewall delete rule name="AgilizaPDV Store Server" | Out-Null

$envFile = Join-Path $env:ProgramData "AgilizaPDV\store-server.env"
if (Test-Path $envFile) {
  $kv = @{}
  Get-Content $envFile | ForEach-Object {
    if ([string]::IsNullOrWhiteSpace($_)) { return }
    if ($_.TrimStart().StartsWith("#")) { return }
    $parts = $_.Split("=", 2)
    if ($parts.Count -eq 2) { $kv[$parts[0]] = $parts[1] }
  }
  if ($kv.ContainsKey("PG_BIN") -and $kv.ContainsKey("PGDATA")) {
    $pgCtl = Join-Path $kv["PG_BIN"] "pg_ctl.exe"
    if (Test-Path $pgCtl) {
      & $pgCtl -D $kv["PGDATA"] stop -m fast | Out-Null
    }
  }
}

exit 0

