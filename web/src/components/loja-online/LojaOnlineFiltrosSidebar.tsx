import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react'
import {
  LOJA_ONLINE_ORDEM_OPCOES,
  applyLojaOnlineFiltrosPatch,
  countLojaOnlineFiltrosAtivos,
  parseLojaOnlineFiltros,
  type LojaOnlineFiltrosOpcoes,
  type LojaOnlineFiltrosState,
} from '../../lib/loja-online-filtros'

type FilterSectionProps = {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function FilterSection({ title, defaultOpen = true, children }: FilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="loja-filtros-section">
      <button
        type="button"
        className="loja-filtros-section-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <ChevronDown size={16} className={open ? 'is-open' : ''} aria-hidden />
      </button>
      {open && <div className="loja-filtros-section-body">{children}</div>}
    </div>
  )
}

type CheckboxListProps = {
  name: string
  options: { value: string; label: string; count: number; hex?: string }[]
  selected: string | null
  onChange: (value: string | null) => void
}

function CheckboxList({ name, options, selected, onChange }: CheckboxListProps) {
  if (options.length === 0) return null
  return (
    <ul className="loja-filtros-list">
      {options.map((opt) => (
        <li key={opt.value}>
          <label className="loja-filtros-check">
            <input
              type="checkbox"
              name={name}
              checked={selected === opt.value}
              onChange={() => onChange(selected === opt.value ? null : opt.value)}
            />
            <span className="loja-filtros-check-label">
              {opt.hex && (
                <span
                  className="loja-filtros-cor-swatch"
                  style={{ background: opt.hex }}
                  aria-hidden
                />
              )}
              {opt.label}
            </span>
            <span className="loja-filtros-count">{opt.count}</span>
          </label>
        </li>
      ))}
    </ul>
  )
}

function FiltrosPanel({
  filtros,
  opcoes,
  onPatch,
  onClear,
}: {
  filtros: LojaOnlineFiltrosState
  opcoes: LojaOnlineFiltrosOpcoes
  onPatch: (patch: Partial<LojaOnlineFiltrosState>) => void
  onClear: () => void
}) {
  const [precoMinLocal, setPrecoMinLocal] = useState(
    filtros.precoMin != null ? String(filtros.precoMin) : ''
  )
  const [precoMaxLocal, setPrecoMaxLocal] = useState(
    filtros.precoMax != null ? String(filtros.precoMax) : ''
  )

  useEffect(() => {
    setPrecoMinLocal(filtros.precoMin != null ? String(filtros.precoMin) : '')
    setPrecoMaxLocal(filtros.precoMax != null ? String(filtros.precoMax) : '')
  }, [filtros.precoMin, filtros.precoMax])

  const aplicarPreco = () => {
    const min = precoMinLocal.trim() ? Number(precoMinLocal.replace(',', '.')) : null
    const max = precoMaxLocal.trim() ? Number(precoMaxLocal.replace(',', '.')) : null
    onPatch({
      precoMin: min != null && Number.isFinite(min) ? min : null,
      precoMax: max != null && Number.isFinite(max) ? max : null,
    })
  }

  const temSecoes =
    opcoes.subcategorias.length > 0 ||
    opcoes.marcas.length > 0 ||
    opcoes.cores.length > 0 ||
    opcoes.tamanhos.length > 0 ||
    opcoes.armazenamentos.length > 0 ||
    opcoes.variacoes.length > 0 ||
    opcoes.precoMax > opcoes.precoMin

  return (
    <div className="loja-filtros-panel">
      <div className="loja-filtros-panel-head">
        <span>
          <SlidersHorizontal size={18} aria-hidden />
          Filtros
        </span>
        {countLojaOnlineFiltrosAtivos(filtros) > 0 && (
          <button type="button" className="loja-filtros-clear" onClick={onClear}>
            Limpar
          </button>
        )}
      </div>

      <FilterSection title="Ordenar">
        <select
          className="loja-filtros-select"
          value={filtros.ordem}
          onChange={(e) => onPatch({ ordem: e.target.value as LojaOnlineFiltrosState['ordem'] })}
        >
          {LOJA_ONLINE_ORDEM_OPCOES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </FilterSection>

      {opcoes.subcategorias.length > 0 && (
        <FilterSection title="Subcategoria">
          <CheckboxList
            name="subcategoria"
            options={opcoes.subcategorias}
            selected={filtros.subcategoria}
            onChange={(value) => onPatch({ subcategoria: value })}
          />
        </FilterSection>
      )}

      {opcoes.marcas.length > 0 && (
        <FilterSection title="Marca">
          <CheckboxList
            name="marca"
            options={opcoes.marcas}
            selected={filtros.marca}
            onChange={(value) => onPatch({ marca: value })}
          />
        </FilterSection>
      )}

      {opcoes.precoMax > opcoes.precoMin && (
        <FilterSection title="Preço">
          <div className="loja-filtros-preco">
            <label>
              <span>Mínimo (R$)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={precoMinLocal}
                placeholder={String(opcoes.precoMin)}
                onChange={(e) => setPrecoMinLocal(e.target.value)}
              />
            </label>
            <label>
              <span>Máximo (R$)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={precoMaxLocal}
                placeholder={String(opcoes.precoMax)}
                onChange={(e) => setPrecoMaxLocal(e.target.value)}
              />
            </label>
            <button type="button" className="loja-filtros-preco-btn" onClick={aplicarPreco}>
              Aplicar
            </button>
          </div>
        </FilterSection>
      )}

      {opcoes.cores.length > 0 && (
        <FilterSection title="Cor">
          <CheckboxList
            name="cor"
            options={opcoes.cores.map((c) => ({ ...c, hex: c.hex }))}
            selected={filtros.cor}
            onChange={(value) => onPatch({ cor: value })}
          />
        </FilterSection>
      )}

      {opcoes.tamanhos.length > 0 && (
        <FilterSection title="Tamanho">
          <CheckboxList
            name="tamanho"
            options={opcoes.tamanhos}
            selected={filtros.tamanho}
            onChange={(value) => onPatch({ tamanho: value })}
          />
        </FilterSection>
      )}

      {opcoes.armazenamentos.length > 0 && (
        <FilterSection title="Armazenamento">
          <CheckboxList
            name="armazenamento"
            options={opcoes.armazenamentos}
            selected={filtros.armazenamento}
            onChange={(value) => onPatch({ armazenamento: value })}
          />
        </FilterSection>
      )}

      {opcoes.variacoes.length > 0 && (
        <FilterSection title="Variações">
          <CheckboxList
            name="variacao"
            options={opcoes.variacoes}
            selected={filtros.variacao}
            onChange={(value) => onPatch({ variacao: value })}
          />
        </FilterSection>
      )}

      {!temSecoes && (
        <p className="loja-filtros-empty">Nenhum filtro adicional disponível nesta categoria.</p>
      )}
    </div>
  )
}

export function LojaOnlineFiltrosSidebar({
  opcoes,
  className,
}: {
  opcoes: LojaOnlineFiltrosOpcoes
  className?: string
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [mobileOpen, setMobileOpen] = useState(false)
  const filtros = useMemo(() => parseLojaOnlineFiltros(searchParams), [searchParams])
  const ativos = countLojaOnlineFiltrosAtivos(filtros)

  const patch = (partial: Partial<LojaOnlineFiltrosState>) => {
    setSearchParams(applyLojaOnlineFiltrosPatch(searchParams, partial), { replace: true })
  }

  const clear = () => {
    const categoria = searchParams.get('categoria')
    const next = new URLSearchParams()
    if (categoria) next.set('categoria', categoria)
    setSearchParams(next, { replace: true })
    setMobileOpen(false)
  }

  const panel = (
    <FiltrosPanel filtros={filtros} opcoes={opcoes} onPatch={patch} onClear={clear} />
  )

  return (
    <>
      <button
        type="button"
        className="loja-filtros-mobile-toggle"
        onClick={() => setMobileOpen(true)}
        aria-expanded={mobileOpen}
      >
        <SlidersHorizontal size={18} />
        Filtros
        {ativos > 0 && <span className="loja-filtros-mobile-badge">{ativos}</span>}
      </button>

      <aside className={`loja-filtros-sidebar${className ? ` ${className}` : ''}`} aria-label="Filtros">
        {panel}
      </aside>

      {mobileOpen && (
        <div className="loja-filtros-drawer" role="dialog" aria-modal="true" aria-label="Filtros">
          <div className="loja-filtros-drawer-backdrop" onClick={() => setMobileOpen(false)} />
          <div className="loja-filtros-drawer-panel">
            <div className="loja-filtros-drawer-head">
              <strong>Filtros</strong>
              <button
                type="button"
                className="loja-filtros-drawer-close"
                onClick={() => setMobileOpen(false)}
                aria-label="Fechar filtros"
              >
                <X size={20} />
              </button>
            </div>
            {panel}
          </div>
        </div>
      )}
    </>
  )
}
