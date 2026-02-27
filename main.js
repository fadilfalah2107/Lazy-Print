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

// Dialog simpan PDF output
ipcMain.handle("save-pdf-dialog", async (event, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || "output.pdf",
    filters: [{ name: "PDF Files", extensions: ["pdf"] }],
  });
  return result.canceled ? null : result.filePath;
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
// CHECK DEPENDENCIES
// ============================================================
ipcMain.handle("check-dependencies", async () => {
  const result = { ghostscript: null, sumatrapdf: null };
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
  result.ghostscript =
    gsPaths.find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    }) || null;
  const sumatraPaths = [
    "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe",
    "C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe",
    path.join(os.homedir(), "AppData\\Local\\SumatraPDF\\SumatraPDF.exe"),
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
// PDF PAGE COUNT
// ============================================================
ipcMain.handle("get-pdf-pages", async (event, filePath) => {
  return new Promise((resolve) => {
    const gsExe = findGhostscript();
    if (!gsExe) {
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
      return;
    }
    const cmd = `"${gsExe}" -dBATCH -dNOPAUSE -dNOSAFER -sDEVICE=nullpage -dQUIET "${filePath}"`;
    exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
      const matches = (stderr || "").match(/Page\s+(\d+)/g);
      if (matches && matches.length > 0) {
        resolve(parseInt(matches[matches.length - 1].replace(/\D/g, "")));
      } else {
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
// PDF PREVIEW
// ============================================================
ipcMain.handle("get-pdf-preview", async (event, { filePath, page }) => {
  return new Promise((resolve) => {
    const gsExe = findGhostscript();
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
        const b64 = fs.readFileSync(outFile).toString("base64");
        fs.unlink(outFile, () => {});
        resolve(`data:image/png;base64,${b64}`);
      } catch {
        resolve(null);
      }
    });
  });
});

// ============================================================
// PRINT TO PDF (merge semua dokumen jadi satu PDF)
// ============================================================
ipcMain.handle(
  "print-to-pdf",
  async (event, { files, outputPath, pageFrom, pageTo }) => {
    const gsExe = findGhostscript();
    if (!gsExe)
      throw new Error(
        "Ghostscript tidak ditemukan. Install Ghostscript untuk fitur ini.",
      );

    // Untuk non-PDF, convert dulu ke PDF via Office COM, lalu merge
    const pdfFiles = [];
    const tempFiles = [];

    try {
      for (const filePath of files) {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === ".pdf") {
          pdfFiles.push(filePath);
        } else if ([".doc", ".docx"].includes(ext)) {
          const tmpPdf = path.join(
            os.tmpdir(),
            `lp_conv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.pdf`,
          );
          await convertOfficeToPdf(filePath, tmpPdf, "word");
          pdfFiles.push(tmpPdf);
          tempFiles.push(tmpPdf);
        } else if ([".xls", ".xlsx"].includes(ext)) {
          const tmpPdf = path.join(
            os.tmpdir(),
            `lp_conv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.pdf`,
          );
          await convertOfficeToPdf(filePath, tmpPdf, "excel");
          pdfFiles.push(tmpPdf);
          tempFiles.push(tmpPdf);
        } else if ([".ppt", ".pptx"].includes(ext)) {
          const tmpPdf = path.join(
            os.tmpdir(),
            `lp_conv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.pdf`,
          );
          await convertOfficeToPdf(filePath, tmpPdf, "ppt");
          pdfFiles.push(tmpPdf);
          tempFiles.push(tmpPdf);
        } else if ([".png", ".jpg", ".jpeg", ".bmp"].includes(ext)) {
          const tmpPdf = path.join(
            os.tmpdir(),
            `lp_conv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.pdf`,
          );
          await convertImageToPdf(gsExe, filePath, tmpPdf);
          pdfFiles.push(tmpPdf);
          tempFiles.push(tmpPdf);
        } else if (ext === ".txt") {
          const tmpPdf = path.join(
            os.tmpdir(),
            `lp_conv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.pdf`,
          );
          await convertTxtToPdf(gsExe, filePath, tmpPdf);
          pdfFiles.push(tmpPdf);
          tempFiles.push(tmpPdf);
        }
      }

      // Merge semua PDF jadi satu pakai Ghostscript
      const pageFlags =
        pageFrom && pageTo
          ? `-dFirstPage=${pageFrom} -dLastPage=${pageTo}`
          : "";
      const inputFiles = pdfFiles.map((f) => `"${f}"`).join(" ");
      const cmd = [
        `"${gsExe}"`,
        "-dBATCH",
        "-dNOPAUSE",
        "-dNOSAFER",
        "-dQUIET",
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.6",
        pageFlags,
        `-sOutputFile="${outputPath}"`,
        inputFiles,
      ]
        .filter(Boolean)
        .join(" ");

      await runCmd(cmd, 180000);

      // Cleanup temp files
      tempFiles.forEach((f) => {
        try {
          fs.unlinkSync(f);
        } catch {}
      });

      return { success: true, outputPath };
    } catch (err) {
      tempFiles.forEach((f) => {
        try {
          fs.unlinkSync(f);
        } catch {}
      });
      throw err;
    }
  },
);

function convertOfficeToPdf(inputPath, outputPath, app) {
  const appMap = {
    word: `
$w = New-Object -ComObject Word.Application; $w.Visible = $false; $w.DisplayAlerts = 0
try { $d = $w.Documents.Open("${inputPath.replace(/\\/g, "\\\\")}", $false, $true); $d.ExportAsFixedFormat("${outputPath.replace(/\\/g, "\\\\")}", 17); $d.Close($false) } finally { $w.Quit() }`,
    excel: `
$e = New-Object -ComObject Excel.Application; $e.Visible = $false; $e.DisplayAlerts = $false
try { $wb = $e.Workbooks.Open("${inputPath.replace(/\\/g, "\\\\")}", 0, $true); $wb.ExportAsFixedFormat(0, "${outputPath.replace(/\\/g, "\\\\")}"); $wb.Close($false) } finally { $e.Quit() }`,
    ppt: `
$p = New-Object -ComObject PowerPoint.Application
try { $pr = $p.Presentations.Open("${inputPath.replace(/\\/g, "\\\\")}", $true, $false, $false); $pr.ExportAsFixedFormat("${outputPath.replace(/\\/g, "\\\\")}", 2); $pr.Close() } finally { $p.Quit() }`,
  };
  return runPSScript(appMap[app], 120000);
}

function convertImageToPdf(gsExe, inputPath, outputPath) {
  const cmd = `"${gsExe}" -dBATCH -dNOPAUSE -dNOSAFER -sDEVICE=pdfwrite -sOutputFile="${outputPath}" "${inputPath}"`;
  return runCmd(cmd, 30000);
}

function convertTxtToPdf(gsExe, inputPath, outputPath) {
  // Ghostscript tidak bisa langsung dari TXT, pakai PS script dulu
  const ps = `
Add-Type -AssemblyName System.Drawing
$txt = Get-Content "${inputPath.replace(/\\/g, "\\\\")}" -Raw
$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = "Microsoft Print to PDF"
$pd.PrinterSettings.PrintFileName = "${outputPath.replace(/\\/g, "\\\\")}"
$pd.PrinterSettings.PrintToFile = $true
$lines = $txt -split "\`n"
$lineIdx = 0
$pd.add_PrintPage({
  param($s, $e)
  $font = New-Object System.Drawing.Font("Courier New", 10)
  $brush = [System.Drawing.Brushes]::Black
  $y = $e.MarginBounds.Top
  $lineH = $font.GetHeight($e.Graphics)
  while ($lineIdx -lt $lines.Count -and $y + $lineH -le $e.MarginBounds.Bottom) {
    $e.Graphics.DrawString($lines[$lineIdx], $font, $brush, $e.MarginBounds.Left, $y)
    $y += $lineH; $lineIdx++
  }
  $e.HasMorePages = ($lineIdx -lt $lines.Count)
  $font.Dispose()
})
$pd.Print()`;
  return runPSScript(ps, 30000);
}

// ============================================================
// PRINT PROFILES — simpan di userData
// ============================================================
const profilesFile = path.join(app.getPath("userData"), "print_profiles.json");

function loadProfiles() {
  try {
    if (fs.existsSync(profilesFile))
      return JSON.parse(fs.readFileSync(profilesFile, "utf8"));
  } catch (e) {}
  return [];
}

function saveProfiles(profiles) {
  try {
    fs.writeFileSync(profilesFile, JSON.stringify(profiles, null, 2), "utf8");
  } catch (e) {}
}

ipcMain.handle("get-profiles", async () => loadProfiles());

ipcMain.handle("save-profile", async (event, profile) => {
  const profiles = loadProfiles();
  const idx = profiles.findIndex((p) => p.id === profile.id);
  if (idx >= 0) profiles[idx] = profile;
  else profiles.push(profile);
  saveProfiles(profiles);
  return profiles;
});

ipcMain.handle("delete-profile", async (event, id) => {
  const profiles = loadProfiles().filter((p) => p.id !== id);
  saveProfiles(profiles);
  return profiles;
});

// ============================================================
// PRINT HISTORY
// ============================================================
const historyFile = path.join(app.getPath("userData"), "print_history.json");
function loadHistory() {
  try {
    if (fs.existsSync(historyFile))
      return JSON.parse(fs.readFileSync(historyFile, "utf8"));
  } catch (e) {}
  return [];
}
function saveHistory(h) {
  try {
    fs.writeFileSync(historyFile, JSON.stringify(h, null, 2), "utf8");
  } catch (e) {}
}

ipcMain.handle("get-history", async () => loadHistory());
ipcMain.handle("add-history", async (event, entries) => {
  const history = loadHistory();
  const updated = [
    ...entries.map((e) => ({ ...e, timestamp: new Date().toISOString() })),
    ...history,
  ].slice(0, 500);
  saveHistory(updated);
  return updated;
});
ipcMain.handle("clear-history", async () => {
  saveHistory([]);
  return [];
});
ipcMain.handle("delete-history-item", async (event, id) => {
  const h = loadHistory().filter((h) => h.id !== id);
  saveHistory(h);
  return h;
});

// ============================================================
// PRINT FILES (ke printer fisik)
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

function printPdfSilent(
  filePath,
  printer,
  copies,
  orientation,
  pageFrom,
  pageTo,
) {
  return new Promise((resolve, reject) => {
    const gsExe = findGhostscript();
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
    const sumatraExe = findSumatra();
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
    )
      reject(new Error(`Ghostscript: ${stderr.substring(0, 300)}`));
    else setTimeout(resolve, 1000);
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
  exec(
    `"${sumatraExe}" -print-to "${printer}" -print-settings "${settings}" "${filePath}"`,
    { timeout: 60000 },
    (err) => {
      if (err) reject(new Error(`SumatraPDF: ${err.message}`));
      else setTimeout(resolve, 2000);
    },
  );
}

function printWordSilent(
  filePath,
  printer,
  copies,
  orientation,
  pageFrom,
  pageTo,
) {
  const orientVal = orientation === "landscape" ? "2" : "1";
  const rangePart =
    pageFrom && pageTo
      ? `$doc.PrintOut($false,$false,3,"${pageFrom}-${pageTo}","","","",${copies})`
      : `$doc.PrintOut($false,$false,0,"","","","",${copies})`;
  const ps = `
$word = New-Object -ComObject Word.Application; $word.Visible = $false; $word.DisplayAlerts = 0
try {
  $doc = $word.Documents.Open("${filePath.replace(/\\/g, "\\\\")}", $false, $true)
  $doc.PageSetup.Orientation = ${orientVal}; $word.ActivePrinter = "${printer}"
  ${rangePart}; Start-Sleep -Seconds 3; $doc.Close($false)
} finally { $word.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null }`;
  return runPSScript(ps, 120000);
}

function printExcelSilent(filePath, printer, copies) {
  const ps = `
$excel = New-Object -ComObject Excel.Application; $excel.Visible = $false; $excel.DisplayAlerts = $false
try {
  $wb = $excel.Workbooks.Open("${filePath.replace(/\\/g, "\\\\")}", 0, $true); $excel.ActivePrinter = "${printer}"
  foreach ($sheet in $wb.Worksheets) { $sheet.PrintOut(1, $sheet.UsedRange.Rows.Count, ${copies}, $false, "${printer}") }
  Start-Sleep -Seconds 3; $wb.Close($false)
} finally { $excel.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null }`;
  return runPSScript(ps, 120000);
}

function printPptSilent(filePath, printer, copies) {
  const ps = `
$ppt = New-Object -ComObject PowerPoint.Application; $ppt.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
try {
  $pres = $ppt.Presentations.Open("${filePath.replace(/\\/g, "\\\\")}", $true, $false, $false)
  for ($i = 1; $i -le ${copies}; $i++) { $pres.PrintOut(1, $pres.Slides.Count, "", 1, [Microsoft.Office.Core.MsoTriState]::msoFalse) }
  Start-Sleep -Seconds 3; $pres.Close()
} finally { $ppt.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null }`;
  return runPSScript(ps, 120000);
}

function printTxtSilent(filePath, printer, copies) {
  const ps = `$content = Get-Content "${filePath.replace(/\\/g, "\\\\")}" -Raw
for ($i = 1; $i -le ${copies}; $i++) { $content | Out-Printer -Name "${printer}" }`;
  return runPSScript(ps, 30000);
}

function printImageSilent(filePath, printer, copies) {
  const ps = `
Add-Type -AssemblyName System.Drawing; Add-Type -AssemblyName System.Windows.Forms
$img = [System.Drawing.Image]::FromFile("${filePath.replace(/\\/g, "\\\\")}")
$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = "${printer}"; $pd.PrinterSettings.Copies = ${copies}
$pd.add_PrintPage({ param($s,$e)
  $rect = $e.MarginBounds; $ratio = [Math]::Min($rect.Width/$img.Width,$rect.Height/$img.Height)
  $nw = [int]($img.Width*$ratio); $nh = [int]($img.Height*$ratio)
  $e.Graphics.DrawImage($img,$rect.Left+($rect.Width-$nw)/2,$rect.Top+($rect.Height-$nh)/2,$nw,$nh)
  $e.HasMorePages = $false })
$pd.Print(); $img.Dispose()`;
  return runPSScript(ps, 30000);
}

// ============================================================
// HELPERS
// ============================================================
function findGhostscript() {
  const paths = [];
  try {
    ["C:\\Program Files\\gs", "C:\\Program Files (x86)\\gs"].forEach((dir) => {
      if (fs.existsSync(dir))
        fs.readdirSync(dir).forEach((v) => {
          paths.push(`${dir}\\${v}\\bin\\gswin64c.exe`);
          paths.push(`${dir}\\${v}\\bin\\gswin32c.exe`);
        });
    });
  } catch (e) {}
  return (
    paths.find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    }) || null
  );
}

function findSumatra() {
  const paths = [
    "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe",
    "C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe",
    path.join(os.homedir(), "AppData\\Local\\SumatraPDF\\SumatraPDF.exe"),
  ];
  return (
    paths.find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    }) || null
  );
}

function runPSScript(script, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `lp_${Date.now()}.ps1`);
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
ipcMain.on("open-output-pdf", (event, filePath) => {
  shell.openPath(filePath);
});
