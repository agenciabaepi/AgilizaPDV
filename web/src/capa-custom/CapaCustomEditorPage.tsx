import { ArrowLeft, ChevronDown, ImagePlus, Layers, Loader2, PaintBucket, Redo2, Type, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLojaOnlineCart } from '../hooks/useLojaOnlineCart';
import { useLojaOnlineStore } from '../hooks/useLojaOnlineStore';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { formatCurrency } from '../lib/loja-online';
import { fetchLojaOnlineProduto, fetchLojaOnlineProdutoVariacoes } from '../lib/loja-online-api';
import type { LojaOnlineProduto } from '../lib/loja-online-types';
import { trackLojaOnlineCapa } from '../lib/loja-online-behavior';
import { trackMetaPixel } from '../lib/loja-online-track';
import { AjudaWhatsAppNotificacao } from './components/AjudaWhatsAppNotificacao';
import { FinishModal } from './components/FinishModal';
import { ModelPicker } from './components/ModelPicker';
import { SelectionControls } from './components/SelectionControls';
import { ToolPanel } from './components/ToolPanel';
import { CaseStage, type CaseStageHandle } from './editor/CaseStage';
import { useHistory } from './editor/useHistory';
import { capaModelosFromSkus, isCapaCustomProduto, type CapaModeloOpcao } from './lib/capa-catalogo';
import { saveCapaDesign } from './lib/capa-upload';
import { GOOGLE_FONTS_URL, loadFonts } from './lib/fonts';
import { readImageFile, type LoadedImage } from './lib/image';
import { apagarRascunho, carregarRascunho, chaveRascunho, salvarRascunho } from './lib/rascunho';
import { getMockup } from './lib/mockups';
import { BLEED_MM, caseGeometry, PHONE_MODELS, PX_PER_MM, type PhoneModel } from './phoneModels';
import type { Design, ImageLayer, Layer, LayerPatch, Panel, TextLayer } from './types';
import './capa-custom.css';

const uid = () => Math.random().toString(36).slice(2, 10);

const TABS: { id: Panel; label: string; icon: typeof ImagePlus }[] = [
  { id: 'image', label: 'Foto', icon: ImagePlus },
  { id: 'text', label: 'Texto', icon: Type },
  { id: 'background', label: 'Fundo', icon: PaintBucket },
  { id: 'layers', label: 'Camadas', icon: Layers },
];

function useGoogleFonts() {
  useEffect(() => {
    const id = 'capa-custom-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_URL;
    document.head.appendChild(link);
  }, []);
}

function useLockBodyScroll() {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
}

export function CapaCustomEditorPage() {
  const { produtoId } = useParams<{ produtoId: string }>();
  const { store, link, mostrarPreco, titulo } = useLojaOnlineStore();
  const [produto, setProduto] = useState<LojaOnlineProduto | null>(null);
  const [options, setOptions] = useState<CapaModeloOpcao[]>([]);
  const [loading, setLoading] = useState(true);

  useGoogleFonts();
  useLockBodyScroll();

  useEffect(() => {
    if (!store?.empresa_id || !produtoId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchLojaOnlineProduto(store.empresa_id, produtoId),
      fetchLojaOnlineProdutoVariacoes(store.empresa_id, produtoId),
    ])
      .then(([p, skus]) => {
        if (cancelled) return;
        setProduto(p);
        setOptions(capaModelosFromSkus(skus));
      })
      .catch(() => {
        if (!cancelled) setProduto(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [store?.empresa_id, produtoId]);

  const voltar = link(produtoId ? `produto/${produtoId}` : '');

  if (loading || !produto || !isCapaCustomProduto(produto) || options.length === 0) {
    return (
      <div className="cc-root cc:fixed cc:inset-0 cc:z-[60] cc:flex cc:flex-col cc:items-center cc:justify-center cc:gap-4 cc:bg-neutral-100 cc:p-6 cc:text-center">
        {loading ? (
          <Loader2 className="cc:h-8 cc:w-8 cc:animate-spin cc:text-neutral-400" />
        ) : (
          <>
            <p className="cc:text-lg cc:font-semibold">
              {!produto || !isCapaCustomProduto(produto)
                ? 'Este produto não pode ser personalizado.'
                : 'Nenhum modelo disponível no momento.'}
            </p>
            <Link to={voltar} className="cc-btn-primary">
              Voltar para {titulo}
            </Link>
          </>
        )}
      </div>
    );
  }

  return <Editor produto={produto} options={options} mostrarPreco={mostrarPreco} titulo={titulo} voltar={voltar} />;
}

function Editor({
  produto,
  options,
  mostrarPreco,
  titulo,
  voltar,
}: {
  produto: LojaOnlineProduto;
  options: CapaModeloOpcao[];
  mostrarPreco: boolean;
  titulo: string;
  voltar: string;
}) {
  const { store, link } = useLojaOnlineStore();
  const { addItem, quantidadeDoProduto } = useLojaOnlineCart();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const [model, setModel] = useState<PhoneModel | undefined>();
  const [pickerOpen, setPickerOpen] = useState(true);
  const [finishOpen, setFinishOpen] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fontsVersion, setFontsVersion] = useState(0);
  const [uploads, setUploads] = useState<LoadedImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const history = useHistory<Design>({ background: 'transparent', layers: [] });
  const design = history.state;
  const { set: setDesign, checkpoint, reset: resetDesign } = history;

  const chaveDraft = store?.empresa_id ? chaveRascunho(store.empresa_id, produto.id) : null;
  const [rascunhoPronto, setRascunhoPronto] = useState(false);
  const [rascunhoRestaurado, setRascunhoRestaurado] = useState(false);
  const salvarPendente = useRef<(() => void) | null>(null);
  const rascunhoDescartado = useRef(false);

  useEffect(() => {
    if (!chaveDraft) {
      setRascunhoPronto(true);
      return;
    }
    let cancelled = false;
    carregarRascunho(chaveDraft)
      .then((r) => {
        if (cancelled || !r || r.design.layers.length === 0) return;
        const op = options.find((o) => o.model.id === r.modelId);
        if (!op) return;
        setModel(op.model);
        setPickerOpen(false);
        resetDesign(r.design);
        setUploads(r.uploads);
        setRascunhoRestaurado(true);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRascunhoPronto(true);
      });
    return () => {
      cancelled = true;
    };
  }, [chaveDraft, options, resetDesign]);

  useEffect(() => {
    if (!rascunhoPronto || !chaveDraft) return;
    const run = () => {
      salvarPendente.current = null;
      if (rascunhoDescartado.current) return;
      if (!model || design.layers.length === 0) {
        void apagarRascunho(chaveDraft).catch(() => {});
        return;
      }
      void salvarRascunho(chaveDraft, { modelId: model.id, design, uploads }).catch(() => {});
    };
    salvarPendente.current = run;
    const t = window.setTimeout(run, 700);
    return () => window.clearTimeout(t);
  }, [rascunhoPronto, chaveDraft, model, design, uploads]);

  useEffect(() => {
    const flush = () => salvarPendente.current?.();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, []);

  useEffect(() => {
    if (!rascunhoRestaurado) return;
    const t = window.setTimeout(() => setRascunhoRestaurado(false), 9000);
    return () => window.clearTimeout(t);
  }, [rascunhoRestaurado]);

  const comecarDoZero = () => {
    setRascunhoRestaurado(false);
    resetDesign({ background: 'transparent', layers: [] });
    setUploads([]);
    setSelectedId(null);
    setModel(undefined);
    setPickerOpen(true);
    if (chaveDraft) void apagarRascunho(chaveDraft).catch(() => {});
  };

  const stageRef = useRef<CaseStageHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);

  const opcao = model ? options.find((o) => o.model.id === model.id) : undefined;
  const geometry = useMemo(() => caseGeometry(model ?? options[0]?.model ?? PHONE_MODELS[0]), [model, options]);
  const mockup = model ? getMockup(model.id) : undefined;
  const selected = design.layers.find((l) => l.id === selectedId) ?? null;
  const activePanel = panel ?? (isDesktop ? 'image' : null);

  useEffect(() => {
    loadFonts().then(() => setFontsVersion((v) => v + 1));
  }, []);

  useEffect(() => {
    trackLojaOnlineCapa('editor_aberto', produto.id);
  }, [produto.id]);

  const updateLayer = useCallback(
    (id: string, patch: LayerPatch, commit = true) => {
      setDesign((d) => ({ ...d, layers: d.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)) }), commit);
    },
    [setDesign],
  );

  const addLayer = useCallback(
    (layer: Layer) => {
      setDesign((d) => ({ ...d, layers: [...d.layers, layer] }));
      setSelectedId(layer.id);
    },
    [setDesign],
  );

  const coverScale = (w: number, h: number) => {
    const bleed = BLEED_MM * PX_PER_MM * 2;
    return Math.max((geometry.width + bleed) / w, (geometry.height + bleed) / h);
  };

  const addImage = (img: LoadedImage) => {
    const layer: ImageLayer = {
      id: uid(),
      type: 'image',
      src: img.src,
      width: img.width,
      height: img.height,
      x: geometry.width / 2,
      y: geometry.height / 2,
      rotation: 0,
      scale: coverScale(img.width, img.height),
      flipX: false,
    };
    addLayer(layer);
  };

  const addText = (text: string, overrides: Partial<TextLayer> = {}) => {
    trackLojaOnlineCapa('texto', produto.id, { modelo: model?.name });
    addLayer({
      id: uid(),
      type: 'text',
      text,
      fontFamily: 'Pacifico',
      fontSize: geometry.width * 0.11,
      fill: '#111111',
      stroke: null,
      bold: false,
      italic: false,
      x: geometry.width / 2,
      y: geometry.height * 0.72,
      rotation: 0,
      scale: 1,
      flipX: false,
      ...overrides,
    });
  };

  const openUpload = (replaceId: string | null = null) => {
    replaceTarget.current = replaceId;
    fileRef.current?.click();
  };

  const handleFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    setError(null);
    for (const file of files) {
      try {
        const img = await readImageFile(file);
        trackLojaOnlineCapa('foto', produto.id, { modelo: model?.name, troca: Boolean(replaceTarget.current) });
        setUploads((u) => [img, ...u]);
        const target = replaceTarget.current;
        const old = target ? design.layers.find((l) => l.id === target) : undefined;
        if (old?.type === 'image') {
          const visibleWidth = old.width * old.scale;
          updateLayer(old.id, { src: img.src, width: img.width, height: img.height, scale: visibleWidth / img.width });
          replaceTarget.current = null;
        } else {
          addImage(img);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Falha ao carregar a imagem.';
        trackLojaOnlineCapa('erro', produto.id, { etapa_erro: 'foto', msg });
        setError(msg);
      }
    }
    if (!isDesktop) setPanel(null);
  };

  const removeLayer = useCallback(
    (id: string) => {
      setDesign((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== id) }));
      setSelectedId((s) => (s === id ? null : s));
    },
    [setDesign],
  );

  const duplicateLayer = (id: string) => {
    const l = design.layers.find((x) => x.id === id);
    if (!l) return;
    const offset = geometry.width * 0.04;
    addLayer({ ...l, id: uid(), x: l.x + offset, y: l.y + offset });
  };

  const moveLayer = (id: string, dir: 1 | -1) => {
    setDesign((d) => {
      const i = d.layers.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.layers.length) return d;
      const layers = [...d.layers];
      [layers[i], layers[j]] = [layers[j], layers[i]];
      return { ...d, layers };
    });
  };

  const fillCase = (id: string) => {
    const l = design.layers.find((x) => x.id === id);
    if (l?.type !== 'image') return;
    updateLayer(id, { x: geometry.width / 2, y: geometry.height / 2, rotation: 0, scale: coverScale(l.width, l.height) });
  };

  const centerLayer = (id: string) => updateLayer(id, { x: geometry.width / 2, y: geometry.height / 2 });

  const changeModel = (next: PhoneModel) => {
    setPickerOpen(false);
    if (next.id !== model?.id) {
      trackLojaOnlineCapa('modelo', produto.id, { modelo: next.name, troca: Boolean(model) });
      if (!model) trackMetaPixel('CustomizeProduct', { content_ids: [produto.id], content_type: 'product' });
    }
    if (model && next.id !== model.id) {
      const ng = caseGeometry(next);
      const kx = ng.width / geometry.width;
      const ky = ng.height / geometry.height;
      setDesign((d) => ({ ...d, layers: d.layers.map((l) => ({ ...l, x: l.x * kx, y: l.y * ky, scale: l.scale * kx })) }));
    }
    setModel(next);
  };

  const maxQty = opcao?.controlaEstoque ? Math.max(0, opcao.estoque - quantidadeDoProduto(opcao.skuId)) : null;

  const addToCart: React.ComponentProps<typeof FinishModal>['onConfirm'] = async ({ print, preview, quantidade, onProgress }) => {
    if (!store?.empresa_id || !model || !opcao) throw new Error('Escolha o modelo do celular.');
    if (maxQty !== null && quantidade > maxQty) {
      throw new Error(maxQty > 0 ? `Só temos ${maxQty} unidade(s) deste modelo.` : 'Este modelo está esgotado.');
    }
    let personalizacao: Awaited<ReturnType<typeof saveCapaDesign>>;
    try {
      personalizacao = await saveCapaDesign({
        empresaId: store.empresa_id,
        produtoId: opcao.skuId,
        produtoPaiId: produto.id,
        model,
        design,
        print,
        preview,
        onProgress,
      });
    } catch (err) {
      trackLojaOnlineCapa('erro', produto.id, {
        etapa_erro: 'carrinho',
        modelo: model.name,
        msg: err instanceof Error ? err.message : 'Falha ao salvar a arte.',
      });
      throw err;
    }
    trackLojaOnlineCapa('carrinho', produto.id, { modelo: model.name, quantidade, valor: opcao.preco * quantidade });
    addItem(
      {
        ...produto,
        id: opcao.skuId,
        nome: opcao.skuNome,
        preco: opcao.preco,
        imagem: personalizacao.previewUrl,
        loja_online_imagens_json: null,
        estoque_atual: opcao.estoque,
        controla_estoque: opcao.controlaEstoque ? 1 : 0,
      },
      quantidade,
      null,
      { produtoPaiId: produto.id, variacaoLabel: model.name, personalizacao },
    );
    rascunhoDescartado.current = true;
    salvarPendente.current = null;
    if (chaveDraft) void apagarRascunho(chaveDraft).catch(() => {});
    navigate(link('carrinho'));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if (!selectedId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeLayer(selectedId);
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const l = design.layers.find((x) => x.id === selectedId);
        if (!l) return;
        const step = (e.shiftKey ? 10 : 1) * 12;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        updateLayer(selectedId, { x: l.x + dx, y: l.y + dy });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, design.layers, history, removeLayer, updateLayer]);

  const toolPanel = activePanel && (
    <ToolPanel
      panel={activePanel}
      design={design}
      selected={selected}
      uploads={uploads}
      onUpload={() => openUpload()}
      onAddImage={addImage}
      onAddText={addText}
      onUpdateLayer={updateLayer}
      onCheckpoint={checkpoint}
      onBackground={(background) => setDesign((d) => ({ ...d, background }))}
      onSelect={setSelectedId}
      onMove={moveLayer}
      onRemove={removeLayer}
      onClose={isDesktop ? undefined : () => setPanel(null)}
    />
  );

  const selectionControls = selected && (
    <SelectionControls
      layer={selected}
      variant={isDesktop ? 'panel' : 'bar'}
      onChange={(patch, commit) => updateLayer(selected.id, patch, commit)}
      onCheckpoint={checkpoint}
      onFill={() => fillCase(selected.id)}
      onCenter={() => centerLayer(selected.id)}
      onDuplicate={() => duplicateLayer(selected.id)}
      onForward={() => moveLayer(selected.id, 1)}
      onBackward={() => moveLayer(selected.id, -1)}
      onRemove={() => removeLayer(selected.id)}
      onReplace={() => openUpload(selected.id)}
      onEditText={() => setPanel('text')}
    />
  );

  return (
    <div className="cc-root cc:fixed cc:inset-0 cc:z-[60] cc:flex cc:h-dvh cc:flex-col cc:bg-neutral-100 cc:text-neutral-900">
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />

      <header className="cc:z-20 cc:flex cc:h-14 cc:shrink-0 cc:items-center cc:gap-2 cc:border-b cc:border-neutral-200 cc:bg-white cc:px-2 cc:lg:px-5">
        <Link to={voltar} className="cc-icon-btn" aria-label="Voltar para a loja">
          <ArrowLeft className="cc:h-5 cc:w-5" />
        </Link>
        <span className="cc:hidden cc:max-w-[220px] cc:truncate cc:text-base cc:font-bold cc:tracking-tight cc:md:block">{titulo}</span>
        <button
          onClick={() => setPickerOpen(true)}
          className="cc:flex cc:min-w-0 cc:items-center cc:gap-1 cc:rounded-full cc:border cc:border-neutral-200 cc:px-3 cc:py-1.5 cc:text-sm cc:font-medium cc:hover:border-brand-400 cc:md:ml-4"
        >
          <span className="cc:truncate">{model?.name ?? 'Selecione o modelo'}</span>
          {mostrarPreco && opcao && <span className="cc:hidden cc:shrink-0 cc:text-neutral-500 cc:sm:inline">· {formatCurrency(opcao.preco)}</span>}
          <ChevronDown className="cc:h-4 cc:w-4 cc:shrink-0 cc:text-neutral-500" />
        </button>
        <div className="cc:ml-auto cc:flex cc:items-center cc:gap-1">
          <button onClick={history.undo} disabled={!history.canUndo} className="cc-icon-btn" aria-label="Desfazer">
            <Undo2 className="cc:h-5 cc:w-5" />
          </button>
          <button onClick={history.redo} disabled={!history.canRedo} className="cc-icon-btn" aria-label="Refazer">
            <Redo2 className="cc:h-5 cc:w-5" />
          </button>
          <button
            onClick={() => {
              setSelectedId(null);
              setFinishOpen(true);
              trackLojaOnlineCapa('finalizar', produto.id, { modelo: model?.name, camadas: design.layers.length });
            }}
            disabled={!model || design.layers.length === 0}
            className="cc-btn-primary cc:ml-1 cc:whitespace-nowrap"
          >
            Finalizar
          </button>
        </div>
      </header>

      <main className="cc:relative cc:flex cc:min-h-0 cc:flex-1">
        {isDesktop && (
          <aside className="cc:flex cc:w-[380px] cc:shrink-0 cc:border-r cc:border-neutral-200 cc:bg-white">
            <nav className="cc:flex cc:w-20 cc:shrink-0 cc:flex-col cc:gap-1 cc:border-r cc:border-neutral-100 cc:p-2">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setPanel(t.id)}
                  className={`cc:flex cc:flex-col cc:items-center cc:gap-1 cc:rounded-xl cc:py-3 cc:text-xs cc:font-medium ${
                    activePanel === t.id ? 'cc:bg-brand-50 cc:text-brand-600' : 'cc:text-neutral-600 cc:hover:bg-neutral-50'
                  }`}
                >
                  <t.icon className="cc:h-5 cc:w-5" />
                  {t.label}
                </button>
              ))}
            </nav>
            <div className="cc:min-w-0 cc:flex-1 cc:overflow-y-auto">{toolPanel}</div>
          </aside>
        )}

        <section className="cc-canvas-bg cc:relative cc:min-w-0 cc:flex-1">
          <CaseStage
            ref={stageRef}
            geometry={geometry}
            mockup={mockup}
            design={design}
            selectedId={selectedId}
            fontsVersion={fontsVersion}
            onSelect={(id) => {
              setSelectedId(id);
              if (!isDesktop && id && panel !== 'text') setPanel(null);
            }}
            onChange={(id, patch) => updateLayer(id, patch, false)}
            onCommit={checkpoint}
          />
          {design.layers.length === 0 && model && (
            <div className="cc:pointer-events-none cc:absolute cc:inset-0 cc:flex cc:items-center cc:justify-center">
              <button onClick={() => openUpload()} className="cc-btn-primary cc:pointer-events-auto cc:gap-2 cc:px-5 cc:py-3 cc:text-base cc:shadow-lg">
                <ImagePlus className="cc:h-5 cc:w-5" />
                Enviar minha foto
              </button>
            </div>
          )}
          {error && (
            <div className="cc:absolute cc:inset-x-3 cc:top-3 cc:z-10 cc:rounded-xl cc:bg-red-600 cc:px-4 cc:py-2 cc:text-sm cc:text-white cc:shadow-sm" onClick={() => setError(null)}>
              {error}
            </div>
          )}
        </section>

        {isDesktop && (
          <aside className="cc:w-80 cc:shrink-0 cc:overflow-y-auto cc:border-l cc:border-neutral-200 cc:bg-white">
            {selectionControls ?? (
              <div className="cc:p-6 cc:text-sm cc:text-neutral-500">
                <p className="cc:mb-2 cc:font-semibold cc:text-neutral-800">Dicas</p>
                <ul className="cc:list-disc cc:space-y-1 cc:pl-4">
                  <li>Clique numa foto ou texto para editar.</li>
                  <li>Arraste para mover; use os cantos para aumentar e a alça de cima para girar.</li>
                  <li>A parte esmaecida fica fora da capa e não será impressa.</li>
                  <li>Quando terminar, clique em Finalizar para escolher a quantidade e colocar no carrinho.</li>
                </ul>
              </div>
            )}
          </aside>
        )}
      </main>

      {!isDesktop && (
        <div className="cc:z-20 cc:shrink-0 cc:bg-white cc:pb-[env(safe-area-inset-bottom)] cc:shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          {panel ? <div className="cc:max-h-[46dvh] cc:overflow-y-auto cc:border-b cc:border-neutral-100">{toolPanel}</div> : selectionControls}
          <nav className="cc:grid cc:grid-cols-4">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setPanel((p) => (p === t.id ? null : t.id))}
                className={`cc:flex cc:flex-col cc:items-center cc:gap-0.5 cc:py-2 cc:text-[11px] cc:font-medium ${
                  panel === t.id ? 'cc:text-brand-600' : 'cc:text-neutral-600'
                }`}
              >
                <t.icon className="cc:h-5 cc:w-5" />
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {rascunhoRestaurado && (
        <div className="cc-rascunho-aviso" role="status">
          <span>Recuperamos a capa que você estava criando.</span>
          <button type="button" onClick={comecarDoZero}>
            Começar do zero
          </button>
        </div>
      )}
      {pickerOpen && rascunhoPronto && (
        <ModelPicker
          options={options}
          current={model}
          mostrarPreco={mostrarPreco}
          onSelect={changeModel}
          onClose={model ? () => setPickerOpen(false) : () => navigate(voltar)}
        />
      )}
      {finishOpen && model && opcao && (
        <FinishModal
          model={model}
          preco={opcao.preco}
          mostrarPreco={mostrarPreco}
          maxQty={maxQty}
          design={design}
          stage={stageRef}
          onConfirm={addToCart}
          onChangeModel={() => {
            setFinishOpen(false);
            setPickerOpen(true);
          }}
          onClose={() => setFinishOpen(false)}
        />
      )}
      <AjudaWhatsAppNotificacao
        telefone={store?.loja_online_whatsapp}
        lojaNome={titulo}
        pausado={pickerOpen || finishOpen || rascunhoRestaurado}
      />
    </div>
  );
}

export default CapaCustomEditorPage;
