/**
 * Cria empresa e usuário de teste no mesmo banco que o Electron usa.
 * Uso: node scripts/seed-test-user.cjs
 *
 * Credenciais: Empresa "Empresa Teste" → login: admin, senha: admin
 */

const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APP_NAME = 'agiliza-pdv'

function getUserDataPath() {
  const home = process.env.HOME || process.env.USERPROFILE || ''
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', APP_NAME)
  }
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || home, APP_NAME)
  }
  return path.join(home, '.config', APP_NAME)
}

function hashSenha(senha) {
  const salt = crypto.randomBytes(16)
  const hash = crypto.pbkdf2Sync(senha, salt, 100000, 64, 'sha256')
  return `${salt.toString('base64')}:${hash.toString('base64')}`
}

function runMigrations(db, migrationsDir) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `)
  const applied = new Set(
    db.prepare('SELECT filename FROM _migrations').all().map((r) => r.filename)
  )
  if (!fs.existsSync(migrationsDir)) {
    console.error('Pasta de migrations não encontrada:', migrationsDir)
    process.exit(1)
  }
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  const insert = db.prepare('INSERT INTO _migrations (filename) VALUES (?)')
  for (const filename of files) {
    if (applied.has(filename)) continue
    const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf-8')
    db.exec(sql)
    insert.run(filename)
    console.log('Migration aplicada:', filename)
  }
}

function main() {
  const userDataPath = getUserDataPath()
  const dbPath = path.join(userDataPath, 'pdv.db')
  const migrationsDir = path.join(__dirname, '..', 'backend', 'db', 'migrations')

  console.log('Banco:', dbPath)

  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true })
  }

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db, migrationsDir)

  const empresas = db.prepare('SELECT id, nome FROM empresas').all()
  if (empresas.length > 0) {
    console.log('Já existem empresas no banco. Para criar usuário de teste, use a tela de login (primeira configuração) ou apague o banco e rode o script de novo.')
    const admins = db.prepare(
      "SELECT login FROM usuarios WHERE role = 'admin'"
    ).all()
    if (admins.length > 0) {
      console.log('Usuários admin existentes:', admins.map((u) => u.login).join(', '))
    }
    db.close()
    return
  }

  const empresaId = crypto.randomUUID()
  db.prepare(
    'INSERT INTO empresas (id, nome, cnpj) VALUES (?, ?, ?)'
  ).run(empresaId, 'Empresa Teste', null)
  console.log('Empresa criada: Empresa Teste')

  const usuarioId = crypto.randomUUID()
  const senhaHash = hashSenha('admin')
  db.prepare(
    'INSERT INTO usuarios (id, empresa_id, nome, login, senha_hash, role) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(usuarioId, empresaId, 'Admin', 'admin', senhaHash, 'admin')
  console.log('Usuário criado: admin / admin')

  db.close()
  console.log('\nPronto. Rode "npm run dev" e faça login com:')
  console.log('  Empresa: Empresa Teste')
  console.log('  Login:   admin')
  console.log('  Senha:   admin')
}

main()
