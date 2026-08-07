/**
 * Criptografia da senha do certificado A1 no modo web (AES-GCM via Web Crypto API).
 * A chave é derivada por empresa — não armazena a senha em texto puro no banco.
 */
import { SUPABASE_ANON_KEY } from './supabase'

const PBKDF2_ITERATIONS = 120_000

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

function certPepper(): string {
  return (
    import.meta.env.VITE_CERT_ENCRYPT_KEY?.trim() ||
    SUPABASE_ANON_KEY ||
    'agiliza-pdv-cert-default-pepper'
  )
}

async function deriveCertKey(empresaId: string): Promise<CryptoKey> {
  const salt = new TextEncoder().encode(`agiliza-cert-v1:${empresaId}`)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(certPepper()),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/** Formato: `v1:<iv_b64>:<cipher_b64>` */
export async function encryptCertSenha(empresaId: string, senha: string): Promise<string> {
  const key = await deriveCertKey(empresaId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(senha)
  )
  return `v1:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(cipher))}`
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
