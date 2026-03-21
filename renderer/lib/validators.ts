/**
 * Validações profissionais para cadastros (CPF, CNPJ, e-mail, telefone).
 * Usado em fornecedores, clientes e outros módulos.
 */

/** Remove caracteres não numéricos */
export function onlyDigits(value: string): string {
  return (value ?? '').replace(/\D/g, '')
}

/** Valida CPF (algoritmo oficial) */
export function isValidCPF(cpf: string): boolean {
  const digits = onlyDigits(cpf)
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * (10 - i)
  }
  let rest = (sum * 10) % 11
  if (rest === 10) rest = 0
  if (rest !== parseInt(digits[9], 10)) return false

  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i], 10) * (11 - i)
  }
  rest = (sum * 10) % 11
  if (rest === 10) rest = 0
  if (rest !== parseInt(digits[10], 10)) return false

  return true
}

/** Valida CNPJ (algoritmo oficial) */
export function isValidCNPJ(cnpj: string): boolean {
  const digits = onlyDigits(cnpj)
  if (digits.length !== 14) return false
  if (/^(\d)\1{13}$/.test(digits)) return false

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i], 10) * weights1[i]
  }
  let rest = sum % 11
  rest = rest < 2 ? 0 : 11 - rest
  if (rest !== parseInt(digits[12], 10)) return false

  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  sum = 0
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i], 10) * weights2[i]
  }
  rest = sum % 11
  rest = rest < 2 ? 0 : 11 - rest
  if (rest !== parseInt(digits[13], 10)) return false

  return true
}

/** Valida CPF ou CNPJ conforme tipo */
export function isValidDoc(tipo: 'F' | 'J', value: string): boolean {
  if (!value?.trim()) return true
  return tipo === 'F' ? isValidCPF(value) : isValidCNPJ(value)
}

/** Formata CPF: 000.000.000-00 */
export function formatCPF(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** Formata CNPJ: 00.000.000/0000-00 */
export function formatCNPJ(value: string): string {
  const d = onlyDigits(value).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/** Formata documento conforme tipo */
export function formatDoc(tipo: 'F' | 'J', value: string): string {
  return tipo === 'F' ? formatCPF(value) : formatCNPJ(value)
}

/** Valida e-mail (regex simplificada mas efetiva) */
export function isValidEmail(email: string): boolean {
  if (!email?.trim()) return true
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email.trim())
}

/** Valida telefone brasileiro (10 ou 11 dígitos) */
export function isValidPhone(phone: string): boolean {
  if (!phone?.trim()) return true
  const d = onlyDigits(phone)
  return d.length >= 10 && d.length <= 11
}

/** Formata telefone: (00) 00000-0000 ou (00) 0000-0000 */
export function formatPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Sanitiza texto: trim, remove caracteres de controle */
export function sanitizeText(value: string | null | undefined): string {
  if (value == null) return ''
  return String(value)
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
}

/** Sanitiza número: retorna null se vazio/inválido */
export function sanitizeNumber(
  value: string | number | null | undefined
): number | null {
  if (value == null) return null
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}
