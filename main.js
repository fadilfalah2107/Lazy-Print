const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { exec, execFile } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 860, minWidth: 1000, minHeight: 650,
    frame: false, titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#0f0f13',
  });
  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => { if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize(); });
ipcMain.on('window-close', () => mainWindow.close());

// ============================================================
// DIALOGS
// ============================================================
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Printable Documents', extensions: ['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','png','jpg','jpeg','bmp'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('save-pdf-dialog', async (event, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'output.pdf',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });
  return result.canceled ? null : result.filePath;
});

// ============================================================
// PRINTERS
// ============================================================
ipcMain.handle('get-printers', async () => {
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    if (printers && printers.length > 0) {
      return printers.map(p => ({ name: p.name, displayName: p.displayName || p.name, isDefault: p.isDefault || false }));
    }
    if (process.platform === 'win32') return await getPrintersViaPS();
    return [];
  } catch (e) {
    if (process.platform === 'win32') return await getPrintersViaPS();
    return [];
  }
});

function getPrintersViaPS() {
  return new Promise((resolve) => {
    exec(`powershell -NoProfile -Command "Get-Printer | Select-Object Name,Default | ConvertTo-Json -Compress"`,
      { timeout: 10000 }, (err, stdout) => {
        if (err || !stdout.trim()) { resolve([]); return; }
        try {
          let data = JSON.parse(stdout.trim());
          if (!Array.isArray(data)) data = [data];
          resolve(data.filter(p => p.Name).map(p => ({ name: p.Name, displayName: p.Name, isDefault: p.Default === true })));
        } catch { resolve([]); }
      });
  });
}

// ============================================================
// CHECK DEPENDENCIES
// ============================================================
ipcMain.handle('check-dependencies', async () => {
  return {
    ghostscript: findGhostscript(),
    sumatrapdf:  findSumatra(),
    libreoffice: findLibreOffice(),
    msoffice: checkMsOffice()
  };
});

function checkMsOffice() {
  // Check registry untuk Office
  const officeKeys = [
    'HKLM\\SOFTWARE\\Microsoft\\Office',
    'HKCU\\SOFTWARE\\Microsoft\\Office'
  ];
  try {
    // Quick check via powershell
    return null; // async check happens in preview
  } catch { return null; }
}

// ============================================================
// FILE INFO
// ============================================================
ipcMain.handle('get-file-info', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase().replace('.','');
    return { name: path.basename(filePath), path: filePath, size: stats.size, ext, modified: stats.mtime };
  } catch { return null; }
});

ipcMain.on('reveal-file', (event, filePath) => { shell.showItemInFolder(filePath); });
ipcMain.on('open-output-pdf', (event, filePath) => { shell.openPath(filePath); });

// ============================================================
// SETTINGS PERSISTENCE
// ============================================================
const settingsFile = path.join(app.getPath('userData'), 'settings.json');
const defaultSettings = { printer: '', copies: 1, orientation: 'portrait', color: 'color', rangeEnabled: false };

ipcMain.handle('get-settings', async () => {
  try {
    if (fs.existsSync(settingsFile)) {
      return { ...defaultSettings, ...JSON.parse(fs.readFileSync(settingsFile, 'utf8')) };
    }
  } catch {}
  return defaultSettings;
});

ipcMain.handle('save-settings', async (event, settings) => {
  try { fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8'); } catch {}
  return settings;
});

// ============================================================
// WINDOWS TOAST NOTIFICATION
// ============================================================
ipcMain.on('show-toast', (event, { title, message }) => {
  if (process.platform !== 'win32') return;
  const safeTitle = title.replace(/"/g, "'");
  const safeMsg = message.replace(/"/g, "'");
  const ps = `
Add-Type -AssemblyName System.Windows.Forms
$n = New-Object System.Windows.Forms.NotifyIcon
$n.Icon = [System.Drawing.SystemIcons]::Information
$n.BalloonTipTitle = "${safeTitle}"
$n.BalloonTipText = "${safeMsg}"
$n.Visible = $true
$n.ShowBalloonTip(4000)
Start-Sleep -Milliseconds 4500
$n.Dispose()`;
  const tmpFile = path.join(os.tmpdir(), 'lp_toast_' + Date.now() + '.ps1');
  try {
    fs.writeFileSync(tmpFile, ps, 'utf8');
    exec('powershell -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + tmpFile + '"',
      { timeout: 8000 }, () => { try { fs.unlinkSync(tmpFile); } catch {} });
  } catch {}
});

// ============================================================
// PAGE COUNT
// ============================================================
ipcMain.handle('get-page-count', async (event, filePath) => {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    const gsExe = findGhostscript();
    if (gsExe) {
      try {
        const result = await runCmd(`"${gsExe}" -dBATCH -dNOPAUSE -dNOSAFER -sDEVICE=nullpage -dQUIET "${filePath}"`, 30000, true);
        const matches = (result.stderr||'').match(/Page\s+(\d+)/g);
        if (matches && matches.length > 0) return parseInt(matches[matches.length-1].replace(/\D/g,''));
      } catch {}
    }
    // Fallback: parse PDF manual
    try {
      const buf = fs.readFileSync(filePath);
      const str = buf.toString('latin1');
      const counts = []; const re = /\/Count\s+(\d+)/g; let m;
      while ((m = re.exec(str)) !== null) counts.push(parseInt(m[1]));
      return counts.length > 0 ? Math.max(...counts) : null;
    } catch { return null; }
  }

  if (['.doc','.docx'].includes(ext)) {
    try {
      const out = await runPSScriptOutput(`
$w = New-Object -ComObject Word.Application; $w.Visible = $false; $w.DisplayAlerts = 0
try { $d = $w.Documents.Open("${esc(filePath)}", $false, $true); Write-Output $d.ComputedPageCount; $d.Close($false) }
finally { $w.Quit() }`, 30000);
      const n = parseInt(out.trim());
      return isNaN(n) ? null : n;
    } catch { return null; }
  }

  if (['.ppt','.pptx'].includes(ext)) {
    try {
      const out = await runPSScriptOutput(`
$p = New-Object -ComObject PowerPoint.Application
try { $pr = $p.Presentations.Open("${esc(filePath)}", $true, $false, $false); Write-Output $pr.Slides.Count; $pr.Close() }
finally { $p.Quit() }`, 30000);
      const n = parseInt(out.trim());
      return isNaN(n) ? null : n;
    } catch { return null; }
  }

  if (['.xls','.xlsx'].includes(ext)) {
    try {
      const out = await runPSScriptOutput(`
$e = New-Object -ComObject Excel.Application; $e.Visible = $false; $e.DisplayAlerts = $false
try { $wb = $e.Workbooks.Open("${esc(filePath)}", 0, $true); Write-Output $wb.Sheets.Count; $wb.Close($false) }
finally { $e.Quit() }`, 30000);
      const n = parseInt(out.trim());
      return isNaN(n) ? null : n;
    } catch { return null; }
  }

  if (ext === '.txt') {
    try { return Math.ceil(fs.readFileSync(filePath,'utf8').split('\n').length / 50); } catch { return null; }
  }
  if (['.png','.jpg','.jpeg','.bmp','.gif'].includes(ext)) return 1;
  return null;
});

// ============================================================
// PREVIEW
// ============================================================
ipcMain.handle('get-preview', async (event, { filePath, page }) => {
  const ext = path.extname(filePath).toLowerCase();

  // IMAGE — langsung baca file
  if (['.png','.jpg','.jpeg','.bmp','.gif'].includes(ext)) {
    try {
      const mimeMap = {png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',bmp:'image/bmp',gif:'image/gif'};
      const mime = mimeMap[ext.replace('.','')];
      const data = fs.readFileSync(filePath);
      return { type: 'image', data: `data:${mime};base64,${data.toString('base64')}` };
    } catch { return null; }
  }

  // PDF — Ghostscript
  if (ext === '.pdf') {
    const gsExe = findGhostscript();
    if (!gsExe) return { type: 'error', msg: 'Install Ghostscript untuk preview PDF' };
    const outFile = tmp('prev_pdf', 'png');
    try {
      await runCmd([
        `"${gsExe}"`,'-dBATCH','-dNOPAUSE','-dNOSAFER','-dQUIET',
        '-sDEVICE=png16m','-r120',
        `-dFirstPage=${page}`,`-dLastPage=${page}`,
        `-sOutputFile="${outFile}"`,`"${filePath}"`
      ].join(' '), 30000);
      if (!fs.existsSync(outFile)) return { type: 'error', msg: 'Ghostscript gagal render halaman ini' };
      const b64 = fs.readFileSync(outFile).toString('base64');
      fs.unlink(outFile, ()=>{});
      return { type: 'image', data: `data:image/png;base64,${b64}` };
    } catch(e) {
      if (fs.existsSync(outFile)) fs.unlink(outFile, ()=>{});
      return { type: 'error', msg: e.message };
    }
  }

  // TXT — render HTML
  if (ext === '.txt') {
    try {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      const lpp = 50, start = (page-1)*lpp;
      const pageLines = lines.slice(start, start+lpp);
      const escaped = pageLines.map(l => l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')).join('\n');
      const totalPages = Math.ceil(lines.length/lpp);
      return { type: 'html', content: `<!DOCTYPE html><html><body style="margin:16px;font-family:Consolas,monospace;font-size:11px;background:#1c1c28;color:#e8e8f0;white-space:pre-wrap;word-break:break-word;line-height:1.5">${escaped}</body></html>`, totalPages };
    } catch(e) { return { type: 'error', msg: e.message }; }
  }

  // WORD / EXCEL / PPT
  // Strategy 1: MS Office COM (Windows, invisible)
  // Strategy 2: LibreOffice headless (fallback, gratis)
  // Keduanya convert ke PDF/PNG dulu, lalu GS render ke PNG
  const gsExe = findGhostscript();
  const libreExe = findLibreOffice();

  if (['.doc','.docx','.xls','.xlsx','.ppt','.pptx'].includes(ext)) {
    // Coba MS Office dulu, fallback ke LibreOffice
    const tmpPdf = tmp('prev_office', 'pdf');

    // === MS Office via COM ===
    let msSuccess = false;
    try {
      if (ext.startsWith('.doc')) {
        await runPSScript(`
$w = New-Object -ComObject Word.Application; $w.Visible = $false; $w.DisplayAlerts = 0
try {
  $d = $w.Documents.Open("${esc(filePath)}", $false, $true)
  $d.ExportAsFixedFormat("${esc(tmpPdf)}", 17, $false, 0, 0, ${page}, ${page})
  $d.Close($false)
} finally { $w.Quit() }`, 60000);
      } else if (ext.startsWith('.xls')) {
        await runPSScript(`
$e = New-Object -ComObject Excel.Application; $e.Visible = $false; $e.DisplayAlerts = $false
try {
  $wb = $e.Workbooks.Open("${esc(filePath)}", 0, $true)
  $ws = $wb.Sheets.Item(${page})
  $ws.ExportAsFixedFormat(0, "${esc(tmpPdf)}")
  $wb.Close($false)
} finally { $e.Quit() }`, 60000);
      } else if (ext.startsWith('.ppt')) {
        // PPT bisa export langsung ke PNG — lebih cepat
        const outPng = tmp('prev_ppt', 'png');
        await runPSScript(`
$p = New-Object -ComObject PowerPoint.Application
try {
  $pr = $p.Presentations.Open("${esc(filePath)}", $true, $false, $false)
  $slide = $pr.Slides.Item(${page})
  $slide.Export("${esc(outPng)}", "PNG", 1280, 720)
  $pr.Close()
} finally { $p.Quit() }`, 60000);
        if (fs.existsSync(outPng)) {
          const b64 = fs.readFileSync(outPng).toString('base64');
          fs.unlink(outPng, ()=>{});
          return { type: 'image', data: `data:image/png;base64,${b64}` };
        }
      }
      if (fs.existsSync(tmpPdf)) msSuccess = true;
    } catch(e) { /* MS Office tidak ada, coba LibreOffice */ }

    // === LibreOffice headless fallback ===
    if (!msSuccess && libreExe) {
      try {
        const outDir = path.dirname(tmpPdf);
        // LibreOffice convert ke PDF, simpan di tempdir
        await runCmd(`"${libreExe}" --headless --convert-to pdf --outdir "${outDir}" "${filePath}"`, 60000);
        // LibreOffice namai file dengan nama asli + .pdf
        const baseName = path.basename(filePath, ext) + '.pdf';
        const libreOut = path.join(outDir, baseName);
        if (fs.existsSync(libreOut)) {
          if (libreOut !== tmpPdf) fs.renameSync(libreOut, tmpPdf);
          msSuccess = true;
        }
      } catch(e) { /* LibreOffice juga gagal */ }
    }

    if (!msSuccess) {
      if (fs.existsSync(tmpPdf)) fs.unlink(tmpPdf, ()=>{});
      const hint = libreExe ? '' : ' Install Microsoft Office atau LibreOffice (gratis).';
      return { type: 'error', msg: `Preview gagal. Tidak ada Office/LibreOffice terdeteksi.${hint}` };
    }

    if (!gsExe) {
      fs.unlink(tmpPdf, ()=>{});
      return { type: 'error', msg: 'Install Ghostscript untuk render preview.' };
    }

    const result = await pdfPageToPng(gsExe, tmpPdf, 1);
    fs.unlink(tmpPdf, ()=>{});
    return result;
  }

  return { type: 'error', msg: `Format .${ext.replace('.','')} tidak mendukung preview` };
});

async function pdfPageToPng(gsExe, pdfPath, page) {
  const outFile = tmp('prev_gs', 'png');
  try {
    await runCmd([
      `"${gsExe}"`,'-dBATCH','-dNOPAUSE','-dNOSAFER','-dQUIET',
      '-sDEVICE=png16m','-r120',
      `-dFirstPage=${page}`,`-dLastPage=${page}`,
      `-sOutputFile="${outFile}"`,`"${pdfPath}"`
    ].join(' '), 20000);
    if (!fs.existsSync(outFile)) return { type: 'error', msg: 'Ghostscript gagal render' };
    const b64 = fs.readFileSync(outFile).toString('base64');
    fs.unlink(outFile, ()=>{});
    return { type: 'image', data: `data:image/png;base64,${b64}` };
  } catch(e) {
    if (fs.existsSync(outFile)) fs.unlink(outFile, ()=>{});
    return { type: 'error', msg: e.message };
  }
}

// ============================================================
// PRINT TO PDF
// ============================================================
ipcMain.handle('print-to-pdf', async (event, { files, outputPath, pageFrom, pageTo }) => {
  const gsExe = findGhostscript();
  if (!gsExe) throw new Error('Ghostscript tidak ditemukan. Install Ghostscript untuk fitur ini.');

  const pdfFiles = [], tempFiles = [];
  try {
    for (const filePath of files) {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.pdf') { pdfFiles.push(filePath); continue; }
      const tmpPdf = tmp('conv', 'pdf');
      try {
        if (['.doc','.docx'].includes(ext)) await convertOfficeToPdf(filePath, tmpPdf, 'word');
        else if (['.xls','.xlsx'].includes(ext)) await convertOfficeToPdf(filePath, tmpPdf, 'excel');
        else if (['.ppt','.pptx'].includes(ext)) await convertOfficeToPdf(filePath, tmpPdf, 'ppt');
        else if (['.png','.jpg','.jpeg','.bmp'].includes(ext)) await runCmd(`"${gsExe}" -dBATCH -dNOPAUSE -dNOSAFER -sDEVICE=pdfwrite -sOutputFile="${tmpPdf}" "${filePath}"`, 30000);
        else if (ext === '.txt') await convertTxtToPdf(filePath, tmpPdf);
        if (fs.existsSync(tmpPdf)) { pdfFiles.push(tmpPdf); tempFiles.push(tmpPdf); }
      } catch(e) { console.log('Skip convert error:', e.message); }
    }
    if (!pdfFiles.length) throw new Error('Tidak ada file yang berhasil dikonversi.');
    const pageFlags = pageFrom && pageTo ? `-dFirstPage=${pageFrom} -dLastPage=${pageTo}` : '';
    const inputFiles = pdfFiles.map(f => `"${f}"`).join(' ');
    await runCmd([`"${gsExe}"`,'-dBATCH','-dNOPAUSE','-dNOSAFER','-dQUIET','-sDEVICE=pdfwrite','-dCompatibilityLevel=1.6',pageFlags,`-sOutputFile="${outputPath}"`,inputFiles].filter(Boolean).join(' '), 180000);
    tempFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    return { success: true, outputPath };
  } catch(e) {
    tempFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    throw e;
  }
});

function convertOfficeToPdf(inputPath, outputPath, appType) {
  const scripts = {
    word: `$w = New-Object -ComObject Word.Application; $w.Visible = $false; $w.DisplayAlerts = 0
try { $d = $w.Documents.Open("${esc(inputPath)}",$false,$true); $d.ExportAsFixedFormat("${esc(outputPath)}",17); $d.Close($false) } finally { $w.Quit() }`,
    excel: `$e = New-Object -ComObject Excel.Application; $e.Visible=$false; $e.DisplayAlerts=$false
try { $wb=$e.Workbooks.Open("${esc(inputPath)}",0,$true); $wb.ExportAsFixedFormat(0,"${esc(outputPath)}"); $wb.Close($false) } finally { $e.Quit() }`,
    ppt: `$p = New-Object -ComObject PowerPoint.Application
try { $pr=$p.Presentations.Open("${esc(inputPath)}",$true,$false,$false); $pr.ExportAsFixedFormat("${esc(outputPath)}",2); $pr.Close() } finally { $p.Quit() }`
  };
  return runPSScript(scripts[appType], 120000);
}

function convertTxtToPdf(inputPath, outputPath) {
  return runPSScript(`$w=New-Object -ComObject Word.Application; $w.Visible=$false; $w.DisplayAlerts=0
try { $d=$w.Documents.Open("${esc(inputPath)}",$false,$true); $d.ExportAsFixedFormat("${esc(outputPath)}",17); $d.Close($false) } finally { $w.Quit() }`, 60000);
}

// ============================================================
// PRINT PROFILES
// ============================================================
const profilesFile = path.join(app.getPath('userData'), 'print_profiles.json');
const loadProfiles = () => { try { return JSON.parse(fs.readFileSync(profilesFile,'utf8')); } catch { return []; } };
const saveProfiles = p => { try { fs.writeFileSync(profilesFile, JSON.stringify(p,null,2)); } catch {} };

ipcMain.handle('get-profiles', async () => loadProfiles());
ipcMain.handle('save-profile', async (event, profile) => {
  const profiles = loadProfiles();
  const idx = profiles.findIndex(p => p.id === profile.id);
  if (idx>=0) profiles[idx]=profile; else profiles.push(profile);
  saveProfiles(profiles); return profiles;
});
ipcMain.handle('delete-profile', async (event, id) => {
  const profiles = loadProfiles().filter(p=>p.id!==id);
  saveProfiles(profiles); return profiles;
});

// ============================================================
// PRINT HISTORY
// ============================================================
const historyFile = path.join(app.getPath('userData'), 'print_history.json');
const loadHistory = () => { try { return JSON.parse(fs.readFileSync(historyFile,'utf8')); } catch { return []; } };
const saveHistory = h => { try { fs.writeFileSync(historyFile, JSON.stringify(h,null,2)); } catch {} };

ipcMain.handle('get-history', async () => loadHistory());
ipcMain.handle('add-history', async (event, entries) => {
  const updated = [...entries.map(e=>({...e,timestamp:new Date().toISOString()})), ...loadHistory()].slice(0,500);
  saveHistory(updated); return updated;
});
ipcMain.handle('clear-history', async () => { saveHistory([]); return []; });
ipcMain.handle('delete-history-item', async (event, id) => {
  const h = loadHistory().filter(h=>h.id!==id); saveHistory(h); return h;
});

// ============================================================
// QUEUE PERSISTENCE
// ============================================================
const queueFile = path.join(app.getPath('userData'), 'queue.json');

ipcMain.handle('save-queue', async (event, files) => {
  // Simpan hanya data yang dibutuhkan (bukan binary)
  const slim = files.map(f => ({
    path: f.path, name: f.name, ext: f.ext, size: f.size,
    totalPages: f.totalPages || null,
    fileCopies: f.fileCopies || null,
    fileOrientation: f.fileOrientation || null,
    filePageFrom: f.filePageFrom || null,
    filePageTo: f.filePageTo || null,
  }));
  try { fs.writeFileSync(queueFile, JSON.stringify(slim, null, 2), 'utf8'); } catch {}
  return slim;
});

ipcMain.handle('load-queue', async () => {
  try {
    if (!fs.existsSync(queueFile)) return [];
    const saved = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
    // Filter file yang masih ada di disk
    return saved.filter(f => { try { return fs.existsSync(f.path); } catch { return false; } });
  } catch { return []; }
});

ipcMain.handle('clear-queue', async () => {
  try { if (fs.existsSync(queueFile)) fs.unlinkSync(queueFile); } catch {}
  return [];
});

// ============================================================
// WATCH FOLDER
// ============================================================
let watcherMap = {}; // folderPath -> fs.FSWatcher

ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Pilih Folder yang akan di-watch'
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('start-watch', async (event, folderPath) => {
  if (watcherMap[folderPath]) return { ok: true, msg: 'Sudah berjalan' };
  const EXTS = ['.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.txt','.png','.jpg','.jpeg','.bmp'];
  try {
    // Debounce map to avoid double-fire
    const pending = new Set();
    const watcher = fs.watch(folderPath, { persistent: false }, (eventType, filename) => {
      if (eventType !== 'rename' || !filename) return;
      const fullPath = path.join(folderPath, filename);
      const ext = path.extname(filename).toLowerCase();
      if (!EXTS.includes(ext)) return;
      if (pending.has(fullPath)) return;
      pending.add(fullPath);
      setTimeout(() => {
        pending.delete(fullPath);
        try {
          if (fs.existsSync(fullPath)) {
            const stat = fs.statSync(fullPath);
            mainWindow.webContents.send('watch-file-added', {
              path: fullPath, name: filename,
              ext: ext.replace('.',''), size: stat.size
            });
          }
        } catch {}
      }, 800);
    });
    watcherMap[folderPath] = watcher;
    watcher.on('error', () => { delete watcherMap[folderPath]; });
    return { ok: true, msg: `Watching: ${path.basename(folderPath)}` };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
});

ipcMain.handle('stop-watch', async (event, folderPath) => {
  if (watcherMap[folderPath]) {
    try { watcherMap[folderPath].close(); } catch {}
    delete watcherMap[folderPath];
  }
  return { ok: true };
});

ipcMain.handle('get-watches', async () => Object.keys(watcherMap));

// Cleanup all watchers on exit
app.on('before-quit', () => {
  Object.values(watcherMap).forEach(w => { try { w.close(); } catch {} });
  watcherMap = {};
});

// ============================================================
// SILENT PRINTING
// ============================================================
ipcMain.handle('print-files', async (event, { files, printer, copies, orientation, nup, duplex }) => {
  const results = [];
  for (const item of files) {
    const filePath = typeof item === 'string' ? item : item.path;
    const pageFrom = item.pageFrom || null, pageTo = item.pageTo || null;
    // Per-file overrides
    const fCopies  = item.fileCopies      || copies;
    const fOri     = item.fileOrientation || orientation;
    try {
      await printFileSilent(filePath, printer, fCopies, fOri, pageFrom, pageTo, nup||1, duplex||false);
      results.push({ file: filePath, success: true });
    } catch(err) {
      results.push({ file: filePath, success: false, error: err.message });
    }
  }
  return results;
});

async function printFileSilent(filePath, printer, copies, orientation, pageFrom, pageTo, nup, duplex) {
  const ext = path.extname(filePath).toLowerCase();
  if (process.platform === 'win32') {
    if (ext==='.pdf') return printPdfSilent(filePath, printer, copies, orientation, pageFrom, pageTo, nup, duplex);
    if (['.doc','.docx'].includes(ext)) return printWordSilent(filePath, printer, copies, orientation, pageFrom, pageTo, duplex);
    if (['.xls','.xlsx'].includes(ext)) return printExcelSilent(filePath, printer, copies, duplex);
    if (['.ppt','.pptx'].includes(ext)) return printPptSilent(filePath, printer, copies);
    if (ext==='.txt') return printTxtSilent(filePath, printer, copies);
    if (['.png','.jpg','.jpeg','.bmp'].includes(ext)) return printImageSilent(filePath, printer, copies);
    throw new Error(`Format ${ext} tidak didukung`);
  } else {
    const orientFlag = orientation==='landscape'?'-o landscape':'';
    const pageFlag = pageFrom&&pageTo?`-P ${pageFrom}-${pageTo}`:'';
    const nupFlag = nup>1?`-o number-up=${nup}`:'';
    const duplexFlag = duplex?'-o sides=two-sided-long-edge':'';
    return runCmd(`lp -d "${printer}" -n ${copies} ${orientFlag} ${pageFlag} ${nupFlag} ${duplexFlag} "${filePath}"`);
  }
}

function printPdfSilent(filePath, printer, copies, orientation, pageFrom, pageTo, nup, duplex) {
  return new Promise((resolve, reject) => {
    const gsExe = findGhostscript();
    if (gsExe) return printPdfGS(gsExe, filePath, printer, copies, orientation, pageFrom, pageTo, resolve, reject, nup, duplex);
    const suma = findSumatra();
    if (suma) return printPdfSumatra(suma, filePath, printer, copies, orientation, pageFrom, pageTo, resolve, reject);
    reject(new Error('Install Ghostscript atau SumatraPDF untuk print PDF.'));
  });
}

function printPdfGS(gsExe, filePath, printer, copies, orientation, pageFrom, pageTo, resolve, reject, nup, duplex) {
  const orientFlag = orientation==='landscape'?'-dFIXEDMEDIA -dDEVICEWIDTHPOINTS=842 -dDEVICEHEIGHTPOINTS=595':'';
  const pageFlags  = pageFrom&&pageTo?`-dFirstPage=${pageFrom} -dLastPage=${pageTo}`:'';
  // N-up: use Ghostscript pstops-style via nup device
  const nupFlag    = nup>1?`-dNupW=${nup<=2?2:2} -dNupH=${nup<=2?1:2}`:'';
  // Duplex: set via printer properties - GS passes through to driver
  const duplexFlag = duplex?'-dDuplex=true -dTumble=false':'';
  const cmd = [`"${gsExe}"`,'-dBATCH','-dNOPAUSE','-dNOSAFER','-dNOPROMPT',
    `-dNumCopies=${copies}`,'-sDEVICE=mswinpr2',
    orientFlag, pageFlags, nupFlag, duplexFlag,
    `-sOutputFile="%printer%${printer.replace(/"/g,'\\"')}"`,`"${filePath}"`
  ].filter(Boolean).join(' ');
  exec(cmd, {timeout:120000}, (err,stdout,stderr) => {
    if (err&&stderr&&stderr.includes('Error')&&!stderr.includes('ProcessFile')) reject(new Error(`GS: ${stderr.substring(0,200)}`));
    else setTimeout(resolve,1000);
  });
}

function printPdfSumatra(sumatraExe, filePath, printer, copies, orientation, pageFrom, pageTo, resolve, reject) {
  let settings = `copies=${copies},${orientation==='landscape'?'landscape':'portrait'},fit`;
  if (pageFrom&&pageTo) settings+=`,${pageFrom}-${pageTo}`;
  exec(`"${sumatraExe}" -print-to "${printer}" -print-settings "${settings}" "${filePath}"`, {timeout:60000}, err => {
    if (err) reject(new Error(`Sumatra: ${err.message}`)); else setTimeout(resolve,2000);
  });
}

function printWordSilent(filePath, printer, copies, orientation, pageFrom, pageTo, duplex) {
  const libreExe = findLibreOffice();
  const orientVal = orientation==='landscape'?'2':'1';
  const rangePart = pageFrom&&pageTo?`$d.PrintOut($false,$false,3,"${pageFrom}-${pageTo}","","","",${copies})`:`$d.PrintOut($false,$false,0,"","","","",${copies})`;
  // Duplex via WdPrintDuplex: 0=default, 1=simplex, 2=duplex long, 3=duplex short
  const duplexLine = duplex?`$d.PageSetup.TwoPagesOnOne = $false; $w.Options.PrintBackground = $false`:'';
  const msScript = `
$w=New-Object -ComObject Word.Application; $w.Visible=$false; $w.DisplayAlerts=0
try {
  $d=$w.Documents.Open("${esc(filePath)}",$false,$true)
  $d.PageSetup.Orientation=${orientVal}; $w.ActivePrinter="${printer}"
  ${duplexLine}
  ${rangePart}; Start-Sleep 3; $d.Close($false)
} finally { $w.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w)|Out-Null }`;
  return runPSScript(msScript, 120000).catch(async err => {
    if (!libreExe) throw new Error('Word tidak ditemukan. Install Microsoft Word atau LibreOffice.');
    return printViaPdfConvert(filePath, printer, copies, libreExe);
  });
}

function printExcelSilent(filePath, printer, copies, duplex) {
  const libreExe = findLibreOffice();
  const msScript = `
$e=New-Object -ComObject Excel.Application; $e.Visible=$false; $e.DisplayAlerts=$false
try {
  $wb=$e.Workbooks.Open("${esc(filePath)}",0,$true); $e.ActivePrinter="${printer}"
  foreach($s in $wb.Worksheets){$s.PrintOut(1,$s.UsedRange.Rows.Count,${copies},$false,"${printer}")}
  Start-Sleep 3; $wb.Close($false)
} finally { $e.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($e)|Out-Null }`;
  return runPSScript(msScript, 120000).catch(async err => {
    if (!libreExe) throw new Error('Excel tidak ditemukan. Install Microsoft Excel atau LibreOffice.');
    return printViaPdfConvert(filePath, printer, copies, libreExe);
  });
}

function printPptSilent(filePath, printer, copies) {
  const libreExe = findLibreOffice();
  const msScript = `
$p=New-Object -ComObject PowerPoint.Application; $p.Visible=[Microsoft.Office.Core.MsoTriState]::msoFalse
try {
  $pr=$p.Presentations.Open("${esc(filePath)}",$true,$false,$false)
  for($i=1;$i -le ${copies};$i++){$pr.PrintOut(1,$pr.Slides.Count,"",1,[Microsoft.Office.Core.MsoTriState]::msoFalse)}
  Start-Sleep 3; $pr.Close()
} finally { $p.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($p)|Out-Null }`;
  return runPSScript(msScript, 120000).catch(async err => {
    if (!libreExe) throw new Error('PowerPoint tidak ditemukan. Install Microsoft PowerPoint atau LibreOffice.');
    return printViaPdfConvert(filePath, printer, copies, libreExe);
  });
}

// Convert via LibreOffice → PDF → print via Ghostscript (semua background, tidak buka UI)
async function printViaPdfConvert(filePath, printer, copies, libreExe) {
  const gsExe = findGhostscript();
  if (!gsExe) throw new Error('Install Ghostscript untuk print via LibreOffice.');
  const outDir = os.tmpdir();
  await runCmd(`"${libreExe}" --headless --convert-to pdf --outdir "${outDir}" "${filePath}"`, 60000);
  const ext = path.extname(filePath);
  const pdfPath = path.join(outDir, path.basename(filePath, ext) + '.pdf');
  if (!fs.existsSync(pdfPath)) throw new Error('LibreOffice gagal convert ke PDF.');
  try {
    await new Promise((resolve, reject) => printPdfGS(gsExe, pdfPath, printer, copies, 'portrait', null, null, resolve, reject));
  } finally {
    fs.unlink(pdfPath, ()=>{});
  }
}

function printTxtSilent(filePath, printer, copies) {
  return runPSScript(`$c=Get-Content "${esc(filePath)}" -Raw
for($i=1;$i -le ${copies};$i++){$c|Out-Printer -Name "${printer}"}`, 30000);
}

function printImageSilent(filePath, printer, copies) {
  return runPSScript(`
Add-Type -AssemblyName System.Drawing,System.Windows.Forms
$img=[System.Drawing.Image]::FromFile("${esc(filePath)}")
$pd=New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName="${printer}"; $pd.PrinterSettings.Copies=${copies}
$pd.add_PrintPage({param($s,$e)
  $r=$e.MarginBounds; $ratio=[Math]::Min($r.Width/$img.Width,$r.Height/$img.Height)
  $nw=[int]($img.Width*$ratio); $nh=[int]($img.Height*$ratio)
  $e.Graphics.DrawImage($img,$r.Left+($r.Width-$nw)/2,$r.Top+($r.Height-$nh)/2,$nw,$nh)
  $e.HasMorePages=$false})
$pd.Print(); $img.Dispose()`, 30000);
}

// ============================================================
// HELPERS
// ============================================================
function esc(p) { return p.replace(/\\/g,'\\\\').replace(/"/g,'\\"'); }
function tmp(prefix, ext) { return path.join(os.tmpdir(), `lp_${prefix}_${Date.now()}_${Math.random().toString(36).substr(2,5)}.${ext}`); }

function findGhostscript() {
  const paths = [];
  try {
    ['C:\\Program Files\\gs','C:\\Program Files (x86)\\gs'].forEach(dir => {
      if (fs.existsSync(dir)) fs.readdirSync(dir).forEach(v => {
        paths.push(`${dir}\\${v}\\bin\\gswin64c.exe`);
        paths.push(`${dir}\\${v}\\bin\\gswin32c.exe`);
      });
    });
  } catch {}
  return paths.find(p => { try { return fs.existsSync(p); } catch { return false; } }) || null;
}

function findSumatra() {
  return [
    'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe',
    'C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe',
    path.join(os.homedir(), 'AppData\\Local\\SumatraPDF\\SumatraPDF.exe'),
  ].find(p => { try { return fs.existsSync(p); } catch { return false; } }) || null;
}

function findLibreOffice() {
  return [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    '/usr/bin/libreoffice', '/usr/bin/soffice',
  ].find(p => { try { return fs.existsSync(p); } catch { return false; } }) || null;
}

function runPSScript(script, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const f = tmp('ps', 'ps1');
    fs.writeFileSync(f, script, 'utf8');
    exec(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${f}"`,
      {timeout}, (err, stdout, stderr) => {
        fs.unlink(f, ()=>{});
        if (err) reject(new Error(stderr || err.message)); else resolve(stdout);
      });
  });
}

function runPSScriptOutput(script, timeout = 60000) {
  return runPSScript(script, timeout);
}

function runCmd(cmd, timeout = 60000, returnBoth = false) {
  return new Promise((resolve, reject) => {
    exec(cmd, {timeout}, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(returnBoth ? {stdout, stderr} : stdout);
    });
  });
}
