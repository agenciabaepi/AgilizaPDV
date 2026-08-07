export function getAsaasApiKey(): string {
  return process.env.ASAAS_API_KEY?.trim() ?? ''
}

export function getAsaasApiBase(): string {
  const fromEnv = process.env.ASAAS_API_BASE?.trim()
  if (fromEnv) return fromEnv
  const key = getAsaasApiKey()
  return key.includes('_prod_') ? 'https://api.asaas.com' : 'https://api-sandbox.asaas.com'
}

export function getAsaasWebhookToken(): string {
  return process.env.ASAAS_WEBHOOK_TOKEN?.trim() ?? ''
}

function isPlaceholderSecret(value: string): boolean {
  const v = value.trim().toLowerCase()
  if (!v) return true
  const placeholders = [
    'sua-service-role-key',
    'sua-chave-anon-public',
    'sua-chave',
    'your-',
    'token-longo-aleatorio',
    'changeme',
    'example',
  ]
  return placeholders.some((p) => v.includes(p)) || v.length < 20
}

export function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.VITE_SUPABASE_URL?.trim() ||
    'https://xyflyetsvsoanhslaxyd.supabase.co'
  )
}

export function getSupabaseServiceRoleKey(): string {
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ''
  if (service && !isPlaceholderSecret(service)) return service

  const anon =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    ''
  if (anon && !isPlaceholderSecret(anon)) return anon

  return (
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5Zmx5ZXRzdnNvYW5oc2xheHlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzMwODAsImV4cCI6MjA4ODIwOTA4MH0.cjNELwkashKJI52Mt0IZaHkgiP2kcbFo-Rc_tyqY_wo'
  )
}

export function assertSupabaseConfigured(): void {
  const url = getSupabaseUrl()
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ''
  if (service && isPlaceholderSecret(service)) {
    // Placeholder no .env — ignora e usa anon (mesmo comportamento do vite-plugin em dev)
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  }
  const key = getSupabaseServiceRoleKey()
  if (!url || !key) {
    throw new Error(
      'Supabase não configurado. Adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em web/.env.local e reinicie o npm run dev.'
    )
  }
}

export function formatSupabaseError(message: string): string {
  if (/invalid api key/i.test(message)) {
    return (
      'Chave do Supabase inválida. Em web/.env.local configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY com os dados do seu projeto (Supabase > Project Settings > API). Reinicie o npm run dev.'
    )
  }
  return message
}

export function getAssinaturaValorMensal(): number {
  return Number(process.env.ASSINATURA_VALOR_MENSAL ?? '5.00')
}

export function getAssinaturaTrialDias(): number {
  return Number(process.env.ASSINATURA_TRIAL_DIAS ?? '7')
}

export function assertAsaasConfigured(): void {
  if (!getAsaasApiKey()) {
    throw new Error('ASAAS_API_KEY não configurada no servidor.')
  }
}
