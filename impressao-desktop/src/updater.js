import { EventEmitter } from "node:events";
import { app, Notification } from "electron";
import updaterPkg from "electron-updater";

const { autoUpdater } = updaterPkg;

const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 15_000;

/**
 * Atualizações em segundo plano pelo canal em `build.publish` (release fixa impressao-atual no GitHub).
 * Updates download silently and install on the next restart, or right away through `install()`.
 */
export class Updater extends EventEmitter {
  constructor() {
    super();
    this.state = { status: app.isPackaged ? "idle" : "disabled", version: null, percent: 0, error: null, checkedAt: null };
    if (!app.isPackaged) return;

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = null;

    autoUpdater.on("checking-for-update", () => this.set({ status: "checking", error: null }));
    autoUpdater.on("update-not-available", () => this.set({ status: "latest", checkedAt: new Date().toISOString() }));
    autoUpdater.on("update-available", (info) =>
      this.set({ status: "downloading", version: info.version, percent: 0, checkedAt: new Date().toISOString() }),
    );
    autoUpdater.on("download-progress", (p) => this.set({ status: "downloading", percent: Math.round(p.percent) }));
    autoUpdater.on("update-downloaded", (info) => {
      this.set({ status: "ready", version: info.version, percent: 100 });
      if (Notification.isSupported()) {
        new Notification({
          title: "Atualização pronta",
          body: `A versão ${info.version} do Agiliza Impressão será instalada ao reiniciar o programa.`,
        }).show();
      }
    });
    autoUpdater.on("error", (error) =>
      this.set({ status: "error", error: friendlyError(error), checkedAt: new Date().toISOString() }),
    );
  }

  set(patch) {
    this.state = { ...this.state, ...patch };
    this.emit("change", this.state);
  }

  start() {
    if (!app.isPackaged) return;
    setTimeout(() => void this.check(), FIRST_CHECK_DELAY_MS);
    setInterval(() => void this.check(), CHECK_EVERY_MS);
  }

  async check() {
    if (!app.isPackaged) throw new Error("Atualizações só funcionam no programa instalado.");
    // A downloaded update stays ready; checking again would download it twice.
    if (this.state.status === "ready" || this.state.status === "downloading") return this.state;
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      this.set({ status: "error", error: friendlyError(error), checkedAt: new Date().toISOString() });
    }
    return this.state;
  }

  install() {
    if (this.state.status !== "ready") throw new Error("Nenhuma atualização baixada ainda.");
    autoUpdater.quitAndInstall(true, true);
  }
}

function friendlyError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|net::ERR_/i.test(message)) return "Sem conexão com a internet.";
  if (/404/.test(message)) return "Nenhuma versão publicada ainda.";
  return message.split("\n")[0].slice(0, 200);
}
