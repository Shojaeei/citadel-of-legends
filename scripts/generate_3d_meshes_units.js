/**
 * Citadel of Legends: Shattered Realms — Procedural Z-Up 3D Unit & Projectile Mesh Generator
 * Uses mathematically verified outward-facing winding (v1-v0) x (v2-v0) . normal > 0 in OBJ space.
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets_3d');
fs.mkdirSync(OUT_DIR, { recursive: true });

class UnitMeshBuilder {
  constructor(name) {
    this.name = name;
    this.verts = [];
    this.norms = [];
    this.uvs = [];
    this.groups = {};
  }

  _pushV(x, y, z) { this.verts.push([x, -y, z]); return this.verts.length; }
  _pushN(nx, ny, nz) {
    const l = Math.hypot(nx, ny, nz) || 1;
    this.norms.push([nx / l, -ny / l, nz / l]);
    return this.norms.length;
  }
  _pushUV(u, v) { this.uvs.push([u, v]); return this.uvs.length; }

  _pushTri(mat, p0, p1, p2) {
    if (!this.groups[mat]) this.groups[mat] = [];
    const a = this.verts[p0[0] - 1], b = this.verts[p1[0] - 1], c = this.verts[p2[0] - 1];
    const n = this.norms[p0[2] - 1];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const dot = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2];
    this.groups[mat].push(dot < 0 ? [p0, p2, p1] : [p0, p1, p2]);
  }

  _addFace(mat, quad) {
    if (quad.length === 3) this._pushTri(mat, quad[0], quad[1], quad[2]);
    else {
      this._pushTri(mat, quad[0], quad[1], quad[2]);
      this._pushTri(mat, quad[0], quad[2], quad[3]);
    }
  }

  addBox(mat, x0, x1, y0, y1, z0, z1, rotZDeg = 0, px = 0, py = 0) {
    const r = (rotZDeg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
    const xf = (x, y, z) => rotZDeg === 0 ? [x, y, z] : [px + (x - px) * c - (y - py) * s, py + (x - px) * s + (y - py) * c, z];
    const nf = (nx, ny, nz) => rotZDeg === 0 ? [nx, ny, nz] : [nx * c - ny * s, nx * s + ny * c, nz];
    const pts = [
      xf(x0, y0, z0), xf(x1, y0, z0), xf(x1, y1, z0), xf(x0, y1, z0),
      xf(x0, y0, z1), xf(x1, y0, z1), xf(x1, y1, z1), xf(x0, y1, z1),
    ].map(p => this._pushV(p[0], p[1], p[2]));
    const faces = [
      { idx: [0, 3, 2, 1], n: nf(0, 0, -1) },
      { idx: [4, 5, 6, 7], n: nf(0, 0, 1) },
      { idx: [0, 1, 5, 4], n: nf(0, -1, 0) },
      { idx: [2, 3, 7, 6], n: nf(0, 1, 0) },
      { idx: [1, 2, 6, 5], n: nf(1, 0, 0) },
      { idx: [3, 0, 4, 7], n: nf(-1, 0, 0) },
    ];
    for (const f of faces) {
      const ni = this._pushN(f.n[0], f.n[1], f.n[2]);
      const u0 = this._pushUV(0, 0), u1 = this._pushUV(1, 0), u2 = this._pushUV(1, 1), u3 = this._pushUV(0, 1);
      this._addFace(mat, [[pts[f.idx[0]], u0, ni], [pts[f.idx[1]], u1, ni], [pts[f.idx[2]], u2, ni], [pts[f.idx[3]], u3, ni]]);
    }
  }

  addPrism(mat, cx, cy, z0, z1, rbx, rby, rtx, rty, sides = 8, startDeg = 0) {
    const sr = (startDeg * Math.PI) / 180;
    const bot = [], top = [];
    for (let i = 0; i < sides; i++) {
      const a = sr + (i / sides) * Math.PI * 2;
      bot.push(this._pushV(cx + rbx * Math.cos(a), cy + rby * Math.sin(a), z0));
      top.push(this._pushV(cx + rtx * Math.cos(a), cy + rty * Math.sin(a), z1));
    }
    const uv = this._pushUV(0.5, 0.5);
    const nb = this._pushN(0, 0, -1), vb = this._pushV(cx, cy, z0);
    for (let i = 0; i < sides; i++) this._addFace(mat, [[vb, uv, nb], [bot[(i + 1) % sides], uv, nb], [bot[i], uv, nb]]);
    if (rtx > 0.5 || rty > 0.5) {
      const nt = this._pushN(0, 0, 1), vt = this._pushV(cx, cy, z1);
      for (let i = 0; i < sides; i++) this._addFace(mat, [[vt, uv, nt], [top[i], uv, nt], [top[(i + 1) % sides], uv, nt]]);
    }
    const h = z1 - z0 || 1;
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides;
      const ma = sr + ((i + 0.5) / sides) * Math.PI * 2;
      const ni = this._pushN(Math.cos(ma), Math.sin(ma), (rbx - rtx) / h);
      this._addFace(mat, [[bot[i], uv, ni], [bot[next], uv, ni], [top[next], uv, ni], [top[i], uv, ni]]);
    }
  }

  addRing(mat, cx, cy, z0, z1, rIn, rOut, sides = 24) {
    const uv = this._pushUV(0.5, 0.5);
    const bIn = [], bOut = [], tIn = [], tOut = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const cs = Math.cos(a), sn = Math.sin(a);
      bIn.push(this._pushV(cx + rIn * cs, cy + rIn * sn, z0));
      bOut.push(this._pushV(cx + rOut * cs, cy + rOut * sn, z0));
      tIn.push(this._pushV(cx + rIn * cs, cy + rIn * sn, z1));
      tOut.push(this._pushV(cx + rOut * cs, cy + rOut * sn, z1));
    }
    const nUp = this._pushN(0, 0, 1), nDn = this._pushN(0, 0, -1);
    for (let i = 0; i < sides; i++) {
      const nx = (i + 1) % sides;
      const a = ((i + 0.5) / sides) * Math.PI * 2;
      const nO = this._pushN(Math.cos(a), Math.sin(a), 0);
      const nI = this._pushN(-Math.cos(a), -Math.sin(a), 0);
      this._addFace(mat, [[tIn[i], uv, nUp], [tOut[i], uv, nUp], [tOut[nx], uv, nUp], [tIn[nx], uv, nUp]]);
      this._addFace(mat, [[bOut[i], uv, nDn], [bIn[i], uv, nDn], [bIn[nx], uv, nDn], [bOut[nx], uv, nDn]]);
      this._addFace(mat, [[bOut[i], uv, nO], [bOut[nx], uv, nO], [tOut[nx], uv, nO], [tOut[i], uv, nO]]);
      this._addFace(mat, [[bIn[nx], uv, nI], [bIn[i], uv, nI], [tIn[i], uv, nI], [tIn[nx], uv, nI]]);
    }
  }

  save(filename) {
    const lines = [`# Citadel Unit: ${this.name}`, `mtllib citadel_buildings.mtl`, `o ${this.name}`];
    for (const v of this.verts) lines.push(`v ${v[0].toFixed(2)} ${v[1].toFixed(2)} ${v[2].toFixed(2)}`);
    for (const t of this.uvs) lines.push(`vt ${t[0].toFixed(4)} ${t[1].toFixed(4)}`);
    for (const n of this.norms) lines.push(`vn ${n[0].toFixed(4)} ${n[1].toFixed(4)} ${n[2].toFixed(4)}`);
    for (const [mat, faces] of Object.entries(this.groups)) {
      lines.push(`g ${this.name}_${mat}`, `usemtl ${mat}`);
      for (const f of faces) lines.push(`f ${f.map(p => `${p[0]}/${p[1]}/${p[2]}`).join(' ')}`);
    }
    const fp = path.join(OUT_DIR, `${filename}.obj`);
    fs.writeFileSync(fp, lines.join('\n'));
    return fp;
  }
}

// 1. SM_UnitKnight (Armored Sword & Shield Champion facing +X)
{
  const m = new UnitMeshBuilder('SM_UnitKnight');
  m.addPrism('slate', 0, -18, 0, 82, 16, 16, 15, 15, 8);
  m.addPrism('slate', 0, 18, 0, 82, 16, 16, 15, 15, 8);
  m.addBox('slate', -24, 24, -36, 36, 82, 158);
  m.addBox('gold', -26, 26, -38, 38, 130, 146); // gold belt/trim
  // Broad shoulder pauldrons & crimson cape
  m.addBox('gold', -26, 26, -54, -32, 132, 168);
  m.addBox('gold', -26, 26, 32, 54, 132, 168);
  m.addBox('crimson', -36, -24, -30, 30, 32, 152);
  // Greathelm + golden plume
  m.addPrism('stone', 0, 0, 158, 204, 24, 24, 20, 20, 8);
  m.addBox('crimson', -14, 10, -5, 5, 204, 232);
  // Heater shield (left/+Y) & Greatsword (right/-Y pointing +X)
  m.addBox('gold', 24, 34, 24, 62, 76, 146);
  m.addBox('timber', 14, 38, -56, -42, 106, 118);
  m.addBox('stone', 38, 128, -53, -45, 104, 118);
  m.save('SM_UnitKnight');
}

// 2. SM_UnitArcher (Hooded Marksman with Recurve Bow facing +X)
{
  const m = new UnitMeshBuilder('SM_UnitArcher');
  m.addPrism('timber', 0, -14, 0, 76, 12, 12, 11, 11, 8);
  m.addPrism('timber', 0, 14, 0, 76, 12, 12, 11, 11, 8);
  m.addBox('slate', -18, 18, -28, 28, 76, 148);
  m.addBox('thatch', -28, -14, -22, 22, 92, 152); // quiver on back
  m.addPrism('gold', -20, 0, 148, 178, 8, 8, 8, 8, 6);
  m.addPrism('thatch', 0, 0, 148, 188, 22, 22, 8, 8, 8); // hooded head
  // Recurve Bow held in front (+X)
  m.addBox('timber', 32, 42, -16, 16, 108, 126);
  m.addBox('gold', 26, 36, -6, 6, 70, 178);
  m.addBox('stone', 22, 82, 2, 7, 118, 123); // nocked arrow
  m.save('SM_UnitArcher');
}

// 3. SM_UnitHalberdier (Polearm Infantry facing +X)
{
  const m = new UnitMeshBuilder('SM_UnitHalberdier');
  m.addPrism('slate', 0, -16, 0, 78, 14, 14, 13, 13, 8);
  m.addPrism('slate', 0, 16, 0, 78, 14, 14, 13, 13, 8);
  m.addBox('stone', -20, 20, -32, 32, 78, 152);
  m.addBox('timber', -22, 22, -46, -30, 134, 160);
  m.addBox('timber', -22, 22, 30, 46, 134, 160);
  m.addPrism('slate', 0, 0, 152, 195, 22, 22, 18, 18, 8);
  // Tall vertical Halberd polearm
  m.addBox('timber', 22, 32, -46, -36, 12, 240);
  m.addBox('stone', 24, 58, -44, -38, 195, 265); // axe blade + spear tip
  m.save('SM_UnitHalberdier');
}

// 4. SM_SiegeCatapult (Wheeled Heavy Timber Mangonel facing +X)
{
  const m = new UnitMeshBuilder('SM_SiegeCatapult');
  // Four thick timber/iron wheels touching Z=0
  for (const wx of [-95, 95]) for (const wy of [-88, 88]) {
    m.addBox('timber', wx - 36, wx + 36, wy - 12, wy + 12, 0, 72);
    m.addBox('slate', wx - 16, wx + 16, wy - 15, wy + 15, 20, 52);
  }
  // Chassis beams & uprights
  m.addBox('timber', -135, 135, -76, -54, 34, 62);
  m.addBox('timber', -135, 135, 54, 76, 34, 62);
  m.addBox('timber', -120, 120, -68, 68, 42, 60);
  m.addBox('timber', 35, 65, -72, -52, 60, 175);
  m.addBox('timber', 35, 65, 52, 72, 60, 175);
  m.addBox('timber', 32, 68, -74, 74, 158, 182);
  // Throwing arm + loaded basalt boulder
  m.addBox('timber', -145, 55, -14, 14, 105, 135);
  m.addPrism('gold', -120, 0, 125, 155, 32, 32, 24, 24, 8);
  m.addPrism('basalt', -120, 0, 140, 205, 34, 34, 28, 28, 8);
  m.save('SM_SiegeCatapult');
}

// 5. SM_MythicGiant (Towering Armored Titan ~340cm tall facing +X)
{
  const m = new UnitMeshBuilder('SM_MythicGiant');
  m.addPrism('basalt', 0, -34, 0, 128, 30, 30, 26, 26, 8);
  m.addPrism('basalt', 0, 34, 0, 128, 30, 30, 26, 26, 8);
  m.addBox('slate', -44, 44, -68, 68, 128, 260);
  m.addBox('ice', -48, 48, -96, -64, 210, 280);
  m.addBox('ice', -48, 48, 64, 96, 210, 280);
  m.addPrism('basalt', 0, 0, 260, 336, 40, 40, 30, 30, 8);
  // Massive warhammer in right hand
  m.addBox('timber', 24, 46, -92, -72, 65, 290);
  m.addBox('ice', 10, 85, -112, -52, 250, 315);
  m.save('SM_MythicGiant');
}

// 6. SM_UnitDragon (Soaring Wyrm hovering cleanly at Z=380..540 facing +X!)
{
  const m = new UnitMeshBuilder('SM_UnitDragon');
  const ZB = 420;
  m.addBox('crimson', -95, 95, -42, 42, ZB, ZB + 64);
  // Neck & armored horned skull + crest
  m.addBox('crimson', 95, 165, -24, 24, ZB + 28, ZB + 78);
  m.addBox('gold', 135, 225, -26, 26, ZB + 52, ZB + 95);
  m.addBox('gold', 110, 145, -36, -18, ZB + 95, ZB + 135);
  m.addBox('gold', 110, 145, 18, 36, ZB + 95, ZB + 135);
  // Long barbed tail
  m.addBox('crimson', -210, -95, -18, 18, ZB + 18, ZB + 46);
  m.addPrism('gold', -245, 0, ZB + 16, ZB + 46, 24, 24, 4, 4, 4, 45);
  // Swept dragon wings (+Y and -Y, 480cm span!)
  m.addBox('timber', -40, 55, 42, 240, ZB + 46, ZB + 62, 16, 0, 42);
  m.addBox('gold', -65, 35, 42, 230, ZB + 42, ZB + 54, 16, 0, 42);
  m.addBox('timber', -40, 55, -240, -42, ZB + 46, ZB + 62, -16, 0, -42);
  m.addBox('gold', -65, 35, -230, -42, ZB + 42, ZB + 54, -16, 0, -42);
  m.save('SM_UnitDragon');
}

// 7. SM_BoulderProjectile (3D Siege Rock / Firebolt Sphere)
{
  const m = new UnitMeshBuilder('SM_BoulderProjectile');
  m.addPrism('basalt', 0, 0, -28, 28, 30, 30, 26, 26, 8);
  m.addPrism('crimson', 0, 0, -20, 20, 36, 36, 20, 20, 8);
  m.save('SM_BoulderProjectile');
}

// 8. SM_SelectionRing (Flat Glowing Ground Selection Halo)
{
  const m = new UnitMeshBuilder('SM_SelectionRing');
  m.addRing('gold', 0, 0, 2, 10, 74, 96, 24);
  m.save('SM_SelectionRing');
}

console.log('Generated 8 Step 4 3D unit & combat meshes in:', OUT_DIR);
