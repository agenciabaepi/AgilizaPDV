/** Perfis que podem ser selecionados como vendedor e operar vendas no PDV. */
export function usuarioPodeSerVendedor(role: string | null | undefined): boolean {
  const r = String(role ?? '').trim().toLowerCase()
  return r === 'caixa' || r === 'admin'
}

export function usuarioLogadoPodeVender(role: string | null | undefined): boolean {
  return usuarioPodeSerVendedor(role)
}

export function filtrarUsuariosVendedores<T extends { role?: string | null }>(usuarios: T[]): T[] {
  return usuarios.filter((u) => usuarioPodeSerVendedor(u.role))
}
