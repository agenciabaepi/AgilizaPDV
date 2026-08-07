import { CERT_PEPPER } from './config'

const PBKDF2_ITERATIONS = 120_000

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'))
}

async function deriveCertKey(empresaId: string): Promise<CryptoKey> {
  const salt = new TextEncoder().encode(`agiliza-cert-v1:${empresaId}`)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(CERT_PEPPER),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )
}

export async function decryptCertSenha(empresaId: string, stored: string): Promise<string | null> {
  const parts = stored.split(':')
  if (parts.length !== 3 || parts[0] !== 'v1') return null
  const [, ivB64, cipherB64] = parts
  if (!ivB64 || !cipherB64) return null
  try {
    const key = await deriveCertKey(empresaId)
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(ivB64) },
      key,
      base64ToBytes(cipherB64)
    )
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}
