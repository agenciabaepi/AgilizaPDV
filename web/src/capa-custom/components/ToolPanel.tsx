import { Bold, ChevronDown, ChevronUp, ImagePlus, Italic, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { BACKGROUND_COLORS, FONTS, STICKERS, TEXT_COLORS } from '../lib/fonts';
import type { LoadedImage } from '../lib/image';
import type { Design, Layer, LayerPatch, Panel, TextLayer } from '../types';

interface Props {
  panel: Panel;
  design: Design;
  selected: Layer | null;
  uploads: LoadedImage[];
  onUpload(): void;
  onAddImage(img: LoadedImage): void;
  onAddText(text: string, overrides?: Partial<TextLayer>): void;
  onUpdateLayer(id: string, patch: LayerPatch, commit?: boolean): void;
  onCheckpoint(): void;
  onBackground(color: string): void;
  onSelect(id: string | null): void;
  onMove(id: string, dir: 1 | -1): void;
  onRemove(id: string): void;
  onClose?: () => void;
}

const TITLES: Record<Panel, string> = {
  image: 'Suas fotos',
  text: 'Texto',
  background: 'Cor de fundo',
  layers: 'Camadas',
};

export function ToolPanel(props: Props) {
  const { panel, onClose } = props;
  return (
    <div className="cc:p-4 cc:lg:p-5">
      <div className="cc:mb-3 cc:flex cc:items-center">
        <h3 className="cc:font-semibold">{TITLES[panel]}</h3>
        {onClose && (
          <button onClick={onClose} className="cc-icon-btn cc:-my-2 cc:ml-auto" aria-label="Fechar painel">
            <X className="cc:h-5 cc:w-5" />
          </button>
        )}
      </div>
      {panel === 'image' && <ImagePanel {...props} />}
      {panel === 'text' && <TextPanel {...props} />}
      {panel === 'background' && <BackgroundPanel {...props} />}
      {panel === 'layers' && <LayersPanel {...props} />}
    </div>
  );
}

function ImagePanel({ uploads, onUpload, onAddImage }: Props) {
  return (
    <div className="cc:space-y-4">
      <button
        onClick={onUpload}
        className="cc:flex cc:w-full cc:flex-col cc:items-center cc:gap-2 cc:rounded-2xl cc:border-2 cc:border-dashed cc:border-brand-400 cc:bg-brand-50 cc:px-4 cc:py-6 cc:text-brand-700"
      >
        <ImagePlus className="cc:h-7 cc:w-7" />
        <span className="cc:font-semibold">Enviar foto</span>
        <span className="cc:text-xs cc:text-brand-700/70">JPG, PNG ou WEBP. Prefira fotos em alta resolução.</span>
      </button>
      {uploads.length > 0 && (
        <div>
          <p className="cc:mb-2 cc:text-xs cc:font-medium cc:uppercase cc:tracking-wide cc:text-neutral-500">Enviadas — toque para adicionar de novo</p>
          <div className="cc:grid cc:grid-cols-4 cc:gap-2">
            {uploads.map((u) => (
              <button key={u.src} onClick={() => onAddImage(u)} className="cc:aspect-square cc:overflow-hidden cc:rounded-xl cc:bg-neutral-100">
                <img src={u.src} alt="" className="cc:h-full cc:w-full cc:object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Swatches({ colors, value, onPick }: { colors: string[]; value: string | null; onPick(c: string): void }) {
  return (
    <div className="cc:flex cc:flex-wrap cc:gap-2">
      {colors.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          aria-label={c}
          className={`cc:h-8 cc:w-8 cc:rounded-full cc:border ${value === c ? 'cc:ring-2 cc:ring-brand-500 cc:ring-offset-2' : 'cc:border-neutral-300'} ${
            c === 'transparent' ? 'cc-checker' : ''
          }`}
          style={c === 'transparent' ? undefined : { background: c }}
        />
      ))}
      <label className="cc:relative cc:h-8 cc:w-8 cc:cursor-pointer cc:overflow-hidden cc:rounded-full cc:border cc:border-neutral-300 cc:bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]">
        <input
          type="color"
          value={value && value.startsWith('#') ? value : '#000000'}
          onChange={(e) => onPick(e.target.value)}
          className="cc:absolute cc:inset-0 cc:cursor-pointer cc:opacity-0"
        />
      </label>
    </div>
  );
}

function TextPanel({ selected, onAddText, onUpdateLayer, onCheckpoint }: Props) {
  const [draft, setDraft] = useState('');
  const text = selected?.type === 'text' ? selected : null;

  const update = (patch: LayerPatch, commit = true) => text && onUpdateLayer(text.id, patch, commit);

  return (
    <div className="cc:space-y-5">
      {text ? (
        <textarea
          value={text.text}
          onChange={(e) => update({ text: e.target.value }, false)}
          onBlur={onCheckpoint}
          rows={2}
          className="cc:w-full cc:resize-none cc:rounded-xl cc:border cc:border-neutral-200 cc:px-3 cc:py-2 cc:text-base cc:outline-hidden cc:focus:border-brand-400"
        />
      ) : (
        <form
          className="cc:flex cc:gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            onAddText(draft.trim());
            setDraft('');
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Digite seu nome ou frase"
            maxLength={60}
            className="cc:min-w-0 cc:flex-1 cc:rounded-xl cc:border cc:border-neutral-200 cc:px-3 cc:py-2.5 cc:text-base cc:outline-hidden cc:focus:border-brand-400"
          />
          <button type="submit" className="cc-btn-primary cc:gap-1" disabled={!draft.trim()}>
            <Plus className="cc:h-4 cc:w-4" />
            Adicionar
          </button>
        </form>
      )}

      {text && (
        <>
          <div>
            <p className="cc-label">Fonte</p>
            <div className="cc:grid cc:grid-cols-3 cc:gap-2">
              {FONTS.map((f) => (
                <button
                  key={f.family}
                  onClick={() => update({ fontFamily: f.family })}
                  className={`cc:truncate cc:rounded-xl cc:border cc:px-2 cc:py-2 cc:text-base ${
                    text.fontFamily === f.family ? 'cc:border-brand-500 cc:bg-brand-50' : 'cc:border-neutral-200'
                  }`}
                  style={{ fontFamily: `"${f.family}"`, fontSize: f.family === 'Press Start 2P' ? 10 : undefined }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="cc-label">Cor</p>
            <Swatches colors={TEXT_COLORS} value={text.fill} onPick={(fill) => update({ fill })} />
          </div>

          <div>
            <p className="cc-label">Contorno</p>
            <Swatches
              colors={['transparent', '#ffffff', '#111111', '#ff6b1a', '#ec4899', '#2563eb']}
              value={text.stroke ?? 'transparent'}
              onPick={(c) => update({ stroke: c === 'transparent' ? null : c })}
            />
          </div>

          <div className="cc:flex cc:gap-2">
            <button onClick={() => update({ bold: !text.bold })} className={`cc-toggle ${text.bold ? 'cc-toggle-on' : ''}`} aria-label="Negrito">
              <Bold className="cc:h-4 cc:w-4" />
            </button>
            <button onClick={() => update({ italic: !text.italic })} className={`cc-toggle ${text.italic ? 'cc-toggle-on' : ''}`} aria-label="Itálico">
              <Italic className="cc:h-4 cc:w-4" />
            </button>
          </div>
        </>
      )}

      <div>
        <p className="cc-label">Figurinhas</p>
        <div className="cc:grid cc:grid-cols-8 cc:gap-1">
          {STICKERS.map((s) => (
            <button key={s} onClick={() => onAddText(s, { fontFamily: 'Poppins', fill: '#000000' })} className="cc:rounded-lg cc:py-1 cc:text-2xl cc:hover:bg-neutral-100">
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BackgroundPanel({ design, onBackground }: Props) {
  return (
    <div className="cc:space-y-3">
      <Swatches colors={BACKGROUND_COLORS} value={design.background} onPick={onBackground} />
      <p className="cc:text-xs cc:text-neutral-500">O quadriculado deixa a capa transparente nas áreas sem imagem.</p>
    </div>
  );
}

function LayersPanel({ design, selected, onSelect, onMove, onRemove }: Props) {
  const layers = [...design.layers].reverse();
  if (layers.length === 0) return <p className="cc:text-sm cc:text-neutral-500">Nenhuma camada ainda. Envie uma foto ou adicione um texto.</p>;
  return (
    <ul className="cc:space-y-2">
      {layers.map((l, i) => (
        <li
          key={l.id}
          onClick={() => onSelect(l.id)}
          className={`cc:flex cc:cursor-pointer cc:items-center cc:gap-3 cc:rounded-xl cc:border cc:p-2 ${
            selected?.id === l.id ? 'cc:border-brand-500 cc:bg-brand-50' : 'cc:border-neutral-200'
          }`}
        >
          <div className="cc:flex cc:h-12 cc:w-12 cc:shrink-0 cc:items-center cc:justify-center cc:overflow-hidden cc:rounded-lg cc:bg-neutral-100">
            {l.type === 'image' ? (
              <img src={l.src} alt="" className="cc:h-full cc:w-full cc:object-cover" />
            ) : (
              <span className="cc:truncate cc:px-1 cc:text-lg" style={{ fontFamily: `"${l.fontFamily}"`, color: l.fill }}>
                Aa
              </span>
            )}
          </div>
          <span className="cc:min-w-0 cc:flex-1 cc:truncate cc:text-sm">{l.type === 'image' ? 'Foto' : l.text}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMove(l.id, 1);
            }}
            disabled={i === 0}
            className="cc-icon-btn"
            aria-label="Trazer para frente"
          >
            <ChevronUp className="cc:h-4 cc:w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMove(l.id, -1);
            }}
            disabled={i === layers.length - 1}
            className="cc-icon-btn"
            aria-label="Enviar para trás"
          >
            <ChevronDown className="cc:h-4 cc:w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(l.id);
            }}
            className="cc-icon-btn cc:text-red-600"
            aria-label="Remover"
          >
            <Trash2 className="cc:h-4 cc:w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
