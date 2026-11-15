const SETUP_WIZARD_PREFIX = 'agiliza_setup_wizard:'

export type SetupWizardState = 'pending' | 'done'

function key(empresaId: string): string {
  return `${SETUP_WIZARD_PREFIX}${empresaId}`
}

export function getSetupWizardState(empresaId: string | null | undefined): SetupWizardState | null {
  if (!empresaId || typeof localStorage === 'undefined') return null
  const value = localStorage.getItem(key(empresaId))
  if (value === 'pending' || value === 'done') return value
  return null
}

export function markSetupWizardPending(empresaId: string): void {
  if (!empresaId || typeof localStorage === 'undefined') return
  localStorage.setItem(key(empresaId), 'pending')
}

export function markSetupWizardDone(empresaId: string): void {
  if (!empresaId || typeof localStorage === 'undefined') return
  localStorage.setItem(key(empresaId), 'done')
}

export function isSetupWizardPending(empresaId: string | null | undefined): boolean {
  return getSetupWizardState(empresaId) === 'pending'
}
