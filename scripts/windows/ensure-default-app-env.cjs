#!/usr/bin/env node
/**
 * Gera build/windows/default-app.env a partir do .env do projeto (SUPABASE_URL e SUPABASE_ANON_KEY)
 * para o instalador Windows preencher o .env do app na instalação.
 * Uso: node scripts/windows/ensure-default-app-env.cjs
 * Requer: .env na raiz com SUPABASE_URL e SUPABASE_ANON_KEY, ou variáveis de ambiente.
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../..')
const envPath = path.join(root, '.env')
const outPath = path.join(root, 'build', 'windows', 'default-app.env')

let supabaseUrl = process.env.SUPABASE_URL || ''
let supabaseAnonKey = process.env.SUPABASE_ANON_KEY || ''

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*SUPABASE_URL=(.+)$/)
    if (m) supabaseUrl = (m[1] || '').trim()
    const k = line.match(/^\s*SUPABASE_ANON_KEY=(.+)$/)
    if (k) supabaseAnonKey = (k[1] || '').trim()
  }
}

const dir = path.dirname(outPath)
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

const out = [
  '# Gerado no build. Usado pelo instalador para preencher o .env do app.',
  `SUPABASE_URL=${supabaseUrl}`,
  `SUPABASE_ANON_KEY=${supabaseAnonKey}`
].join('\n') + '\n'

fs.writeFileSync(outPath, out, 'utf8')
console.log('[ensure-default-app-env] Escrito build/windows/default-app.env')
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[ensure-default-app-env] Aviso: SUPABASE_URL ou SUPABASE_ANON_KEY vazios. Preencha o .env na raiz antes do build para o instalador deixar o app já configurado.')
}
