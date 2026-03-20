/**
 * Verifica senha usando PBKDF2-HMAC-SHA256 via Web Crypto API.
 * Compatível com o hashSenha/verificarSenha do backend (backend/lib/senha.ts).
 * Formato: `${salt.toString('base64')}:${hash.toString('base64')}`
 */
export async function verificarSenhaWeb(senha: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  if (parts.length !== 2) return false
  const [saltB64, hashB64] = parts.map((p) => p.trim())
  if (!saltB64 || !hashB64) return false

  try {
    const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0))
    const expectedHashBytes = Uint8Array.from(atob(hashB64), (c) => c.charCodeAt(0))

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(senha),
      'PBKDF2',
      false,
      ['deriveBits']
    )

    const derivedBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      512 // 64 bytes
    )

    const derivedBytes = new Uint8Array(derivedBits)
    if (derivedBytes.length !== expectedHashBytes.length) return false

    // Comparação em tempo constante
    let diff = 0
    for (let i = 0; i < derivedBytes.length; i++) {
      diff |= derivedBytes[i] ^ expectedHashBytes[i]
    }
    return diff === 0
  } catch {
    return false
  }
}
