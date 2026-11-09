import { LayoutGrid, Columns2, Columns3, List } from 'lucide-react'
import type { LojaOnlineCatalogVista } from '../../hooks/useLojaOnlineCatalogView'

const OPCOES: {
  value: LojaOnlineCatalogVista
  label: string
  icon: typeof LayoutGrid
}[] = [
  { value: '2', label: '2 colunas', icon: Columns2 },
  { value: '3', label: '3 colunas', icon: Columns3 },
  { value: '4', label: '4 colunas', icon: LayoutGrid },
  { value: 'lista', label: 'Lista', icon: List },
]

export function LojaOnlineCatalogViewToggle({
  value,
  onChange,
}: {
  value: LojaOnlineCatalogVista
  onChange: (vista: LojaOnlineCatalogVista) => void
}) {
  return (
    <div className="loja-joog-cat-view" role="group" aria-label="Visualização do catálogo">
      {OPCOES.map((opt) => {
        const Icon = opt.icon
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            className={`loja-joog-cat-view-btn${active ? ' is-active' : ''}`}
            aria-pressed={active}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => onChange(opt.value)}
          >
            <Icon size={18} strokeWidth={2} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
