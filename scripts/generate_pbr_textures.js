/**
 * Procedural Seamless 512x512 PBR Texture Generator (Albedo + Normal Map PNGs)
 * Zero external dependencies (pure Node.js zlib + PNG encoder).
 * Generates medieval stone masonry, lush meadow grass, oak timber planks,
 * roof slate/thatch shingles, cobblestone road, and water ripple normal maps.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'assets_3d', 'textures');
fs.mkdirSync(OUT_DIR, { recursive: true });

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function writePNG(filePath, w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const rowStart = y * (w * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const idat = zlib.deflateSync(raw, { level: 6 });
  const out = Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filePath, out);
}

// Seamless periodic hash & value noise (period = P)
function hash2(x, y, seed = 1) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smoothNoise(u, v, period, seed) {
  const x = u * period;
  const y = v * period;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const x0 = ((ix % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y0 = ((iy % period) + period) % period;
  const y1 = (y0 + 1) % period;
  const n00 = hash2(x0, y0, seed);
  const n10 = hash2(x1, y0, seed);
  const n01 = hash2(x0, y1, seed);
  const n11 = hash2(x1, y1, seed);
  return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy;
}

function fbm(u, v, basePeriod, octaves, seed) {
  let val = 0;
  let amp = 0.5;
  let p = basePeriod;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    val += amp * smoothNoise(u, v, p, seed + i * 31);
    norm += amp;
    amp *= 0.5;
    p *= 2;
  }
  return val / norm;
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function heightToNormalPNG(filePath, w, h, heightField, strength = 6.0) {
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const ym = (y - 1 + h) % h;
    const yp = (y + 1) % h;
    for (let x = 0; x < w; x++) {
      const xm = (x - 1 + w) % w;
      const xp = (x + 1) % w;
      const dx = (heightField[y * w + xp] - heightField[y * w + xm]) * strength;
      const dy = (heightField[yp * w + x] - heightField[ym * w + x]) * strength;
      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const inv = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= inv;
      ny *= inv;
      nz *= inv;
      const idx = (y * w + x) * 4;
      rgba[idx] = clampByte((nx * 0.5 + 0.5) * 255);
      rgba[idx + 1] = clampByte((ny * 0.5 + 0.5) * 255);
      rgba[idx + 2] = clampByte((nz * 0.5 + 0.5) * 255);
      rgba[idx + 3] = 255;
    }
  }
  writePNG(filePath, w, h, rgba);
}

const W = 512, H = 512;

// 1. T_StoneMasonry (Ashlar Medieval Castle Blocks)
{
  const rgba = Buffer.alloc(W * H * 4);
  const hmap = new Float32Array(W * H);
  const rows = 8;
  const cols = 4;
  for (let y = 0; y < H; y++) {
    const u = y / H;
    for (let x = 0; x < W; x++) {
      const v = x / W;
      const n1 = fbm(v, u, 8, 4, 101);
      const n2 = fbm(v, u, 32, 3, 202);
      const ry = u * rows + (n1 - 0.5) * 0.08;
      const rowIdx = Math.floor(ry);
      const fy = ry - rowIdx;
      const stagger = (rowIdx & 1) ? 0.5 : 0.0;
      const rx = v * cols + stagger + (n1 - 0.5) * 0.06;
      const colIdx = Math.floor(rx);
      const fx = rx - colIdx;

      const blockHash = hash2((colIdx + 16) % cols, (rowIdx + 16) % rows, 77);
      // Mortar groove mask
      const edgeY = Math.min(fy, 1 - fy);
      const edgeX = Math.min(fx, 1 - fx);
      const mortar = Math.min(edgeY * 18, edgeX * 10, 1.0);
      const bevel = Math.pow(Math.max(0.0, Math.min(1.0, mortar)), 0.45);

      const height = bevel * (0.75 + 0.25 * n2) + (blockHash - 0.5) * 0.12;
      hmap[y * W + x] = height;

      // Grayscale-neutral high-detail stone so MaterialInstance BaseColor tints cleanly
      const mortarShade = 88 + n2 * 25;
      const blockTone = 175 + (blockHash - 0.5) * 42 + (n1 - 0.5) * 35 + (n2 - 0.5) * 28;
      const lum = mortarShade * (1 - bevel) + blockTone * bevel;
      const idx = (y * W + x) * 4;
      rgba[idx] = clampByte(lum * 1.01);
      rgba[idx + 1] = clampByte(lum * 1.0);
      rgba[idx + 2] = clampByte(lum * 0.98);
      rgba[idx + 3] = 255;
    }
  }
  writePNG(path.join(OUT_DIR, 'T_StoneMasonry_D.png'), W, H, rgba);
  heightToNormalPNG(path.join(OUT_DIR, 'T_StoneMasonry_N.png'), W, H, hmap, 11.0);
}

// 2. T_GrassMeadow (Lush Meadow Turf with Clover, Blades & Soil Micro-detail)
{
  const rgba = Buffer.alloc(W * H * 4);
  const hmap = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const macro = fbm(u, v, 4, 4, 303);
      const mid = fbm(u, v, 16, 4, 404);
      const blades = fbm(u, v, 64, 3, 505);
      const h = macro * 0.35 + mid * 0.35 + blades * 0.3;
      hmap[y * W + x] = h;

      // Neutral-bright botanical variation (130..235) so MI_TerrainGrass BaseColor tint produces rich emerald/olive/clover hues
      const r = 150 + (macro - 0.5) * 65 + (mid - 0.5) * 45 + (blades - 0.5) * 50;
      const g = 185 + (macro - 0.5) * 55 + (mid - 0.5) * 50 + (blades - 0.5) * 55;
      const b = 135 + (macro - 0.5) * 45 + ( blades - 0.5) * 40;
      const idx = (y * W + x) * 4;
      rgba[idx] = clampByte(r);
      rgba[idx + 1] = clampByte(g);
      rgba[idx + 2] = clampByte(b);
      rgba[idx + 3] = 255;
    }
  }
  writePNG(path.join(OUT_DIR, 'T_GrassMeadow_D.png'), W, H, rgba);
  heightToNormalPNG(path.join(OUT_DIR, 'T_GrassMeadow_N.png'), W, H, hmap, 9.5);
}

// 3. T_TimberPlanks (Medieval Oak Walkway & Beam Planks)
{
  const rgba = Buffer.alloc(W * H * 4);
  const hmap = new Float32Array(W * H);
  const planks = 6;
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const py = v * planks;
      const pIdx = Math.floor(py);
      const fy = py - pIdx;
      const grain = fbm(u * 0.25, v * 2.5, 16, 4, 606 + pIdx * 7);
      const rings = Math.sin((u * 6 + grain * 4.5) * Math.PI * 2) * 0.5 + 0.5;
      const seamY = Math.min(fy, 1 - fy);
      const endX = (u * 2 + (pIdx & 1) * 0.5) % 1.0;
      const seamX = Math.min(endX, 1 - endX);
      const groove = Math.min(1.0, Math.min(seamY * 22, seamX * 36));
      const bevel = Math.pow(groove, 0.4);
      const h = bevel * (0.7 + 0.3 * grain + 0.12 * rings);
      hmap[y * W + x] = h;

      const plankTone = hash2(pIdx, 3, 707) * 32 - 16;
      const lum = (80 * (1 - bevel)) + (175 + plankTone + (grain - 0.5) * 45 + (rings - 0.5) * 24) * bevel;
      const idx = (y * W + x) * 4;
      rgba[idx] = clampByte(lum * 1.05);
      rgba[idx + 1] = clampByte(lum * 0.98);
      rgba[idx + 2] = clampByte(lum * 0.90);
      rgba[idx + 3] = 255;
    }
  }
  writePNG(path.join(OUT_DIR, 'T_TimberPlanks_D.png'), W, H, rgba);
  heightToNormalPNG(path.join(OUT_DIR, 'T_TimberPlanks_N.png'), W, H, hmap, 10.0);
}

// 4. T_RoofShingles (Overlapping Slate / Medieval Roof Shingle Scales)
{
  const rgba = Buffer.alloc(W * H * 4);
  const hmap = new Float32Array(W * H);
  const rows = 10;
  const cols = 8;
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const ry = v * rows;
      const rIdx = Math.floor(ry);
      const fy = ry - rIdx;
      const stagger = (rIdx & 1) ? 0.5 : 0.0;
      const rx = u * cols + stagger;
      const cIdx = Math.floor(rx);
      const fx = rx - cIdx;
      const tileHash = hash2((cIdx + 32) % cols, (rIdx + 32) % rows, 808);
      const grain = fbm(u, v, 24, 3, 909);

      const overlap = 0.25 + 0.75 * fy;
      const sideGap = Math.min(1.0, Math.min(fx, 1 - fx) * 18);
      const bottomLip = Math.min(1.0, fy * 14);
      const mask = Math.min(sideGap, bottomLip);
      const h = mask * overlap + (tileHash - 0.5) * 0.1 + grain * 0.12;
      hmap[y * W + x] = h;

      const lum = 75 * (1 - mask) + (165 + (tileHash - 0.5) * 46 + (fy - 0.5) * 35 + (grain - 0.5) * 28) * mask;
      const idx = (y * W + x) * 4;
      rgba[idx] = clampByte(lum);
      rgba[idx + 1] = clampByte(lum);
      rgba[idx + 2] = clampByte(lum * 1.03);
      rgba[idx + 3] = 255;
    }
  }
  writePNG(path.join(OUT_DIR, 'T_RoofShingles_D.png'), W, H, rgba);
  heightToNormalPNG(path.join(OUT_DIR, 'T_RoofShingles_N.png'), W, H, hmap, 11.5);
}

// 5. T_CobbleRoad (Courtyard & Bridge Rounded Cobblestones)
{
  const rgba = Buffer.alloc(W * H * 4);
  const hmap = new Float32Array(W * H);
  const grid = 10;
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const gx = u * grid;
      const gy = v * grid;
      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      let d1 = 99, d2 = 99, cellHash = 0.5;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cx = ((ix + dx) % grid + grid) % grid;
          const cy = ((iy + dy) % grid + grid) % grid;
          const px = ix + dx + 0.2 + 0.6 * hash2(cx, cy, 1111);
          const py = iy + dy + 0.2 + 0.6 * hash2(cx, cy, 2222);
          const dist = Math.hypot(gx - px, gy - py);
          if (dist < d1) {
            d2 = d1;
            d1 = dist;
            cellHash = hash2(cx, cy, 3333);
          } else if (dist < d2) {
            d2 = dist;
          }
        }
      }
      const edge = Math.max(0, Math.min(1, (d2 - d1) * 4.5));
      const dome = Math.pow(edge, 0.5) * Math.max(0, 1 - d1 * 0.9);
      const grit = fbm(u, v, 32, 3, 4444);
      const h = dome * 0.85 + grit * 0.15;
      hmap[y * W + x] = h;

      const lum = 80 * (1 - Math.pow(edge, 0.35)) + (165 + (cellHash - 0.5) * 48 + (grit - 0.5) * 32) * Math.pow(edge, 0.35);
      const idx = (y * W + x) * 4;
      rgba[idx] = clampByte(lum * 1.02);
      rgba[idx + 1] = clampByte(lum * 1.0);
      rgba[idx + 2] = clampByte(lum * 0.96);
      rgba[idx + 3] = 255;
    }
  }
  writePNG(path.join(OUT_DIR, 'T_CobbleRoad_D.png'), W, H, rgba);
  heightToNormalPNG(path.join(OUT_DIR, 'T_CobbleRoad_N.png'), W, H, hmap, 12.0);
}

console.log('Generated 10 PBR textures in:', OUT_DIR);
