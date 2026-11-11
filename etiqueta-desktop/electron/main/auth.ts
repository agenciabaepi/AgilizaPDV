import { getSupabase } from './supabase'
import { verificarSenha } from './senha'

export type UsuarioSession = {
  id: string
  empresa_id: string
  nome: string
  login: string
  email?: string | null
  role: string
  created_at: string
}

function rowToSession(row: Record<string, unknown>): UsuarioSession {
  return {
    id: String(row.id),
    empresa_id: String(row.empresa_id),
    nome: String(row.nome ?? ''),
    login: String(row.login ?? ''),
    email: (row.email as string | null | undefined) ?? null,
    role: String(row.role ?? 'admin'),
    created_at: String(row.created_at ?? new Date().toISOString())
  }
}

async function selectByEmailOrLogin(normalized: string): Promise<Record<string, unknown>[]> {
  const supabase = getSupabase()
  const selectFields =
    'id, empresa_id, nome, login, email, role, created_at, senha_hash'

  const byEmail = await supabase.from('usuarios').select(selectFields).ilike('email', normalized)
  if (!byEmail.error && (byEmail.data?.length ?? 0) > 0) {
    return byEmail.data as Record<string, unknown>[]
  }

  const byLogin = await supabase.from('usuarios').select(selectFields).ilike('login', normalized)
  if (byLogin.error) {
    throw new Error(`Falha ao consultar usuários: ${byLogin.error.message}`)
  }
  return (byLogin.data ?? []) as Record<string, unknown>[]
}

/** Login igual ao painel web: e-mail ou login + senha (PBKDF2). */
export async function authenticateByEmail(emailOrLogin: string, senha: string): Promise<UsuarioSession> {
  const normalized = emailOrLogin.trim().toLowerCase()
  if (!normalized) throw new Error('Informe o e-mail.')
  if (!senha) throw new Error('Informe a senha.')

  const candidates = await selectByEmailOrLogin(normalized)
  const matches = candidates.filter((r) => {
    const dbEmail = String(r.email ?? '').trim().toLowerCase()
    const dbLogin = String(r.login ?? '').trim().toLowerCase()
    return dbEmail === normalized || dbLogin === normalized
  })
  if (matches.length === 0) throw new Error('E-mail não encontrado.')

  for (const candidate of matches) {
    const senhaHash = candidate.senha_hash as string | null
    if (!senhaHash) continue
    if (verificarSenha(senha, senhaHash)) return rowToSession(candidate)
  }
  throw new Error('Senha inválida.')
}
