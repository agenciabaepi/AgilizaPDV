const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getState: () => ipcRenderer.invoke("get-state"),
  listDevices: () => ipcRenderer.invoke("list-devices"),
  connect: (code) => ipcRenderer.invoke("connect", code),
  disconnect: () => ipcRenderer.invoke("disconnect"),
  setPrinter: (printerId, settings) => ipcRenderer.invoke("set-printer", printerId, settings),
  testPrint: (printerId) => ipcRenderer.invoke("test-print", printerId),
  setAutoStart: (on) => ipcRenderer.invoke("set-autostart", on),
  checkUpdate: () => ipcRenderer.invoke("check-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("state", listener);
    return () => ipcRenderer.off("state", listener);
  },
});
