import type { Design, Layer } from '../types';
import type { LoadedImage } from './image';
import { preloadImage } from './image';

const DB_NAME = 'agiliza-capa-rascunho';
const DB_VERSION = 1;
const STORE_RASCUNHOS = 'rascunhos';
const STORE_IMAGENS = 'imagens';
const VALIDADE_MS = 14 * 24 * 60 * 60 * 1000;

type RascunhoRegistro = {
  chave: string;
  modelId: string;
  design: Design;
  uploads: LoadedImage[];
  /** Chaves das imagens gravadas em STORE_IMAGENS (o `src` da sessão em que foram salvas). */
  imagens: string[];
  salvoEm: number;
};

export type RascunhoRestaurado = {
  modelId: string;
  design: Design;
  uploads: LoadedImage[];
  salvoEm: number;
};

/** Blob de cada `src` desta sessão, para não reler object URLs a cada gravação. */
const blobPorSrc = new Map<string, Blob>();
const imagensGravadas = new Set<string>();

let dbPromise: Promise<IDBDatabase> | null = null;

function abrirDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RASCUNHOS)) db.createObjectStore(STORE_RASCUNHOS, { keyPath: 'chave' });
      if (!db.objectStoreNames.contains(STORE_IMAGENS)) db.createObjectStore(STORE_IMAGENS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function reqPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function chaveRascunho(empresaId: string, produtoId: string): string {
  return `${empresaId}:${produtoId}`;
}

function srcsDoRascunho(design: Design, uploads: LoadedImage[]): string[] {
  const set = new Set<string>();
  for (const l of design.layers) if (l.type === 'image') set.add(l.src);
  for (const u of uploads) set.add(u.src);
  return [...set];
}

async function blobDe(src: string): Promise<Blob | null> {
  const hit = blobPorSrc.get(src);
  if (hit) return hit;
  try {
    const blob = await fetch(src).then((r) => r.blob());
    blobPorSrc.set(src, blob);
    return blob;
  } catch {
    return null;
  }
}

export async function salvarRascunho(
  chave: string,
  dados: { modelId: string; design: Design; uploads: LoadedImage[] },
): Promise<void> {
  const db = await abrirDb();
  const srcs = srcsDoRascunho(dados.design, dados.uploads);

  const novos: [string, Blob][] = [];
  for (const src of srcs) {
    if (imagensGravadas.has(src)) continue;
    const blob = await blobDe(src);
    if (blob) novos.push([src, blob]);
  }

  const anterior = (await reqPromise(
    db.transaction(STORE_RASCUNHOS, 'readonly').objectStore(STORE_RASCUNHOS).get(chave),
  )) as RascunhoRegistro | undefined;

  const tx = db.transaction([STORE_RASCUNHOS, STORE_IMAGENS], 'readwrite');
  const imagens = tx.objectStore(STORE_IMAGENS);
  for (const [src, blob] of novos) imagens.put(blob, src);
  const atuais = new Set(srcs);
  for (const antiga of anterior?.imagens ?? []) {
    if (!atuais.has(antiga)) imagens.delete(antiga);
  }
  const registro: RascunhoRegistro = {
    chave,
    modelId: dados.modelId,
    design: dados.design,
    uploads: dados.uploads,
    imagens: srcs,
    salvoEm: Date.now(),
  };
  tx.objectStore(STORE_RASCUNHOS).put(registro);
  await txDone(tx);
  for (const [src] of novos) imagensGravadas.add(src);
}

export async function apagarRascunho(chave: string): Promise<void> {
  const db = await abrirDb();
  const anterior = (await reqPromise(
    db.transaction(STORE_RASCUNHOS, 'readonly').objectStore(STORE_RASCUNHOS).get(chave),
  )) as RascunhoRegistro | undefined;
  const tx = db.transaction([STORE_RASCUNHOS, STORE_IMAGENS], 'readwrite');
  for (const src of anterior?.imagens ?? []) {
    tx.objectStore(STORE_IMAGENS).delete(src);
    imagensGravadas.delete(src);
  }
  tx.objectStore(STORE_RASCUNHOS).delete(chave);
  await txDone(tx);
}

/** Lê o rascunho e recria as fotos com novos object URLs (os da sessão anterior não valem mais). */
export async function carregarRascunho(chave: string): Promise<RascunhoRestaurado | null> {
  const db = await abrirDb();
  const registro = (await reqPromise(
    db.transaction(STORE_RASCUNHOS, 'readonly').objectStore(STORE_RASCUNHOS).get(chave),
  )) as RascunhoRegistro | undefined;
  if (!registro) return null;
  if (Date.now() - registro.salvoEm > VALIDADE_MS) {
    await apagarRascunho(chave).catch(() => {});
    return null;
  }

  const store = db.transaction(STORE_IMAGENS, 'readonly').objectStore(STORE_IMAGENS);
  const blobs = await Promise.all(registro.imagens.map((src) => reqPromise(store.get(src)) as Promise<Blob | undefined>));

  const novoSrc = new Map<string, string>();
  registro.imagens.forEach((antigo, i) => {
    const blob = blobs[i];
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    novoSrc.set(antigo, url);
    blobPorSrc.set(url, blob);
  });

  const layers: Layer[] = registro.design.layers
    .map((l): Layer | null => {
      if (l.type !== 'image') return l;
      const src = novoSrc.get(l.src);
      return src ? { ...l, src } : null;
    })
    .filter((l): l is Layer => l !== null);

  const uploads = registro.uploads
    .map((u) => {
      const src = novoSrc.get(u.src);
      return src ? { ...u, src } : null;
    })
    .filter((u): u is LoadedImage => u !== null);

  await Promise.all([...novoSrc.values()].map((src) => preloadImage(src).catch(() => undefined)));

  return {
    modelId: registro.modelId,
    design: { ...registro.design, layers },
    uploads,
    salvoEm: registro.salvoEm,
  };
}
