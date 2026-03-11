import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  required?: boolean
  error?: string
  options: SelectOption[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, required, error, options, placeholder, id, ...props }, ref) => {
    const selectId = id ?? `select-${Math.random().toString(36).slice(2)}`
    return (
      <div className={cn('input-wrap', error && 'input-error')}>
        {label && (
          <label htmlFor={selectId} className={cn('input-label', required && 'input-required')}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn('input-select', className)}
          {...props}
        >
          {placeholder && (
            <option value="">{placeholder}</option>
          )}
          {(options ?? []).filter((opt): opt is SelectOption => opt != null).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span className="input-hint" style={{ color: 'var(--color-error)' }}>{error}</span>}
      </div>
    )
  }
)
Select.displayName = 'Select'
