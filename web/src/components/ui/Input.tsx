import { forwardRef, useId } from 'react'
import { cn } from '../../lib/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  required?: boolean
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, required, error, hint, id, ...props }, ref) => {
    const autoId = useId()
    const inputId = id ?? autoId
    return (
      <div className={cn('input-wrap', error && 'input-error')}>
        {label && (
          <label htmlFor={inputId} className={cn('input-label', required && 'input-required')}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn('input-el', className)}
          {...props}
        />
        {hint && !error && <span className="input-hint">{hint}</span>}
        {error && <span className="input-hint" style={{ color: 'var(--color-error)' }}>{error}</span>}
      </div>
    )
  }
)
Input.displayName = 'Input'
