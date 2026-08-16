import type { LojaOnlineHeaderMobileId } from '../../lib/loja-online-header'
import { LOJA_ONLINE_HEADER_MOBILE_TEMPLATES } from '../../lib/loja-online-header'

function MiniIcon({ kind }: { kind: 'menu' | 'brand' | 'cart' }) {
  if (kind === 'menu') {
    return (
      <span className="loja-header-mini-icon loja-header-mini-icon--menu" aria-hidden>
        <i />
        <i />
        <i />
      </span>
    )
  }
  if (kind === 'cart') {
    return <span className="loja-header-mini-icon loja-header-mini-icon--cart" aria-hidden />
  }
  return <span className="loja-header-mini-icon loja-header-mini-icon--brand" aria-hidden />
}

export function LojaOnlineHeaderMobilePicker({
  value,
  onChange,
}: {
  value: LojaOnlineHeaderMobileId
  onChange: (id: LojaOnlineHeaderMobileId) => void
}) {
  return (
    <div className="loja-header-template-grid" role="radiogroup" aria-label="Layout do cabeçalho no celular">
      {LOJA_ONLINE_HEADER_MOBILE_TEMPLATES.map((spec) => {
        const active = value === spec.id
        return (
          <button
            key={spec.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`loja-cards-template-tile${active ? ' is-active' : ''}`}
            onClick={() => onChange(spec.id)}
          >
            <span className="loja-header-mini-preview">
              <span className={`loja-header-mini-row loja-header-mini-row--${spec.id}`}>
                {spec.row.map((slot) => (
                  <MiniIcon key={slot} kind={slot} />
                ))}
              </span>
              <span className="loja-header-mini-search" />
            </span>
            <span className="loja-cards-template-meta">
              <strong>{spec.label}</strong>
              <small>{spec.description}</small>
            </span>
          </button>
        )
      })}
    </div>
  )
}
