export type Brand = 'Apple';

export interface Circle {
  cx: number;
  cy: number;
  r: number;
}

/** Recorte da câmera. Coordenadas em mm a partir do canto superior esquerdo da traseira do aparelho. */
export interface CameraSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  lenses: Circle[];
  flash?: Circle;
}

export interface PhoneModel {
  id: string;
  brand: Brand;
  /** Geração, usada para agrupar no seletor. */
  series: number;
  name: string;
  /** Dimensões do aparelho em mm. */
  width: number;
  height: number;
  cornerRadius: number;
  camera: CameraSpec;
}

/** Folga da capa em relação ao aparelho, em mm, de cada lado. */
export const CASE_MARGIN_MM = 1.2;

/** Resolução do arquivo de impressão: 12 px/mm ≈ 305 dpi. */
export const PX_PER_MM = 12;

/** Sangria do arquivo de impressão, em mm, de cada lado. */
export const BLEED_MM = 3;

/** Módulo quadrado com duas lentes na vertical (11, 12, 12 mini). */
const dual = (s: number, p = 6): CameraSpec => ({
  x: p,
  y: p,
  w: s,
  h: s,
  r: s * 0.27,
  lenses: [
    { cx: p + s * 0.29, cy: p + s * 0.29, r: s * 0.2 },
    { cx: p + s * 0.29, cy: p + s * 0.71, r: s * 0.2 },
  ],
  flash: { cx: p + s * 0.73, cy: p + s * 0.29, r: s * 0.07 },
});

/** Módulo quadrado com duas lentes na diagonal (13, 14, 15). */
const diagonal = (s: number, p = 6): CameraSpec => ({
  x: p,
  y: p,
  w: s,
  h: s,
  r: s * 0.27,
  lenses: [
    { cx: p + s * 0.29, cy: p + s * 0.29, r: s * 0.2 },
    { cx: p + s * 0.71, cy: p + s * 0.71, r: s * 0.2 },
  ],
  flash: { cx: p + s * 0.74, cy: p + s * 0.26, r: s * 0.07 },
});

/** Módulo quadrado com três lentes em triângulo (linha Pro do 11 ao 16). */
const triple = (s: number, p = 5.5): CameraSpec => ({
  x: p,
  y: p,
  w: s,
  h: s,
  r: s * 0.25,
  lenses: [
    { cx: p + s * 0.28, cy: p + s * 0.27, r: s * 0.21 },
    { cx: p + s * 0.28, cy: p + s * 0.73, r: s * 0.21 },
    { cx: p + s * 0.73, cy: p + s * 0.5, r: s * 0.21 },
  ],
  flash: { cx: p + s * 0.76, cy: p + s * 0.16, r: s * 0.06 },
});

/** Placa retangular com lentes empilhadas em cápsula (16, 16 Plus, 17). */
const vertical = (p = 6): CameraSpec => ({
  x: p,
  y: p,
  w: 25,
  h: 38,
  r: 7,
  lenses: [
    { cx: p + 8.5, cy: p + 10, r: 6.2 },
    { cx: p + 8.5, cy: p + 27, r: 6.2 },
  ],
  flash: { cx: p + 20, cy: p + 10, r: 2 },
});

/** Lente única sem módulo (16e, 17e). */
const single = (p = 7): CameraSpec => ({
  x: p,
  y: p,
  w: 14,
  h: 14,
  r: 7,
  lenses: [{ cx: p + 7, cy: p + 7, r: 5.6 }],
  flash: { cx: p + 20, cy: p + 7, r: 2 },
});

/** Barra de câmera de ponta a ponta com três lentes à esquerda (17 Pro em diante). */
const proBar = (width: number): CameraSpec => ({
  x: 0,
  y: 4.5,
  w: width,
  h: 33,
  r: 9,
  lenses: [
    { cx: 13.5, cy: 13, r: 6.8 },
    { cx: 13.5, cy: 29, r: 6.8 },
    { cx: 28, cy: 21, r: 6.8 },
  ],
  flash: { cx: width - 11, cy: 14, r: 2.2 },
});

/** Barra de câmera de ponta a ponta com uma lente (17 Air). */
const airBar = (width: number): CameraSpec => ({
  x: 0,
  y: 5,
  w: width,
  h: 22,
  r: 8,
  lenses: [{ cx: 15, cy: 16, r: 6.4 }],
  flash: { cx: 28, cy: 16, r: 2 },
});

const iphone = (series: number, suffix: string, width: number, height: number, cornerRadius: number, camera: CameraSpec): PhoneModel => {
  const name = `iPhone ${series}${suffix === 'e' ? 'e' : suffix ? ` ${suffix}` : ''}`;
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    brand: 'Apple',
    series,
    name,
    width,
    height,
    cornerRadius,
    camera,
  };
};

export const PHONE_MODELS: PhoneModel[] = [
  iphone(11, '', 75.7, 150.9, 11, dual(31)),
  iphone(11, 'Pro', 71.4, 144, 10, triple(33)),
  iphone(11, 'Pro Max', 77.8, 158, 11, triple(35)),

  iphone(12, 'mini', 64.2, 131.5, 9, dual(26, 5.5)),
  iphone(12, '', 71.5, 146.7, 10, dual(28)),
  iphone(12, 'Pro', 71.5, 146.7, 10, triple(33)),
  iphone(12, 'Pro Max', 78.1, 160.8, 11, triple(35)),

  iphone(13, 'mini', 64.2, 131.5, 9, diagonal(26, 5.5)),
  iphone(13, '', 71.5, 146.7, 10, diagonal(29)),
  iphone(13, 'Pro', 71.5, 146.7, 10, triple(36)),
  iphone(13, 'Pro Max', 78.1, 160.8, 11, triple(38)),

  iphone(14, '', 71.5, 146.7, 10, diagonal(29)),
  iphone(14, 'Plus', 78.1, 160.8, 11, diagonal(31)),
  iphone(14, 'Pro', 71.5, 147.5, 10.5, triple(37)),
  iphone(14, 'Pro Max', 77.6, 160.7, 11, triple(38)),

  iphone(15, '', 71.6, 147.6, 10.5, diagonal(29)),
  iphone(15, 'Plus', 77.8, 160.9, 11, diagonal(31)),
  iphone(15, 'Pro', 70.6, 146.6, 10.5, triple(36)),
  iphone(15, 'Pro Max', 76.7, 159.9, 11, triple(38)),

  iphone(16, 'e', 71.5, 146.7, 10, single()),
  iphone(16, '', 71.6, 147.6, 10.5, vertical()),
  iphone(16, 'Plus', 77.8, 160.9, 11, vertical()),
  iphone(16, 'Pro', 71.5, 149.6, 10.5, triple(37)),
  iphone(16, 'Pro Max', 77.6, 163, 11.5, triple(39)),

  iphone(17, 'e', 71.5, 146.7, 10, single()),
  iphone(17, '', 71.5, 149.6, 10.5, vertical()),
  iphone(17, 'Air', 74.7, 156.2, 11.5, airBar(74.7)),
  iphone(17, 'Pro', 71.9, 150, 11, proBar(71.9)),
  iphone(17, 'Pro Max', 78, 163.4, 12, proBar(78)),

  iphone(18, 'Pro', 71.9, 150, 11, proBar(71.9)),
  iphone(18, 'Pro Max', 78, 163.4, 12, proBar(78)),
];

/** Gerações em ordem crescente, para as abas do seletor. */
export const SERIES = [...new Set(PHONE_MODELS.map((m) => m.series))];

export function findModel(id: string | null | undefined): PhoneModel | undefined {
  return PHONE_MODELS.find((m) => m.id === id);
}

export interface CaseGeometry {
  width: number;
  height: number;
  radius: number;
  camera: CameraSpec;
}

/** Converte o modelo para as coordenadas do design (px do arquivo de impressão). */
export function caseGeometry(model: PhoneModel): CaseGeometry {
  const k = PX_PER_MM;
  const m = CASE_MARGIN_MM;
  const c = model.camera;
  const circle = (p: Circle): Circle => ({ cx: (p.cx + m) * k, cy: (p.cy + m) * k, r: p.r * k });
  // barras de ponta a ponta (17 Pro/Air) atravessam a folga lateral da capa
  const fullWidth = c.x <= 0 && c.w >= model.width;
  return {
    width: (model.width + m * 2) * k,
    height: (model.height + m * 2) * k,
    radius: (model.cornerRadius + m) * k,
    camera: {
      x: fullWidth ? 0 : (c.x + m) * k,
      y: (c.y + m) * k,
      w: fullWidth ? (model.width + m * 2) * k : c.w * k,
      h: c.h * k,
      r: c.r * k,
      lenses: c.lenses.map(circle),
      flash: c.flash && circle(c.flash),
    },
  };
}
