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
[![Version](https://img.shields.io/badge/Version-1.5.0-ff6b35?style=for-the-badge)](.)
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

| Fitur                      | Status | Keterangan                                    |
| -------------------------- | ------ | --------------------------------------------- |
| 🗂️ **Drag & Drop**         | ✅     | Drop banyak file sekaligus                    |
| 🖨️ **Auto-detect Printer** | ✅     | Default printer otomatis terpilih             |
| 📄 **PDF Silent Print**    | ✅     | Via Ghostscript — tanpa buka apapun           |
| 📝 **Word / Excel / PPT**  | ✅     | Via COM Automation — invisible di background  |
| 🖼️ **Image Print**         | ✅     | PNG, JPG, BMP via .NET PrintDocument          |
| 📋 **TXT Print**           | ✅     | Via PowerShell Out-Printer                    |
| 🔢 **Page Range**          | ✅     | Print halaman tertentu saja                   |
| 👁️ **PDF Preview**         | ✅     | Preview per halaman sebelum print             |
| 📜 **Print History**       | ✅     | Log semua aktivitas print tersimpan           |
| 🔍 **Search History**      | ✅     | Cari berdasarkan nama file / printer          |
| 📊 **Live Progress**       | ✅     | Real-time status per dokumen                  |
| 🌙 **Dark Mode**           | ✅     | Dark by default, karena siapa yang mau terang |

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
┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│  PDF │ DOCX │ XLSX │ PPTX │  TXT │  PNG │  JPG │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│  ✅  │  ✅  │  ✅  │  ✅  │  ✅  │  ✅  │  ✅  │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┘

 juga: .doc  .xls  .ppt  .jpeg  .bmp
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
PDF   ──► Ghostscript (mswinpr2 driver) ──► Print Spooler ──► 🖨️
DOCX  ──► Word COM Object (invisible)   ──► Print Spooler ──► 🖨️
XLSX  ──► Excel COM Object (invisible)  ──► Print Spooler ──► 🖨️
PPTX  ──► PPT COM Object (invisible)    ──► Print Spooler ──► 🖨️
TXT   ──► PowerShell Out-Printer        ──► Print Spooler ──► 🖨️
IMG   ──► .NET PrintDocument            ──► Print Spooler ──► 🖨️
```

> Semua proses berjalan **100% di background** — tidak ada jendela yang terbuka.

---

## 🗺️ Roadmap

```
v1.0  ✅  Core print engine + drag & drop
v1.1  ✅  PDF preview + page range
v1.2  ✅  Print history
v1.3  ✅  Build ke .exe (installer)
v1.4  ✅  Format tambahan (ODT, ODS, RTF, HTML) + error handling
v1.5  ✅  Build installer + icon + versi resmi
v2.0  📋  Network printer discovery
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
1. Pastikan Microsoft Office terinstall
2. Tutup semua instance Word/Excel yang sedang terbuka
3. Coba print ulang
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
