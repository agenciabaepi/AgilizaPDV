import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  required?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, required, id, ...props }, ref) => {
    const autoId = useId()
    const inputId = id ?? autoId
    return (
      <div className="input-wrap">
        {label ? (
          <label htmlFor={inputId} className={cn('input-label', required && 'input-required')}>
            {label}
          </label>
        ) : null}
        <input ref={ref} id={inputId} className={cn('input-el', className)} {...props} />
      </div>
    )
  }
)
Input.displayName = 'Input'
