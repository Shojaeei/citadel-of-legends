/**
 * PR #5 — Sculpted 3D Valley Terrain, Realm Outposts, Skybolt Anti-Air Ballista & Meadow Grass
 *
 * Outputs into assets_3d/:
 *   SM_SculptedValley_West.obj   (18,000 x 28,000 UU multi-elevation valley half, local X in [-9000, 9000])
 *   SM_SculptedValley_East.obj   (18,000 x 28,000 UU multi-elevation valley half, local X in [-9000, 9000])
 *   SM_SupplyOutpost.obj         (Multi-material supply outpost with stone plinth, timber depot, crates & banner mast)
 *   SM_ForwardBastion.obj        (Fortified bridgehead bastion with buttresses, battlements, iron gate & braziers)
 *   SM_SkyboltBallista.obj       (Heavy anti-air rotating torsion ballista & iron harpoon bolt)
 *   SM_GrassClump.obj            (Multi-blade meadow grass tuft anchored at Z=0 for WPO wind sway)
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.resolve(__dirname, '..', 'assets_3d');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Must stay mathematically identical to UCitadelTerritoryLibrary::SampleValleyHeight(WorldX, WorldY)
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function sampleValleyHeight(worldX, worldY) {
  const absX = Math.abs(worldX);
  const absY = Math.abs(worldY);

  // Protect existing Keep courtyards & bridge decks cleanly at Z = 0
  const onCentralBridge = absY < 850 && absX < 2200;
  const onNorthFord = Math.abs(worldY - 4600) < 850 && absX < 2200;
  const onSouthBridge = Math.abs(worldY + 4600) < 850 && absX < 2200;
  const crossingMask = (onCentralBridge || onNorthFord || onSouthBridge)
    ? 0
    : smoothstep(700, 1500, Math.min(absY, Math.abs(worldY - 4600), Math.abs(worldY + 4600)));

  // Sunken riverbanks along X = 0 (excluding bridge approaches)
  const riverTrough = -115 * (1 - smoothstep(350, 1450, absX)) * crossingMask;

  // Scenic rolling ridge hills at north/south valley flanks & far outer mountain rim
  const flankMask = smoothstep(7200, 12800, absY);
  const farRimMask = smoothstep(12600, 17400, absX);
  const hillMask = Math.max(flankMask, farRimMask * 0.85);

  // Multi-frequency ridge waves (creates >28 deg cliff faces for M_ValleyLandscape slope blend)
  const waveA = Math.sin(worldX * 0.00055) * Math.cos(worldY * 0.00048);
  const waveB = Math.sin((worldX + worldY) * 0.0011 + 1.1) * 0.45;
  const waveC = Math.cos((worldX - worldY) * 0.0018) * 0.25;
  const ridgeDetail = Math.max(0.15, 0.65 + waveA * 0.45 + waveB + waveC);
  const ridgeHeight = hillMask * (340 + ridgeDetail * 380);

  // Subtle playable meadow undulations outside the castle keep pads (keeps center <= +24 UU)
  const castlePadMask = smoothstep(1800, 3600, absX) * (1 - smoothstep(10500, 13200, absX));
  const microUndulation = Math.sin(worldX * 0.0009) * Math.sin(worldY * 0.0009) * 18 * castlePadMask * crossingMask;

  return riverTrough + ridgeHeight + microUndulation;
}

class MeshObjBuilder {
  constructor(comment) {
    this.comment = comment;
    this.verts = [];
    this.uvs = [];
    this.groups = {};
    this.mat = 'Stone';
  }
  use(m) {
    this.mat = m;
    if (!this.groups[m]) this.groups[m] = [];
  }
  // Native UE Z-up -> OBJ (x, -y, z) because UE OBJ importer negates Y
  v(x, y, z, u = 0, v = 0) {
    this.verts.push([x, -y, z]);
    this.uvs.push([u, v]);
    return this.verts.length;
  }
  tri(a, b, c) {
    this.groups[this.mat].push([a, b, c]);
  }
  quad(a, b, c, d) {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }
  box(cx, cy, z0, sx, sy, sz, topScale = 1.0) {
    const hx = sx * 0.5, hy = sy * 0.5;
    const tx = hx * topScale, ty = hy * topScale;
    const z1 = z0 + sz;
    const p = [
      this.v(cx - hx, cy - hy, z0, 0, 0),
      this.v(cx + hx, cy - hy, z0, 1, 0),
      this.v(cx + hx, cy + hy, z0, 1, 1),
      this.v(cx - hx, cy + hy, z0, 0, 1),
      this.v(cx - tx, cy - ty, z1, 0, 0),
      this.v(cx + tx, cy - ty, z1, 1, 0),
      this.v(cx + tx, cy + ty, z1, 1, 1),
      this.v(cx - tx, cy + ty, z1, 0, 1),
    ];
    this.quad(p[4], p[7], p[6], p[5]);
    this.quad(p[0], p[1], p[2], p[3]);
    this.quad(p[0], p[4], p[5], p[1]);
    this.quad(p[1], p[5], p[6], p[2]);
    this.quad(p[2], p[6], p[7], p[3]);
    this.quad(p[3], p[7], p[4], p[0]);
  }
  prism(cx, cy, z0, r0, r1, h, segs = 8) {
    const bot = [], top = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      bot.push(this.v(cx + ca * r0, cy + sa * r0, z0, i / segs, 0));
      top.push(this.v(cx + ca * r1, cy + sa * r1, z0 + h, i / segs, 1));
    }
    const c0 = this.v(cx, cy, z0, 0.5, 0);
    const c1 = this.v(cx, cy, z0 + h, 0.5, 1);
    for (let i = 0; i < segs; i++) {
      const ni = (i + 1) % segs;
      this.quad(bot[i], top[i], top[ni], bot[ni]);
      this.tri(bot[i], bot[ni], c0);
      this.tri(top[ni], top[i], c1);
    }
  }
  limb(p0, p1, r0, r1, segs = 8) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    const ax = dx / len, ay = dy / len, az = dz / len;
    const ref = Math.abs(az) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    let ux = ay * ref[2] - az * ref[1];
    let uy = az * ref[0] - ax * ref[2];
    let uz = ax * ref[1] - ay * ref[0];
    const ulen = Math.hypot(ux, uy, uz) || 1;
    ux /= ulen; uy /= ulen; uz /= ulen;
    const wx = ay * uz - az * uy;
    const wy = az * ux - ax * uz;
    const wz = ax * uy - ay * ux;
    const ring0 = [], ring1 = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const nx = ux * ca + wx * sa, ny = uy * ca + wy * sa, nz = uz * ca + wz * sa;
      ring0.push(this.v(p0[0] + nx * r0, p0[1] + ny * r0, p0[2] + nz * r0, i / segs, 0));
      ring1.push(this.v(p1[0] + nx * r1, p1[1] + ny * r1, p1[2] + nz * r1, i / segs, 1));
    }
    const c0 = this.v(p0[0], p0[1], p0[2], 0.5, 0);
    const c1 = this.v(p1[0], p1[1], p1[2], 0.5, 1);
    for (let i = 0; i < segs; i++) {
      const ni = (i + 1) % segs;
      this.quad(ring0[i], ring1[i], ring1[ni], ring0[ni]);
      this.tri(ring0[i], ring0[ni], c0);
      this.tri(ring1[ni], ring1[i], c1);
    }
  }
  save(fileName) {
    const lines = [`# ${fileName} — ${this.comment}`];
    for (const [x, y, z] of this.verts) {
      lines.push(`v ${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`);
    }
    for (const [u, v] of this.uvs) {
      lines.push(`vt ${u.toFixed(4)} ${v.toFixed(4)}`);
    }
    let tris = 0;
    for (const [mat, faces] of Object.entries(this.groups)) {
      lines.push(`g ${mat}`);
      lines.push(`usemtl ${mat}`);
      for (const [a, b, c] of faces) {
        lines.push(`f ${a}/${a} ${b}/${b} ${c}/${c}`);
        tris++;
      }
    }
    fs.writeFileSync(path.join(OUT_DIR, `${fileName}.obj`), lines.join('\n') + '\n');
    console.log(`✔ Generated ${fileName}.obj (${this.verts.length} verts, ${tris} tris, slots: ${Object.keys(this.groups).join(', ')})`);
  }
}

function buildValleyHalf(fileName, worldOffsetX) {
  const m = new MeshObjBuilder('PR5 Sculpted Valley Terrain');
  m.use('TerrainSurface');
  const nx = 64, ny = 96;
  const halfX = 9000, halfY = 14000;
  const grid = [];
  for (let iy = 0; iy <= ny; iy++) {
    const row = [];
    const ty = iy / ny;
    const ly = -halfY + ty * (halfY * 2);
    for (let ix = 0; ix <= nx; ix++) {
      const tx = ix / nx;
      const lx = -halfX + tx * (halfX * 2);
      const wx = lx + worldOffsetX;
      const z = sampleValleyHeight(wx, ly);
      row.push(m.v(lx, ly, z, (wx + 18000) / 1200, (ly + 14000) / 1200));
    }
    grid.push(row);
  }
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      m.quad(grid[iy][ix], grid[iy + 1][ix], grid[iy + 1][ix + 1], grid[iy][ix + 1]);
    }
  }
  m.save(fileName);
}

function buildSupplyOutpost() {
  const m = new MeshObjBuilder('PR5 Supply Outpost');
  m.use('Stone');
  m.box(0, 0, -25, 620, 620, 55, 0.96);
  m.box(-90, 0, 30, 260, 300, 45, 0.94);
  for (const [cx, cy] of [[-250, -250], [250, -250], [-250, 250], [250, 250]]) {
    m.prism(cx, cy, 30, 38, 30, 110, 6);
  }
  m.use('Timber');
  for (const [px, py] of [[-190, -110], [10, -110], [-190, 110], [10, 110]]) {
    m.box(px, py, 75, 28, 28, 210);
  }
  m.box(-90, 0, 285, 250, 270, 26, 0.85);
  m.box(140, -100, 30, 95, 95, 85);
  m.box(145, 10, 30, 82, 82, 72);
  m.box(140, -45, 115, 72, 72, 65);
  m.limb([110, 140, 30], [110, 140, 560], 11, 8, 8);
  m.use('Gold');
  m.prism(110, 140, 560, 18, 2, 42, 6);
  m.use('BannerCloth');
  m.box(165, 140, 415, 95, 10, 135);
  m.use('Stone');
  m.prism(-90, 0, 311, 185, 18, 125, 4);
  m.save('SM_SupplyOutpost');
}

function buildForwardBastion() {
  const m = new MeshObjBuilder('PR5 Forward Bastion');
  m.use('Stone');
  m.box(0, 0, -30, 780, 780, 65, 0.95);
  m.box(0, 0, 35, 580, 580, 340, 0.93);
  for (const [cx, cy] of [[-260, -260], [260, -260], [-260, 260], [260, 260]]) {
    m.prism(cx, cy, 35, 115, 96, 460, 8);
    m.box(cx, cy, 495, 175, 175, 45);
  }
  for (let i = -200; i <= 200; i += 100) {
    m.box(i, -270, 375, 55, 45, 75);
    m.box(i, 270, 375, 55, 45, 75);
    m.box(-270, i, 375, 45, 55, 75);
    m.box(270, i, 375, 45, 55, 75);
  }
  m.use('Timber');
  m.box(0, 0, 365, 520, 520, 20);
  m.use('ArmorSteel');
  m.box(292, 0, 35, 22, 165, 210);
  m.use('EmberGlow');
  m.prism(295, -135, 285, 26, 36, 48, 6);
  m.prism(295, 135, 285, 26, 36, 48, 6);
  m.use('BannerCloth');
  m.box(0, 0, 535, 18, 120, 170);
  m.use('Gold');
  m.limb([0, 0, 385], [0, 0, 740], 10, 7, 8);
  m.save('SM_ForwardBastion');
}

function buildSkyboltBallista() {
  const m = new MeshObjBuilder('PR5 Skybolt Anti-Air Ballista');
  m.use('Stone');
  m.prism(0, 0, 0, 95, 80, 42, 8);
  m.use('Timber');
  m.box(0, 0, 42, 120, 92, 34);
  m.limb([0, 0, 68], [150, 0, 148], 14, 11, 8);
  m.limb([55, -110, 96], [55, 110, 96], 10, 10, 8);
  m.use('ArmorSteel');
  m.limb([55, -95, 96], [28, -195, 122], 12, 5, 8);
  m.limb([55, 95, 96], [28, 195, 122], 12, 5, 8);
  m.limb([-12, 0, 62], [28, -195, 122], 2.5, 2.5, 6);
  m.limb([-12, 0, 62], [28, 195, 122], 2.5, 2.5, 6);
  m.limb([-15, 0, 78], [195, 0, 186], 5, 4.5, 8);
  m.use('Gold');
  m.limb([195, 0, 186], [228, 0, 204], 11, 1, 6);
  m.save('SM_SkyboltBallista');
}

function buildGrassClump() {
  const m = new MeshObjBuilder('PR5 Meadow Grass Clump');
  m.use('foliage');
  const blades = [
    { x: 0, y: 0, yaw: 0.2, lean: 24, h: 72, w: 12 },
    { x: 18, y: -12, yaw: 1.3, lean: 28, h: 64, w: 10 },
    { x: -16, y: 14, yaw: 2.5, lean: 22, h: 68, w: 11 },
    { x: 14, y: 19, yaw: 3.7, lean: 30, h: 58, w: 10 },
    { x: -20, y: -15, yaw: 4.9, lean: 25, h: 62, w: 10 },
    { x: 4, y: -22, yaw: 5.7, lean: 20, h: 52, w: 9 },
  ];
  for (const b of blades) {
    const cy = Math.cos(b.yaw), sy = Math.sin(b.yaw);
    const rx = -sy, ry = cy;
    const hw = b.w * 0.5;
    const p0L = m.v(b.x - rx * hw, b.y - ry * hw, 0, 0, 0);
    const p0R = m.v(b.x + rx * hw, b.y + ry * hw, 0, 1, 0);
    const midX = b.x + cy * (b.lean * 0.45), midY = b.y + sy * (b.lean * 0.45);
    const p1L = m.v(midX - rx * (hw * 0.65), midY - ry * (hw * 0.65), b.h * 0.55, 0.15, 0.55);
    const p1R = m.v(midX + rx * (hw * 0.65), midY + ry * (hw * 0.65), b.h * 0.55, 0.85, 0.55);
    const tip = m.v(b.x + cy * b.lean, b.y + sy * b.lean, b.h, 0.5, 1.0);
    m.quad(p0L, p0R, p1R, p1L);
    m.quad(p0R, p0L, p1L, p1R);
    m.tri(p1L, p1R, tip);
    m.tri(p1R, p1L, tip);
  }
  m.save('SM_GrassClump');
}

buildValleyHalf('SM_SculptedValley_West', -9000);
buildValleyHalf('SM_SculptedValley_East', 9000);
buildSupplyOutpost();
buildForwardBastion();
buildSkyboltBallista();
buildGrassClump();
