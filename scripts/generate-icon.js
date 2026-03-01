/**
 * generate-icon.js
 * Membuat build/icon.ico multi-resolusi (16, 32, 48, 256 px)
 * Desain: oranye #ff6b35 dengan rounded corner + printer symbol putih
 * Pure Node.js — tidak butuh external dependency
 */

"use strict";
const fs = require("fs");
const path = require("path");

const BUILD_DIR = path.join(__dirname, "..", "build");
const OUT_FILE = path.join(BUILD_DIR, "icon.ico");

if (!fs.existsSync(BUILD_DIR)) fs.mkdirSync(BUILD_DIR, { recursive: true });

// ─── Warna (BGRA untuk Windows bitmap) ────────────────────────────────────
const ORANGE = [53, 107, 255, 255];   // #ff6b35 dalam BGRA
const WHITE  = [255, 255, 255, 255];
const TRANS  = [0, 0, 0, 0];

// ─── Logika pixel ─────────────────────────────────────────────────────────
function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function isInCorner(nx, ny, r) {
  if (nx < r && ny < r && dist(nx, ny, r, r) > r) return true;
  if (nx > 1 - r && ny < r && dist(nx, ny, 1 - r, r) > r) return true;
  if (nx < r && ny > 1 - r && dist(nx, ny, r, 1 - r) > r) return true;
  if (nx > 1 - r && ny > 1 - r && dist(nx, ny, 1 - r, 1 - r) > r) return true;
  return false;
}

function getColor(nx, ny) {
  const r = 0.16; // radius sudut

  // Transparan di luar rounded corners
  if (isInCorner(nx, ny, r)) return TRANS;

  // ── Printer shape (koordinat dinormalisasi 0..1) ────────────────────
  // Paper input (masuk dari atas printer)
  if (nx >= 0.34 && nx <= 0.66 && ny >= 0.10 && ny <= 0.43) return WHITE;

  // Printer body (kotak utama)
  if (nx >= 0.18 && nx <= 0.82 && ny >= 0.35 && ny <= 0.73) return WHITE;

  // Paper output (keluar dari bawah printer)
  if (nx >= 0.28 && nx <= 0.72 && ny >= 0.63 && ny <= 0.90) return WHITE;

  // Lubang paper di body (oranye — supaya terlihat ada "slot")
  if (nx >= 0.28 && nx <= 0.72 && ny >= 0.63 && ny <= 0.70) return ORANGE;

  // Tombol kecil di printer (oranye dot)
  if (nx >= 0.60 && nx <= 0.72 && ny >= 0.46 && ny <= 0.57) return ORANGE;

  return ORANGE;
}

// ─── Buat pixel data (format BGRA, bottom-up) ─────────────────────────────
function createPixels(size) {
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // ICO menyimpan pixel dari bawah ke atas
      const idx = ((size - 1 - y) * size + x) * 4;
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;
      const [b, g, rr, a] = getColor(nx, ny);
      buf[idx] = b;
      buf[idx + 1] = g;
      buf[idx + 2] = rr;
      buf[idx + 3] = a;
    }
  }
  return buf;
}

// ─── Encode ICO binary ────────────────────────────────────────────────────
function buildIco(sizes) {
  const pixelArrays = sizes.map(createPixels);

  // Ukuran tiap entri bitmap: BITMAPINFOHEADER(40) + pixels + AND mask
  const bmpSizes = sizes.map((s) => 40 + s * s * 4 + Math.ceil((s * s) / 8));

  const headerSize = 6 + sizes.length * 16; // ICONDIR + ICONDIRENTRY[]
  let offset = headerSize;
  const offsets = sizes.map((_, i) => {
    const o = offset;
    offset += bmpSizes[i];
    return o;
  });

  const totalSize = offset;
  const buf = Buffer.alloc(totalSize);
  let pos = 0;

  // ── ICONDIR ──
  buf.writeUInt16LE(0, pos); pos += 2;              // Reserved
  buf.writeUInt16LE(1, pos); pos += 2;              // Type = ICO
  buf.writeUInt16LE(sizes.length, pos); pos += 2;   // Count

  // ── ICONDIRENTRY[] ──
  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i];
    buf.writeUInt8(s >= 256 ? 0 : s, pos); pos++;   // Width (0 = 256)
    buf.writeUInt8(s >= 256 ? 0 : s, pos); pos++;   // Height
    buf.writeUInt8(0, pos); pos++;                   // ColorCount (0 = >8bpp)
    buf.writeUInt8(0, pos); pos++;                   // Reserved
    buf.writeUInt16LE(1, pos); pos += 2;             // Planes
    buf.writeUInt16LE(32, pos); pos += 2;            // BitCount (32bpp)
    buf.writeUInt32LE(bmpSizes[i], pos); pos += 4;  // BytesInRes
    buf.writeUInt32LE(offsets[i], pos); pos += 4;   // ImageOffset
  }

  // ── Bitmap data tiap size ──
  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i];
    const pixels = pixelArrays[i];
    const maskBytes = Math.ceil((s * s) / 8);

    // BITMAPINFOHEADER (40 bytes)
    buf.writeUInt32LE(40, pos); pos += 4;            // biSize
    buf.writeInt32LE(s, pos); pos += 4;              // biWidth
    buf.writeInt32LE(s * 2, pos); pos += 4;          // biHeight (double untuk ICO)
    buf.writeUInt16LE(1, pos); pos += 2;             // biPlanes
    buf.writeUInt16LE(32, pos); pos += 2;            // biBitCount
    buf.writeUInt32LE(0, pos); pos += 4;             // biCompression (BI_RGB)
    buf.writeUInt32LE(0, pos); pos += 4;             // biSizeImage
    buf.writeInt32LE(0, pos); pos += 4;              // biXPelsPerMeter
    buf.writeInt32LE(0, pos); pos += 4;              // biYPelsPerMeter
    buf.writeUInt32LE(0, pos); pos += 4;             // biClrUsed
    buf.writeUInt32LE(0, pos); pos += 4;             // biClrImportant

    // Pixel data
    pixels.copy(buf, pos);
    pos += s * s * 4;

    // AND mask (semua 0 = pixel tidak transparan di area non-alpha)
    buf.fill(0, pos, pos + maskBytes);
    pos += maskBytes;
  }

  return buf;
}

// ─── Main ─────────────────────────────────────────────────────────────────
const ico = buildIco([16, 32, 48, 256]);
fs.writeFileSync(OUT_FILE, ico);
console.log(`✓ Icon generated: ${OUT_FILE} (${ico.length.toLocaleString()} bytes, 4 sizes: 16×16 32×32 48×48 256×256)`);
