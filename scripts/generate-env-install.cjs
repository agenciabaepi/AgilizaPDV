/**
 * Gera env.install para o instalador incluir na primeira execução do app.
 * - Com SUPABASE_URL e SUPABASE_ANON_KEY (do .env ou variáveis de ambiente): gera env.install preenchido.
 * - Sem elas (ex.: CI sem secrets): gera env.install vazio e o build continua; o app instalado mostrará "Supabase não configurado" até configurar.
 */

const path = require('path')
const fs = require('fs')

const root = process.cwd()
const envPath = path.join(root, '.env')
const outPath = path.join(root, 'env.install')

function trimValue(s) {
  if (typeof s !== 'string') return ''
  return s.replace(/\r$/g, '').trim().replace(/^["']|["']$/g, '')
}

function loadVars() {
  const vars = {}
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (m) vars[m[1].trim()] = trimValue(m[2])
    }
  }
  return {
    SUPABASE_URL: trimValue(process.env.SUPABASE_URL || vars.SUPABASE_URL || ''),
    SUPABASE_ANON_KEY: trimValue(process.env.SUPABASE_ANON_KEY || vars.SUPABASE_ANON_KEY || '')
  }
}

const { SUPABASE_URL, SUPABASE_ANON_KEY } = loadVars()
const hasKeys = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

if (!hasKeys) {
  console.warn('[generate-env-install] SUPABASE_URL ou SUPABASE_ANON_KEY não definidos (.env ou env). env.install será gerado vazio; o build continua. No app instalado configure Supabase depois, ou defina as variáveis no CI (secrets) para o instalador já vir configurado.')
}

const content = `# Gerado automaticamente pelo build.

SUPABASE_URL=${SUPABASE_URL || ''}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY || ''}
`

fs.writeFileSync(outPath, content, 'utf8')
console.log(hasKeys ? '[generate-env-install] env.install gerado com SUPABASE_URL e SUPABASE_ANON_KEY.' : '[generate-env-install] env.install gerado (valores em branco).')

// Gera também o módulo que o app importa em runtime (assim o instalado já vem configurado)
const genPath = path.join(root, 'electron', 'supabase-config.generated.ts')
const genContent = `/** Gerado pelo build - não edite. Valores vêm do .env ou variáveis de ambiente no build. */
export const SUPABASE_URL = ${JSON.stringify(SUPABASE_URL)}
export const SUPABASE_ANON_KEY = ${JSON.stringify(SUPABASE_ANON_KEY)}
`
fs.writeFileSync(genPath, genContent, 'utf8')
console.log('[generate-env-install] supabase-config.generated.ts atualizado.')
