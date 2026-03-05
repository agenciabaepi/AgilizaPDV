const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..', '..')
const binDir = path.join(root, 'build', 'windows', 'postgres', 'bin')

const required = [
  'postgres.exe',
  'pg_ctl.exe',
  'initdb.exe',
  'psql.exe',
  'createdb.exe'
]

function exists(file) {
  return fs.existsSync(path.join(binDir, file))
}

const missing = required.filter((f) => !exists(f))

if (missing.length > 0) {
  console.error('\n[AgilizaPDV] ERRO: binarios do PostgreSQL embarcado ausentes.')
  console.error(`[AgilizaPDV] Pasta esperada: ${binDir}`)
  console.error('[AgilizaPDV] Arquivos faltando:')
  for (const f of missing) console.error(`  - ${f}`)
  console.error('\nCopie os binarios para build/windows/postgres/bin antes de rodar build:win.\n')
  process.exit(1)
}

console.log('[AgilizaPDV] PostgreSQL embarcado OK.')

