export interface LoadedImage {
  src: string;
  width: number;
  height: number;
}

function loadElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível ler esta imagem.'));
    img.src = src;
  });
}

/** Usa o arquivo original do usuário, sem redimensionar nem recomprimir, para não perder qualidade na impressão. */
export async function readImageFile(file: File): Promise<LoadedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Envie um arquivo de imagem (JPG, PNG ou WEBP).');

  const src = URL.createObjectURL(file);
  try {
    const img = await loadElement(src);
    cache.set(src, img);
    return { src, width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    URL.revokeObjectURL(src);
    throw new Error('Este formato não abre no navegador. Envie JPG, PNG ou WEBP.');
  }
}

const cache = new Map<string, HTMLImageElement>();

export function getCachedImage(src: string): HTMLImageElement | undefined {
  return cache.get(src);
}

export async function preloadImage(src: string): Promise<HTMLImageElement> {
  const hit = cache.get(src);
  if (hit) return hit;
  const img = await loadElement(src);
  cache.set(src, img);
  return img;
}

export function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((r) => r.blob());
}
