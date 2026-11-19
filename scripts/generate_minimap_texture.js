// Generates a 256x256 stylized medieval tactical minimap of L_CitadelValley
// Coordinate mapping matches the 3D world: X in [-7500, +7500] -> U in [0, 1], Y in [-5500, +5500] -> V in [0, 1]
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 256, H = 256;
const rgba = Buffer.alloc(W * H * 4);

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function hash(x, y) {
  let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function setPx(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  rgba[i] = clamp(Math.round(r), 0, 255);
  rgba[i + 1] = clamp(Math.round(g), 0, 255);
  rgba[i + 2] = clamp(Math.round(b), 0, 255);
  rgba[i + 3] = clamp(Math.round(a), 0, 255);
}
function wx(u) { return -7500 + u * 15000; }
function wy(v) { return -5500 + v * 11000; }

for (let y = 0; y < H; y++) {
  const v = (y + 0.5) / H;
  const Y = wy(v);
  for (let x = 0; x < W; x++) {
    const u = (x + 0.5) / W;
    const X = wx(u);
    const n = (hash(x * 0.15, y * 0.15) - 0.5) * 14 + Math.sin(X * 0.0012) * Math.cos(Y * 0.0014) * 8;

    // Base valley biomes: lush west emerald meadow vs rugged east obsidian highlands
    let r = X < 0 ? 58 + n * 0.7 : 76 + n * 0.7;
    let g = X < 0 ? 112 + n : 86 + n * 0.6;
    let b = X < 0 ? 56 + n * 0.5 : 74 + n * 0.6;

    // Subtle elevation contour rings
    const contour = Math.abs(((Math.sin(X * 0.0008 + Y * 0.0005) * 3) % 1));
    if (contour < 0.06) { r *= 0.92; g *= 0.92; b *= 0.92; }

    // Forest groves (NW, SW, NE, SE)
    const groves = [[-5200, -3400, 1250], [-5400, 3400, 1250], [-2500, -3500, 950], [-2500, 3500, 950], [3200, -3500, 1100], [3200, 3500, 1100]];
    for (const [gx, gy, gr] of groves) {
      const d = Math.hypot(X - gx, Y - gy);
      if (d < gr) { r = 34 + n * 0.5; g = 74 + n * 0.7; b = 38 + n * 0.4; }
    }

    // River embankments & river water (X in [-1225, 1225])
    if (Math.abs(X) < 1380) { r = 92; g = 88; b = 78; }
    if (Math.abs(X) < 1180) {
      const ripple = Math.sin(Y * 0.008 + X * 0.004) * 12;
      r = 30 + ripple * 0.3; g = 92 + ripple * 0.6; b = 148 + ripple;
    }

    // Royal Highway (Y in [-270, 270], X in [-4200, 4200])
    if (Math.abs(Y) < 310 && Math.abs(X) < 4200) { r = 158; g = 142; b = 112; }

    // Stone River Bridge (X in [-1320, 1320], Y in [-760, 760])
    if (Math.abs(X) < 1340 && Math.abs(Y) < 760) {
      r = 164; g = 156; b = 142;
      if (Math.abs(Y) > 640) { r = 116; g = 110; b = 102; } // bridge parapets
    }

    // Solaris Western Courtyard & Walls (X in [-6200, -3600], Y in [-1400, 1400])
    if (X >= -6200 && X <= -3600 && Math.abs(Y) <= 1450) {
      r = 154; g = 146; b = 132;
      const onWall = (Math.abs(Y) > 1220) || (X < -6000) || (X > -3820 && Math.abs(Y) > 360);
      if (onWall) { r = 198; g = 204; b = 214; }
    }
    // Solaris Keep (Gold emblem at -5600, 0)
    if (Math.hypot(X + 5600, Y) < 560) { r = 238; g = 194; b = 52; }
    // Solaris Gatehouse (Blue-gold dot at -3600, 0)
    if (Math.abs(X + 3600) < 230 && Math.abs(Y) < 350) { r = 82; g = 165; b = 245; }

    // Dread Eastern Courtyard & Walls (X in [3600, 6200], Y in [-1400, 1400])
    if (X >= 3600 && X <= 6200 && Math.abs(Y) <= 1450) {
      r = 96; g = 86; b = 88;
      const onWall = (Math.abs(Y) > 1220) || (X > 6000) || (X < 3820 && Math.abs(Y) > 360);
      if (onWall) { r = 132; g = 74; b = 78; }
    }
    // Dread Keep (Crimson emblem at +5600, 0)
    if (Math.hypot(X - 5600, Y) < 560) { r = 218; g = 46; b = 54; }
    // Dread Gatehouse (Dark crimson at +3600, 0)
    if (Math.abs(X - 3600) < 230 && Math.abs(Y) < 350) { r = 185; g = 58; b = 64; }

    // Subtle 3x3 tactical grid overlay + crisp inner parchment border
    const gx = Math.abs(u - 1 / 3) < 0.004 || Math.abs(u - 2 / 3) < 0.004;
    const gy = Math.abs(v - 1 / 3) < 0.004 || Math.abs(v - 2 / 3) < 0.004;
    if (gx || gy) { r = r * 0.78 + 30; g = g * 0.78 + 26; b = b * 0.78 + 18; }
    if (x < 3 || x >= W - 3 || y < 3 || y >= H - 3) { r = 196; g = 162; b = 76; }

    setPx(x, y, r, g, b, 255);
  }
}

// Minimal PNG encoder
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const tb = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, crc]);
}
const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0;
  rgba.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const outPath = path.join(__dirname, '..', 'assets_3d', 'textures', 'T_MinimapValley.png');
fs.writeFileSync(outPath, png);
console.log('Generated', outPath, png.length, 'bytes');
