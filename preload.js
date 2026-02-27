const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  minimizeWindow: () => ipcRenderer.send("window-minimize"),
  maximizeWindow: () => ipcRenderer.send("window-maximize"),
  closeWindow: () => ipcRenderer.send("window-close"),

  openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),
  getFileInfo: (p) => ipcRenderer.invoke("get-file-info", p),
  revealFile: (p) => ipcRenderer.send("reveal-file", p),

  getPrinters: () => ipcRenderer.invoke("get-printers"),
  printFiles: (opts) => ipcRenderer.invoke("print-files", opts),

  checkDependencies: () => ipcRenderer.invoke("check-dependencies"),
  getPdfPages: (p) => ipcRenderer.invoke("get-pdf-pages", p),
  getPdfPreview: (opts) => ipcRenderer.invoke("get-pdf-preview", opts),

  getHistory: () => ipcRenderer.invoke("get-history"),
  addHistory: (entries) => ipcRenderer.invoke("add-history", entries),
  clearHistory: () => ipcRenderer.invoke("clear-history"),
  deleteHistoryItem: (id) => ipcRenderer.invoke("delete-history-item", id),
});
