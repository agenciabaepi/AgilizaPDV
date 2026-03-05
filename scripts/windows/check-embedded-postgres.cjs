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
const strict = process.argv.includes('--strict') || process.env.REQUIRE_EMBEDDED_POSTGRES === '1'

if (missing.length > 0) {
  if (strict) {
    console.error('\n[AgilizaPDV] ERRO: binarios do PostgreSQL embarcado ausentes.')
    console.error(`[AgilizaPDV] Pasta esperada: ${binDir}`)
    console.error('[AgilizaPDV] Arquivos faltando:')
    for (const f of missing) console.error(`  - ${f}`)
    console.error('\nCopie os binarios para build/windows/postgres/bin antes de rodar build:win.\n')
    process.exit(1)
  }
  console.warn('\n[AgilizaPDV] AVISO: PostgreSQL embarcado ausente.')
  console.warn('[AgilizaPDV] O instalador tentará fallback para PostgreSQL global (instalador local/winget).')
  console.warn(`[AgilizaPDV] Pasta esperada para embedded: ${binDir}`)
  for (const f of missing) console.warn(`  - faltando: ${f}`)
  console.warn('')
  process.exit(0)
}

console.log('[AgilizaPDV] PostgreSQL embarcado OK.')

