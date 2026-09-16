import type { ReactNode } from 'react'
import { Check, Pencil } from 'lucide-react'

type Props = {
  number: number
  title: string
  summary?: string | null
  open: boolean
  done: boolean
  locked?: boolean
  onEdit?: () => void
  children: ReactNode
}

export function LojaOnlineCheckoutAccordionStep({
  number,
  title,
  summary,
  open,
  done,
  locked,
  onEdit,
  children,
}: Props) {
  if (locked) return null

  if (done && !open) {
    return (
      <button type="button" className="loja-store-checkout-step loja-store-checkout-step--done" onClick={onEdit}>
        <span className="loja-store-checkout-step-num is-check">
          <Check size={14} strokeWidth={3} />
        </span>
        <span className="loja-store-checkout-step-head-text">
          <strong>{title}</strong>
          {summary ? <small>{summary}</small> : null}
        </span>
        <span className="loja-store-checkout-step-head-action">
          <Pencil size={14} />
          Alterar
        </span>
      </button>
    )
  }

  if (!open) return null

  return (
    <section className="loja-store-checkout-step is-open loja-store-checkout-step--current">
      <div className="loja-store-checkout-step-head loja-store-checkout-step-head--static">
        <span className="loja-store-checkout-step-num">{number}</span>
        <span className="loja-store-checkout-step-head-text">
          <strong>{title}</strong>
        </span>
      </div>
      <div className="loja-store-checkout-step-panel">{children}</div>
    </section>
  )
}
