const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..', '..')
const releaseDir = path.join(root, 'release')

function findLatestInstaller() {
  if (!fs.existsSync(releaseDir)) return null
  const versions = fs
    .readdirSync(releaseDir)
    .map((name) => path.join(releaseDir, name))
    .filter((p) => fs.statSync(p).isDirectory())
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)

  for (const versionDir of versions) {
    const files = fs
      .readdirSync(versionDir)
      .filter((f) => /Windows.*Setup\.exe$/i.test(f))
      .map((f) => path.join(versionDir, f))
    if (files.length > 0) return files[0]
  }
  return null
}

const installer = findLatestInstaller()

console.log('\n=== Proximos passos (homologacao Windows) ===\n')
if (installer) {
  console.log(`Instalador gerado: ${installer}\n`)
} else {
  console.log('Instalador nao encontrado em release/. Verifique o build.\n')
}

console.log('1) Maquina A (Servidor)')
console.log('   - Execute o setup e selecione "Servidor".')
console.log('   - Valide:')
console.log('     schtasks /Query /TN "AgilizaPDV Store Server"')
console.log('     Test-NetConnection localhost -Port 3000')
console.log('     Invoke-RestMethod http://localhost:3000/health')
console.log('')
console.log('2) Maquina B (Terminal)')
console.log('   - Execute o setup e selecione "Computador terminal".')
console.log('   - No app, suporte -> Configuracoes -> "Descobrir automaticamente".')
console.log('')
console.log('3) Smoke test API (no servidor)')
console.log('   - powershell -ExecutionPolicy Bypass -File scripts/windows/homologacao-smoke.ps1')
console.log('')
console.log('Checklist completo:')
console.log('   - docs/windows-homologacao-servidor-terminal.md')
console.log('')
