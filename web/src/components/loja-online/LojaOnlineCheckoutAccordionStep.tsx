import type { ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'

type Props = {
  number: number
  title: string
  summary?: string | null
  open: boolean
  done: boolean
  onToggle: () => void
  children: ReactNode
}

export function LojaOnlineCheckoutAccordionStep({
  number,
  title,
  summary,
  open,
  done,
  onToggle,
  children,
}: Props) {
  return (
    <section className={`loja-store-checkout-step${open ? ' is-open' : ' is-collapsed'}${done ? ' is-done' : ''}`}>
      <button type="button" className="loja-store-checkout-step-head" onClick={onToggle} aria-expanded={open}>
        <span className={`loja-store-checkout-step-num${done && !open ? ' is-check' : ''}`}>
          {done && !open ? <Check size={14} strokeWidth={3} /> : number}
        </span>
        <span className="loja-store-checkout-step-head-text">
          <strong>{title}</strong>
          {!open && summary ? <small>{summary}</small> : null}
        </span>
        <span className="loja-store-checkout-step-head-action">
          {done && !open ? 'Alterar' : <ChevronDown size={18} className={open ? 'is-open' : ''} />}
        </span>
      </button>
      {open && <div className="loja-store-checkout-step-panel">{children}</div>}
    </section>
  )
}
