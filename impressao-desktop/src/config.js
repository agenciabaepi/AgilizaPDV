import fs from "node:fs";
import path from "node:path";
import { app, safeStorage } from "electron";

/**
 * {
 *   code: string | null,                       // connection code (stored encrypted)
 *   printers: { [printerId]: { device: string, columns: number, encoding: string } },
 * }
 */
const DEFAULTS = { code: null, printers: {} };

const file = () => path.join(app.getPath("userData"), "config.json");

function protect(value) {
  if (!value) return null;
  if (safeStorage.isEncryptionAvailable()) return `enc:${safeStorage.encryptString(value).toString("base64")}`;
  return `raw:${value}`;
}

function unprotect(value) {
  if (!value) return null;
  if (value.startsWith("enc:")) return safeStorage.decryptString(Buffer.from(value.slice(4), "base64"));
  if (value.startsWith("raw:")) return value.slice(4);
  return null;
}

export function loadConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(file(), "utf8"));
    return { ...DEFAULTS, ...raw, printers: raw.printers ?? {}, code: unprotect(raw.code) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(config) {
  const target = file();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ ...config, code: protect(config.code) }, null, 2));
  fs.renameSync(tmp, target);
}
