export const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Dancing+Script:wght@400;700&family=Great+Vibes&family=Lobster&family=Pacifico&family=Permanent+Marker&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Poppins:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700&family=Press+Start+2P&display=swap';

export interface FontOption {
  family: string;
  label: string;
}

export const FONTS: FontOption[] = [
  { family: 'Pacifico', label: 'Pacifico' },
  { family: 'Dancing Script', label: 'Dancing' },
  { family: 'Great Vibes', label: 'Vibes' },
  { family: 'Poppins', label: 'Poppins' },
  { family: 'Bebas Neue', label: 'Bebas' },
  { family: 'Anton', label: 'Anton' },
  { family: 'Permanent Marker', label: 'Marker' },
  { family: 'Lobster', label: 'Lobster' },
  { family: 'Playfair Display', label: 'Playfair' },
  { family: 'Press Start 2P', label: 'Pixel' },
];

export const TEXT_COLORS = ['#111111', '#ffffff', '#ff6b1a', '#e11d48', '#ec4899', '#a855f7', '#2563eb', '#0ea5e9', '#16a34a', '#facc15', '#d4af37', '#78716c'];

export const BACKGROUND_COLORS = ['#ffffff', '#f5f5f4', '#111111', '#fde2e4', '#fad2e1', '#e2ece9', '#bee1e6', '#cddafd', '#fff1c1', '#ffd6a5', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff', 'transparent'];

export const STICKERS = ['❤️', '✨', '⭐', '🌸', '🦋', '🔥', '😎', '🐶', '🐱', '🌈', '☀️', '🌙', '⚽', '🎀', '💖', '🍒'];

/** Konva desenha no canvas, então a fonte precisa estar carregada antes do render. */
export function loadFonts(): Promise<unknown> {
  return Promise.allSettled(
    FONTS.flatMap((f) => [document.fonts.load(`40px "${f.family}"`), document.fonts.load(`bold 40px "${f.family}"`)]),
  );
}
