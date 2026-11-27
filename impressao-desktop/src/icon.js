import { nativeImage } from "electron";

const SIZE = 32;

const COLORS = {
  online: [0x16, 0xa3, 0x4a],
  offline: [0x9c, 0xa3, 0xaf],
  error: [0xea, 0x1d, 0x2c],
};

const inRect = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

/** Round tray icon with a printer glyph, drawn in code so the app ships without image assets. */
export function trayIcon(state = "offline") {
  const [r, g, b] = COLORS[state] ?? COLORS.offline;
  const bitmap = Buffer.alloc(SIZE * SIZE * 4);
  const c = (SIZE - 1) / 2;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const d = Math.hypot(x - c, y - c);
      if (d > 15.5) continue;

      const paperIn = inRect(x, y, 11, 6, 20, 11);
      const body = inRect(x, y, 6, 12, 25, 21);
      const paperOut = inRect(x, y, 10, 18, 21, 25);
      const slot = inRect(x, y, 9, 17, 22, 17);
      const lines = inRect(x, y, 12, 21, 19, 21) || inRect(x, y, 12, 23, 17, 23);
      const white = (paperIn || body || paperOut) && !slot && !lines;

      // BGRA, with a soft edge on the circle.
      const alpha = Math.round(255 * Math.min(1, 15.5 - d));
      bitmap[i] = white ? 255 : b;
      bitmap[i + 1] = white ? 255 : g;
      bitmap[i + 2] = white ? 255 : r;
      bitmap[i + 3] = alpha;
    }
  }
  return nativeImage.createFromBitmap(bitmap, { width: SIZE, height: SIZE, scaleFactor: 2 });
}
