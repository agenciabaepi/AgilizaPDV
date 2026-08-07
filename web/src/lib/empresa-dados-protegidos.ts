import type { EmpresaConfig, UpdateEmpresaConfigInput } from '../vite-env'
import { validateEmpresaOnboarding } from './onboarding'
import { onlyDigits } from './validators'

/** Empresa com cadastro inicial completo (onboarding). */
export function empresaDadosCriticosCompletos(config: EmpresaConfig | null): boolean {
  return validateEmpresaOnboarding(config).length === 0
}

/** CNPJ não pode ser editado pelo painel após o cadastro inicial. */
export function cnpjBloqueadoParaEdicao(config: EmpresaConfig | null): boolean {
  return empresaDadosCriticosCompletos(config) && Boolean(onlyDigits(config?.cnpj ?? ''))
}

export function mergeEmpresaConfigUpdate(
  atual: EmpresaConfig,
  update: UpdateEmpresaConfigInput
): EmpresaConfig {
  return {
    ...atual,
    nome: update.nome !== undefined ? update.nome : atual.nome,
    cnpj: update.cnpj !== undefined ? update.cnpj : atual.cnpj,
    codigo_acesso: update.codigo_acesso !== undefined ? update.codigo_acesso : atual.codigo_acesso,
    razao_social: update.razao_social !== undefined ? update.razao_social : atual.razao_social,
    endereco: update.endereco !== undefined ? update.endereco : atual.endereco,
    telefone: update.telefone !== undefined ? update.telefone : atual.telefone,
    email: update.email !== undefined ? update.email : atual.email,
  }
}

/**
 * Impede apagar ou invalidar dados obrigatórios da empresa após o cadastro inicial.
 * Suporte pode ignorar com bypassDadosProtegidos.
 */
export function assertEmpresaConfigUpdateAllowed(
  atual: EmpresaConfig,
  update: UpdateEmpresaConfigInput,
  options?: { bypassDadosProtegidos?: boolean }
): void {
  if (options?.bypassDadosProtegidos || !empresaDadosCriticosCompletos(atual)) return

  const merged = mergeEmpresaConfigUpdate(atual, update)
  const missing = validateEmpresaOnboarding(merged)
  if (missing.length > 0) {
    throw new Error(
      `Não é permitido remover dados obrigatórios da empresa (${missing.join(', ')}). Você pode editar, mas não deixar em branco.`
    )
  }

  if (update.cnpj !== undefined) {
    const atualDigits = onlyDigits(atual.cnpj ?? '')
    const novoDigits = onlyDigits(update.cnpj ?? '')
    if (atualDigits && novoDigits !== atualDigits) {
      throw new Error(
        'O CNPJ não pode ser alterado após o cadastro inicial. Entre em contato com o suporte se precisar corrigir.'
      )
    }
  }
}

export function assertUsuarioUpdateAllowed(
  current: { nome: string; email: string | null },
  update: { nome?: string; email?: string | null | undefined },
  options?: { bypassDadosProtegidos?: boolean }
): void {
  if (options?.bypassDadosProtegidos) return

  const nomeAtual = current.nome?.trim()
  const emailAtual = current.email?.trim()
  if (!nomeAtual || !emailAtual) return

  if (update.nome !== undefined && !update.nome.trim()) {
    throw new Error('O nome não pode ser removido após o cadastro.')
  }
  if (update.email !== undefined && !update.email?.trim()) {
    throw new Error('O e-mail não pode ser removido após o cadastro.')
  }
}
