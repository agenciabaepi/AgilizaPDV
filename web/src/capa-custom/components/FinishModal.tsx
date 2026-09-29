import { Loader2, Minus, Plus, ShoppingBag, Smartphone, X } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { formatCurrency } from '../../lib/loja-online';
import type { CaseStageHandle, PrintFile } from '../editor/CaseStage';
import { dataUrlToBlob } from '../lib/image';
import type { PhoneModel } from '../phoneModels';
import type { Design } from '../types';
import { effectiveDpi } from './SelectionControls';

interface Props {
  model: PhoneModel;
  preco: number;
  mostrarPreco: boolean;
  /** Quantidade máxima que ainda cabe no estoque; `null` = sem controle. */
  maxQty: number | null;
  design: Design;
  stage: RefObject<CaseStageHandle>;
  onConfirm(files: { print: PrintFile; preview: Blob; quantidade: number; onProgress(message: string): void }): Promise<void>;
  onChangeModel(): void;
  onClose(): void;
  /** Coloca no carrinho sem pedir confirmação; o modal só aparece se houver aviso ou erro. */
  auto?: boolean;
  quantidadeInicial?: number;
}

type Status = { kind: 'idle' } | { kind: 'saving'; message: string } | { kind: 'error'; message: string };

export function FinishModal({
  model,
  preco,
  mostrarPreco,
  maxQty,
  design,
  stage,
  onConfirm,
  onChangeModel,
  onClose,
  auto = false,
  quantidadeInicial = 1,
}: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const lowRes = design.layers.some((l) => effectiveDpi(l) < 150);
  const saving = status.kind === 'saving';
  const semEstoque = maxQty !== null && maxQty <= 0;
  const [qty, setQty] = useState(() => (maxQty !== null ? Math.max(1, Math.min(quantidadeInicial, maxQty)) : quantidadeInicial));
  const [autoAtivo, setAutoAtivo] = useState(auto && !lowRes && !semEstoque);
  const autoDisparado = useRef(false);

  useEffect(() => {
    // espera o transformer sumir após desselecionar
    const t = setTimeout(() => setPreview(stage.current?.exportImage({ withMockup: true, pixelRatio: 0.5 }) ?? null), 50);
    return () => clearTimeout(t);
  }, [stage]);

  const confirm = async () => {
    if (!preview || saving || semEstoque) return;
    setStatus({ kind: 'saving', message: 'Gerando arquivo de impressão…' });
    try {
      const [print, previewBlob] = await Promise.all([stage.current!.exportPrint(), dataUrlToBlob(preview)]);
      await onConfirm({
        print,
        preview: previewBlob,
        quantidade: qty,
        onProgress: (message) => setStatus({ kind: 'saving', message }),
      });
    } catch (err) {
      setAutoAtivo(false);
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Não foi possível adicionar ao carrinho.' });
    }
  };

  useEffect(() => {
    if (!autoAtivo || !preview || autoDisparado.current) return;
    autoDisparado.current = true;
    void confirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara uma vez quando a prévia fica pronta
  }, [autoAtivo, preview]);

  if (autoAtivo) {
    return (
      <div className="cc:fixed cc:inset-0 cc:z-50 cc:flex cc:items-center cc:justify-center cc:bg-black/50 cc:p-6">
        <div className="cc:flex cc:w-full cc:max-w-xs cc:flex-col cc:items-center cc:gap-3 cc:rounded-3xl cc:bg-white cc:p-6 cc:text-center">
          {preview ? (
            <img src={preview} alt="" className="cc:max-h-[30dvh] cc:drop-shadow-xl" />
          ) : null}
          <p className="cc:flex cc:items-center cc:gap-2 cc:text-sm cc:font-semibold">
            <Loader2 className="cc:h-5 cc:w-5 cc:animate-spin" />
            {status.kind === 'saving' ? status.message : 'Preparando sua capa…'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="cc:fixed cc:inset-0 cc:z-50 cc:flex cc:items-end cc:justify-center cc:bg-black/50 cc:sm:items-center cc:sm:p-6" onClick={saving ? undefined : onClose}>
      <div
        className="cc:flex cc:max-h-[94dvh] cc:w-full cc:flex-col cc:overflow-y-auto cc:rounded-t-3xl cc:bg-white cc:sm:max-w-3xl cc:sm:flex-row cc:sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cc-canvas-bg cc:flex cc:items-center cc:justify-center cc:p-6 cc:sm:w-1/2">
          {preview ? (
            <img src={preview} alt="Prévia da capa" className="cc:max-h-[34dvh] cc:drop-shadow-xl cc:sm:max-h-[60dvh]" />
          ) : (
            <Loader2 className="cc:h-8 cc:w-8 cc:animate-spin cc:text-neutral-400" />
          )}
        </div>

        <div className="cc:flex cc:flex-1 cc:flex-col cc:gap-4 cc:p-5 cc:sm:p-6">
          <div className="cc:flex cc:items-start">
            <div>
              <h2 className="cc:text-lg cc:font-semibold">Ficou incrível!</h2>
              <p className="cc:text-sm cc:text-neutral-500">Confira sua capa antes de colocar no carrinho.</p>
            </div>
            <button onClick={onClose} disabled={saving} className="cc-icon-btn cc:ml-auto" aria-label="Fechar">
              <X className="cc:h-5 cc:w-5" />
            </button>
          </div>

          <div className="cc:flex cc:items-center cc:gap-3 cc:rounded-2xl cc:border cc:border-neutral-200 cc:p-3">
            <Smartphone className="cc:h-5 cc:w-5 cc:shrink-0 cc:text-neutral-500" />
            <div className="cc:min-w-0 cc:flex-1">
              <p className="cc:text-xs cc:text-neutral-500">Modelo</p>
              <p className="cc:truncate cc:font-semibold">{model.name}</p>
            </div>
            <button type="button" onClick={onChangeModel} disabled={saving} className="cc:text-sm cc:font-semibold cc:text-brand-600">
              Trocar
            </button>
          </div>

          {lowRes && (
            <p className="cc:rounded-lg cc:bg-amber-50 cc:px-3 cc:py-2 cc:text-xs cc:text-amber-800">
              Alguma foto está ampliada demais e pode sair borrada. Volte e diminua o zoom ou use uma foto maior.
            </p>
          )}

          <div className="cc:flex cc:items-center cc:justify-between">
            <div className="cc:flex cc:items-center cc:rounded-full cc:border cc:border-neutral-200">
              <button
                type="button"
                className="cc-icon-btn"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={saving || qty <= 1}
                aria-label="Diminuir quantidade"
              >
                <Minus className="cc:h-4 cc:w-4" />
              </button>
              <span className="cc:w-8 cc:text-center cc:font-semibold">{qty}</span>
              <button
                type="button"
                className="cc-icon-btn"
                onClick={() => setQty((q) => q + 1)}
                disabled={saving || (maxQty !== null && qty >= maxQty)}
                aria-label="Aumentar quantidade"
              >
                <Plus className="cc:h-4 cc:w-4" />
              </button>
            </div>
            {mostrarPreco && <p className="cc:text-xl cc:font-bold">{formatCurrency(preco * qty)}</p>}
          </div>

          {semEstoque && (
            <p className="cc:rounded-lg cc:bg-red-50 cc:px-3 cc:py-2 cc:text-sm cc:text-red-700">
              Este modelo acabou de esgotar. Escolha outro modelo para continuar.
            </p>
          )}
          {status.kind === 'error' && <p className="cc:text-sm cc:text-red-600">{status.message}</p>}

          <div className="cc:mt-auto cc:flex cc:flex-col cc:gap-2 cc:pt-2">
            <button type="button" onClick={confirm} disabled={!preview || saving || semEstoque} className="cc-btn-primary cc:gap-2 cc:py-3 cc:text-base">
              {saving ? (
                <>
                  <Loader2 className="cc:h-5 cc:w-5 cc:animate-spin" />
                  {status.message}
                </>
              ) : (
                <>
                  <ShoppingBag className="cc:h-5 cc:w-5" />
                  Adicionar ao carrinho
                </>
              )}
            </button>
            <button type="button" onClick={onClose} disabled={saving} className="cc-btn-secondary">
              Continuar editando
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
