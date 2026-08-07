import type { EmpresaConfig } from '../vite-env'
import { isValidCNPJ, isValidEmail, isValidPhone, onlyDigits } from './validators'

export type OnboardingUsuario = {
  nome: string | null
  email: string | null
}

export type OnboardingStatus = {
  completo: boolean
  empresaCompleta: boolean
  usuarioCompleto: boolean
  camposEmpresaFaltando: string[]
  camposUsuarioFaltando: string[]
}

const EMPRESA_LABELS: Record<string, string> = {
  nome: 'Nome fantasia',
  razao_social: 'Razão social',
  cnpj: 'CNPJ',
  email: 'E-mail da empresa',
  telefone: 'Telefone',
  endereco: 'Endereço',
}

const USUARIO_LABELS: Record<string, string> = {
  nome: 'Nome completo',
  email: 'E-mail',
}

export function validateEmpresaOnboarding(config: EmpresaConfig | null): string[] {
  if (!config) {
    return Object.values(EMPRESA_LABELS)
  }

  const missing: string[] = []
  if (!config.nome?.trim()) missing.push(EMPRESA_LABELS.nome)
  if (!config.razao_social?.trim()) missing.push(EMPRESA_LABELS.razao_social)

  const cnpjDigits = onlyDigits(config.cnpj ?? '')
  if (!cnpjDigits) missing.push(EMPRESA_LABELS.cnpj)
  else if (!isValidCNPJ(cnpjDigits)) missing.push(`${EMPRESA_LABELS.cnpj} (inválido)`)

  const email = config.email?.trim() ?? ''
  if (!email) missing.push(EMPRESA_LABELS.email)
  else if (!isValidEmail(email)) missing.push(`${EMPRESA_LABELS.email} (inválido)`)

  const telefone = config.telefone?.trim() ?? ''
  if (!telefone) missing.push(EMPRESA_LABELS.telefone)
  else if (!isValidPhone(telefone)) missing.push(`${EMPRESA_LABELS.telefone} (inválido)`)

  if (!config.endereco?.trim()) missing.push(EMPRESA_LABELS.endereco)

  return missing
}

export function validateUsuarioOnboarding(user: OnboardingUsuario | null): string[] {
  if (!user) return Object.values(USUARIO_LABELS)

  const missing: string[] = []
  if (!user.nome?.trim()) missing.push(USUARIO_LABELS.nome)

  const email = user.email?.trim() ?? ''
  if (!email) missing.push(USUARIO_LABELS.email)
  else if (!isValidEmail(email)) missing.push(`${USUARIO_LABELS.email} (inválido)`)

  return missing
}

export function computeOnboardingStatus(
  config: EmpresaConfig | null,
  user: OnboardingUsuario | null
): OnboardingStatus {
  const camposEmpresaFaltando = validateEmpresaOnboarding(config)
  const camposUsuarioFaltando = validateUsuarioOnboarding(user)
  const empresaCompleta = camposEmpresaFaltando.length === 0
  const usuarioCompleto = camposUsuarioFaltando.length === 0

  return {
    completo: empresaCompleta && usuarioCompleto,
    empresaCompleta,
    usuarioCompleto,
    camposEmpresaFaltando,
    camposUsuarioFaltando,
  }
}

export async function loadOnboardingStatus(
  empresaId: string,
  userId: string
): Promise<OnboardingStatus> {
  const [config, user] = await Promise.all([
    window.electronAPI.empresas.getConfig(empresaId),
    window.electronAPI.usuarios.get(userId),
  ])

  return computeOnboardingStatus(
    config,
    user ? { nome: user.nome, email: user.email } : null
  )
}
