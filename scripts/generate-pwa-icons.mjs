#!/usr/bin/env node
/**
 * Generate the §3.6 PWA placeholder icons: a core, one orbit, three satellites
 * on `--bg` / `--ivory`. Not final artwork — see apps/web/public/icons/README.md.
 *
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'apps', 'web', 'public', 'icons');

/** `--bg` / `--ivory` from comms/contracts/design-tokens.md — raster, not CSS. */
const BG = [0x11, 0x11, 0x14];
const IVORY = [0xec, 0xec, 0xee];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(size, shadeAt) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const t = shadeAt(x + 0.5, y + 0.5, size);
      const o = row + 1 + x * 4;
      raw[o] = Math.round(BG[0] + (IVORY[0] - BG[0]) * t);
      raw[o + 1] = Math.round(BG[1] + (IVORY[1] - BG[1]) * t);
      raw[o + 2] = Math.round(BG[2] + (IVORY[2] - BG[2]) * t);
      raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function disk(px, py, cx, cy, r, feather) {
  const d = Math.hypot(px - cx, py - cy);
  return clamp01((r + feather - d) / (2 * feather));
}

function ring(px, py, cx, cy, r, half, feather) {
  const d = Math.abs(Math.hypot(px - cx, py - cy) - r);
  return clamp01((half + feather - d) / (2 * feather));
}

/**
 * Galaxy mark. `safe` < 1 pulls the drawing into the maskable 80% zone
 * (10% inset on each edge).
 */
function galaxy(px, py, size, safe) {
  const cx = size / 2;
  const cy = size / 2;
  const unit = (size * safe) / 2;
  const feather = Math.max(0.6, size / 256);
  let t = 0;
  t = Math.max(t, disk(px, py, cx, cy, unit * 0.18, feather * 1.4));
  t = Math.max(t, ring(px, py, cx, cy, unit * 0.52, Math.max(1, size * 0.006), feather));
  const satR = unit * 0.52;
  const sat = unit * 0.055;
  for (const deg of [38, 158, 268]) {
    const rad = (deg * Math.PI) / 180;
    t = Math.max(t, disk(px, py, cx + Math.cos(rad) * satR, cy + Math.sin(rad) * satR, sat, feather));
  }
  return t;
}

function badge(px, py, size) {
  const cx = size / 2;
  const cy = size / 2;
  const feather = 0.7;
  return Math.max(
    disk(px, py, cx, cy, size * 0.22, feather),
    ring(px, py, cx, cy, size * 0.34, 1.2, feather),
  );
}

const files = [
  ['icon-192.png', 192, (x, y, s) => galaxy(x, y, s, 0.92)],
  ['icon-512.png', 512, (x, y, s) => galaxy(x, y, s, 0.92)],
  ['icon-maskable-512.png', 512, (x, y, s) => galaxy(x, y, s, 0.72)],
  ['badge-72.png', 72, badge],
];

await mkdir(OUT, { recursive: true });
for (const [name, size, shade] of files) {
  const png = encodePng(size, shade);
  await writeFile(join(OUT, name), png);
  process.stdout.write(`wrote ${name} (${png.length} bytes)\n`);
}
