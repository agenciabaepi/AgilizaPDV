/** Valida CNPJ (algoritmo oficial) */
export function isValidCNPJ(cnpj: string): boolean {
  const digits = (cnpj ?? '').replace(/\D/g, '')
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

export function normalizeCnpj(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '')
}
