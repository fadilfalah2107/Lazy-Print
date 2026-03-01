const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  minimizeWindow: () => ipcRenderer.send("window-minimize"),
  maximizeWindow: () => ipcRenderer.send("window-maximize"),
  closeWindow: () => ipcRenderer.send("window-close"),

  openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),
  openFolderDialog: () => ipcRenderer.invoke("open-folder-dialog"),
  savePdfDialog: (name) => ipcRenderer.invoke("save-pdf-dialog", name),
  getFileInfo: (p) => ipcRenderer.invoke("get-file-info", p),
  revealFile: (p) => ipcRenderer.send("reveal-file", p),
  openOutputPdf: (p) => ipcRenderer.send("open-output-pdf", p),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (s) => ipcRenderer.invoke("save-settings", s),
  showToast: (opts) => ipcRenderer.send("show-toast", opts),

  getPrinters: () => ipcRenderer.invoke("get-printers"),
  printFiles: (opts) => ipcRenderer.invoke("print-files", opts),
  printToPdf: (opts) => ipcRenderer.invoke("print-to-pdf", opts),

  checkDependencies: () => ipcRenderer.invoke("check-dependencies"),
  getPreview: (opts) => ipcRenderer.invoke("get-preview", opts),
  getPageCount: (p) => ipcRenderer.invoke("get-page-count", p),

  getProfiles: () => ipcRenderer.invoke("get-profiles"),
  saveProfile: (p) => ipcRenderer.invoke("save-profile", p),
  deleteProfile: (id) => ipcRenderer.invoke("delete-profile", id),

  getHistory: () => ipcRenderer.invoke("get-history"),
  addHistory: (entries) => ipcRenderer.invoke("add-history", entries),
  clearHistory: () => ipcRenderer.invoke("clear-history"),
  deleteHistoryItem: (id) => ipcRenderer.invoke("delete-history-item", id),

  // Queue persistence
  saveQueue: (files) => ipcRenderer.invoke("save-queue", files),
  loadQueue: () => ipcRenderer.invoke("load-queue"),
  clearQueue: () => ipcRenderer.invoke("clear-queue"),

  // Watch folder
  startWatch: (folder) => ipcRenderer.invoke("start-watch", folder),
  stopWatch: (folder) => ipcRenderer.invoke("stop-watch", folder),
  getWatches: () => ipcRenderer.invoke("get-watches"),
  onWatchFileAdded: (cb) =>
    ipcRenderer.on("watch-file-added", (e, data) => cb(data)),
  offWatchFileAdded: () => ipcRenderer.removeAllListeners("watch-file-added"),

  // Electron 32+: gunakan webUtils.getPathForFile() karena file.path dihapus
  getPathForFile: (file) => webUtils.getPathForFile(file),

  // Lifetime stats
  getLifetimeStats: () => ipcRenderer.invoke("get-lifetime-stats"),

  // Tray events → renderer
  onTrayOpenFiles: (cb) => ipcRenderer.on("tray-open-files", () => cb()),
  onTrayStartPrint: (cb) => ipcRenderer.on("tray-start-print", () => cb()),

  // Quit from tray menu
  quitApp: () => ipcRenderer.send("quit-app"),

  // License / Trial
  getLicenseStatus: () => ipcRenderer.invoke("get-license-status"),
  activateLicense: (opts) => ipcRenderer.invoke("activate-license", opts),
});
