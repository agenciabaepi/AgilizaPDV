import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, Menu, Notification, Tray } from "electron";
import { PrintAgent, UnauthorizedError } from "./agent.js";
import { loadConfig, saveConfig } from "./config.js";
import { decodeConnectionCode } from "./connection.js";
import { DEFAULT_PRINTER_SETTINGS, ENCODINGS, PAPER_WIDTHS, renderJob } from "./escpos.js";
import { trayIcon } from "./icon.js";
import { Updater } from "./updater.js";
import { printRaw } from "./windows-printer.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_SIZE = 50;
const APP_NAME = "Agiliza Impressão";

if (!app.requestSingleInstanceLock()) app.quit();
app.setAppUserModelId("app.agilizapdv.impressao");

let config;
let agent = null;
let tray = null;
let mainWindow = null;
let quitting = false;
let updater = null;

const state = {
  connected: false,
  online: false,
  error: null,
  needsCode: false,
  info: null,
  log: [],
};

// --- Impressão -------------------------------------------------------------------

function printerSettings(printerId) {
  return { ...DEFAULT_PRINTER_SETTINGS, ...config.printers[printerId] };
}

function mappedPrinterIds() {
  return Object.entries(config.printers)
    .filter(([, s]) => s.device)
    .map(([id]) => id);
}

async function printJob(job) {
  const settings = printerSettings(job.impressora_id);
  if (!settings.device) throw new Error("Impressora não configurada neste computador.");
  const copias = Math.max(1, Math.min(5, Number(job.payload?.copias) || 1));
  const data = renderJob(job.tipo, job.payload, settings);
  for (let i = 0; i < copias; i++) {
    await printRaw(settings.device, data, `Agiliza ${job.titulo ?? job.tipo}`);
  }
}

function describeJob(job) {
  if (job.tipo === "teste") return "Teste de impressão";
  return job.titulo || "Documento";
}

function printerName(printerId) {
  return state.info?.impressoras.find((p) => p.id === printerId)?.nome ?? "Impressora";
}

function addLog(entry) {
  state.log = [{ at: new Date().toISOString(), ...entry }, ...state.log].slice(0, LOG_SIZE);
}

// --- Conexão ---------------------------------------------------------------------

async function startAgent(code) {
  await stopAgent();
  const connection = decodeConnectionCode(code);
  const next = new PrintAgent(connection, {
    printerIds: mappedPrinterIds,
    print: printJob,
    version: app.getVersion(),
  });

  next.on("info", (info) => {
    state.info = info;
    state.connected = true;
    state.needsCode = false;
    publish();
  });
  next.on("status", ({ online, error }) => {
    state.online = online;
    state.error = error ? error.message : null;
    if (error instanceof UnauthorizedError) {
      state.connected = false;
      state.needsCode = true;
      state.error = "Este computador foi desconectado no sistema. Gere um novo código em Configurações › Impressoras.";
    }
    publish();
  });
  next.on("job", (job) => {
    addLog({ text: describeJob(job), printer: printerName(job.impressora_id), ok: job.ok, error: job.error });
    if (!job.ok && Notification.isSupported()) {
      new Notification({ title: "Falha ao imprimir", body: `${describeJob(job)}: ${job.error}` }).show();
    }
    publish();
  });

  await next.hello();
  agent = next;
  agent.start();
}

async function stopAgent() {
  if (agent) await agent.stop();
  agent = null;
}

// --- Tela ------------------------------------------------------------------------

async function listDevices() {
  const host = mainWindow && !mainWindow.isDestroyed() ? mainWindow : new BrowserWindow({ show: false });
  try {
    const printers = await host.webContents.getPrintersAsync();
    return printers.map((p) => p.name).sort((a, b) => a.localeCompare(b));
  } finally {
    if (host !== mainWindow) host.destroy();
  }
}

function snapshot() {
  return {
    ...state,
    printers: config.printers,
    autoStart: app.getLoginItemSettings().openAtLogin,
    options: { encodings: ENCODINGS, paperWidths: PAPER_WIDTHS, defaults: DEFAULT_PRINTER_SETTINGS },
    version: app.getVersion(),
    update: updater?.state ?? null,
  };
}

function publish() {
  updateTray();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("state", snapshot());
}

function trayState() {
  if (!state.connected || state.error) return state.connected ? "error" : "offline";
  return state.online ? "online" : "offline";
}

function updateTray() {
  if (!tray) return;
  const status = !state.connected
    ? "Não conectado"
    : state.error
      ? `Erro: ${state.error}`
      : `Conectado · ${state.info?.empresa?.nome ?? ""}`;
  tray.setImage(trayIcon(trayState()));
  tray.setToolTip(`${APP_NAME}\n${status}`.slice(0, 127));
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: status, enabled: false },
      { type: "separator" },
      { label: "Abrir painel", click: showWindow },
      {
        label: "Iniciar com o Windows",
        type: "checkbox",
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => setAutoStart(item.checked),
      },
      updater?.state.status === "ready"
        ? { label: `Reiniciar e atualizar (v${updater.state.version})`, click: () => updater.install() }
        : {
            label: "Buscar atualizações",
            enabled: app.isPackaged && updater?.state.status !== "checking" && updater?.state.status !== "downloading",
            click: () => {
              showWindow();
              void updater.check();
            },
          },
      { type: "separator" },
      {
        label: "Sair",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = new BrowserWindow({
      width: 760,
      height: 720,
      minWidth: 600,
      minHeight: 500,
      title: APP_NAME,
      icon: trayIcon("online"),
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: path.join(dirname, "preload.cjs"),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    mainWindow.on("close", (event) => {
      if (quitting) return;
      event.preventDefault();
      mainWindow.hide();
    });
    mainWindow.once("ready-to-show", () => mainWindow.show());
    mainWindow.loadFile(path.join(dirname, "ui", "index.html"));
    return;
  }
  mainWindow.show();
  mainWindow.focus();
}

function setAutoStart(on) {
  app.setLoginItemSettings({ openAtLogin: on, args: ["--hidden"] });
  publish();
}

// --- IPC -------------------------------------------------------------------------

const handle = (channel, fn) =>
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

handle("get-state", () => snapshot());

handle("list-devices", () => listDevices());

handle("connect", async (code) => {
  await startAgent(code);
  config.code = code.replace(/\s+/g, "");
  saveConfig(config);
  // Em desenvolvimento o item de inicialização apontaria para o electron.exe puro.
  if (app.isPackaged) setAutoStart(true);
  return snapshot();
});

handle("disconnect", async () => {
  await stopAgent();
  config = { ...config, code: null };
  saveConfig(config);
  Object.assign(state, { connected: false, online: false, error: null, needsCode: false, info: null });
  publish();
  return snapshot();
});

handle("set-printer", (printerId, settings) => {
  config.printers[printerId] = { ...printerSettings(printerId), ...settings };
  saveConfig(config);
  void agent?.drain();
  publish();
  return snapshot();
});

handle("test-print", async (printerId) => {
  const settings = printerSettings(printerId);
  if (!settings.device) throw new Error("Escolha a impressora do Windows primeiro.");
  const data = renderJob(
    "teste",
    {
      empresa: state.info?.empresa?.nome,
      impressora: `${printerName(printerId)} → ${settings.device}`,
      created_at: new Date().toLocaleString("pt-BR"),
    },
    settings,
  );
  await printRaw(settings.device, data, "Agiliza teste");
});

handle("set-autostart", (on) => {
  setAutoStart(Boolean(on));
  return snapshot();
});

handle("check-update", async () => {
  await updater.check();
  return snapshot();
});

handle("install-update", () => updater.install());

// --- App -------------------------------------------------------------------------

/** O Windows pode abrir o programa antes da internet; tenta de novo até o código ser aceito ou recusado. */
async function connectAtBoot() {
  if (agent || !config.code) return;
  try {
    await startAgent(config.code);
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error);
    state.needsCode = error instanceof UnauthorizedError;
    publish();
    if (!state.needsCode && config.code) setTimeout(connectAtBoot, 30_000);
  }
}

app.on("second-instance", showWindow);

// Continua na bandeja (ao lado do relógio) quando a janela é fechada.
app.on("window-all-closed", () => {});

app.on("before-quit", () => {
  quitting = true;
});

app.whenReady().then(async () => {
  config = loadConfig();
  updater = new Updater();
  updater.on("change", publish);
  updater.start();
  tray = new Tray(trayIcon("offline"));
  tray.on("double-click", showWindow);
  tray.on("click", showWindow);
  updateTray();

  const hidden = process.argv.includes("--hidden");
  if (config.code) await connectAtBoot();
  if (!hidden || !config.code) showWindow();
});
