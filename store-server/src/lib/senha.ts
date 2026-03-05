import { pbkdf2Sync, randomBytes } from 'crypto'

const SALT_BYTES = 16
const HASH_ITERATIONS = 100000
const HASH_KEYLEN = 64

export function hashSenha(senha: string): string {
  const salt = randomBytes(SALT_BYTES)
  const hash = pbkdf2Sync(senha, salt, HASH_ITERATIONS, HASH_KEYLEN, 'sha256')
  return `${salt.toString('base64')}:${hash.toString('base64')}`
}

export function verificarSenha(senha: string, stored: string): boolean {
  const [saltB64, hashB64] = stored.split(':')
  if (!saltB64 || !hashB64) return false
  const salt = Buffer.from(saltB64, 'base64')
  const hash = pbkdf2Sync(senha, salt, HASH_ITERATIONS, HASH_KEYLEN, 'sha256')
  return hash.toString('base64') === hashB64
}
