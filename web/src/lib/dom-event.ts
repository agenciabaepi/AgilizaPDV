/** Lê value de input/select/textarea com segurança (evita currentTarget nulo após re-render). */
export function eventValue(
  e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
): string {
  const el = (e.currentTarget ?? e.target) as HTMLInputElement | null
  return el?.value ?? ''
}

export function eventChecked(e: React.ChangeEvent<HTMLInputElement>): boolean {
  const el = (e.currentTarget ?? e.target) as HTMLInputElement | null
  return el?.checked ?? false
}
