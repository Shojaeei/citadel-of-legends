/**
 * PR #2 — Massive 4x Multi-Biome Valley & Realistic 1024px PBR Environment Generator
 * Generates:
 *   1. Seamless 1024x1024 PBR Albedo + Normal maps:
 *      - T_MeadowTerrain_D.png / T_MeadowTerrain_N.png (European highland grass, moss, earth, clover)
 *      - T_HighlandStone_D.png / T_HighlandStone_N.png (Weathered medieval ashlar masonry + moss joints)
 *      - T_ValleyCobble_D.png  / T_ValleyCobble_N.png  (Rounded cobblestone + soil crevices, anti-glare)
 *      - T_CliffGranite_D.png  / T_CliffGranite_N.png  (Fractured alpine rock strata + dark crevices)
 *   2. 512x512 Upgraded Tactical Minimap (T_MinimapValley_V2.png) with 3 river crossings & biomes
 *   3. 8 High-Detail Sculpted 3D Environment Meshes (OBJ):
 *      - SM_OakTree.obj, SM_TallPine.obj, SM_TimberBridge.obj, SM_StoneFord.obj,
 *        SM_Windmill.obj, SM_WheatField.obj, SM_IronVein.obj, SM_RuinedArch.obj
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ASSETS_DIR = path.join(__dirname, '..', 'assets_3d');
const TEX_DIR = path.join(ASSETS_DIR, 'textures');
fs.mkdirSync(TEX_DIR, { recursive: true });

// ---- Fast PNG encoder ----
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
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function writePng(filePath, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(filePath, png);
  console.log(`  TEX ${path.basename(filePath)} (${w}x${h}, ${(png.length / 1024).toFixed(0)} KB)`);
}

// ---- Seamless Periodic 2D Value Noise & fBM ----
function hash2(x, y, s) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041);
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function smooth(t) { return t * t * (3 - 2 * t); }
function tileNoise(u, v, period, seed) {
  const x = u * period, y = v * period;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smooth(x - x0), fy = smooth(y - y0);
  const ix0 = ((x0 % period) + period) % period, ix1 = (ix0 + 1) % period;
  const iy0 = ((y0 % period) + period) % period, iy1 = (iy0 + 1) % period;
  const a = hash2(ix0, iy0, seed), b = hash2(ix1, iy0, seed);
  const c = hash2(ix0, iy1, seed), d = hash2(ix1, iy1, seed);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}
function tileFbm(u, v, basePeriod, octaves, seed) {
  let val = 0, amp = 0.5, norm = 0, p = basePeriod;
  for (let o = 0; o < octaves; o++) {
    val += tileNoise(u, v, p, seed + o * 31) * amp;
    norm += amp;
    amp *= 0.5;
    p *= 2;
  }
  return val / norm;
}

function heightToNormal(height, w, h, strength) {
  const out = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    const ym = (y - 1 + h) % h, yp = (y + 1) % h;
    for (let x = 0; x < w; x++) {
      const xm = (x - 1 + w) % w, xp = (x + 1) % w;
      const dx = (height[y * w + xp] - height[y * w + xm]) * strength;
      const dy = (height[yp * w + x] - height[ym * w + x]) * strength;
      const inv = 1.0 / Math.sqrt(dx * dx + dy * dy + 1.0);
      const idx = (y * w + x) * 3;
      out[idx]     = Math.max(0, Math.min(255, Math.round((-dx * inv * 0.5 + 0.5) * 255)));
      out[idx + 1] = Math.max(0, Math.min(255, Math.round((-dy * inv * 0.5 + 0.5) * 255)));
      out[idx + 2] = Math.max(0, Math.min(255, Math.round((inv * 0.5 + 0.5) * 255)));
    }
  }
  return out;
}

function clampByte(v) { return Math.max(0, Math.min(255, Math.round(v))); }

console.log('1) Generating 1024x1024 seamless medieval PBR textures...');
const SZ = 1024;

// 1A. T_MeadowTerrain_D & N — Rich natural European highland grass, moss, wild soil & clover
{
  const alb = Buffer.alloc(SZ * SZ * 3);
  const ht  = new Float32Array(SZ * SZ);
  for (let y = 0; y < SZ; y++) {
    const v = y / SZ;
    for (let x = 0; x < SZ; x++) {
      const u = x / SZ;
      const macro = tileFbm(u, v, 4, 4, 11);
      const blades = tileFbm(u, v, 32, 3, 29);
      const soilPatch = Math.max(0, (tileFbm(u, v, 6, 3, 73) - 0.58) * 2.8);
      const mossPatch = Math.max(0, (tileFbm(u, v, 8, 3, 97) - 0.52) * 2.1);
      // Natural muted highland greens (NO neon green!)
      let r = 56 + macro * 28 + blades * 22 + soilPatch * 48 - mossPatch * 14;
      let g = 86 + macro * 34 + blades * 26 - soilPatch * 10 + mossPatch * 12;
      let b = 38 + macro * 14 + blades * 10 + soilPatch * 18 - mossPatch * 8;
      // Rare warm wildflower / dry straw flecks
      const fleck = tileNoise(u, v, 128, 131);
      if (fleck > 0.965) { r += 42; g += 36; b += 14; }
      const i = (y * SZ + x) * 3;
      alb[i] = clampByte(r); alb[i + 1] = clampByte(g); alb[i + 2] = clampByte(b);
      ht[y * SZ + x] = blades * 0.65 + macro * 0.35 - soilPatch * 0.25;
    }
  }
  writePng(path.join(TEX_DIR, 'T_MeadowTerrain_D.png'), SZ, SZ, alb);
  writePng(path.join(TEX_DIR, 'T_MeadowTerrain_N.png'), SZ, SZ, heightToNormal(ht, SZ, SZ, 4.2));
}

// 1B. T_HighlandStone_D & N — Authentic weathered medieval ashlar limestone masonry with moss crevices
{
  const alb = Buffer.alloc(SZ * SZ * 3);
  const ht  = new Float32Array(SZ * SZ);
  const rows = 12;
  for (let y = 0; y < SZ; y++) {
    const v = y / SZ;
    const rowF = v * rows;
    const row = Math.floor(rowF);
    const ry = rowF - row;
    const cols = (row % 3 === 0) ? 5 : 6;
    const stagger = (row % 2) * 0.5 + hash2(row, 3, 41) * 0.25;
    for (let x = 0; x < SZ; x++) {
      const u = x / SZ;
      const colF = (u + stagger) * cols;
      const col = Math.floor(colF) % cols;
      const cx = colF - Math.floor(colF);

      const chip = (tileFbm(u, v, 24, 3, 55) - 0.5) * 0.045;
      const dEdgeX = Math.min(cx, 1.0 - cx) + chip;
      const dEdgeY = Math.min(ry, 1.0 - ry) + chip * 1.4;
      const mortar = Math.min(1.0, Math.min(dEdgeX / 0.055, dEdgeY / 0.08));
      const bevel = smooth(Math.max(0, Math.min(1, mortar)));

      const blkSeed = hash2(col, row, 19);
      const grain = tileFbm(u, v, 16, 4, 61);
      const moss = Math.max(0, (tileFbm(u, v, 8, 3, 83) - 0.56) * 2.4) * (1.0 - bevel * 0.65);

      // Rich weathered granite-limestone (mid-value so it never blows out!)
      const baseLum = 92 + blkSeed * 36 + (grain - 0.5) * 34;
      const warmth = (blkSeed - 0.5) * 16;
      let r = baseLum + warmth;
      let g = baseLum + warmth * 0.4;
      let b = baseLum - warmth * 0.7;

      // Dark weathered mortar + creeping lichen moss
      const mR = 44 + grain * 18, mG = 43 + grain * 18, mB = 40 + grain * 15;
      r = mR + (r - mR) * bevel - moss * 26;
      g = mG + (g - mG) * bevel + moss * 20;
      b = mB + (b - mB) * bevel - moss * 24;

      const idx = (y * SZ + x) * 3;
      alb[idx] = clampByte(r); alb[idx + 1] = clampByte(g); alb[idx + 2] = clampByte(b);
      ht[y * SZ + x] = bevel * (0.72 + grain * 0.28);
    }
  }
  writePng(path.join(TEX_DIR, 'T_HighlandStone_D.png'), SZ, SZ, alb);
  writePng(path.join(TEX_DIR, 'T_HighlandStone_N.png'), SZ, SZ, heightToNormal(ht, SZ, SZ, 6.5));
}

// 1C. T_ValleyCobble_D & N — Voronoi rounded medieval cobblestones with packed earth/moss joints
{
  const alb = Buffer.alloc(SZ * SZ * 3);
  const ht  = new Float32Array(SZ * SZ);
  const G = 14; // 14x14 cobblestone cells
  const ptsX = new Float32Array(G * G);
  const ptsY = new Float32Array(G * G);
  const ptsCol = new Float32Array(G * G);
  for (let j = 0; j < G; j++) {
    for (let i = 0; i < G; i++) {
      ptsX[j * G + i] = i + 0.18 + hash2(i, j, 201) * 0.64;
      ptsY[j * G + i] = j + 0.18 + hash2(i, j, 202) * 0.64;
      ptsCol[j * G + i] = hash2(i, j, 203);
    }
  }
  for (let y = 0; y < SZ; y++) {
    const v = y / SZ, gy = v * G, cy = Math.floor(gy);
    for (let x = 0; x < SZ; x++) {
      const u = x / SZ, gx = u * G, cx = Math.floor(gx);
      let d1 = 99, d2 = 99, bestC = 0.5;
      for (let oy = -1; oy <= 1; oy++) {
        const ny = (cy + oy + G) % G;
        for (let ox = -1; ox <= 1; ox++) {
          const nx = (cx + ox + G) % G;
          let dx = ptsX[ny * G + nx] - gx;
          let dy = ptsY[ny * G + nx] - gy;
          if (dx > G * 0.5) dx -= G; if (dx < -G * 0.5) dx += G;
          if (dy > G * 0.5) dy -= G; if (dy < -G * 0.5) dy += G;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < d1) { d2 = d1; d1 = d; bestC = ptsCol[ny * G + nx]; }
          else if (d < d2) { d2 = d; }
        }
      }
      const edge = d2 - d1;
      const dome = smooth(Math.max(0, Math.min(1, (edge - 0.04) / 0.22)));
      const grain = tileFbm(u, v, 24, 3, 215);
      const moss = Math.max(0, (tileFbm(u, v, 8, 3, 229) - 0.55) * 2.2) * (1 - dome);

      const sLum = 78 + bestC * 38 + (grain - 0.5) * 26;
      const warm = (bestC - 0.5) * 20;
      const dirtR = 54 + grain * 18 - moss * 14;
      const dirtG = 48 + grain * 16 + moss * 26;
      const dirtB = 38 + grain * 12 - moss * 12;

      const idx = (y * SZ + x) * 3;
      alb[idx]     = clampByte(dirtR + (sLum + warm - dirtR) * dome);
      alb[idx + 1] = clampByte(dirtG + (sLum + warm * 0.4 - dirtG) * dome);
      alb[idx + 2] = clampByte(dirtB + (sLum - warm * 0.6 - dirtB) * dome);
      ht[y * SZ + x] = dome * (0.78 + grain * 0.22);
    }
  }
  writePng(path.join(TEX_DIR, 'T_ValleyCobble_D.png'), SZ, SZ, alb);
  writePng(path.join(TEX_DIR, 'T_ValleyCobble_N.png'), SZ, SZ, heightToNormal(ht, SZ, SZ, 6.0));
}

// 1D. T_CliffGranite_D & N — Dramatic stratified alpine crag granite with dark mineral veins
{
  const alb = Buffer.alloc(SZ * SZ * 3);
  const ht  = new Float32Array(SZ * SZ);
  for (let y = 0; y < SZ; y++) {
    const v = y / SZ;
    for (let x = 0; x < SZ; x++) {
      const u = x / SZ;
      const warp = tileFbm(u, v, 6, 4, 301) * 0.22;
      const strata = Math.abs(Math.sin((v + warp) * Math.PI * 10.0));
      const crag = tileFbm(u, v, 12, 5, 317);
      const fine = tileFbm(u, v, 48, 3, 331);
      const hVal = strata * 0.35 + crag * 0.50 + fine * 0.15;
      const moss = Math.max(0, (tileFbm(u, v, 6, 3, 349) - 0.62) * 2.5);
      const lum = 52 + hVal * 68;
      const idx = (y * SZ + x) * 3;
      alb[idx]     = clampByte(lum * 0.96 - moss * 18);
      alb[idx + 1] = clampByte(lum * 0.98 + moss * 14);
      alb[idx + 2] = clampByte(lum * 1.04 - moss * 16);
      ht[y * SZ + x] = hVal;
    }
  }
  writePng(path.join(TEX_DIR, 'T_CliffGranite_D.png'), SZ, SZ, alb);
  writePng(path.join(TEX_DIR, 'T_CliffGranite_N.png'), SZ, SZ, heightToNormal(ht, SZ, SZ, 7.5));
}

// 1E. 512x512 Detailed Tactical Minimap for the 4x Expanded Valley (3 Crossings + Biomes)
{
  const MW = 512, MH = 512;
  const img = Buffer.alloc(MW * MH * 3);
  for (let py = 0; py < MH; py++) {
    const wy = (py / (MH - 1) - 0.5) * 26000; // -13000 .. +13000
    for (let px = 0; px < MW; px++) {
      const wx = (px / (MW - 1) - 0.5) * 34000; // -17000 .. +17000
      const u = px / MW, v = py / MH;
      const n = tileFbm(u, v, 8, 4, 505);

      // Base parchment-tinted medieval valley biome palette
      let r = 54 + n * 24, g = 88 + n * 28, b = 42 + n * 14;
      // Eastern Obsidian darkened volcanic frontier
      if (wx > 2200) {
        const eastT = Math.min(1, (wx - 2200) / 6000);
        r = r * (1 - eastT) + (68 + n * 22) * eastT;
        g = g * (1 - eastT) + (56 + n * 18) * eastT;
        b = b * (1 - eastT) + (50 + n * 18) * eastT;
      }
      // Northern Whispering Forest (deep emerald pine belt)
      if (wy > 3200 && Math.abs(wx) < 13500) {
        r *= 0.68; g *= 0.85; b *= 0.72;
      }
      // Southern Iron Quarry Canyon (slate-rock highland)
      if (wy < -3400 && Math.abs(wx) < 13500) {
        r = r * 0.45 + 62; g = g * 0.45 + 58; b = b * 0.45 + 54;
      }
      // Winding River meandering around X = 0
      const riverCenter = Math.sin(wy * 0.00028) * 520;
      const distRiv = Math.abs(wx - riverCenter);
      if (distRiv < 1050) {
        const bank = Math.max(0, (distRiv - 750) / 300);
        r = 26 + bank * 54; g = 82 + bank * 30; b = 136 - bank * 50;
      }
      // 3 Walkable River Crossings!
      const onCentralBridge = Math.abs(wy) < 520 && Math.abs(wx) < 1700;
      const onNorthFord     = Math.abs(wy - 4600) < 420 && Math.abs(wx - Math.sin(4600 * 0.00028) * 520) < 1550;
      const onSouthBridge   = Math.abs(wy + 4600) < 420 && Math.abs(wx - Math.sin(-4600 * 0.00028) * 520) < 1550;
      if (onCentralBridge) { r = 165; g = 152; b = 128; }
      else if (onNorthFord) { r = 132; g = 148; b = 142; }
      else if (onSouthBridge) { r = 142; g = 108; b = 74; }

      // Cobble highways connecting Keeps & crossings
      const onMainRoad = Math.abs(wy) < 260 && wx > -7500 && wx < 7500;
      if (onMainRoad && !onCentralBridge && distRiv >= 1050) { r = 128; g = 114; b = 88; }

      // Mountain Ridge Perimeter
      if (Math.abs(wx) > 14200 || Math.abs(wy) > 10800) {
        r = 56 + n * 24; g = 54 + n * 22; b = 58 + n * 24;
      }
      // Solaris Citadel icon (West, gold)
      if (Math.hypot(wx + 4200, wy) < 950) { r = 232; g = 192; b = 64; }
      // Dread Citadel icon (East, crimson)
      if (Math.hypot(wx - 4200, wy) < 950) { r = 205; g = 52; b = 54; }
      // Subtle cartography grid lines
      if (px % 128 === 0 || py % 128 === 0) { r *= 0.86; g *= 0.86; b *= 0.86; }

      const idx = (py * MW + px) * 3;
      img[idx] = clampByte(r); img[idx + 1] = clampByte(g); img[idx + 2] = clampByte(b);
    }
  }
  writePng(path.join(TEX_DIR, 'T_MinimapValley_V2.png'), MW, MH, img);
}

// ============================================================================
// 2) High-Detail 3D Biome Meshes (OBJ with clean normals, UVs, and multi-material groups)
// ============================================================================
console.log('2) Generating 8 sculpted multi-biome 3D environment meshes...');

class MeshBuilder {
  constructor() {
    this.verts = [];
    this.uvs = [];
    this.groups = {};
    this.curMat = 'Mat_0';
  }
  useMat(m) { this.curMat = m; if (!this.groups[m]) this.groups[m] = []; }
  addV(x, y, z, u = 0, v = 0) {
    this.verts.push([x, y, z]);
    this.uvs.push([u, v]);
    return this.verts.length;
  }
  addTri(a, b, c) {
    if (!this.groups[this.curMat]) this.groups[this.curMat] = [];
    this.groups[this.curMat].push([a, b, c]);
  }
  addQuad(a, b, c, d) { this.addTri(a, b, c); this.addTri(a, c, d); }

  addBox(cx, cy, cz, sx, sy, sz, yaw = 0) {
    const hx = sx * 0.5, hy = sy * 0.5, hz = sz * 0.5;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const local = [
      [-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
      [-hx, -hy,  hz], [hx, -hy,  hz], [hx, hy,  hz], [-hx, hy,  hz],
    ];
    const idx = local.map(([x, y, z]) => {
      const rx = x * cs - y * sn + cx;
      const ry = x * sn + y * cs + cy;
      return this.addV(rx, ry, z + cz, (rx + ry) * 0.004, (z + cz) * 0.004);
    });
    this.addQuad(idx[4], idx[5], idx[6], idx[7]); // top
    this.addQuad(idx[3], idx[2], idx[1], idx[0]); // bottom
    this.addQuad(idx[0], idx[1], idx[5], idx[4]); // -Y
    this.addQuad(idx[2], idx[3], idx[7], idx[6]); // +Y
    this.addQuad(idx[1], idx[2], idx[6], idx[5]); // +X
    this.addQuad(idx[3], idx[0], idx[4], idx[7]); // -X
  }

  addCylinder(cx, cy, z0, z1, r0, r1, segs = 10, leanX = 0, leanY = 0) {
    const bot = [], top = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      bot.push(this.addV(cx + ca * r0, cy + sa * r0, z0, i / segs, 0));
      top.push(this.addV(cx + leanX + ca * r1, cy + leanY + sa * r1, z1, i / segs, 1));
    }
    const cTop = this.addV(cx + leanX, cy + leanY, z1, 0.5, 0.5);
    for (let i = 0; i < segs; i++) {
      const ni = (i + 1) % segs;
      this.addQuad(bot[i], bot[ni], top[ni], top[i]);
      this.addTri(top[i], top[ni], cTop);
    }
  }

  // Organic displaced icosphere/canopy cluster (NOT boxy cones!)
  addCanopyBlob(cx, cy, cz, rx, ry, rz, rings = 5, segs = 10, seed = 1) {
    const grid = [];
    for (let r = 0; r <= rings; r++) {
      const phi = (r / rings) * Math.PI;
      const row = [];
      for (let s = 0; s < segs; s++) {
        const theta = (s / segs) * Math.PI * 2;
        const wob = 0.82 + 0.34 * hash2(s + r * 7, seed * 13, 77);
        const x = cx + Math.sin(phi) * Math.cos(theta) * rx * wob;
        const y = cy + Math.sin(phi) * Math.sin(theta) * ry * wob;
        const z = cz + Math.cos(phi) * rz * wob;
        row.push(this.addV(x, y, z, s / segs, r / rings));
      }
      grid.push(row);
    }
    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segs; s++) {
        const ns = (s + 1) % segs;
        this.addQuad(grid[r][s], grid[r][ns], grid[r + 1][ns], grid[r + 1][s]);
      }
    }
  }

  saveObj(name) {
    const lines = [`# ${name} — Citadel of Legends PR2 High-Detail Biome Asset`];
    for (const [x, y, z] of this.verts) lines.push(`v ${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`);
    for (const [u, v] of this.uvs) lines.push(`vt ${u.toFixed(4)} ${v.toFixed(4)}`);
    let tris = 0;
    for (const [mat, faces] of Object.entries(this.groups)) {
      lines.push(`g ${mat}`);
      lines.push(`usemtl ${mat}`);
      for (const [a, b, c] of faces) {
        lines.push(`f ${a}/${a} ${b}/${b} ${c}/${c}`);
        tris++;
      }
    }
    const p = path.join(ASSETS_DIR, `${name}.obj`);
    fs.writeFileSync(p, lines.join('\n') + '\n');
    console.log(`  OBJ ${name}.obj (${this.verts.length} verts, ${tris} tris, ${Object.keys(this.groups).length} mats)`);
  }
}

// 2A. SM_OakTree — Gnarled medieval European oak with spreading roots, main branches & 6 lush organic leaf clusters
{
  const m = new MeshBuilder();
  m.useMat('Bark');
  m.addCylinder(0, 0, -20, 60, 58, 36, 10, 4, -3);
  m.addCylinder(4, -3, 55, 210, 36, 24, 10, -8, 12);
  // 4 organic flared root buttresses
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI * 0.5 + 0.3;
    m.addCylinder(Math.cos(a) * 42, Math.sin(a) * 42, -15, 65, 22, 12, 6, -Math.cos(a) * 28, -Math.sin(a) * 28);
  }
  // 4 diverging main boughs
  const boughs = [[110, 60, 290], [-105, 70, 300], [40, -115, 285], [-80, -85, 295]];
  for (const [bx, by, bz] of boughs) {
    m.addCylinder(-4, 9, 185, bz, 18, 9, 7, bx, by);
  }
  m.useMat('Canopy');
  m.addCanopyBlob(0, 0, 360, 165, 160, 110, 5, 10, 1);
  m.addCanopyBlob(115, 55, 310, 130, 125, 90, 5, 10, 2);
  m.addCanopyBlob(-110, 68, 325, 135, 120, 95, 5, 10, 3);
  m.addCanopyBlob(45, -120, 300, 125, 125, 88, 5, 10, 4);
  m.addCanopyBlob(-82, -88, 315, 120, 115, 85, 5, 10, 5);
  m.addCanopyBlob(18, 22, 425, 115, 115, 78, 4, 9, 6);
  m.saveObj('SM_OakTree');
}

// 2B. SM_TallPine — Sweeping layered alpine spruce/pine (5 irregular flared bough tiers!)
{
  const m = new MeshBuilder();
  m.useMat('Bark');
  m.addCylinder(0, 0, -25, 490, 38, 8, 9, 5, 4);
  m.useMat('PineNeedles');
  const tiers = [
    [120, 185, 115, 11], [210, 160, 110, 12], [295, 132, 100, 13],
    [375, 102, 92, 14],  [450, 68, 88, 15],   [515, 34, 72, 16],
  ];
  for (const [tz, rad, h, sd] of tiers) {
    // Flared irregular drooping skirt
    const segs = 12;
    const baseRing = [], midRing = [];
    const apex = m.addV(4, 3, tz + h, 0.5, 0.0);
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2 + sd * 0.4;
      const wob = 0.78 + 0.42 * hash2(i, sd, 91);
      const rOuter = rad * wob;
      const droop = -22 * wob;
      baseRing.push(m.addV(Math.cos(a) * rOuter, Math.sin(a) * rOuter, tz + droop, i / segs, 1.0));
      midRing.push(m.addV(Math.cos(a) * (rOuter * 0.52), Math.sin(a) * (rOuter * 0.52), tz + h * 0.46, i / segs, 0.5));
    }
    for (let i = 0; i < segs; i++) {
      const ni = (i + 1) % segs;
      m.addQuad(baseRing[i], baseRing[ni], midRing[ni], midRing[i]);
      m.addTri(midRing[i], midRing[ni], apex);
    }
  }
  m.saveObj('SM_TallPine');
}

// 2C. SM_TimberBridge — Heavy medieval oak siege bridge for Southern Quarry Crossing (2800 UU long x 720 UU wide)
{
  const m = new MeshBuilder();
  m.useMat('Stone');
  // 4 stout stone bridge abutment piers sunk deep into riverbed
  for (const px of [-1100, -380, 380, 1100]) {
    m.addBox(px, -310, -90, 140, 110, 220);
    m.addBox(px,  310, -90, 140, 110, 220);
  }
  m.useMat('Timber');
  // Deck planks
  m.addBox(0, 0, -10, 2800, 680, 36);
  // Heavy longitudinal beams
  m.addBox(0, -310, -35, 2820, 48, 56);
  m.addBox(0,  310, -35, 2820, 48, 56);
  // Side wooden posts + safety railings
  for (let px = -1250; px <= 1250; px += 250) {
    m.addBox(px, -330, 58, 36, 36, 130);
    m.addBox(px,  330, 58, 36, 36, 130);
  }
  m.addBox(0, -330, 108, 2600, 26, 22);
  m.addBox(0,  330, 108, 2600, 26, 22);
  m.saveObj('SM_TimberBridge');
}

// 2D. SM_StoneFord — Northern Whispering Shallow Stone Ford with timber guide markers
{
  const m = new MeshBuilder();
  m.useMat('Cobble');
  m.addBox(0, 0, -14, 2650, 740, 28);
  // Stepping stone slabs along riverbed edges
  for (let i = 0; i < 12; i++) {
    const px = -1100 + i * 200;
    m.addCylinder(px, -360 + (i % 2) * 35, -30, 6, 75, 62, 7);
    m.addCylinder(px + 60, 360 - (i % 2) * 35, -30, 6, 78, 60, 7);
  }
  m.useMat('Timber');
  // River-ford guide poles with crossbeams
  for (const px of [-980, -320, 320, 980]) {
    m.addCylinder(px, -390, -25, 165, 16, 12, 7);
    m.addCylinder(px,  390, -25, 165, 16, 12, 7);
  }
  m.saveObj('SM_StoneFord');
}

// 2E. SM_Windmill — Classic Stronghold medieval stone & timber flour windmill
{
  const m = new MeshBuilder();
  m.useMat('Stone');
  m.addCylinder(0, 0, -10, 420, 195, 135, 12);
  m.useMat('Roof');
  // Conical slate cap
  m.addCylinder(0, 0, 415, 575, 152, 8, 12);
  m.useMat('Timber');
  // Doorframe, gallery walkway & huge windmill sail cross
  m.addBox(182, 0, 68, 38, 76, 136);
  m.addCylinder(0, 0, 280, 305, 190, 185, 12);
  // Axle & 4 giant lattice sails facing +X
  m.addBox(160, 0, 430, 95, 32, 32);
  for (let k = 0; k < 4; k++) {
    const ang = k * Math.PI * 0.5 + 0.35;
    const dy = Math.cos(ang), dz = Math.sin(ang);
    for (let s = 1; s <= 5; s++) {
      const dist = s * 58;
      m.addBox(198, dy * dist, 430 + dz * dist, 14, 52, 52);
    }
  }
  m.useMat('Canvas');
  for (let k = 0; k < 4; k++) {
    const ang = k * Math.PI * 0.5 + 0.35;
    const dy = Math.cos(ang), dz = Math.sin(ang);
    for (let s = 2; s <= 5; s++) {
      const dist = s * 58;
      m.addBox(206, dy * dist + dz * 24, 430 + dz * dist - dy * 24, 6, 48, 48);
    }
  }
  m.saveObj('SM_Windmill');
}

// 2F. SM_WheatField — Golden medieval farmland wheat rows with rustic timber fencing
{
  const m = new MeshBuilder();
  m.useMat('Wheat');
  for (let row = -3; row <= 3; row++) {
    m.addBox(0, row * 95, 34, 680, 64, 68);
  }
  m.useMat('Timber');
  for (let px = -360; px <= 360; px += 180) {
    m.addBox(px, -365, 38, 18, 18, 80);
    m.addBox(px,  365, 38, 18, 18, 80);
  }
  m.addBox(0, -365, 58, 740, 12, 14);
  m.addBox(0,  365, 58, 740, 12, 14);
  m.addBox(-365, 0, 58, 12, 740, 14);
  m.addBox( 365, 0, 58, 12, 740, 14);
  m.saveObj('SM_WheatField');
}

// 2G. SM_IronVein — Jagged basalt rock quarry outcrop streaked with metallic iron ore
{
  const m = new MeshBuilder();
  m.useMat('Basalt');
  m.addCanopyBlob(0, 0, 75, 195, 165, 120, 4, 8, 41);
  m.addCanopyBlob(115, -55, 55, 125, 110, 88, 4, 8, 42);
  m.addCanopyBlob(-105, 65, 62, 130, 115, 95, 4, 8, 43);
  m.useMat('IronOre');
  m.addCanopyBlob(40, 25, 128, 62, 55, 46, 3, 7, 44);
  m.addCanopyBlob(-55, -45, 98, 52, 48, 38, 3, 7, 45);
  m.saveObj('SM_IronVein');
}

// 2H. SM_RuinedArch — Weathered ancient medieval aqueduct archway
{
  const m = new MeshBuilder();
  m.useMat('Stone');
  m.addBox(-190, 0, 165, 105, 105, 340);
  m.addBox( 190, 0, 145, 105, 105, 300);
  m.addBox(-190, 0, 25, 145, 145, 50);
  m.addBox( 190, 0, 25, 145, 145, 50);
  // Broken lintel & arch stones
  m.addBox(-95, 0, 325, 220, 96, 65);
  m.addBox( 95, 0, 295, 160, 96, 58);
  // Fallen rubble blocks at base
  m.addBox(55, 78, 24, 72, 58, 48, 0.4);
  m.addBox(-45, -85, 20, 64, 52, 40, -0.6);
  m.saveObj('SM_RuinedArch');
}

console.log('PR #2 environment textures & 3D biome meshes complete!');
