const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const { exec } = require("child_process");
const fs = require("fs");
const os = require("os");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1000,
    minHeight: 650,
    frame: false,
    titleBarStyle: "hidden",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    backgroundColor: "#0f0f13",
  });
  mainWindow.loadFile("index.html");
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.on("window-minimize", () => mainWindow.minimize());
ipcMain.on("window-maximize", () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on("window-close", () => mainWindow.close());

// ============================================================
// FILE DIALOG
// ============================================================
ipcMain.handle("open-file-dialog", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    filters: [
      {
        name: "Printable Documents",
        extensions: [
          "pdf",
          "doc",
          "docx",
          "xls",
          "xlsx",
          "ppt",
          "pptx",
          "txt",
          "png",
          "jpg",
          "jpeg",
          "bmp",
        ],
      },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  return result.canceled ? [] : result.filePaths;
});

// ============================================================
// GET PRINTERS
// ============================================================
ipcMain.handle("get-printers", async () => {
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    if (printers && printers.length > 0) {
      return printers.map((p) => ({
        name: p.name,
        displayName: p.displayName || p.name,
        isDefault: p.isDefault || false,
      }));
    }
    if (process.platform === "win32") return await getPrintersViaPS();
    return [];
  } catch (e) {
    if (process.platform === "win32") return await getPrintersViaPS();
    return [];
  }
});

function getPrintersViaPS() {
  return new Promise((resolve) => {
    exec(
      `powershell -NoProfile -Command "Get-Printer | Select-Object Name, Default | ConvertTo-Json -Compress"`,
      { timeout: 10000 },
      (err, stdout) => {
        if (err || !stdout.trim()) {
          resolve([]);
          return;
        }
        try {
          let data = JSON.parse(stdout.trim());
          if (!Array.isArray(data)) data = [data];
          resolve(
            data
              .filter((p) => p.Name)
              .map((p) => ({
                name: p.Name,
                displayName: p.Name,
                isDefault: p.Default === true,
              })),
          );
        } catch {
          resolve([]);
        }
      },
    );
  });
}

// ============================================================
// CHECK DEPENDENCIES (Ghostscript, SumatraPDF)
// ============================================================
ipcMain.handle("check-dependencies", async () => {
  const result = { ghostscript: null, sumatrapdf: null };

  // Cek Ghostscript
  const gsPaths = [];
  const gsDir64 = "C:\\Program Files\\gs";
  const gsDir32 = "C:\\Program Files (x86)\\gs";
  try {
    if (fs.existsSync(gsDir64))
      fs.readdirSync(gsDir64).forEach((v) =>
        gsPaths.push(`${gsDir64}\\${v}\\bin\\gswin64c.exe`),
      );
    if (fs.existsSync(gsDir32))
      fs.readdirSync(gsDir32).forEach((v) =>
        gsPaths.push(`${gsDir32}\\${v}\\bin\\gswin32c.exe`),
      );
  } catch (e) {}
  result.ghostscript =
    gsPaths.find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    }) || null;

  // Cek SumatraPDF
  const sumatraPaths = [
    "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe",
    "C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe",
    path.join(os.homedir(), "AppData\\Local\\SumatraPDF\\SumatraPDF.exe"),
    path.join(
      os.homedir(),
      "AppData\\Local\\Programs\\SumatraPDF\\SumatraPDF.exe",
    ),
  ];
  result.sumatrapdf =
    sumatraPaths.find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    }) || null;

  return result;
});

// ============================================================
// GET PDF PAGE COUNT
// ============================================================
ipcMain.handle("get-pdf-pages", async (event, filePath) => {
  return new Promise((resolve) => {
    // Pakai Ghostscript untuk hitung halaman
    const gsPaths = [];
    try {
      const gsDir64 = "C:\\Program Files\\gs";
      const gsDir32 = "C:\\Program Files (x86)\\gs";
      if (fs.existsSync(gsDir64))
        fs.readdirSync(gsDir64).forEach((v) =>
          gsPaths.push(`${gsDir64}\\${v}\\bin\\gswin64c.exe`),
        );
      if (fs.existsSync(gsDir32))
        fs.readdirSync(gsDir32).forEach((v) =>
          gsPaths.push(`${gsDir32}\\${v}\\bin\\gswin32c.exe`),
        );
    } catch (e) {}

    const gsExe = gsPaths.find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });
    if (!gsExe) {
      resolve(null);
      return;
    }

    const cmd = `"${gsExe}" -dBATCH -dNOPAUSE -dNOSAFER -sDEVICE=nullpage -dQUIET "${filePath}"`;
    exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
      // GS output page count ke stderr dengan format "Page N"
      const matches = (stderr || "").match(/Page\s+(\d+)/g);
      if (matches && matches.length > 0) {
        const pages = parseInt(matches[matches.length - 1].replace(/\D/g, ""));
        resolve(pages);
      } else {
        // Fallback: baca PDF manual untuk cari /Count
        try {
          const buf = fs.readFileSync(filePath);
          const str = buf.toString("latin1");
          const counts = [];
          const re = /\/Count\s+(\d+)/g;
          let m;
          while ((m = re.exec(str)) !== null) counts.push(parseInt(m[1]));
          resolve(counts.length > 0 ? Math.max(...counts) : null);
        } catch {
          resolve(null);
        }
      }
    });
  });
});

// ============================================================
// GENERATE PDF PREVIEW (convert halaman ke PNG pakai GS)
// ============================================================
ipcMain.handle("get-pdf-preview", async (event, { filePath, page }) => {
  return new Promise((resolve) => {
    const gsPaths = [];
    try {
      const gsDir64 = "C:\\Program Files\\gs";
      const gsDir32 = "C:\\Program Files (x86)\\gs";
      if (fs.existsSync(gsDir64))
        fs.readdirSync(gsDir64).forEach((v) =>
          gsPaths.push(`${gsDir64}\\${v}\\bin\\gswin64c.exe`),
        );
      if (fs.existsSync(gsDir32))
        fs.readdirSync(gsDir32).forEach((v) =>
          gsPaths.push(`${gsDir32}\\${v}\\bin\\gswin32c.exe`),
        );
    } catch (e) {}

    const gsExe = gsPaths.find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });
    if (!gsExe) {
      resolve(null);
      return;
    }

    const outFile = path.join(os.tmpdir(), `pc_preview_${Date.now()}.png`);
    const cmd = [
      `"${gsExe}"`,
      "-dBATCH",
      "-dNOPAUSE",
      "-dNOSAFER",
      "-dQUIET",
      "-sDEVICE=png16m",
      "-r150",
      `-dFirstPage=${page}`,
      `-dLastPage=${page}`,
      `-sOutputFile="${outFile}"`,
      `"${filePath}"`,
    ].join(" ");

    exec(cmd, { timeout: 30000 }, (err) => {
      if (err || !fs.existsSync(outFile)) {
        resolve(null);
        return;
      }
      try {
        const data = fs.readFileSync(outFile);
        const b64 = data.toString("base64");
        fs.unlink(outFile, () => {});
        resolve(`data:image/png;base64,${b64}`);
      } catch {
        resolve(null);
      }
    });
  });
});

// ============================================================
// PRINT HISTORY - simpan ke file JSON
// ============================================================
const historyFile = path.join(app.getPath("userData"), "print_history.json");

function loadHistory() {
  try {
    if (fs.existsSync(historyFile))
      return JSON.parse(fs.readFileSync(historyFile, "utf8"));
  } catch (e) {}
  return [];
}

function saveHistory(history) {
  try {
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), "utf8");
  } catch (e) {}
}

ipcMain.handle("get-history", async () => loadHistory());

ipcMain.handle("add-history", async (event, entries) => {
  const history = loadHistory();
  const newEntries = entries.map((e) => ({
    ...e,
    timestamp: new Date().toISOString(),
  }));
  const updated = [...newEntries, ...history].slice(0, 500); // max 500 entri
  saveHistory(updated);
  return updated;
});

ipcMain.handle("clear-history", async () => {
  saveHistory([]);
  return [];
});

ipcMain.handle("delete-history-item", async (event, id) => {
  const history = loadHistory().filter((h) => h.id !== id);
  saveHistory(history);
  return history;
});

// ============================================================
// PRINT FILES
// ============================================================
ipcMain.handle(
  "print-files",
  async (event, { files, printer, copies, orientation }) => {
    const results = [];
    for (const item of files) {
      const filePath = typeof item === "string" ? item : item.path;
      const pageFrom = item.pageFrom || null;
      const pageTo = item.pageTo || null;
      try {
        await printFileSilent(
          filePath,
          printer,
          copies,
          orientation,
          pageFrom,
          pageTo,
        );
        results.push({ file: filePath, success: true });
      } catch (err) {
        results.push({ file: filePath, success: false, error: err.message });
      }
    }
    return results;
  },
);

async function printFileSilent(
  filePath,
  printer,
  copies,
  orientation,
  pageFrom,
  pageTo,
) {
  const ext = path.extname(filePath).toLowerCase();
  if (process.platform === "win32") {
    if (ext === ".pdf")
      return printPdfSilent(
        filePath,
        printer,
        copies,
        orientation,
        pageFrom,
        pageTo,
      );
    if ([".doc", ".docx"].includes(ext))
      return printWordSilent(
        filePath,
        printer,
        copies,
        orientation,
        pageFrom,
        pageTo,
      );
    if ([".xls", ".xlsx"].includes(ext))
      return printExcelSilent(filePath, printer, copies);
    if ([".ppt", ".pptx"].includes(ext))
      return printPptSilent(filePath, printer, copies);
    if (ext === ".txt") return printTxtSilent(filePath, printer, copies);
    if ([".png", ".jpg", ".jpeg", ".bmp"].includes(ext))
      return printImageSilent(filePath, printer, copies);
    throw new Error(`Format ${ext} tidak didukung`);
  } else {
    const orientFlag = orientation === "landscape" ? "-o landscape" : "";
    const pageFlag = pageFrom && pageTo ? `-P ${pageFrom}-${pageTo}` : "";
    return runCmd(
      `lp -d "${printer}" -n ${copies} ${orientFlag} ${pageFlag} "${filePath}"`,
    );
  }
}

// ---- PDF ----
function printPdfSilent(
  filePath,
  printer,
  copies,
  orientation,
  pageFrom,
  pageTo,
) {
  return new Promise((resolve, reject) => {
    const gsPaths = [];
    try {
      const gsDir64 = "C:\\Program Files\\gs";
      const gsDir32 = "C:\\Program Files (x86)\\gs";
      if (fs.existsSync(gsDir64))
        fs.readdirSync(gsDir64).forEach((v) =>
          gsPaths.push(`${gsDir64}\\${v}\\bin\\gswin64c.exe`),
        );
      if (fs.existsSync(gsDir32))
        fs.readdirSync(gsDir32).forEach((v) =>
          gsPaths.push(`${gsDir32}\\${v}\\bin\\gswin32c.exe`),
        );
    } catch (e) {}
    const gsExe = gsPaths.find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });

    if (gsExe)
      return printPdfWithGhostscript(
        gsExe,
        filePath,
        printer,
        copies,
        orientation,
        pageFrom,
        pageTo,
        resolve,
        reject,
      );

    const sumatraPaths = [
      "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe",
      "C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe",
      path.join(os.homedir(), "AppData\\Local\\SumatraPDF\\SumatraPDF.exe"),
    ];
    const sumatraExe = sumatraPaths.find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });
    if (sumatraExe)
      return printPdfWithSumatra(
        sumatraExe,
        filePath,
        printer,
        copies,
        orientation,
        pageFrom,
        pageTo,
        resolve,
        reject,
      );

    reject(new Error("Install Ghostscript atau SumatraPDF untuk print PDF."));
  });
}

function printPdfWithGhostscript(
  gsExe,
  filePath,
  printer,
  copies,
  orientation,
  pageFrom,
  pageTo,
  resolve,
  reject,
) {
  const orientFlag =
    orientation === "landscape"
      ? "-dFIXEDMEDIA -dDEVICEWIDTHPOINTS=842 -dDEVICEHEIGHTPOINTS=595"
      : "";
  const pageFlags =
    pageFrom && pageTo ? `-dFirstPage=${pageFrom} -dLastPage=${pageTo}` : "";
  const printerEsc = printer.replace(/"/g, '\\"');

  const cmd = [
    `"${gsExe}"`,
    "-dBATCH",
    "-dNOPAUSE",
    "-dNOSAFER",
    "-dNOPROMPT",
    `-dNumCopies=${copies}`,
    "-sDEVICE=mswinpr2",
    orientFlag,
    pageFlags,
    `-sOutputFile="%printer%${printerEsc}"`,
    `"${filePath}"`,
  ]
    .filter(Boolean)
    .join(" ");

  exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
    if (
      err &&
      stderr &&
      stderr.includes("Error") &&
      !stderr.includes("ProcessFile")
    ) {
      reject(new Error(`Ghostscript: ${stderr.substring(0, 300)}`));
    } else {
      setTimeout(resolve, 1000);
    }
  });
}

function printPdfWithSumatra(
  sumatraExe,
  filePath,
  printer,
  copies,
  orientation,
  pageFrom,
  pageTo,
  resolve,
  reject,
) {
  const orientOpt = orientation === "landscape" ? "landscape" : "portrait";
  let settings = `copies=${copies},${orientOpt},fit`;
  if (pageFrom && pageTo) settings += `,${pageFrom}-${pageTo}`;
  const cmd = `"${sumatraExe}" -print-to "${printer}" -print-settings "${settings}" "${filePath}"`;
  exec(cmd, { timeout: 60000 }, (err) => {
    if (err) reject(new Error(`SumatraPDF: ${err.message}`));
    else setTimeout(resolve, 2000);
  });
}

// ---- WORD ----
function printWordSilent(
  filePath,
  printer,
  copies,
  orientation,
  pageFrom,
  pageTo,
) {
  const orientVal = orientation === "landscape" ? "2" : "1";
  const rangeType = pageFrom && pageTo ? "3" : "0"; // wdPrintRangeOfPages=3, wdPrintAllDocument=0
  const rangePages =
    pageFrom && pageTo
      ? `$doc.PrintOut($false,$false,${rangeType},"${pageFrom}-${pageTo}","","","",${copies})`
      : `$doc.PrintOut($false,$false,0,"","","","",${copies})`;
  const ps = `
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $doc = $word.Documents.Open("${filePath.replace(/\\/g, "\\\\")}", $false, $true)
  $doc.PageSetup.Orientation = ${orientVal}
  $word.ActivePrinter = "${printer}"
  ${rangePages}
  Start-Sleep -Seconds 3
  $doc.Close($false)
} finally {
  $word.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}`;
  return runPSScript(ps, 120000);
}

// ---- EXCEL ----
function printExcelSilent(filePath, printer, copies) {
  const ps = `
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
  $wb = $excel.Workbooks.Open("${filePath.replace(/\\/g, "\\\\")}", 0, $true)
  $excel.ActivePrinter = "${printer}"
  foreach ($sheet in $wb.Worksheets) {
    $sheet.PrintOut(1, $sheet.UsedRange.Rows.Count, ${copies}, $false, "${printer}")
  }
  Start-Sleep -Seconds 3
  $wb.Close($false)
} finally {
  $excel.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}`;
  return runPSScript(ps, 120000);
}

// ---- POWERPOINT ----
function printPptSilent(filePath, printer, copies) {
  const ps = `
$ppt = New-Object -ComObject PowerPoint.Application
$ppt.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
try {
  $pres = $ppt.Presentations.Open("${filePath.replace(/\\/g, "\\\\")}", $true, $false, $false)
  for ($i = 1; $i -le ${copies}; $i++) {
    $pres.PrintOptions.PrintInBackground = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $pres.PrintOut(1, $pres.Slides.Count, "", 1, [Microsoft.Office.Core.MsoTriState]::msoFalse)
  }
  Start-Sleep -Seconds 3
  $pres.Close()
} finally {
  $ppt.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
}`;
  return runPSScript(ps, 120000);
}

// ---- TXT ----
function printTxtSilent(filePath, printer, copies) {
  const ps = `
$content = Get-Content "${filePath.replace(/\\/g, "\\\\")}" -Raw
for ($i = 1; $i -le ${copies}; $i++) {
  $content | Out-Printer -Name "${printer}"
}`;
  return runPSScript(ps, 30000);
}

// ---- IMAGE ----
function printImageSilent(filePath, printer, copies) {
  const ps = `
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$img = [System.Drawing.Image]::FromFile("${filePath.replace(/\\/g, "\\\\")}")
$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = "${printer}"
$pd.PrinterSettings.Copies = ${copies}
$pd.add_PrintPage({
  param($sender, $e)
  $rect = $e.MarginBounds
  $ratio = [Math]::Min($rect.Width / $img.Width, $rect.Height / $img.Height)
  $newW = [int]($img.Width * $ratio)
  $newH = [int]($img.Height * $ratio)
  $x = $rect.Left + ($rect.Width - $newW) / 2
  $y = $rect.Top + ($rect.Height - $newH) / 2
  $e.Graphics.DrawImage($img, $x, $y, $newW, $newH)
  $e.HasMorePages = $false
})
$pd.Print()
$img.Dispose()`;
  return runPSScript(ps, 30000);
}

// ============================================================
// HELPERS
// ============================================================
function runPSScript(script, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `pc_print_${Date.now()}.ps1`);
    fs.writeFileSync(tmpFile, script, "utf8");
    exec(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`,
      { timeout },
      (err, stdout, stderr) => {
        fs.unlink(tmpFile, () => {});
        if (err) reject(new Error(stderr || err.message));
        else resolve();
      },
    );
  });
}

function runCmd(cmd, timeout = 60000) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve();
    });
  });
}

// FILE INFO
ipcMain.handle("get-file-info", async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase().replace(".", "");
    return {
      name: path.basename(filePath),
      path: filePath,
      size: stats.size,
      ext,
      modified: stats.mtime,
    };
  } catch {
    return null;
  }
});

ipcMain.on("reveal-file", (event, filePath) => {
  shell.showItemInFolder(filePath);
});
