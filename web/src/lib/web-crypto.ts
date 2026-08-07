/**
 * Hash e verificação de senha usando PBKDF2-HMAC-SHA256 via Web Crypto API.
 * Compatível com o hashSenha/verificarSenha do backend (backend/lib/senha.ts).
 * Formato: `${salt.toString('base64')}:${hash.toString('base64')}`
 */
const PBKDF2_ITERATIONS = 100000
const PBKDF2_HASH_BITS = 512

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function derivePbkdf2Bytes(senha: string, salt: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(senha),
    'PBKDF2',
    false,
    ['deriveBits']
  )

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    PBKDF2_HASH_BITS
  )

  return new Uint8Array(derivedBits)
}

export async function hashSenhaWeb(senha: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hashBytes = await derivePbkdf2Bytes(senha, salt)
  return `${bytesToBase64(salt)}:${bytesToBase64(hashBytes)}`
}

export async function verificarSenhaWeb(senha: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  if (parts.length !== 2) return false
  const [saltB64, hashB64] = parts.map((p) => p.trim())
  if (!saltB64 || !hashB64) return false

  try {
    const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0))
    const expectedHashBytes = Uint8Array.from(atob(hashB64), (c) => c.charCodeAt(0))
    const derivedBytes = await derivePbkdf2Bytes(senha, salt)

    if (derivedBytes.length !== expectedHashBytes.length) return false

    let diff = 0
    for (let i = 0; i < derivedBytes.length; i++) {
      diff |= derivedBytes[i] ^ expectedHashBytes[i]
    }
    return diff === 0
  } catch {
    return false
  }
}
