/**
 * Generate deterministic extension icons without runtime dependencies.
 * The mark uses the same blue as the UI and a deliberately simple,
 * high-contrast @ glyph that remains legible at toolbar size.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ICONS_DIR = resolve(fileURLToPath(import.meta.url), "..", "..", "icons");
const SIZES = [16, 32, 48, 128];
const ACCENT = [26, 86, 196, 255];
const ACCENT_DARK = [19, 63, 150, 255];
const ON_ACCENT = [255, 255, 255, 255];

mkdirSync(ICONS_DIR, { recursive: true });

function pngSignature() {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function ihdr(width, height) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return header;
}

function encodePNG(width, height, rgba) {
  const rowLength = width * 4 + 1;
  const raw = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowLength] = 0;
    rgba.copy(raw, y * rowLength + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    pngSignature(),
    chunk("IHDR", ihdr(width, height)),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function mix(base, overlay, amount) {
  return [
    Math.round(base[0] * (1 - amount) + overlay[0] * amount),
    Math.round(base[1] * (1 - amount) + overlay[1] * amount),
    Math.round(base[2] * (1 - amount) + overlay[2] * amount),
    255,
  ];
}

function insideRoundedSquare(x, y, size) {
  const inset = size * 0.04;
  const radius = size * 0.22;
  const left = inset;
  const top = inset;
  const right = size - inset;
  const bottom = size - inset;
  const nearestX = Math.max(left + radius, Math.min(x, right - radius));
  const nearestY = Math.max(top + radius, Math.min(y, bottom - radius));
  return Math.hypot(x - nearestX, y - nearestY) <= radius;
}

function insideGlyph(x, y, size) {
  const nx = (x - size / 2) / size;
  const ny = (y - size / 2) / size;

  const outerDistance = Math.hypot(nx, ny * 1.04);
  const outerAngle = Math.atan2(ny, nx);
  const outerRing =
    outerDistance >= 0.315 &&
    outerDistance <= 0.405 &&
    !(outerAngle > 0.28 && outerAngle < 1.08);

  const innerX = nx + 0.045;
  const innerY = ny + 0.005;
  const innerDistance = Math.hypot(innerX, innerY * 1.06);
  const innerBowl = innerDistance >= 0.105 && innerDistance <= 0.185;
  const innerStem = nx >= 0.09 && nx <= 0.17 && ny >= -0.18 && ny <= 0.16;
  const tail = nx >= 0.13 && nx <= 0.35 && ny >= 0.08 && ny <= 0.17;

  return outerRing || innerBowl || innerStem || tail;
}

function coverage(x, y, size, sampler) {
  let hits = 0;
  const samples = 4;
  for (let sampleY = 0; sampleY < samples; sampleY++) {
    for (let sampleX = 0; sampleX < samples; sampleX++) {
      if (sampler(x + (sampleX + 0.5) / samples, y + (sampleY + 0.5) / samples, size)) {
        hits++;
      }
    }
  }
  return hits / (samples * samples);
}

function makeIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      const tileCoverage = coverage(x, y, size, insideRoundedSquare);
      const glyphCoverage = coverage(x, y, size, insideGlyph);
      const base = y > size * 0.72 ? mix(ACCENT, ACCENT_DARK, 0.12) : ACCENT;
      const color = mix(base, ON_ACCENT, glyphCoverage);
      rgba[index] = color[0];
      rgba[index + 1] = color[1];
      rgba[index + 2] = color[2];
      rgba[index + 3] = Math.round(255 * tileCoverage);
    }
  }
  return encodePNG(size, size, rgba);
}

for (const size of SIZES) {
  writeFileSync(resolve(ICONS_DIR, `icon-${size}.png`), makeIcon(size));
  console.log(`icons/icon-${size}.png generated`);
}
