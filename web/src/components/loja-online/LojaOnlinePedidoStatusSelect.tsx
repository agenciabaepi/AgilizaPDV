import type { LojaOnlinePedido } from '../../lib/loja-online-types'
import {
  getPedidoStatusAdminOptions,
  normalizePedidoStatus,
  type LojaOnlinePedidoStatus,
} from '../../lib/loja-online-pedido-status'

type Props = {
  label?: string
  value: string
  formaEntrega?: LojaOnlinePedido['forma_entrega'] | null
  disabled?: boolean
  onChange: (status: LojaOnlinePedidoStatus) => void
}

export function LojaOnlinePedidoStatusSelect({
  label = 'Status do pedido',
  value,
  formaEntrega,
  disabled,
  onChange,
}: Props) {
  const groups = getPedidoStatusAdminOptions(formaEntrega)
  const normalized = normalizePedidoStatus(value, { status: value, forma_pagamento: null, pagamento_status: null })

  return (
    <label className="loja-admin-pedido-status-field">
      <span className="loja-admin-pedido-status-field-label">{label}</span>
      <select
        className="input-el loja-admin-pedido-status-select"
        value={normalized}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as LojaOnlinePedidoStatus)}
      >
        {groups.map((group) => (
          <optgroup key={group.id} label={group.label}>
            {group.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}
