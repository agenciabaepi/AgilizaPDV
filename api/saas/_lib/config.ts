export function getSaasAdminEmail(): string {
  return process.env.SAAS_ADMIN_EMAIL?.trim().toLowerCase() ?? ''
}

export function getSaasAdminPassword(): string {
  return process.env.SAAS_ADMIN_PASSWORD?.trim() ?? ''
}

export function getSaasAdminToken(): string {
  return process.env.SAAS_ADMIN_TOKEN?.trim() ?? ''
}

export function assertSaasConfigured(): void {
  if (!getSaasAdminToken()) {
    throw new Error('SAAS_ADMIN_TOKEN não configurado no servidor.')
  }
  if (!getSaasAdminEmail() || !getSaasAdminPassword()) {
    throw new Error('SAAS_ADMIN_EMAIL e SAAS_ADMIN_PASSWORD devem estar configurados.')
  }
}
