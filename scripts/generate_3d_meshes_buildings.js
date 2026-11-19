/**
 * Citadel of Legends: Shattered Realms — Procedural Z-Up 3D Building Mesh Generator
 * Generates Stronghold-scale modular medieval & mythic 3D OBJ assets for UE 5.8 Mobile/Desktop.
 * Vertex coordinates transform (x, y, z) -> OBJ (x, -y, z) to match UE Interchange Z-up axis import.
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets_3d');
fs.mkdirSync(OUT_DIR, { recursive: true });

class MeshBuilder {
  constructor(name) {
    this.name = name;
    this.verts = [];
    this.norms = [];
    this.uvs = [];
    this.groups = {}; // matName -> array of face defs
  }

  _pushV(x, y, z) {
    this.verts.push([x, -y, z]);
    return this.verts.length;
  }

  _pushN(nx, ny, nz) {
    const len = Math.hypot(nx, ny, nz) || 1;
    this.norms.push([nx / len, -ny / len, nz / len]);
    return this.norms.length;
  }

  _pushUV(u, v) {
    this.uvs.push([u, v]);
    return this.uvs.length;
  }

  _pushTri(mat, p0, p1, p2) {
    const a = this.verts[p0[0] - 1];
    const b = this.verts[p1[0] - 1];
    const c = this.verts[p2[0] - 1];
    const n = this.norms[p0[2] - 1];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    const dot = cx * n[0] + cy * n[1] + cz * n[2];
    if (dot < 0) {
      this.groups[mat].push([p0, p2, p1]);
    } else {
      this.groups[mat].push([p0, p1, p2]);
    }
  }

  _addFace(mat, idxQuad) {
    if (!this.groups[mat]) this.groups[mat] = [];
    if (idxQuad.length === 3) {
      this._pushTri(mat, idxQuad[0], idxQuad[1], idxQuad[2]);
    } else if (idxQuad.length === 4) {
      this._pushTri(mat, idxQuad[0], idxQuad[1], idxQuad[2]);
      this._pushTri(mat, idxQuad[0], idxQuad[2], idxQuad[3]);
    }
  }

  /**
   * Add an axis-aligned or rotated box centered at (cx, cy) from z0 to z1.
   * All faces receive outward-facing normals and crisp UVs.
   */
  addBox(mat, x0, x1, y0, y1, z0, z1, rotZDeg = 0, pivotX = 0, pivotY = 0) {
    const rad = (rotZDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const xf = (x, y, z) => {
      if (rotZDeg === 0) return [x, y, z];
      const dx = x - pivotX;
      const dy = y - pivotY;
      return [pivotX + dx * cos - dy * sin, pivotY + dx * sin + dy * cos, z];
    };
    const nf = (nx, ny, nz) => {
      if (rotZDeg === 0) return [nx, ny, nz];
      return [nx * cos - ny * sin, nx * sin + ny * cos, nz];
    };

    const corners = [
      xf(x0, y0, z0), xf(x1, y0, z0), xf(x1, y1, z0), xf(x0, y1, z0), // 0..3 bottom
      xf(x0, y0, z1), xf(x1, y0, z1), xf(x1, y1, z1), xf(x0, y1, z1), // 4..7 top
    ];
    const vi = corners.map(c => this._pushV(c[0], c[1], c[2]));

    // Face winding ordered CCW looking FROM OUTSIDE in UE (X fwd, Y right, Z up)
    // Wait: OBJ (x, -y, z) is inverted handedness during input, so standard CCW in (x,-y,z) becomes CW in UE if uncorrected.
    // To produce outward CCW in (X, Y, Z), keep quad order with (b-a)x(c-a) pointing OUTSIDE in (X, -Y, Z):
    // Since y -> -y flips cross product sign, use CW order in (x, y, z) so after y->-y it becomes CCW outward!
    const faces = [
      { idx: [0, 3, 2, 1], n: nf(0, 0, -1), u: Math.abs(x1 - x0) / 200, v: Math.abs(y1 - y0) / 200 }, // bottom
      { idx: [4, 5, 6, 7], n: nf(0, 0, 1), u: Math.abs(x1 - x0) / 200, v: Math.abs(y1 - y0) / 200 },  // top
      { idx: [0, 1, 5, 4], n: nf(0, -1, 0), u: Math.abs(x1 - x0) / 200, v: Math.abs(z1 - z0) / 200 }, // -Y
      { idx: [2, 3, 7, 6], n: nf(0, 1, 0), u: Math.abs(x1 - x0) / 200, v: Math.abs(z1 - z0) / 200 },  // +Y
      { idx: [1, 2, 6, 5], n: nf(1, 0, 0), u: Math.abs(y1 - y0) / 200, v: Math.abs(z1 - z0) / 200 },  // +X
      { idx: [3, 0, 4, 7], n: nf(-1, 0, 0), u: Math.abs(y1 - y0) / 200, v: Math.abs(z1 - z0) / 200 }, // -X
    ];

    for (const f of faces) {
      const ni = this._pushN(f.n[0], f.n[1], f.n[2]);
      const u0 = this._pushUV(0, 0);
      const u1 = this._pushUV(f.u, 0);
      const u2 = this._pushUV(f.u, f.v);
      const u3 = this._pushUV(0, f.v);
      const uv = [u0, u1, u2, u3];
      this._addFace(mat, [
        [vi[f.idx[0]], uv[0], ni],
        [vi[f.idx[1]], uv[1], ni],
        [vi[f.idx[2]], uv[2], ni],
        [vi[f.idx[3]], uv[3], ni],
      ]);
    }
  }

  /**
   * Add a tapered frustum / cylinder / cone / spire with N sides centered at (cx, cy).
   */
  addPrism(mat, cx, cy, z0, z1, rBotX, rBotY, rTopX, rTopY, sides = 8, startAngleDeg = 0) {
    const startRad = (startAngleDeg * Math.PI) / 180;
    const bot = [];
    const top = [];
    for (let i = 0; i < sides; i++) {
      const a = startRad + (i / sides) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      bot.push(this._pushV(cx + rBotX * c, cy + rBotY * s, z0));
      top.push(this._pushV(cx + rTopX * c, cy + rTopY * s, z1));
    }

    // Bottom cap
    const nBot = this._pushN(0, 0, -1);
    const uvC = this._pushUV(0.5, 0.5);
    const vBotC = this._pushV(cx, cy, z0);
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides;
      this._addFace(mat, [
        [vBotC, uvC, nBot],
        [bot[next], uvC, nBot],
        [bot[i], uvC, nBot],
      ]);
    }

    // Top cap if non-zero radius
    if (rTopX > 0.5 || rTopY > 0.5) {
      const nTop = this._pushN(0, 0, 1);
      const vTopC = this._pushV(cx, cy, z1);
      for (let i = 0; i < sides; i++) {
        const next = (i + 1) % sides;
        this._addFace(mat, [
          [vTopC, uvC, nTop],
          [top[i], uvC, nTop],
          [top[next], uvC, nTop],
        ]);
      }
    }

    // Side faces
    const slopeZ = (rBotX - rTopX);
    const h = z1 - z0 || 1;
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides;
      const midA = startRad + ((i + 0.5) / sides) * Math.PI * 2;
      const ni = this._pushN(Math.cos(midA), Math.sin(midA), slopeZ / h);
      const u0 = this._pushUV(i / sides, 0);
      const u1 = this._pushUV((i + 1) / sides, 0);
      const u2 = this._pushUV((i + 1) / sides, 1);
      const u3 = this._pushUV(i / sides, 1);
      this._addFace(mat, [
        [bot[i], u0, ni],
        [bot[next], u1, ni],
        [top[next], u2, ni],
        [top[i], u3, ni],
      ]);
    }
  }

  /**
   * Add a pitched gable roof resting along X (ridge parallel to X or Y).
   */
  addGableRoof(mat, x0, x1, y0, y1, zEave, zPeak, ridgeAlongX = true) {
    const cx = (x0 + x1) * 0.5;
    const cy = (y0 + y1) * 0.5;
    const u0 = this._pushUV(0, 0);
    const u1 = this._pushUV(1, 0);
    const u2 = this._pushUV(1, 1);
    const u3 = this._pushUV(0, 1);

    if (ridgeAlongX) {
      const v00 = this._pushV(x0, y0, zEave);
      const v10 = this._pushV(x1, y0, zEave);
      const v11 = this._pushV(x1, y1, zEave);
      const v01 = this._pushV(x0, y1, zEave);
      const vr0 = this._pushV(x0, cy, zPeak);
      const vr1 = this._pushV(x1, cy, zPeak);
      const dz = zPeak - zEave;
      const dy = (y1 - y0) * 0.5;

      const nS = this._pushN(0, -dz, dy);
      const nN = this._pushN(0, dz, dy);
      const nW = this._pushN(-1, 0, 0);
      const nE = this._pushN(1, 0, 0);
      const nB = this._pushN(0, 0, -1);

      this._addFace(mat, [[v00, u0, nS], [v10, u1, nS], [vr1, u2, nS], [vr0, u3, nS]]);
      this._addFace(mat, [[v11, u0, nN], [v01, u1, nN], [vr0, u2, nN], [vr1, u3, nN]]);
      this._addFace(mat, [[v01, u0, nW], [v00, u1, nW], [vr0, u2, nW]]);
      this._addFace(mat, [[v10, u0, nE], [v11, u1, nE], [vr1, u2, nE]]);
      this._addFace(mat, [[v00, u0, nB], [v01, u1, nB], [v11, u2, nB], [v10, u3, nB]]);
    } else {
      const v00 = this._pushV(x0, y0, zEave);
      const v10 = this._pushV(x1, y0, zEave);
      const v11 = this._pushV(x1, y1, zEave);
      const v01 = this._pushV(x0, y1, zEave);
      const vr0 = this._pushV(cx, y0, zPeak);
      const vr1 = this._pushV(cx, y1, zPeak);
      const dz = zPeak - zEave;
      const dx = (x1 - x0) * 0.5;

      const nW = this._pushN(-dz, 0, dx);
      const nE = this._pushN(dz, 0, dx);
      const nS = this._pushN(0, -1, 0);
      const nN = this._pushN(0, 1, 0);
      const nB = this._pushN(0, 0, -1);

      this._addFace(mat, [[v01, u0, nW], [v00, u1, nW], [vr0, u2, nW], [vr1, u3, nW]]);
      this._addFace(mat, [[v10, u0, nE], [v11, u1, nE], [vr1, u2, nE], [vr0, u3, nE]]);
      this._addFace(mat, [[v00, u0, nS], [v10, u1, nS], [vr0, u2, nS]]);
      this._addFace(mat, [[v11, u0, nN], [v01, u1, nN], [vr1, u2, nN]]);
      this._addFace(mat, [[v00, u0, nB], [v01, u1, nB], [v11, u2, nB], [v10, u3, nB]]);
    }
  }

  save(filename) {
    const lines = [
      `# Citadel of Legends: ${this.name}`,
      `mtllib citadel_buildings.mtl`,
      `o ${this.name}`,
    ];
    for (const v of this.verts) lines.push(`v ${v[0].toFixed(2)} ${v[1].toFixed(2)} ${v[2].toFixed(2)}`);
    for (const t of this.uvs) lines.push(`vt ${t[0].toFixed(4)} ${t[1].toFixed(4)}`);
    for (const n of this.norms) lines.push(`vn ${n[0].toFixed(4)} ${n[1].toFixed(4)} ${n[2].toFixed(4)}`);
    for (const [mat, faces] of Object.entries(this.groups)) {
      lines.push(`g ${this.name}_${mat}`);
      lines.push(`usemtl ${mat}`);
      for (const f of faces) {
        lines.push(`f ${f.map(p => `${p[0]}/${p[1]}/${p[2]}`).join(' ')}`);
      }
    }
    const fp = path.join(OUT_DIR, `${filename}.obj`);
    fs.writeFileSync(fp, lines.join('\n'));
    return fp;
  }
}

// Write shared MTL for clean material slot identification
const mtl = `# Citadel Buildings MTL
newmtl stone
Kd 0.56 0.55 0.52
newmtl timber
Kd 0.34 0.21 0.12
newmtl slate
Kd 0.22 0.26 0.34
newmtl thatch
Kd 0.68 0.54 0.26
newmtl gold
Kd 0.85 0.68 0.22
newmtl basalt
Kd 0.19 0.21 0.25
newmtl ice
Kd 0.45 0.78 0.96
newmtl crimson
Kd 0.65 0.12 0.16
`;
fs.writeFileSync(path.join(OUT_DIR, 'citadel_buildings.mtl'), mtl);

// 1. SM_Hovel (1x1 tile, Peasant Cottage)
{
  const m = new MeshBuilder('SM_Hovel');
  m.addBox('stone', -155, 155, -145, 145, 0, 35);
  m.addBox('timber', -145, 145, -135, 135, 35, 195);
  // Corner timber posts & front door porch
  for (const sx of [-142, 122]) for (const sy of [-132, 112]) {
    m.addBox('timber', sx, sx + 22, sy, sy + 22, 35, 200);
  }
  m.addBox('stone', 110, 165, -45, 45, 0, 22);
  m.addBox('timber', 135, 160, -35, 35, 22, 130);
  // Steep thatched roof + stone chimney
  m.addGableRoof('thatch', -170, 170, -160, 160, 190, 330, true);
  m.addBox('stone', -115, -65, -110, -60, 190, 365);
  m.addBox('gold', 132, 152, 55, 95, 95, 140); // warm window shutter
  m.save('SM_Hovel');
}

// 2. SM_Granary (1x1 tile, Elevated Food Storehouse)
{
  const m = new MeshBuilder('SM_Granary');
  // Four corner stone piers raising wood floor above damp ground
  for (const sx of [-145, 95]) for (const sy of [-145, 95]) {
    m.addBox('stone', sx, sx + 50, sy, sy + 50, 0, 65);
  }
  m.addBox('timber', -160, 160, -160, 160, 65, 90);
  m.addBox('timber', -140, 140, -140, 140, 90, 255);
  m.addPrism('thatch', 0, 0, 255, 415, 215, 215, 14, 14, 4, 45);
  // Side grain chute / ramp & golden sacks
  m.addBox('timber', 140, 185, -55, 55, 0, 75);
  m.addPrism('gold', 155, -25, 20, 65, 22, 22, 16, 16, 6);
  m.addPrism('gold', 155, 25, 20, 65, 22, 22, 16, 16, 6);
  m.save('SM_Granary');
}

// 3. SM_Sawyer (1x1 tile, Lumber Camp & Timber Mill)
{
  const m = new MeshBuilder('SM_Sawyer');
  m.addBox('stone', -175, 175, -175, 175, 0, 20);
  // Open timber shed posts
  for (const sx of [-150, 120]) for (const sy of [-140, 110]) {
    m.addBox('timber', sx, sx + 30, sy, sy + 30, 20, 205);
  }
  m.addGableRoof('thatch', -170, 170, -160, 160, 200, 305, false);
  // Stacked pine logs beside workshop
  for (let row = 0; row < 2; row++) {
    for (let col = -1; col <= 1; col++) {
      m.addBox('timber', -145, 25, 55 + col * 36 - 14, 55 + col * 36 + 14, 20 + row * 28, 48 + row * 28);
    }
  }
  // Vertical saw frame + steel sawtooth accents
  m.addBox('timber', -60, -40, -90, 40, 20, 180);
  m.addBox('slate', -54, -46, -55, 10, 45, 155);
  m.save('SM_Sawyer');
}

// 4. SM_Quarry (1x1 tile, Basalt Stone & Crane Works)
{
  const m = new MeshBuilder('SM_Quarry');
  // Stepped quarry terrace
  m.addBox('basalt', -180, 180, -180, 180, 0, 32);
  m.addBox('stone', -160, 40, -150, 150, 32, 95);
  m.addBox('stone', -140, -20, -120, 40, 95, 155);
  // Tall timber A-frame lifting crane
  m.addBox('timber', 35, 65, -25, 5, 32, 395);
  m.addBox('timber', 35, 65, 5, 205, 290, 325);
  m.addBox('timber', 40, 60, -120, 180, 355, 385);
  // Suspended cut stone block + chain accent
  m.addBox('slate', 46, 54, 125, 133, 210, 360);
  m.addBox('stone', 15, 85, 95, 165, 130, 210);
  // Minecart track accents
  m.addBox('gold', 70, 145, -135, -75, 32, 85);
  m.save('SM_Quarry');
}

// 5. SM_Barracks (2x2 tiles, Crenellated Martial Hall)
{
  const m = new MeshBuilder('SM_Barracks');
  m.addBox('stone', -360, 360, -360, 360, 0, 45);
  // Main stone hall + raised roof
  m.addBox('stone', -310, 180, -290, 290, 45, 340);
  m.addGableRoof('slate', -325, 195, -310, 310, 340, 515, false);
  // Twin front battlement turrets facing East (+X)
  for (const ty of [-230, 230]) {
    m.addPrism('stone', 240, ty, 45, 450, 115, 115, 108, 108, 8);
    m.addPrism('slate', 240, ty, 450, 550, 122, 122, 8, 8, 8);
  }
  // Open courtyard training yard arch & weapon racks + golden crest
  m.addBox('timber', 180, 290, -110, 110, 45, 225);
  m.addBox('gold', 175, 200, -48, 48, 250, 330);
  m.addBox('gold', 240, 275, -180, 180, 45, 95);
  m.save('SM_Barracks');
}

// 6. SM_Cathedral (2x2 tiles, Solaris Holy Spire)
{
  const m = new MeshBuilder('SM_Cathedral');
  // Tiered sacred limestone plinth
  m.addBox('stone', -360, 360, -360, 360, 0, 50);
  m.addBox('stone', -320, 320, -270, 270, 50, 390);
  // Side gothic flying buttresses
  for (const bx of [-210, -70, 70, 210]) {
    for (const sy of [-315, 265]) {
      m.addBox('stone', bx - 25, bx + 25, sy, sy + 50, 50, 340);
    }
  }
  // Tall pitched slate nave roof
  m.addGableRoof('slate', -335, 335, -285, 285, 390, 620, true);
  // Twin West/East gothic bell towers + central soaring golden spire
  for (const ty of [-165, 165]) {
    m.addBox('stone', -305, -165, ty - 70, ty + 70, 50, 660);
    m.addPrism('slate', -235, ty, 660, 860, 82, 82, 6, 6, 4, 45);
  }
  // Soaring crossing spire needle (Sunburst Gold)
  m.addBox('stone', -75, 75, -75, 75, 390, 720);
  m.addPrism('gold', 0, 0, 720, 1140, 95, 95, 4, 4, 8);
  // Sunburst halo crest above doorway
  m.addPrism('gold', 315, 0, 240, 340, 55, 55, 55, 55, 8);
  m.save('SM_Cathedral');
}

// 7. SM_Runestone (2x2 tiles, Frostbound Runic Sanctum)
{
  const m = new MeshBuilder('SM_Runestone');
  // Circular terraced basalt mountain dais
  m.addPrism('basalt', 0, 0, 0, 45, 355, 355, 330, 330, 12);
  m.addPrism('stone', 0, 0, 45, 95, 280, 280, 260, 260, 10);
  // Circle of 6 monolithic carved standing stones
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const cx = Math.cos(a) * 235;
    const cy = Math.sin(a) * 235;
    m.addBox('slate', cx - 38, cx + 38, cy - 28, cy + 28, 85, 460 + (i % 2) * 80, (i * 60), cx, cy);
    m.addBox('ice', cx - 20, cx + 20, cy - 32, cy + 32, 220, 380, (i * 60), cx, cy);
  }
  // Massive central jagged glowing Frost crystal spire
  m.addPrism('ice', 0, 0, 90, 960, 125, 125, 8, 8, 6);
  m.addPrism('ice', -75, 55, 90, 580, 62, 62, 6, 6, 5);
  m.addPrism('ice', 85, -45, 90, 520, 55, 55, 6, 6, 5);
  m.save('SM_Runestone');
}

// 8. SM_Crucible (2x2 tiles, Obsidian Scourge Blood Crucible)
{
  const m = new MeshBuilder('SM_Crucible');
  m.addPrism('basalt', 0, 0, 0, 70, 360, 360, 320, 320, 8, 22.5);
  m.addPrism('basalt', 0, 0, 70, 260, 275, 275, 220, 220, 8, 22.5);
  // 4 gothic obsidian corner spires reaching like claws
  for (const ang of [45, 135, 225, 315]) {
    const rad = (ang * Math.PI) / 180;
    const sx = Math.cos(rad) * 240;
    const sy = Math.sin(rad) * 240;
    m.addBox('basalt', sx - 45, sx + 45, sy - 45, sy + 45, 70, 680, ang, sx, sy);
    m.addPrism('crimson', sx, sy, 680, 860, 55, 55, 4, 4, 4, ang);
  }
  // Central crimson altar core & blood spire
  m.addPrism('crimson', 0, 0, 260, 620, 115, 115, 150, 150, 8);
  m.addPrism('crimson', 0, 0, 620, 1040, 130, 130, 5, 5, 8);
  m.save('SM_Crucible');
}

// 9. SM_DragonRoost (2x2 tiles, Wyrm Aerie Ring)
{
  const m = new MeshBuilder('SM_DragonRoost');
  // Wide rocky volcanic plateau & stone citadel ring
  m.addPrism('basalt', 0, 0, 0, 120, 360, 360, 310, 310, 12);
  m.addPrism('stone', 0, 0, 120, 220, 290, 290, 270, 270, 12);
  // Stepped perches + 4 burning beacon pillars
  m.addPrism('basalt', 0, 0, 220, 340, 195, 195, 165, 165, 8);
  for (const [bx, by] of [[-245, -245], [245, -245], [245, 245], [-245, 245]]) {
    m.addBox('stone', bx - 42, bx + 42, by - 42, by + 42, 0, 520);
    m.addPrism('gold', bx, by, 520, 660, 52, 52, 8, 8, 6);
  }
  m.addPrism('slate', 0, 0, 340, 410, 150, 150, 110, 110, 8);
  // Central dragon roost totem arch
  m.addBox('timber', -135, -95, -25, 25, 340, 740);
  m.addBox('timber', 95, 135, -25, 25, 340, 740);
  m.addBox('gold', -145, 145, -30, 30, 720, 795);
  m.save('SM_DragonRoost');
}

console.log('Generated 9 modular 3D Stronghold building meshes in:', OUT_DIR);
