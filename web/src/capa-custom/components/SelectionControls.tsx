import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Crosshair,
  FlipHorizontal2,
  Maximize,
  Pencil,
  RefreshCw,
  RotateCw,
  Trash2,
  ZoomIn,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { PX_PER_MM } from '../phoneModels';
import type { Layer, LayerPatch } from '../types';

interface Props {
  layer: Layer;
  variant: 'bar' | 'panel';
  onChange(patch: LayerPatch, commit: boolean): void;
  onCheckpoint(): void;
  onFill(): void;
  onCenter(): void;
  onDuplicate(): void;
  onForward(): void;
  onBackward(): void;
  onRemove(): void;
  onReplace(): void;
  onEditText(): void;
}

const LOG_MIN = Math.log(0.02);
const LOG_MAX = Math.log(8);
const normalizeAngle = (r: number) => ((((r + 180) % 360) + 360) % 360) - 180;

/** Resolução efetiva da foto na impressão. */
export function effectiveDpi(layer: Layer) {
  return layer.type === 'image' ? (PX_PER_MM * 25.4) / layer.scale : Infinity;
}

function Action({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick(): void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`cc:flex cc:shrink-0 cc:flex-col cc:items-center cc:gap-1 cc:rounded-xl cc:px-2.5 cc:py-1.5 cc:text-[11px] cc:font-medium cc:hover:bg-neutral-100 cc:lg:flex-row cc:lg:gap-2 cc:lg:px-3 cc:lg:py-2 cc:lg:text-sm ${
        danger ? 'cc:text-red-600' : 'cc:text-neutral-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function SelectionControls(p: Props) {
  const { layer, variant } = p;
  const [mode, setMode] = useState<'zoom' | 'rotate'>('zoom');
  const dpi = effectiveDpi(layer);
  const icon = 'cc:h-5 cc:w-5 cc:lg:h-4 cc:lg:w-4';

  const zoomSlider = (
    <input
      type="range"
      min={LOG_MIN}
      max={LOG_MAX}
      step={0.001}
      value={Math.log(layer.scale)}
      onChange={(e) => p.onChange({ scale: Math.exp(Number(e.target.value)) }, false)}
      onPointerUp={p.onCheckpoint}
      onKeyUp={p.onCheckpoint}
      className="cc-range"
      aria-label="Zoom"
    />
  );

  const rotateSlider = (
    <input
      type="range"
      min={-180}
      max={180}
      step={1}
      value={Math.round(normalizeAngle(layer.rotation))}
      onChange={(e) => p.onChange({ rotation: Number(e.target.value) }, false)}
      onPointerUp={p.onCheckpoint}
      onKeyUp={p.onCheckpoint}
      className="cc-range"
      aria-label="Rotação"
    />
  );

  const actions = (
    <>
      <Action icon={<Trash2 className={icon} />} label="Excluir" onClick={p.onRemove} danger />
      {layer.type === 'image' ? (
        <>
          <Action icon={<RefreshCw className={icon} />} label="Trocar" onClick={p.onReplace} />
          <Action icon={<Maximize className={icon} />} label="Preencher" onClick={p.onFill} />
        </>
      ) : (
        <Action icon={<Pencil className={icon} />} label="Editar" onClick={p.onEditText} />
      )}
      <Action icon={<Crosshair className={icon} />} label="Centralizar" onClick={p.onCenter} />
      <Action icon={<RotateCw className={icon} />} label="Girar 90°" onClick={() => p.onChange({ rotation: normalizeAngle(layer.rotation + 90) }, true)} />
      <Action icon={<FlipHorizontal2 className={icon} />} label="Espelhar" onClick={() => p.onChange({ flipX: !layer.flipX }, true)} />
      <Action icon={<Copy className={icon} />} label="Duplicar" onClick={p.onDuplicate} />
      <Action icon={<ArrowUpToLine className={icon} />} label="Frente" onClick={p.onForward} />
      <Action icon={<ArrowDownToLine className={icon} />} label="Trás" onClick={p.onBackward} />
    </>
  );

  const warning = dpi < 150 && (
    <p className="cc:flex cc:items-center cc:gap-2 cc:rounded-lg cc:bg-amber-50 cc:px-3 cc:py-2 cc:text-xs cc:text-amber-800">
      <AlertTriangle className="cc:h-4 cc:w-4 cc:shrink-0" />
      Foto muito ampliada ({Math.round(dpi)} dpi). A impressão pode ficar borrada.
    </p>
  );

  if (variant === 'panel') {
    return (
      <div className="cc:space-y-5 cc:p-5">
        <h3 className="cc:font-semibold">{layer.type === 'image' ? 'Editar foto' : 'Editar texto'}</h3>
        {warning}
        <div>
          <p className="cc-label cc:flex cc:items-center cc:justify-between">
            Tamanho <span className="cc:text-neutral-400">{Math.round(layer.scale * 100)}%</span>
          </p>
          {zoomSlider}
        </div>
        <div>
          <p className="cc-label cc:flex cc:items-center cc:justify-between">
            Rotação <span className="cc:text-neutral-400">{Math.round(normalizeAngle(layer.rotation))}°</span>
          </p>
          {rotateSlider}
        </div>
        <div className="cc:grid cc:grid-cols-2 cc:gap-1">{actions}</div>
      </div>
    );
  }

  return (
    <div className="cc:space-y-2 cc:border-b cc:border-neutral-100 cc:px-3 cc:pt-3">
      {warning}
      <div className="cc:flex cc:items-center cc:gap-3">
        <div className="cc:flex cc:shrink-0 cc:rounded-full cc:bg-neutral-100 cc:p-0.5">
          <button onClick={() => setMode('zoom')} className={`cc-seg ${mode === 'zoom' ? 'cc-seg-on' : ''}`} aria-label="Zoom">
            <ZoomIn className="cc:h-4 cc:w-4" />
          </button>
          <button onClick={() => setMode('rotate')} className={`cc-seg ${mode === 'rotate' ? 'cc-seg-on' : ''}`} aria-label="Girar">
            <RotateCw className="cc:h-4 cc:w-4" />
          </button>
        </div>
        {mode === 'zoom' ? zoomSlider : rotateSlider}
      </div>
      <div className="cc:-mx-3 cc:flex cc:overflow-x-auto cc:px-1 cc:pb-1">{actions}</div>
    </div>
  );
}
