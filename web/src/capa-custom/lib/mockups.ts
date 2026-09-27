/**
 * Mockups fotográficos por modelo, em `web/src/assets/mockups/<id-do-modelo>/`:
 * - `celular.png`: foto da capa no aparelho, com fundo transparente.
 * - `mascara.png`: mesma dimensão da foto; branco onde a arte do cliente aparece,
 *   transparente (ou preto) no resto, inclusive nos furos da câmera.
 * A área branca da máscara é esticada para as medidas do modelo, então as imagens podem ter qualquer margem.
 */
const files = import.meta.glob('../assets/mockups/*/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export interface MockupImages {
  photo: string;
  mask: string;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LoadedMockup {
  photo: HTMLImageElement;
  /** Máscara convertida para canal alfa (branco = opaco). */
  mask: HTMLCanvasElement;
  width: number;
  height: number;
  /** Área imprimível na máscara, em px da imagem. */
  maskBox: Box;
  /** Área visível da foto, em px da imagem. */
  photoBox: Box;
}

const byModel = new Map<string, Partial<MockupImages>>();
for (const [path, url] of Object.entries(files)) {
  const match = path.match(/mockups\/([^/]+)\/(celular|mascara)\.png$/);
  if (!match) continue;
  const entry = byModel.get(match[1]) ?? {};
  entry[match[2] === 'celular' ? 'photo' : 'mask'] = url;
  byModel.set(match[1], entry);
}

export function getMockup(modelId: string): MockupImages | undefined {
  const entry = byModel.get(modelId);
  return entry?.photo && entry.mask ? { photo: entry.photo, mask: entry.mask } : undefined;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    img.src = src;
  });
}

function readPixels(img: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  return { canvas, ctx, data: ctx.getImageData(0, 0, canvas.width, canvas.height) };
}

function alphaBox(data: ImageData): Box {
  const { width, height } = data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data.data[(y * width + x) * 4 + 3] > 128) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('Máscara vazia: nenhuma área branca encontrada.');
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

const cache = new Map<string, Promise<LoadedMockup>>();

export function loadMockup(m: MockupImages): Promise<LoadedMockup> {
  const key = `${m.photo}|${m.mask}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = Promise.all([loadImage(m.photo), loadImage(m.mask)]).then(([photo, maskImg]) => {
      const mask = readPixels(maskImg);
      const px = mask.data.data;
      // aceita máscara branca sobre transparente ou branca sobre preto
      for (let i = 0; i < px.length; i += 4) {
        const lum = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
        px[i + 3] = Math.round(px[i + 3] * lum);
        px[i] = px[i + 1] = px[i + 2] = 255;
      }
      mask.ctx.putImageData(mask.data, 0, 0);
      return {
        photo,
        mask: mask.canvas,
        width: photo.naturalWidth,
        height: photo.naturalHeight,
        maskBox: alphaBox(mask.data),
        photoBox: alphaBox(readPixels(photo).data),
      };
    });
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
}
