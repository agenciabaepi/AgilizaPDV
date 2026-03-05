/** Junta classes CSS, ignorando valores falsy */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
