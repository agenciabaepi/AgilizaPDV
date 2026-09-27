import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Circle, Group, Image as KImage, Layer as KLayer, Line, Rect, Stage, Text as KText, Transformer } from 'react-konva';
import { BLEED_MM, PX_PER_MM, type CaseGeometry } from '../phoneModels';
import { getCachedImage, preloadImage } from '../lib/image';
import { loadMockup, type LoadedMockup, type MockupImages } from '../lib/mockups';
import { setPngDpi } from '../lib/png';
import type { Design, ImageLayer, Layer, LayerPatch, TextLayer } from '../types';

Konva.hitOnDragEnabled = true;

export interface PrintFile {
  blob: Blob;
  width: number;
  height: number;
  dpi: number;
  /** A resolução ideal passou do limite do aparelho e o arquivo saiu menor. */
  limited: boolean;
}

export interface CaseStageHandle {
  /** Prévia em PNG. `pixelRatio` é relativo à resolução base de impressão. */
  exportImage(opts: { withMockup: boolean; pixelRatio?: number }): string;
  /** Arquivo de impressão na resolução nativa das fotos enviadas, com sangria e sem máscara. */
  exportPrint(): Promise<PrintFile>;
}

/** Limites de canvas dos navegadores (o Safari do iPhone é o mais restrito). */
const MAX_CANVAS_EDGE = 16384;
/** O arquivo vai para o Storage no checkout: ~24 MP já passa de 800 dpi numa capa e cabe no limite de upload. */
const MAX_PRINT_PIXELS = 24_000_000;
const MAX_PRINT_PIXELS_MOBILE = 16_000_000;

interface Props {
  geometry: CaseGeometry;
  mockup?: MockupImages;
  design: Design;
  selectedId: string | null;
  fontsVersion: number;
  onSelect(id: string | null): void;
  /** Atualização contínua (sem entrada no histórico). */
  onChange(id: string, patch: LayerPatch): void;
  onCommit(): void;
}

const MIN_SCALE = 0.02;
const MAX_SCALE = 20;
const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

const measurer = new Konva.Text();

export function textFontStyle(l: TextLayer) {
  return [l.italic && 'italic', l.bold && 'bold'].filter(Boolean).join(' ') || 'normal';
}

function textProps(l: TextLayer) {
  const strokeWidth = l.stroke ? l.fontSize * 0.08 : 0;
  return {
    text: l.text || ' ',
    fontFamily: `"${l.fontFamily}", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`,
    fontSize: l.fontSize,
    fontStyle: textFontStyle(l),
    lineHeight: 1.1,
    align: 'center',
    padding: strokeWidth,
    fill: l.fill,
    stroke: l.stroke ?? undefined,
    strokeWidth,
    fillAfterStrokeEnabled: true,
    lineJoin: 'round' as const,
  };
}

function useLoadedImage(src: string | undefined) {
  const [img, setImg] = useState(() => (src ? getCachedImage(src) : undefined));
  useEffect(() => {
    setImg(src ? getCachedImage(src) : undefined);
    if (!src) return;
    let alive = true;
    preloadImage(src).then((i) => alive && setImg(i), () => undefined);
    return () => {
      alive = false;
    };
  }, [src]);
  return img;
}

interface ShapeHandlers {
  draggable: boolean;
  onMouseDown(): void;
  onTouchStart(): void;
  onDragMove(e: KonvaEventObject<DragEvent>): void;
  onDragEnd(): void;
  onTransform(e: KonvaEventObject<Event>): void;
  onTransformEnd(): void;
}

interface ShapeProps {
  layer: Layer;
  fontsVersion: number;
  handlers?: ShapeHandlers;
  nodeRef?: (node: Konva.Node | null) => void;
}

function transformProps(l: Layer) {
  return { x: l.x, y: l.y, rotation: l.rotation, scaleX: l.scale * (l.flipX ? -1 : 1), scaleY: l.scale };
}

function ImageShape({ layer, handlers, nodeRef }: ShapeProps & { layer: ImageLayer }) {
  const img = useLoadedImage(layer.src);
  return (
    <KImage
      ref={nodeRef}
      image={img}
      width={layer.width}
      height={layer.height}
      offsetX={layer.width / 2}
      offsetY={layer.height / 2}
      {...transformProps(layer)}
      listening={!!handlers}
      {...handlers}
    />
  );
}

function TextShape({ layer, fontsVersion, handlers, nodeRef }: ShapeProps & { layer: TextLayer }) {
  const props = textProps(layer);
  const size = useMemo(() => {
    measurer.setAttrs(props);
    return { w: measurer.width(), h: measurer.height() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer.text, layer.fontFamily, layer.fontSize, layer.bold, layer.italic, layer.stroke, fontsVersion]);
  return (
    <KText
      ref={nodeRef}
      {...props}
      offsetX={size.w / 2}
      offsetY={size.h / 2}
      {...transformProps(layer)}
      listening={!!handlers}
      {...handlers}
    />
  );
}

function LayerShape(p: ShapeProps) {
  return p.layer.type === 'image' ? <ImageShape {...p} layer={p.layer} /> : <TextShape {...p} layer={p.layer} />;
}

function roundedRectPath(ctx: Konva.Context, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(w, 0, w, h, r);
  ctx.arcTo(w, h, 0, h, r);
  ctx.arcTo(0, h, 0, 0, r);
  ctx.arcTo(0, 0, w, 0, r);
  ctx.closePath();
}

function CameraMockup({ g }: { g: CaseGeometry }) {
  const c = g.camera;
  return (
    <Group listening={false}>
      <Rect
        x={c.x}
        y={c.y}
        width={c.w}
        height={c.h}
        cornerRadius={c.r}
        fill="#1b1b1e"
        stroke="#3d3d42"
        strokeWidth={8}
        shadowColor="#000"
        shadowOpacity={0.35}
        shadowBlur={30}
      />
      {c.lenses.map((l, i) => (
        <Group key={i} x={l.cx} y={l.cy}>
          <Circle
            radius={l.r}
            fillRadialGradientStartRadius={0}
            fillRadialGradientEndRadius={l.r}
            fillRadialGradientColorStops={[0, '#52525b', 0.75, '#27272a', 1, '#0a0a0b']}
            stroke="#71717a"
            strokeWidth={l.r * 0.06}
          />
          <Circle
            radius={l.r * 0.55}
            fillRadialGradientStartRadius={0}
            fillRadialGradientEndRadius={l.r * 0.55}
            fillRadialGradientColorStops={[0, '#1e3a5f', 0.6, '#0b1220', 1, '#000']}
          />
          <Circle x={-l.r * 0.18} y={-l.r * 0.2} radius={l.r * 0.12} fill="#fff" opacity={0.35} />
        </Group>
      ))}
      {c.flash && <Circle x={c.flash.cx} y={c.flash.cy} radius={c.flash.r} fill="#f3eccf" stroke="#8a8a8a" strokeWidth={4} />}
    </Group>
  );
}

export const CaseStage = forwardRef<CaseStageHandle, Props>(function CaseStage(
  { geometry: g, mockup, design, selectedId, fontsVersion, onSelect, onChange, onCommit },
  ref,
) {
  const [loaded, setLoaded] = useState<LoadedMockup | null>(null);
  useEffect(() => {
    setLoaded(null);
    if (!mockup) return;
    let alive = true;
    loadMockup(mockup).then(
      (m) => alive && setLoaded(m),
      (err) => console.error(err),
    );
    return () => {
      alive = false;
    };
  }, [mockup?.photo, mockup?.mask]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Posição das imagens do mockup no espaço do design: a área branca da máscara cobre exatamente a capa. */
  const photoRect = useMemo(() => {
    if (!loaded) return null;
    const sx = g.width / loaded.maskBox.w;
    const sy = g.height / loaded.maskBox.h;
    return { x: -loaded.maskBox.x * sx, y: -loaded.maskBox.y * sy, w: loaded.width * sx, h: loaded.height * sy, sx, sy };
  }, [loaded, g.width, g.height]);

  /** Área enquadrada na tela e na prévia: capa + foto inteira. */
  const frame = useMemo(() => {
    if (!loaded || !photoRect) return { x: 0, y: 0, w: g.width, h: g.height };
    const pb = loaded.photoBox;
    const x0 = Math.min(0, photoRect.x + pb.x * photoRect.sx);
    const y0 = Math.min(0, photoRect.y + pb.y * photoRect.sy);
    const x1 = Math.max(g.width, photoRect.x + (pb.x + pb.w) * photoRect.sx);
    const y1 = Math.max(g.height, photoRect.y + (pb.y + pb.h) * photoRect.sy);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }, [loaded, photoRect, g.width, g.height]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const ghostRef = useRef<Konva.Group>(null);
  const shadowRef = useRef<Konva.Rect>(null);
  const caseBgRef = useRef<Konva.Node | null>(null);
  const setCaseBg = (n: Konva.Node | null) => {
    caseBgRef.current = n;
  };
  const guidesRef = useRef<Konva.Group>(null);
  const mockupRef = useRef<Konva.Group>(null);
  const artRef = useRef<Konva.Group>(null);
  const maskRef = useRef<Konva.Image>(null);
  const nodes = useRef(new Map<string, Konva.Node>());
  const pinch = useRef<{ dist: number; angle: number; scale: number; rotation: number } | null>(null);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [guides, setGuides] = useState({ v: false, h: false });
  const coarse = useMemo(() => window.matchMedia('(pointer: coarse)').matches, []);

  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = size.w < 640 ? 20 : 40;
  const scale = Math.max(0.01, Math.min((size.w - pad * 2) / frame.w, (size.h - pad * 2) / frame.h));
  const ox = (size.w - frame.w * scale) / 2 - frame.x * scale;
  const oy = (size.h - frame.h * scale) / 2 - frame.y * scale;
  const transparent = design.background === 'transparent';

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? nodes.current.get(selectedId) : undefined;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, design.layers, fontsVersion, size]);

  useImperativeHandle(ref, () => {
    const bleed = BLEED_MM * PX_PER_MM;
    const printArea = { x: -bleed, y: -bleed, w: g.width + bleed * 2, h: g.height + bleed * 2 };

    /** `pixelRatio` relativo à resolução base de impressão (PX_PER_MM). */
    const render = (withMockup: boolean, pixelRatio: number) => {
      const stage = stageRef.current!;
      const hidden: (Konva.Node | null)[] = [ghostRef.current, trRef.current, guidesRef.current, shadowRef.current];
      const art = artRef.current;
      const clipFn = art?.clipFunc();
      if (!withMockup) {
        // impressão: arte inteira, sem máscara nem cantos, porque o recorte físico da câmera varia
        hidden.push(mockupRef.current, caseBgRef.current, maskRef.current);
        art?.setAttr('clipFunc', undefined);
      }
      hidden.forEach((n) => n?.visible(false));
      const area = withMockup ? frame : printArea;
      try {
        return stage.toCanvas({
          x: ox + area.x * scale,
          y: oy + area.y * scale,
          width: area.w * scale,
          height: area.h * scale,
          pixelRatio: pixelRatio / scale,
        });
      } finally {
        hidden.forEach((n) => n?.visible(true));
        art?.setAttr('clipFunc', clipFn);
      }
    };

    return {
      exportImage({ withMockup, pixelRatio = 1 }) {
        return render(withMockup, pixelRatio).toDataURL('image/png');
      },

      async exportPrint() {
        // resolução em que cada pixel da foto original vira um pixel do arquivo
        const ideal = Math.max(1, ...design.layers.filter((l) => l.type === 'image').map((l) => 1 / l.scale));
        const maxPixels = coarse ? MAX_PRINT_PIXELS_MOBILE : MAX_PRINT_PIXELS;
        const limit = Math.min(
          MAX_CANVAS_EDGE / printArea.w,
          MAX_CANVAS_EDGE / printArea.h,
          Math.sqrt(maxPixels / (printArea.w * printArea.h)),
        );
        let ratio = Math.max(1, Math.min(ideal, limit));
        for (;;) {
          const canvas = render(false, ratio);
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
          if (blob && blob.size > 0) {
            const dpi = Math.round(PX_PER_MM * ratio * 25.4);
            return { blob: await setPngDpi(blob, dpi), width: canvas.width, height: canvas.height, dpi, limited: ratio < ideal };
          }
          if (ratio <= 1) throw new Error('Não foi possível gerar o arquivo de impressão neste aparelho.');
          ratio = Math.max(1, ratio * 0.75);
        }
      },
    };
  }, [g, ox, oy, scale, frame, design.layers, coarse]);

  const handlersFor = (layer: Layer): ShapeHandlers => ({
    draggable: true,
    onMouseDown: () => onSelect(layer.id),
    onTouchStart: () => onSelect(layer.id),
    onDragMove: (e) => {
      if (pinch.current) return;
      const node = e.target;
      const snap = 10 / scale;
      let { x, y } = node.position();
      const v = Math.abs(x - g.width / 2) < snap;
      const h = Math.abs(y - g.height / 2) < snap;
      if (v) x = g.width / 2;
      if (h) y = g.height / 2;
      node.position({ x, y });
      setGuides((prev) => (prev.v === v && prev.h === h ? prev : { v, h }));
      onChange(layer.id, { x, y });
    },
    onDragEnd: () => {
      setGuides({ v: false, h: false });
      onCommit();
    },
    onTransform: (e) => {
      const node = e.target;
      onChange(layer.id, { x: node.x(), y: node.y(), rotation: node.rotation(), scale: Math.abs(node.scaleY()) });
    },
    onTransformEnd: onCommit,
  });

  const handleStagePointerDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) onSelect(null);
  };

  const handleTouchMove = (e: KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    const layer = design.layers.find((l) => l.id === selectedId);
    if (touches.length !== 2 || !layer) return;
    e.evt.preventDefault();
    nodes.current.get(layer.id)?.stopDrag();
    const [a, b] = [touches[0], touches[1]];
    const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    const angle = (Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * 180) / Math.PI;
    const p = pinch.current;
    if (!p) {
      pinch.current = { dist, angle, scale: layer.scale, rotation: layer.rotation };
      return;
    }
    onChange(layer.id, { scale: clampScale((p.scale * dist) / p.dist), rotation: p.rotation + angle - p.angle });
  };

  const handleTouchEnd = (e: KonvaEventObject<TouchEvent>) => {
    if (pinch.current && e.evt.touches.length < 2) {
      pinch.current = null;
      onCommit();
    }
  };

  const clip = (ctx: Konva.Context) => roundedRectPath(ctx, g.width, g.height, g.radius);
  const px = 1 / scale;

  return (
    <div ref={wrapRef} className="cc:absolute cc:inset-0 cc:touch-none cc:select-none">
      {size.w > 0 && (
        <Stage
          ref={stageRef}
          width={size.w}
          height={size.h}
          onMouseDown={handleStagePointerDown}
          onTouchStart={handleStagePointerDown}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <KLayer>
            <Group x={ox} y={oy} scaleX={scale} scaleY={scale}>
              {!loaded && (
                <Rect
                  ref={shadowRef}
                  width={g.width}
                  height={g.height}
                  cornerRadius={g.radius}
                  fill="#fff"
                  shadowColor="#000"
                  shadowOpacity={0.22}
                  shadowBlur={40 * px}
                  shadowOffsetY={12 * px}
                  listening={false}
                />
              )}

              <Group ref={ghostRef} opacity={0.3}>
                {design.layers.map((l) => (
                  <LayerShape
                    key={l.id}
                    layer={l}
                    fontsVersion={fontsVersion}
                    handlers={handlersFor(l)}
                    nodeRef={(n) => (n ? nodes.current.set(l.id, n) : nodes.current.delete(l.id))}
                  />
                ))}
              </Group>

              {loaded && photoRect ? (
                <KImage
                  ref={setCaseBg}
                  image={loaded.photo}
                  x={photoRect.x}
                  y={photoRect.y}
                  width={photoRect.w}
                  height={photoRect.h}
                  listening={false}
                />
              ) : (
                <Rect
                  ref={setCaseBg}
                  width={g.width}
                  height={g.height}
                  cornerRadius={g.radius}
                  fill={transparent ? 'rgba(235,238,242,0.9)' : '#fff'}
                  listening={false}
                />
              )}
            </Group>
          </KLayer>

          {/* camada própria: o destination-in da máscara só pode afetar a arte */}
          <KLayer listening={false}>
            <Group ref={artRef} x={ox} y={oy} scaleX={scale} scaleY={scale} clipFunc={loaded ? undefined : clip}>
              {!transparent && (
                <Rect
                  x={-BLEED_MM * PX_PER_MM}
                  y={-BLEED_MM * PX_PER_MM}
                  width={g.width + BLEED_MM * PX_PER_MM * 2}
                  height={g.height + BLEED_MM * PX_PER_MM * 2}
                  fill={design.background}
                />
              )}
              {design.layers.map((l) => (
                <LayerShape key={l.id} layer={l} fontsVersion={fontsVersion} />
              ))}
              {loaded && photoRect && (
                <KImage
                  ref={maskRef}
                  image={loaded.mask}
                  x={photoRect.x}
                  y={photoRect.y}
                  width={photoRect.w}
                  height={photoRect.h}
                  globalCompositeOperation="destination-in"
                />
              )}
            </Group>
          </KLayer>

          <KLayer>
            <Group x={ox} y={oy} scaleX={scale} scaleY={scale} listening={false}>
              <Group ref={guidesRef}>
                {guides.v && (
                  <Line points={[g.width / 2, 0, g.width / 2, g.height]} stroke="#ff6b1a" strokeWidth={1.5 * px} dash={[6 * px, 4 * px]} />
                )}
                {guides.h && (
                  <Line points={[0, g.height / 2, g.width, g.height / 2]} stroke="#ff6b1a" strokeWidth={1.5 * px} dash={[6 * px, 4 * px]} />
                )}
              </Group>

              <Group ref={mockupRef}>
                {!loaded && (
                  <>
                    <Group clipFunc={clip}>
                      <Rect
                        width={g.width}
                        height={g.height}
                        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                        fillLinearGradientEndPoint={{ x: g.width, y: g.height }}
                        fillLinearGradientColorStops={[0, 'rgba(255,255,255,0.22)', 0.35, 'rgba(255,255,255,0)', 1, 'rgba(0,0,0,0.08)']}
                      />
                    </Group>
                    <Group clipFunc={clip}>
                      <CameraMockup g={g} />
                    </Group>
                    <Rect width={g.width} height={g.height} cornerRadius={g.radius} stroke="rgba(0,0,0,0.22)" strokeWidth={2.5 * px} />
                  </>
                )}
              </Group>
            </Group>

            <Transformer
              ref={trRef}
              keepRatio
              flipEnabled={false}
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
              rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
              rotationSnapTolerance={4}
              anchorSize={coarse ? 22 : 12}
              anchorCornerRadius={coarse ? 11 : 6}
              anchorStroke="#ff6b1a"
              anchorStrokeWidth={2}
              borderStroke="#ff6b1a"
              borderStrokeWidth={1.5}
              rotateAnchorOffset={coarse ? 36 : 28}
              padding={4}
              boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 24 || Math.abs(newBox.height) < 24 ? oldBox : newBox)}
            />
          </KLayer>
        </Stage>
      )}
    </div>
  );
});
