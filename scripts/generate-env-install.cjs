/**
 * Gera env.install a partir do .env da raiz do projeto para o instalador já incluir .env preenchido.
 * Uso: node scripts/generate-env-install.cjs
 * Requer: arquivo .env na raiz com SUPABASE_URL e SUPABASE_ANON_KEY (ou variáveis de ambiente).
 */

const path = require('path')
const fs = require('fs')

const root = process.cwd()
const envPath = path.join(root, '.env')
const outPath = path.join(root, 'env.install')

// Carrega variáveis: primeiro do .env, depois process.env (CI/export sobrescreve)
function loadVars() {
  const vars = {}
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8')
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (m) vars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  }
  return {
    SUPABASE_URL: process.env.SUPABASE_URL || vars.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || vars.SUPABASE_ANON_KEY || ''
  }
}

const { SUPABASE_URL, SUPABASE_ANON_KEY } = loadVars()

const hasKeys = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
if (!hasKeys) {
  console.warn('[generate-env-install] SUPABASE_URL ou SUPABASE_ANON_KEY não definidos. Gerando env.install em branco (instalador funcionará; configure Supabase depois).')
}

const content = `# Gerado automaticamente pelo build. Não edite manualmente.
# Para o instalador incluir .env já preenchido, defina SUPABASE_URL e SUPABASE_ANON_KEY no .env da raiz ou em variáveis de ambiente antes do build.

SUPABASE_URL=${SUPABASE_URL || ''}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY || ''}
`

fs.writeFileSync(outPath, content, 'utf8')
console.log('[generate-env-install] env.install gerado com sucesso.')
process.exit(0)
