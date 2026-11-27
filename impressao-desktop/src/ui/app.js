const $ = (id) => document.getElementById(id);

let state = null;
let devices = [];

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of [].concat(children)) {
    if (child != null) node.append(child);
  }
  return node;
}

function showAlert(message) {
  $("alert").hidden = !message;
  $("alert").textContent = message ?? "";
}

async function call(promise, button) {
  if (button) button.disabled = true;
  try {
    const result = await promise;
    if (!result.ok) {
      showAlert(result.error);
      return null;
    }
    showAlert(state?.error ?? null);
    if (result.data && typeof result.data === "object" && "connected" in result.data) render(result.data);
    return result;
  } finally {
    if (button) button.disabled = false;
  }
}

function select(options, value, onChange) {
  const node = el(
    "select",
    {},
    options.map(([v, label]) => el("option", { value: String(v), textContent: label, selected: String(v) === String(value) })),
  );
  node.addEventListener("change", () => onChange(node.value));
  return node;
}

function renderPrinters() {
  const { info, printers: settings, options } = state;
  const list = $("printers");
  list.replaceChildren();
  if (!info?.impressoras.length) {
    list.append(el("p", { className: "muted", textContent: "Nenhuma impressora cadastrada no sistema ainda." }));
    return;
  }

  for (const printer of info.impressoras) {
    const current = { ...options.defaults, ...settings[printer.id] };
    const deviceOptions = [["", "— Não imprimir aqui —"], ...devices.map((d) => [d, d])];
    if (current.device && !devices.includes(current.device)) {
      deviceOptions.push([current.device, `${current.device} (não encontrada)`]);
    }
    const save = (patch) => call(window.api.setPrinter(printer.id, patch));

    const test = el("button", { className: "ghost", textContent: "Imprimir teste", disabled: !current.device });
    test.addEventListener("click", async () => {
      const result = await call(window.api.testPrint(printer.id), test);
      if (result) showAlert(null);
    });

    list.append(
      el("div", { className: "printer" }, [
        el("div", { className: "name" }, [
          el("span", {}, [printer.nome]),
          test,
        ]),
        el("label", { className: "device" }, [
          "Impressora do Windows",
          select(deviceOptions, current.device, (device) => save({ device })),
        ]),
        el("label", {}, [
          "Papel",
          select(Object.entries(options.paperWidths), current.columns, (columns) => save({ columns: Number(columns) })),
        ]),
        el("label", {}, [
          "Cortar papel",
          select(
            [
              ["1", "Sim (guilhotina)"],
              ["0", "Não"],
            ],
            current.cut === false ? "0" : "1",
            (v) => save({ cut: v === "1" }),
          ),
        ]),
        el("label", {}, [
          "Acentuação",
          select(
            Object.entries(options.encodings).map(([k, v]) => [k, v.label]),
            current.encoding,
            (encoding) => save({ encoding }),
          ),
        ]),
      ]),
    );
  }
}

function renderLog() {
  const log = $("log");
  log.replaceChildren();
  if (!state.log.length) {
    log.append(el("li", { className: "muted", textContent: "Nada impresso desde que o programa abriu." }));
    return;
  }
  for (const entry of state.log) {
    const time = new Date(entry.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    log.append(
      el("li", {}, [
        el("span", { className: "time", textContent: time }),
        el("span", { className: entry.ok ? "ok" : "fail", textContent: entry.ok ? "✔" : "✖" }),
        el("span", { textContent: `${entry.text} · ${entry.printer}${entry.error ? ` — ${entry.error}` : ""}` }),
      ]),
    );
  }
}

const UPDATE_STATUS = {
  disabled: () => "Atualizações automáticas só no programa instalado.",
  idle: () => "O programa busca atualizações sozinho a cada 4 horas.",
  checking: () => "Buscando atualizações…",
  latest: () => "Você está usando a versão mais recente.",
  downloading: (u) => `Baixando a versão ${u.version}… ${u.percent}%`,
  ready: (u) => `Versão ${u.version} pronta. Reinicie para instalar (leva poucos segundos).`,
  error: (u) => `Não foi possível buscar atualizações: ${u.error}`,
};

function renderUpdate() {
  const update = state.update ?? { status: "disabled" };
  const button = $("update-btn");
  $("version").textContent = `Versão instalada: ${state.version}`;
  $("update-status").textContent = (UPDATE_STATUS[update.status] ?? UPDATE_STATUS.idle)(update);
  $("update-status").className = update.status === "error" ? "small fail" : "muted small";
  button.textContent = update.status === "ready" ? "Reiniciar e atualizar" : "Buscar atualizações";
  button.className = update.status === "ready" ? "primary" : "ghost";
  button.disabled = ["disabled", "checking", "downloading"].includes(update.status);
}

function render(next) {
  state = next;
  const status = $("status");
  status.className = "pill";
  if (!state.connected) status.textContent = "Não conectado";
  else if (state.error) {
    status.textContent = "Com problema";
    status.classList.add("error");
  } else if (state.online) {
    status.textContent = "Online";
    status.classList.add("online");
  } else status.textContent = "Conectando…";

  showAlert(state.error);
  $("connect").hidden = state.connected;
  $("connected").hidden = !state.connected;
  $("autostart").checked = state.autoStart;
  renderUpdate();

  if (state.connected) {
    $("empresa").textContent = state.info?.empresa?.nome ?? "";
    $("station").textContent = `Este computador: ${state.info?.estacao?.nome ?? ""}`;
    renderPrinters();
    renderLog();
  }
}

async function loadDevices() {
  const result = await call(window.api.listDevices(), $("refresh-devices"));
  if (result) devices = result.data;
  if (state?.connected) renderPrinters();
}

$("connect-btn").addEventListener("click", async () => {
  const code = $("code").value.trim();
  if (!code) return showAlert("Cole o código de conexão.");
  const result = await call(window.api.connect(code), $("connect-btn"));
  if (result) $("code").value = "";
});

$("disconnect-btn").addEventListener("click", () => {
  if (confirm("Desconectar este computador? Ele deixará de imprimir até ser conectado de novo.")) {
    call(window.api.disconnect(), $("disconnect-btn"));
  }
});

$("refresh-devices").addEventListener("click", loadDevices);
$("update-btn").addEventListener("click", () => {
  if (state?.update?.status === "ready") call(window.api.installUpdate());
  else call(window.api.checkUpdate(), $("update-btn"));
});
$("autostart").addEventListener("change", (e) => call(window.api.setAutoStart(e.target.checked)));

window.api.onState(render);

(async () => {
  const result = await window.api.getState();
  if (result.ok) render(result.data);
  await loadDevices();
})();
