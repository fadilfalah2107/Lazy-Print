<div align="center">

```
 ██╗      █████╗ ███████╗██╗   ██╗    ██████╗ ██████╗ ██╗███╗   ██╗████████╗
 ██║     ██╔══██╗╚════██║╚██╗ ██╔╝    ██╔══██╗██╔══██╗██║████╗  ██║╚══██╔══╝
 ██║     ███████║    ██╔╝ ╚████╔╝     ██████╔╝██████╔╝██║██╔██╗ ██║   ██║
 ██║     ██╔══██║   ██╔╝   ╚██╔╝      ██╔═══╝ ██╔══██╗██║██║╚██╗██║   ██║
 ███████╗██║  ██║   ██║     ██║       ██║     ██║  ██║██║██║ ╚████║   ██║
 ╚══════╝╚═╝  ╚═╝   ╚═╝     ╚═╝       ╚═╝     ╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝   ╚═╝
```

### 🖨️ _Cara cepat print semua dokumen — tanpa drama, tanpa ribet_

<br>

[![Made with Electron](https://img.shields.io/badge/Made%20with-Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-orange?style=for-the-badge&logo=windows&logoColor=white)](.)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](.)
[![Version](https://img.shields.io/badge/Version-1.6.0-ff6b35?style=for-the-badge)](.)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen?style=for-the-badge)](.)

<br>

</div>

---

## 😩 Sebelum Lazy Print...

```
Senin pagi. 47 dokumen. Deadline 5 menit lagi.

📂 Buka file 1... tunggu loading... klik Print... pilih printer...
   OK... tunggu... lanjut ke file 2...
📂 Buka file 2... loading... Print... pilih printer lagi...
   kenapa defaultnya ganti sendiri??... OK...
📂 Buka file 3... "Microsoft Word tidak merespons"

   😤 *meja bergetar*

📂 Buka file 4...
```

## 😎 Sesudah Lazy Print...

```
Senin pagi. 47 dokumen. Deadline 5 menit lagi.

🗂️  Drag semua file → drop
🖨️  Pilih printer
▶️  Klik Print

☕  Ngopi dulu.

✅  47/47 dokumen terkirim ke printer.
    Selesai dalam 43 detik.
```

---

<div align="center">

## 🏗️ Arsitektur

```
┌─────────────────────────────────────────────────────────┐
│                      LAZY PRINT                         │
│                                                         │
│   ┌──────────────┐          ┌──────────────────────┐   │
│   │  DROP ZONE   │  ──────► │    PRINT QUEUE       │   │
│   │              │          │                      │   │
│   │  PDF  DOCX   │          │  ▶ doc1.pdf    ✓    │   │
│   │  XLSX PPTX   │          │  ▶ report.docx ✓    │   │
│   │  TXT  PNG    │          │  ▶ data.xlsx   🔄   │   │
│   └──────────────┘          │  ▶ slides.pptx ⏳   │   │
│                              └──────────────────────┘   │
│   ┌──────────────┐                      │               │
│   │   SETTINGS   │                      ▼               │
│   │              │          ┌──────────────────────┐   │
│   │  Printer: ▼  │          │   GHOSTSCRIPT ENGINE │   │
│   │  Copies: 2   │  ──────► │                      │   │
│   │  Portrait    │          │  mswinpr2 driver →   │   │
│   │  Page: 1-5   │          │  Windows Print Spool │   │
│   └──────────────┘          └──────────────────────┘   │
│                                          │               │
│                                          ▼               │
│                              ┌──────────────────────┐   │
│                              │     🖨️  PRINTER       │   │
│                              │   HP / Canon / Epson │   │
│                              └──────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

</div>

---

## ✨ Fitur

| Fitur                        | Status | Keterangan                                           |
| ---------------------------- | ------ | ---------------------------------------------------- |
| 🗂️ **Drag & Drop**           | ✅     | Drop banyak file sekaligus                           |
| 🖨️ **Auto-detect Printer**   | ✅     | Default printer otomatis terpilih                    |
| 📄 **PDF Silent Print**      | ✅     | Via Ghostscript — tanpa buka apapun                  |
| 📝 **Word / Excel / PPT**    | ✅     | LibreOffice headless → PDF → GS, fallback Office COM |
| 🖼️ **Image Print**           | ✅     | PNG, JPG, BMP via .NET PrintDocument                 |
| 📋 **TXT Print**             | ✅     | Via PowerShell Out-Printer                           |
| 🔢 **Page Range**            | ✅     | Print halaman tertentu saja (per-file)               |
| 👁️ **PDF Preview**           | ✅     | Preview per halaman sebelum print                    |
| 📜 **Print History**         | ✅     | Log semua aktivitas print tersimpan                  |
| 🔍 **Search History**        | ✅     | Cari berdasarkan nama file / printer                 |
| 📊 **Live Progress**         | ✅     | Real-time status per dokumen                         |
| 💾 **Print Profiles**        | ✅     | Simpan & load konfigurasi printer favorit            |
| 📁 **Watch Folder**          | ✅     | Auto-print file baru yang masuk ke folder            |
| 🔄 **Queue Persistence**     | ✅     | Queue tersimpan meski app ditutup                    |
| 🖥️ **System Tray**           | ✅     | Minimize ke tray, app tetap aktif di background      |
| 🔔 **Sound Notification**    | ✅     | Bunyi saat print selesai / error (bisa dimatikan)    |
| ⚠️ **Duplicate Detection**   | ✅     | File yang sama di-flash kuning, tidak masuk dobel    |
| ↩️ **Undo Hapus**            | ✅     | Ctrl+Z untuk kembalikan file yang dihapus            |
| 🕓 **Recent Files**          | ✅     | Panel file terakhir dicetak, klik untuk re-add       |
| 📈 **Lifetime Stats**        | ✅     | Total file dicetak & persentase sukses all-time      |
| 📤 **Export PDF**            | ✅     | Gabung semua file menjadi satu PDF (LibreOffice-first)|
| 🌙 **Dark Mode**             | ✅     | Dark by default, karena siapa yang mau terang        |

### ⌨️ Keyboard Shortcuts

| Shortcut         | Fungsi                              |
| ---------------- | ----------------------------------- |
| `Ctrl+O`         | Tambah file                         |
| `Ctrl+P`         | Mulai print                         |
| `Ctrl+A`         | Pilih semua file                    |
| `Ctrl+Z`         | Undo hapus file (max 10 langkah)    |
| `Ctrl+↑ / ↓`    | Pindah urutan file yang di-preview  |
| `Space`          | Toggle preview file                 |
| `Del`            | Hapus file yang dipilih             |
| `← →`            | Navigasi halaman preview            |
| `?`              | Tampilkan semua shortcut            |

---

## 🚀 Cara Install

### Prerequisites

```
Node.js v16+    ──►  https://nodejs.org
Ghostscript     ──►  https://www.ghostscript.com/releases/gsdnld.html
```

> 💡 **Kenapa Ghostscript?** Ini engine yang sama yang dipakai Print Conductor.
> Kirim PDF langsung ke Windows print spooler tanpa buka UI apapun.
> Gratis & open source sejak 1988.

### Install & Jalankan

```bash
# Extract project, masuk ke folder
cd lazy-print

# Install dependencies
npm install

# Jalankan!
npm start
```

Selesai. Semudah itu.

---

## 📦 Format yang Didukung

```
┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│  PDF │ DOCX │ XLSX │ PPTX │  ODT │  ODS │  RTF │ HTML │  TXT │  PNG │  JPG │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│  ✅  │  ✅  │  ✅  │  ✅  │  ✅  │  ✅  │  ✅  │  ✅  │  ✅  │  ✅  │  ✅  │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘

 juga: .doc  .xls  .ppt  .htm  .jpeg  .bmp
```

---

## 🔧 Tech Stack

```
┌─────────────────────────────────────────────┐
│                                             │
│   🔵 Electron        ──  Desktop framework  │
│   🟡 JavaScript      ──  Logic & UI         │
│   👻 Ghostscript     ──  PDF engine         │
│   💜 PowerShell      ──  Office COM + utils │
│   🔴 .NET Drawing    ──  Image printing     │
│                                             │
└─────────────────────────────────────────────┘
```

---

## ⚙️ Cara Kerja Per Format

```
PDF              ──► Ghostscript (mswinpr2)      ──► Print Spooler ──► 🖨️
DOCX/XLS/PPTX   ──► LibreOffice headless → PDF  ──► Ghostscript   ──► 🖨️
                     (fallback: Office COM jika LibreOffice tidak ada)
ODT/ODS/RTF/HTML ──► LibreOffice headless → PDF  ──► Ghostscript   ──► 🖨️
TXT              ──► PowerShell Out-Printer       ──► Print Spooler ──► 🖨️
IMG              ──► .NET PrintDocument           ──► Print Spooler ──► 🖨️
```

> Semua proses berjalan **100% di background** — tidak ada jendela yang terbuka.
> LibreOffice diutamakan karena benar-benar headless — Office COM sebagai fallback.

---

## 🗺️ Roadmap

```
v1.0  ✅  Core print engine + drag & drop
v1.1  ✅  PDF preview + page range
v1.2  ✅  Print history
v1.3  ✅  Build ke .exe (installer)
v1.4  ✅  Format tambahan (ODT, ODS, RTF, HTML) + error handling
v1.5  ✅  Print profiles + watch folder + queue persistence
v1.6  ✅  System tray · sound notification · undo · recent files ·
          lifetime stats · duplicate detection · keyboard shortcuts baru ·
          PDF export LibreOffice-first
v2.0  📋  Scheduled print
v2.1  📋  Network printer discovery
```

---

## 🐛 Troubleshooting

**PDF tidak terprint?**

```
1. Pastikan Ghostscript terinstall
2. Cek badge di titlebar — harus hijau "● GS OK"
3. Klik badge untuk lihat path Ghostscript yang terdeteksi
```

**Printer tidak terdeteksi?**

```
1. Pastikan printer sudah diinstall di Windows
2. Cek Control Panel → Devices and Printers
3. Restart aplikasi
```

**Word/Excel/PPT gagal?**

```
1. Install LibreOffice (gratis) — otomatis dipakai sebagai engine utama
   https://www.libreoffice.org/download
2. Atau pastikan Microsoft Office terinstall (sebagai fallback)
3. Tutup semua instance Word/Excel yang sedang terbuka
4. Coba print ulang
```

**App hilang dari taskbar?**

```
App berjalan di system tray (pojok kanan bawah taskbar).
Klik icon Lazy Print di tray untuk membuka kembali.
Klik kanan → Keluar untuk menutup sepenuhnya.
```

---

## 📄 License

MIT — bebas dipakai, dimodifikasi, didistribusikan.

---

<div align="center">

```
Dibuat dengan ☕ dan rasa malas yang produktif.
```

**[⬆ Kembali ke atas](#)**

</div>
