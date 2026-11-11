import { useId, type SelectHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export type SelectOption = { value: string; label: string }

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: SelectOption[]
}

export function Select({ className, label, options, id, ...props }: SelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <div className="input-wrap">
      {label ? (
        <label htmlFor={selectId} className="input-label">
          {label}
        </label>
      ) : null}
      <select id={selectId} className={cn('input-select', className)} {...props}>
        {options.map((opt) => (
          <option key={opt.value || opt.label} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
