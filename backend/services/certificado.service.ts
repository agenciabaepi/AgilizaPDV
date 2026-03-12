import { getDb } from '../db'

export type CertificadoInfo = {
  empresa_id: string
  caminho_arquivo: string
  has_senha: boolean
  updated_at: string
}

/** Retorna informações do certificado (sem descriptografar a senha). */
export function getCertificadoInfo(empresaId: string): CertificadoInfo | null {
  const db = getDb()
  if (!db) return null
  const row = db
    .prepare(
      'SELECT empresa_id, caminho_arquivo, senha_encrypted, updated_at FROM empresa_certificado WHERE empresa_id = ?'
    )
    .get(empresaId) as
    | { empresa_id: string; caminho_arquivo: string; senha_encrypted: string | null; updated_at: string }
    | undefined
  if (!row) return null
  return {
    empresa_id: row.empresa_id,
    caminho_arquivo: row.caminho_arquivo,
    has_senha: row.senha_encrypted != null && row.senha_encrypted.length > 0,
    updated_at: row.updated_at,
  }
}

/** Salva ou atualiza o registro do certificado. Senha já deve vir criptografada (string do safeStorage). */
export function saveCertificado(
  empresaId: string,
  caminhoArquivo: string,
  senhaEncrypted: string | null
): CertificadoInfo | null {
  const db = getDb()
  if (!db) return null
  db.prepare(
    `INSERT INTO empresa_certificado (empresa_id, caminho_arquivo, senha_encrypted, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(empresa_id) DO UPDATE SET
       caminho_arquivo = excluded.caminho_arquivo,
       senha_encrypted = excluded.senha_encrypted,
       updated_at = datetime('now')`
  ).run(empresaId, caminhoArquivo, senhaEncrypted)
  return getCertificadoInfo(empresaId)
}

/** Retorna o certificado com senha_encrypted para descriptografia no processo main. */
export function getCertificadoRaw(empresaId: string): {
  caminho_arquivo: string
  senha_encrypted: string | null
} | null {
  const db = getDb()
  if (!db) return null
  const row = db
    .prepare('SELECT caminho_arquivo, senha_encrypted FROM empresa_certificado WHERE empresa_id = ?')
    .get(empresaId) as { caminho_arquivo: string; senha_encrypted: string | null } | undefined
  return row ?? null
}

/** Remove o registro do certificado (o arquivo .pfx deve ser removido pelo chamador). */
export function removeCertificado(empresaId: string): boolean {
  const db = getDb()
  if (!db) return false
  const result = db.prepare('DELETE FROM empresa_certificado WHERE empresa_id = ?').run(empresaId)
  return result.changes > 0
}
