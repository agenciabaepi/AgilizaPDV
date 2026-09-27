import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatCurrency } from '../../lib/loja-online';
import type { CapaModeloOpcao } from '../lib/capa-catalogo';
import type { PhoneModel } from '../phoneModels';
import { CaseThumb } from './CaseThumb';

interface Props {
  options: CapaModeloOpcao[];
  current?: PhoneModel;
  mostrarPreco: boolean;
  onSelect(model: PhoneModel): void;
  onClose?: () => void;
}

export function ModelPicker({ options, current, mostrarPreco, onSelect, onClose }: Props) {
  const series = useMemo(() => [...new Set(options.map((o) => o.model.series))], [options]);
  const [serie, setSerie] = useState<number>(current?.series ?? series[0]);
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
    if (q) return options.filter((o) => o.model.name.toLowerCase().includes(q));
    return options.filter((o) => o.model.series === serie);
  }, [options, serie, query]);

  return (
    <div className="cc:fixed cc:inset-0 cc:z-50 cc:flex cc:items-end cc:justify-center cc:bg-black/50 cc:sm:items-center cc:sm:p-6" onClick={onClose}>
      <div
        className="cc:flex cc:h-[92dvh] cc:w-full cc:flex-col cc:overflow-hidden cc:rounded-t-3xl cc:bg-white cc:sm:h-auto cc:sm:max-h-[85dvh] cc:sm:max-w-3xl cc:sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cc:flex cc:items-center cc:gap-3 cc:px-5 cc:pb-3 cc:pt-5">
          <div>
            <h2 className="cc:text-lg cc:font-semibold">Qual é o seu celular?</h2>
            <p className="cc:text-sm cc:text-neutral-500">A capa é feita sob medida para o modelo escolhido.</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="cc-icon-btn cc:ml-auto" aria-label="Fechar">
              <X className="cc:h-5 cc:w-5" />
            </button>
          )}
        </div>

        <div className="cc:px-5">
          <label className="cc:flex cc:items-center cc:gap-2 cc:rounded-xl cc:border cc:border-neutral-200 cc:px-3 cc:py-2.5 cc:focus-within:border-brand-400">
            <Search className="cc:h-4 cc:w-4 cc:text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar modelo, ex: 15 Pro Max"
              className="cc:w-full cc:bg-transparent cc:text-base cc:outline-hidden cc:sm:text-sm"
            />
          </label>
          {!query && series.length > 1 && (
            <div className="cc:-mx-5 cc:mt-3 cc:flex cc:gap-2 cc:overflow-x-auto cc:px-5 cc:pb-1">
              {series.map((s) => (
                <button
                  key={s}
                  onClick={() => setSerie(s)}
                  className={`cc:shrink-0 cc:rounded-full cc:px-4 cc:py-1.5 cc:text-sm cc:font-medium ${
                    serie === s ? 'cc:bg-neutral-900 cc:text-white' : 'cc:bg-neutral-100 cc:text-neutral-700'
                  }`}
                >
                  iPhone {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="cc:grid cc:flex-1 cc:grid-cols-3 cc:content-start cc:gap-3 cc:overflow-y-auto cc:p-5 cc:sm:grid-cols-4 cc:md:grid-cols-5">
          {visible.map((o) => (
            <button
              key={o.model.id}
              onClick={() => onSelect(o.model)}
              disabled={!o.disponivel}
              className={`cc:relative cc:flex cc:flex-col cc:items-center cc:gap-2 cc:rounded-2xl cc:border cc:p-3 cc:text-center cc:text-xs cc:font-medium cc:transition cc:hover:border-brand-400 cc:disabled:opacity-50 cc:disabled:hover:border-neutral-200 ${
                current?.id === o.model.id ? 'cc:border-brand-500 cc:bg-brand-50' : 'cc:border-neutral-200'
              }`}
            >
              <CaseThumb model={o.model} className="cc:h-24 cc:w-auto" />
              <span className="cc:leading-tight">{o.model.name}</span>
              {!o.disponivel ? (
                <span className="cc:rounded-full cc:bg-neutral-100 cc:px-2 cc:py-0.5 cc:text-[11px] cc:text-neutral-500">Esgotado</span>
              ) : (
                mostrarPreco && <span className="cc:text-[13px] cc:font-semibold cc:text-neutral-900">{formatCurrency(o.preco)}</span>
              )}
            </button>
          ))}
          {visible.length === 0 && <p className="cc:col-span-full cc:py-10 cc:text-center cc:text-sm cc:text-neutral-500">Nenhum modelo encontrado.</p>}
        </div>
      </div>
    </div>
  );
}
