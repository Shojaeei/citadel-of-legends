/**
 * Phase 9 Visual & Art Pass Asset Generator
 * Generates:
 *  - 5 Packed PBR ORM (R=AO, G=Roughness, B=Metallic) maps + 1 seamless multi-octave T_WaterRipple_N normal map
 *  - 6 Detailed Z-Up 3D Medieval Prop OBJ meshes: SM_Brazier, SM_WarBanner, SM_CliffRock, SM_WoodenCart, SM_ShrubBush, SM_BridgeArch
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MESH_DIR = path.join(__dirname, '..', 'assets_3d');
const TEX_DIR = path.join(MESH_DIR, 'textures');
fs.mkdirSync(TEX_DIR, { recursive: true });

// ---- PNG writer ----
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function writePNG(filePath, w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filePath, png);
}

function clampByte(v) { return Math.max(0, Math.min(255, Math.round(v))); }
function hash2(x, y, seed = 1) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function smoothNoise(u, v, period, seed) {
  const x = u * period, y = v * period;
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const x0 = ((ix % period) + period) % period, x1 = (x0 + 1) % period;
  const y0 = ((iy % period) + period) % period, y1 = (y0 + 1) % period;
  const n00 = hash2(x0, y0, seed), n10 = hash2(x1, y0, seed);
  const n01 = hash2(x0, y1, seed), n11 = hash2(x1, y1, seed);
  const a = n00 + (n10 - n00) * sx, b = n01 + (n11 - n01) * sx;
  return a + (b - a) * sy;
}
function fbm(u, v, basePeriod, octaves, seed) {
  let sum = 0, amp = 0.5, norm = 0, p = basePeriod;
  for (let i = 0; i < octaves; i++) {
    sum += smoothNoise(u, v, p, seed + i * 73) * amp;
    norm += amp; amp *= 0.5; p *= 2;
  }
  return sum / norm;
}
function writeNormalFromHeight(filePath, w, h, hmap, strength) {
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const ym = (y - 1 + h) % h, yp = (y + 1) % h;
    for (let x = 0; x < w; x++) {
      const xm = (x - 1 + w) % w, xp = (x + 1) % w;
      const dx = (hmap[y * w + xp] - hmap[y * w + xm]) * strength;
      const dy = (hmap[yp * w + x] - hmap[ym * w + x]) * strength;
      let nx = -dx, ny = -dy, nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      const i = (y * w + x) * 4;
      rgba[i] = clampByte((nx * 0.5 + 0.5) * 255);
      rgba[i + 1] = clampByte((ny * 0.5 + 0.5) * 255);
      rgba[i + 2] = clampByte((nz * 0.5 + 0.5) * 255);
      rgba[i + 3] = 255;
    }
  }
  writePNG(filePath, w, h, rgba);
}

// ---- 1. Packed ORM Maps (R=AO, G=Roughness, B=Metallic) + Water Ripple Normal ----
const W = 512, H = 512;

function genORM(filename, fn) {
  const rgba = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const [ao, rough, metal] = fn(u, v);
      const i = (y * W + x) * 4;
      rgba[i] = clampByte(ao * 255);
      rgba[i + 1] = clampByte(rough * 255);
      rgba[i + 2] = clampByte(metal * 255);
      rgba[i + 3] = 255;
    }
  }
  writePNG(path.join(TEX_DIR, filename), W, H, rgba);
}

// Stone masonry ORM: recessed dark mortar crevices (low AO, high roughness), chiseled blocks (higher AO, slight sheen variation)
genORM('T_StoneMasonry_ORM.png', (u, v) => {
  const rows = 8, cols = 4;
  const ry = v * rows, rIdx = Math.floor(ry), fy = ry - rIdx;
  const rx = u * cols + ((rIdx & 1) ? 0.5 : 0), fx = rx - Math.floor(rx);
  const mortar = (fy < 0.07 || fy > 0.93 || fx < 0.04 || fx > 0.96) ? 1 : 0;
  const grit = fbm(u, v, 16, 4, 101);
  const ao = mortar ? 0.38 : (0.78 + grit * 0.22);
  const rough = mortar ? 0.94 : (0.64 + grit * 0.24);
  return [ao, rough, 0.02];
});

// Grass meadow ORM: high roughness matte blades with ambient occlusion in turf roots
genORM('T_GrassMeadow_ORM.png', (u, v) => {
  const macro = fbm(u, v, 8, 4, 202);
  const fine = fbm(u, v, 32, 3, 211);
  return [0.68 + macro * 0.30, 0.78 + fine * 0.18, 0.0];
});

// Timber planks ORM: plank seams recessed AO, wood grain roughness streaks
genORM('T_TimberPlanks_ORM.png', (u, v) => {
  const fy = (v * 8) % 1;
  const seam = (fy < 0.06 || fy > 0.94) ? 1 : 0;
  const grain = fbm(u * 0.5, v * 4, 16, 3, 303);
  return [seam ? 0.35 : 0.78 + grain * 0.20, seam ? 0.95 : 0.58 + grain * 0.28, 0.0];
});

// Roof shingles ORM: overlapping slate lip shadows & rain sheen
genORM('T_RoofShingles_ORM.png', (u, v) => {
  const rows = 10, cols = 8;
  const ry = v * rows, rIdx = Math.floor(ry), fy = ry - rIdx;
  const fx = (u * cols + ((rIdx & 1) ? 0.5 : 0)) % 1;
  const edge = Math.min(Math.min(fx, 1 - fx) * 14, fy * 12, 1);
  const grain = fbm(u, v, 24, 3, 404);
  return [0.42 + 0.55 * edge, 0.48 + (1 - edge) * 0.42 + grain * 0.12, 0.04];
});

// Cobble road ORM: damp glossy stone crowns, matte sandy crevices
genORM('T_CobbleRoad_ORM.png', (u, v) => {
  const n = fbm(u, v, 12, 4, 505);
  const f = fbm(u, v, 32, 2, 515);
  return [0.55 + n * 0.42, 0.52 + (1 - n) * 0.40 + f * 0.08, 0.02];
});

// Animated River Water multi-octave seamless ripple normal map
{
  const hmap = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const w1 = Math.sin((u * 6 + v * 2) * Math.PI * 2) * 0.22;
      const w2 = Math.cos((u * 4 - v * 6) * Math.PI * 2) * 0.18;
      const w3 = fbm(u, v, 10, 4, 707) * 0.65;
      const w4 = fbm(u, v, 28, 3, 733) * 0.25;
      hmap[y * W + x] = w1 + w2 + w3 + w4;
    }
  }
  writeNormalFromHeight(path.join(TEX_DIR, 'T_WaterRipple_N.png'), W, H, hmap, 14.0);
}

// ---- 2. Detailed Z-Up 3D Prop Mesh Builder ----
class PropMeshBuilder {
  constructor(name) {
    this.name = name; this.verts = []; this.norms = []; this.uvs = []; this.groups = {};
  }
  _v(x, y, z) { this.verts.push([x, -y, z]); return this.verts.length; }
  _n(nx, ny, nz) { const l = Math.hypot(nx, ny, nz) || 1; this.norms.push([nx / l, -ny / l, nz / l]); return this.norms.length; }
  _uv(u, v) { this.uvs.push([u, v]); return this.uvs.length; }
  _tri(mat, p0, p1, p2) {
    if (!this.groups[mat]) this.groups[mat] = [];
    const a = this.verts[p0[0] - 1], b = this.verts[p1[0] - 1], c = this.verts[p2[0] - 1];
    const n = this.norms[p0[2] - 1];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const dot = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2];
    this.groups[mat].push(dot < 0 ? [p0, p2, p1] : [p0, p1, p2]);
  }
  _quad(mat, q) {
    this._tri(mat, q[0], q[1], q[2]);
    this._tri(mat, q[0], q[2], q[3]);
  }
  box(mat, x0, x1, y0, y1, z0, z1, rotZDeg = 0, px = 0, py = 0) {
    const r = (rotZDeg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
    const xf = (x, y, z) => rotZDeg ? [px + (x - px) * c - (y - py) * s, py + (x - px) * s + (y - py) * c, z] : [x, y, z];
    const nf = (nx, ny, nz) => rotZDeg ? [nx * c - ny * s, nx * s + ny * c, nz] : [nx, ny, nz];
    const pts = [
      xf(x0, y0, z0), xf(x1, y0, z0), xf(x1, y1, z0), xf(x0, y1, z0),
      xf(x0, y0, z1), xf(x1, y0, z1), xf(x1, y1, z1), xf(x0, y1, z1),
    ].map(p => this._v(p[0], p[1], p[2]));
    const faces = [
      { idx: [0, 3, 2, 1], n: nf(0, 0, -1) }, { idx: [4, 5, 6, 7], n: nf(0, 0, 1) },
      { idx: [0, 1, 5, 4], n: nf(0, -1, 0) }, { idx: [2, 3, 7, 6], n: nf(0, 1, 0) },
      { idx: [1, 2, 6, 5], n: nf(1, 0, 0) },  { idx: [3, 0, 4, 7], n: nf(-1, 0, 0) },
    ];
    for (const f of faces) {
      const ni = this._n(f.n[0], f.n[1], f.n[2]);
      const u0 = this._uv(0, 0), u1 = this._uv(1, 0), u2 = this._uv(1, 1), u3 = this._uv(0, 1);
      this._quad(mat, [[pts[f.idx[0]], u0, ni], [pts[f.idx[1]], u1, ni], [pts[f.idx[2]], u2, ni], [pts[f.idx[3]], u3, ni]]);
    }
  }
  prism(mat, cx, cy, z0, z1, rbx, rby, rtx, rty, sides = 8, startDeg = 0, jitter = 0, seed = 1) {
    const sr = (startDeg * Math.PI) / 180;
    const bot = [], top = [];
    for (let i = 0; i < sides; i++) {
      const a = sr + (i / sides) * Math.PI * 2;
      const jb = 1 + (jitter ? (hash2(i, 1, seed) - 0.5) * jitter : 0);
      const jt = 1 + (jitter ? (hash2(i, 2, seed) - 0.5) * jitter : 0);
      bot.push(this._v(cx + rbx * jb * Math.cos(a), cy + rby * jb * Math.sin(a), z0));
      top.push(this._v(cx + rtx * jt * Math.cos(a), cy + rty * jt * Math.sin(a), z1));
    }
    const uv = this._uv(0.5, 0.5);
    const nb = this._n(0, 0, -1), vb = this._v(cx, cy, z0);
    for (let i = 0; i < sides; i++) this._tri(mat, [vb, uv, nb], [bot[(i + 1) % sides], uv, nb], [bot[i], uv, nb]);
    if (rtx > 0.5 || rty > 0.5) {
      const nt = this._n(0, 0, 1), vt = this._v(cx, cy, z1);
      for (let i = 0; i < sides; i++) this._tri(mat, [vt, uv, nt], [top[i], uv, nt], [top[(i + 1) % sides], uv, nt]);
    }
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const aMid = sr + ((i + 0.5) / sides) * Math.PI * 2;
      const ns = this._n(Math.cos(aMid), Math.sin(aMid), (rbx - rtx) / Math.max(1, z1 - z0));
      this._quad(mat, [[bot[i], uv, ns], [bot[j], uv, ns], [top[j], uv, ns], [top[i], uv, ns]]);
    }
  }
  save(filename) {
    const lines = [`# ${this.name}`, `mtllib citadel.mtl`, `o ${this.name}`];
    for (const v of this.verts) lines.push(`v ${v[0].toFixed(2)} ${v[1].toFixed(2)} ${v[2].toFixed(2)}`);
    for (const t of this.uvs) lines.push(`vt ${t[0].toFixed(4)} ${t[1].toFixed(4)}`);
    for (const n of this.norms) lines.push(`vn ${n[0].toFixed(4)} ${n[1].toFixed(4)} ${n[2].toFixed(4)}`);
    for (const [mat, tris] of Object.entries(this.groups)) {
      lines.push(`g ${this.name}_${mat}`, `usemtl ${mat}`);
      for (const t of tris) lines.push(`f ${t[0][0]}/${t[0][1]}/${t[0][2]} ${t[1][0]}/${t[1][1]}/${t[1][2]} ${t[2][0]}/${t[2][1]}/${t[2][2]}`);
    }
    fs.writeFileSync(path.join(MESH_DIR, filename), lines.join('\n') + '\n');
  }
}

// 1) SM_Brazier (Stone plinth + wrought-iron basin + glowing ember mound)
{
  const b = new PropMeshBuilder('SM_Brazier');
  b.prism('Stone', 0, 0, 0, 42, 46, 46, 36, 36, 8, 22.5);
  b.prism('Stone', 0, 0, 42, 54, 42, 42, 42, 42, 8, 22.5);
  b.prism('DarkMetal', 0, 0, 54, 118, 22, 22, 16, 16, 8);
  b.prism('DarkMetal', 0, 0, 118, 152, 18, 18, 48, 48, 10);
  b.prism('DarkMetal', 0, 0, 152, 162, 52, 52, 50, 50, 10);
  // 4 iron struts
  for (let i = 0; i < 4; i++) b.box('DarkMetal', 16, 26, -6, 6, 54, 134, i * 90);
  // Glowing coal dome
  b.prism('GoldAccent', 0, 0, 148, 174, 38, 38, 12, 12, 10);
  b.save('SM_Brazier.obj');
}

// 2) SM_WarBanner (Tall timber flagpole + gold finial + wind-swept cloth pennant)
{
  const b = new PropMeshBuilder('SM_WarBanner');
  b.prism('Stone', 0, 0, 0, 32, 34, 34, 24, 24, 8);
  b.prism('Timber', 0, 0, 32, 420, 10, 10, 7, 7, 8);
  b.prism('GoldAccent', 0, 0, 420, 458, 12, 12, 1, 1, 6);
  // Crossbar
  b.box('Timber', -8, 8, -75, 75, 388, 400);
  b.prism('GoldAccent', 0, -78, 386, 402, 10, 10, 10, 10, 6);
  b.prism('GoldAccent', 0, 78, 386, 402, 10, 10, 10, 10, 6);
  // Gently billowed banner segments
  b.box('GoldAccent', 10, 20, -64, 64, 300, 388);
  b.box('GoldAccent', 16, 26, -60, 60, 215, 304);
  b.box('GoldAccent', 12, 22, -52, 52, 140, 220);
  b.box('GoldAccent', 18, 28, -32, 32, 95, 145);
  b.save('SM_WarBanner.obj');
}

// 3) SM_CliffRock (Sculpted multi-crag basalt mountain rock cluster)
{
  const b = new PropMeshBuilder('SM_CliffRock');
  b.prism('Basalt', 0, 0, -40, 420, 380, 320, 150, 120, 9, 10, 0.35, 11);
  b.prism('Basalt', -190, 120, -40, 290, 240, 220, 95, 85, 8, 25, 0.35, 22);
  b.prism('Basalt', 210, -110, -40, 320, 260, 210, 100, 90, 8, 5, 0.32, 33);
  b.prism('Basalt', 70, 180, -40, 210, 200, 170, 70, 65, 7, 15, 0.30, 44);
  b.save('SM_CliffRock.obj');
}

// 4) SM_WoodenCart (Medieval timber supply wagon with wheels & crates)
{
  const b = new PropMeshBuilder('SM_WoodenCart');
  // Cart bed & side rails
  b.box('Timber', -110, 110, -62, 62, 44, 56);
  b.box('Timber', -112, 112, -66, -56, 56, 106);
  b.box('Timber', -112, 112, 56, 66, 56, 106);
  b.box('Timber', -112, -102, -62, 62, 56, 106);
  b.box('Timber', 102, 112, -62, 62, 56, 92);
  // Pull shafts
  b.box('Timber', 110, 215, -48, -38, 46, 56);
  b.box('Timber', 110, 215, 38, 48, 46, 56);
  // 4 Wheels
  for (const wx of [-68, 68]) {
    for (const wy of [-72, 72]) {
      b.box('DarkMetal', wx - 36, wx + 36, wy - 7, wy + 7, 6, 78);
      b.box('Timber', wx - 28, wx + 28, wy - 8, wy + 8, 14, 70);
    }
  }
  // Cargo crates & hay sacks
  b.box('Thatch', -88, -10, -48, 42, 56, 122);
  b.box('Timber', 4, 82, -46, 14, 56, 112);
  b.box('GoldAccent', 12, 78, 18, 48, 56, 98);
  b.save('SM_WoodenCart.obj');
}

// 5) SM_ShrubBush (Organic multi-lobe meadow foliage cluster)
{
  const b = new PropMeshBuilder('SM_ShrubBush');
  b.prism('Foliage', 0, 0, -5, 92, 85, 80, 42, 40, 8, 0, 0.25, 51);
  b.prism('Foliage', 52, 28, -5, 68, 58, 55, 25, 22, 7, 20, 0.25, 62);
  b.prism('Foliage', -48, -24, -5, 74, 62, 60, 28, 25, 7, 40, 0.25, 73);
  b.prism('Foliage', -22, 46, -5, 60, 52, 48, 20, 18, 7, 10, 0.22, 84);
  b.save('SM_ShrubBush.obj');
}

// 6) SM_BridgeArch (Ornate stone bridge lantern pillar & chamfered buttress)
{
  const b = new PropMeshBuilder('SM_BridgeArch');
  b.box('Stone', -58, 58, -58, 58, 0, 48);
  b.box('Stone', -46, 46, -46, 46, 48, 220);
  b.box('Stone', -56, 56, -56, 56, 220, 246);
  b.prism('DarkMetal', 0, 0, 246, 302, 28, 28, 34, 34, 4, 45);
  b.prism('GoldAccent', 0, 0, 254, 294, 20, 20, 20, 20, 4, 45);
  b.prism('DarkMetal', 0, 0, 302, 340, 38, 38, 4, 4, 4, 45);
  b.save('SM_BridgeArch.obj');
}

console.log('Phase 9 Art Pass: generated 6 PBR/Water maps in', TEX_DIR, 'and 6 3D prop meshes in', MESH_DIR);
