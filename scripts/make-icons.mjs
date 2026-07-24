/**
 * Generate the 4 extension icons as minimal deterministic PNGs at 16/32/48/128.
 * Drawn with the native `zlib` + a hand-rolled PNG encoder so we have zero
 * build dependencies. The icon is a solid rounded square with a white "@" glyph.
 *
 * Regenerates every `npm run build` so the extension always has icons present
 * even before the user supplies real artwork.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ICONS_DIR = resolve(process.cwd(), "icons");
mkdirSync(ICONS_DIR, { recursive: true });

const SIZES = [16, 32, 48, 128];

function encodePNG(width, height, rgba) {
  const channels = 4;
  const raw = Buffer.alloc((width * channels + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * channels + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      raw[y * (width * channels + 1) + 1 + x * channels + 0] = rgba[i + 0];
      raw[y * (width * channels + 1) + 1 + x * channels + 1] = rgba[i + 1];
      raw[y * (width * channels + 1) + 1 + x * channels + 2] = rgba[i + 2];
      raw[y * (width * channels + 1) + 1 + x * channels + 3] = rgba[i + 3];
    }
  }
  const idat = deflateSync(raw);
  return Buffer.concat([pngSignature(), chunk("IHDR", ihdr(width, height)), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function pngSignature() {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function ihdr(width, height) {
  const b = Buffer.alloc(13);
  b.writeUInt32BE(width, 0);
  b.writeUInt32BE(height, 4);
  b[8] = 8;
  b[9] = 6;
  b[10] = 0;
  b[11] = 0;
  b[12] = 0;
  return b;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makeIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const bg = [37, 99, 235, 255];
  const fg = [255, 255, 255, 255];
  const r = size / 2;
  const corner = size * 0.22;
  const stroke = Math.max(1, Math.round(size * 0.12));
  const innerR = size * 0.26;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = Math.abs(x - r + 0.5);
      const dy = Math.abs(y - r + 0.5);
      const inCorner = dx > r - corner && dy > r - corner;
      const inBox = dx <= r - 1 && dy <= r - 1;
      const inRound = dx <= r - 1 && dy <= r - 1 && (dx <= r - corner || dy <= r - corner);
      let isBg = inRound;
      let isFg = false;
      if (inBox) {
        const cx = x - r + 0.5;
        const cy = y - r + 0.5;
        const distOuter = Math.hypot(cx, cy);
        const distInner = Math.hypot(cx, cy);
        const onRing = distOuter <= innerR + stroke / 2 && distOuter >= innerR - stroke / 2;
        let onTail = false;
        if (cx >= 0) onTail = cx <= stroke / 2 + 0.5 && cy >= -innerR - stroke / 2 && cy <= innerR + stroke / 2 && Math.abs(cy) <= stroke / 2 + 0.5 ? Math.abs(cy) <= stroke / 2 + 0.5 : false;
        if (onRing) isFg = true;
        if (onTail) isFg = true;
        const dotR = stroke / 2 + 0.5;
        if (Math.hypot(cx, cy) <= dotR) isFg = true;
      }
      if (isFg) {
        rgba[i] = fg[0]; rgba[i + 1] = fg[1]; rgba[i + 2] = fg[2]; rgba[i + 3] = fg[3];
      } else if (isBg) {
        rgba[i] = bg[0]; rgba[i + 1] = bg[1]; rgba[i + 2] = bg[2]; rgba[i + 3] = bg[3];
      } else {
        rgba[i] = 0; rgba[i + 1] = 0; rgba[i + 2] = 0; rgba[i + 3] = 0;
      }
    }
  }
  return encodePNG(size, size, rgba);
}

for (const s of SIZES) {
  writeFileSync(resolve(ICONS_DIR, `icon-${s}.png`), makeIcon(s));
  console.log(`icons/icon-${s}.png generated`);
}