/**
 * PR #4 — High-Detail Multi-Material Sculpted Medieval Characters & Siege Engines
 * Replaces crude low-poly placeholder cubes with sculpted anatomical silhouettes,
 * layered armor pauldrons, plumed helmets, flowing capes, kite shields, curved longbows,
 * barded warhorses, sweeping bat-winged dragons, and authentic torsion siege catapults.
 *
 * Outputs into assets_3d/:
 *   SM_UnitKnight_HD.obj, SM_UnitArcher_HD.obj, SM_UnitHalberdier_HD.obj,
 *   SM_MythicGiant_HD.obj, SM_UnitDragon_HD.obj, SM_SiegeCatapult_HD.obj
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets_3d');

class CharacterBuilder {
  constructor() {
    this.verts = [];
    this.uvs = [];
    this.groups = {};
    this.mat = 'ArmorSteel';
  }
  use(m) { this.mat = m; if (!this.groups[m]) this.groups[m] = []; }
  v(x, y, z, u = 0, v = 0) {
    this.verts.push([x, y, z]);
    this.uvs.push([u, v]);
    return this.verts.length;
  }
  tri(a, b, c) { this.groups[this.mat].push([a, b, c]); }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }

  // Tapered limb / tube along arbitrary 3D segment p0 -> p1 with rounded cross-section
  limb(p0, p1, r0, r1, segs = 10) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    const ax = dx / len, ay = dy / len, az = dz / len;
    // Build orthonormal basis (u, w) perpendicular to axis
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
      this.quad(ring0[i], ring0[ni], ring1[ni], ring1[i]);
      this.tri(ring0[ni], ring0[i], c0);
      this.tri(ring1[i], ring1[ni], c1);
    }
  }

  // Smooth sculpted ellipsoid (helmets, pauldrons, torsos, skulls, dragon body segments)
  ellipsoid(cx, cy, cz, rx, ry, rz, rings = 6, segs = 12) {
    const grid = [];
    for (let r = 0; r <= rings; r++) {
      const phi = (r / rings) * Math.PI;
      const row = [];
      for (let s = 0; s < segs; s++) {
        const theta = (s / segs) * Math.PI * 2;
        const x = cx + Math.sin(phi) * Math.cos(theta) * rx;
        const y = cy + Math.sin(phi) * Math.sin(theta) * ry;
        const z = cz + Math.cos(phi) * rz;
        row.push(this.v(x, y, z, s / segs, r / rings));
      }
      grid.push(row);
    }
    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segs; s++) {
        const ns = (s + 1) % segs;
        this.quad(grid[r][s], grid[r][ns], grid[r + 1][ns], grid[r + 1][s]);
      }
    }
  }

  // Oriented box for shields, blades, cloaks, catapult beams
  box(cx, cy, cz, sx, sy, sz, pitch = 0, yaw = 0) {
    const hx = sx * 0.5, hy = sy * 0.5, hz = sz * 0.5;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const pts = [
      [-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
      [-hx, -hy,  hz], [hx, -hy,  hz], [hx, hy,  hz], [-hx, hy,  hz],
    ].map(([x, y, z]) => {
      // Pitch around Y then Yaw around Z
      const px = x * cp + z * sp, pz = -x * sp + z * cp;
      const rx = px * cyw - y * syw + cx;
      const ry = px * syw + y * cyw + cy;
      return this.v(rx, ry, pz + cz, (rx + ry) * 0.01, (pz + cz) * 0.01);
    });
    this.quad(pts[4], pts[5], pts[6], pts[7]);
    this.quad(pts[3], pts[2], pts[1], pts[0]);
    this.quad(pts[0], pts[1], pts[5], pts[4]);
    this.quad(pts[2], pts[3], pts[7], pts[6]);
    this.quad(pts[1], pts[2], pts[6], pts[5]);
    this.quad(pts[3], pts[0], pts[4], pts[7]);
  }

  // Kite shield curved profile
  kiteShield(cx, cy, cz, h = 68, w = 44, thick = 6) {
    const top = this.v(cx, cy, cz + h * 0.45, 0.5, 0);
    const tl  = this.v(cx + 4, cy - w * 0.5, cz + h * 0.35, 0, 0.15);
    const tr  = this.v(cx + 4, cy + w * 0.5, cz + h * 0.35, 1, 0.15);
    const ml  = this.v(cx + 6, cy - w * 0.44, cz, 0.05, 0.5);
    const mr  = this.v(cx + 6, cy + w * 0.44, cz, 0.95, 0.5);
    const bot = this.v(cx + 2, cy, cz - h * 0.55, 0.5, 1);
    const mid = this.v(cx + thick + 5, cy, cz + h * 0.05, 0.5, 0.45);
    // Front beveled faces
    this.tri(top, tl, mid); this.tri(top, mid, tr);
    this.tri(tl, ml, mid);  this.tri(tr, mid, mr);
    this.tri(ml, bot, mid); this.tri(mr, mid, bot);
    // Back flat faces
    const midB = this.v(cx - thick * 0.5, cy, cz + h * 0.05, 0.5, 0.45);
    this.tri(tl, top, midB); this.tri(midB, top, tr);
    this.tri(ml, tl, midB);  this.tri(midB, tr, mr);
    this.tri(bot, ml, midB); this.tri(midB, mr, bot);
  }

  // Flowing cloak / cape draped down the back
  cape(xTop, yHalf, zTop, zBot, flare = 1.6, sweepBack = -38) {
    const rows = 5;
    const grid = [];
    for (let r = 0; r <= rows; r++) {
      const t = r / rows;
      const z = zTop + (zBot - zTop) * t;
      const x = xTop + sweepBack * Math.pow(t, 1.35);
      const wy = yHalf * (1 + (flare - 1) * t);
      const row = [];
      for (let c = 0; c <= 4; c++) {
        const s = (c / 4) * 2 - 1;
        const ripple = Math.sin(s * Math.PI * 1.5) * 4.5 * t;
        row.push(this.v(x + ripple, s * wy, z, c / 4, t));
      }
      grid.push(row);
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 4; c++) {
        // Double-sided so visible from front and back
        this.quad(grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]);
        this.quad(grid[r][c + 1], grid[r][c], grid[r + 1][c], grid[r + 1][c + 1]);
      }
    }
  }

  save(name) {
    const lines = [`# ${name} — Citadel of Legends PR4 High-Detail Multi-Material Character`];
    for (const [x, y, z] of this.verts) lines.push(`v ${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`);
    for (const [u, v] of this.uvs) lines.push(`vt ${u.toFixed(4)} ${v.toFixed(4)}`);
    let tris = 0;
    let skipped = 0;
    // Positions as written (2 decimals), so the zero-area test matches what importers see
    const P = this.verts.map(([x, y, z]) => [+x.toFixed(2), +y.toFixed(2), +z.toFixed(2)]);
    const isDegenerate = (a, b, c) => {
      const [ax, ay, az] = P[a - 1], [bx, by, bz] = P[b - 1], [cx, cy, cz] = P[c - 1];
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      return nx * nx + ny * ny + nz * nz < 1e-8;
    };
    for (const [mat, faces] of Object.entries(this.groups)) {
      lines.push(`g ${mat}`);
      lines.push(`usemtl ${mat}`);
      for (const [a, b, c] of faces) {
        // Skip zero-area slivers (e.g. at the closed poles of rounded shapes)
        if (isDegenerate(a, b, c)) { skipped++; continue; }
        lines.push(`f ${a}/${a} ${b}/${b} ${c}/${c}`);
        tris++;
      }
    }
    fs.writeFileSync(path.join(OUT_DIR, `${name}.obj`), lines.join('\n') + '\n');
    console.log(`  HD ${name}.obj (${this.verts.length} verts, ${tris} tris, ${skipped} zero-area skipped, mats: ${Object.keys(this.groups).join(', ')})`);
  }
}

console.log('Generating 6 High-Detail Multi-Material Medieval Characters & Siege Engine...');

// ============================================================================
// 1. SM_UnitKnight_HD — Mounted Armored Warhorse + Plumed Greathelm Knight + Lance + Shield + Cape
// ============================================================================
{
  const m = new CharacterBuilder();
  // Warhorse body & 4 muscular legs
  m.use('Leather');
  m.ellipsoid(0, 0, 96, 68, 28, 30, 7, 12);          // horse barrel torso
  m.limb([44, 0, 108], [76, 0, 152], 21, 13, 10);    // arched muscular neck
  m.ellipsoid(84, 0, 154, 20, 11, 12, 5, 10);        // horse head/snout
  m.limb([76, -8, 162], [79, -9, 174], 4, 1.5, 6);   // left ear
  m.limb([76,  8, 162], [79,  9, 174], 4, 1.5, 6);   // right ear
  // 4 articulated legs with hooves
  for (const [lx, ly, kneeX] of [[42, -18, 48], [42, 18, 44], [-44, -18, -50], [-44, 18, -46]]) {
    m.limb([lx, ly, 82], [kneeX, ly, 42], 11, 7.5, 8);
    m.limb([kneeX, ly, 42], [lx + 4, ly, 0], 7.5, 6.5, 8);
  }
  m.limb([-62, 0, 98], [-86, 0, 46], 9, 4, 8);       // flowing horse tail

  // Royal horse barding caparison + knight surcoat + cape + lance pennon (FactionTrim = slot 0!)
  m.use('FactionTrim');
  m.cape(-18, 28, 186, 98, 1.7, -42);                // Knight flowing royal cape
  m.box(58, 0, 82, 34, 60, 44, -0.2, 0);             // Front horse caparison cloth
  m.box(-48, 0, 82, 42, 60, 46, 0.15, 0);            // Rear horse barding drape
  m.kiteShield(24, -36, 156, 62, 40, 6);             // Heraldic kite shield
  m.box(170, 32, 158, 52, 4, 24, 0, 0);              // Tournament lance pennon banner
  m.ellipsoid(-2, 0, 224, 16, 6, 12, 4, 8);          // Helmet crest plume

  // Full Plate-Armored Rider (burnished steel)
  m.use('ArmorSteel');
  m.ellipsoid(0, 0, 166, 22, 24, 30, 6, 12);         // Plate cuirass breastplate
  m.ellipsoid(2, -26, 186, 13, 14, 13, 5, 10);       // Left pauldron
  m.ellipsoid(2,  26, 186, 13, 14, 13, 5, 10);       // Right pauldron
  m.ellipsoid(2, 0, 206, 15, 14, 17, 6, 12);         // Visored Greathelm
  m.box(16, 0, 204, 10, 14, 12, 0, 0);               // Pointed houndskull visor
  m.limb([2, -26, 180], [20, -32, 154], 9, 7, 8);    // Left shield arm
  m.limb([2,  26, 180], [26,  30, 154], 9, 7, 8);    // Right lance arm
  m.limb([-2, -22, 136], [10, -28, 86], 10, 7, 8);   // Left armored leg in stirrup
  m.limb([-2,  22, 136], [10,  28, 86], 10, 7, 8);   // Right armored leg in stirrup
  m.ellipsoid(86, 0, 158, 17, 10, 9, 4, 8);          // Horse steel chamfron face armor
  m.limb([185, 32, 166], [230, 32, 168], 7, 1.5, 8); // Steel lance tip

  m.use('Timber');
  m.limb([-28, 32, 150], [186, 32, 166], 6, 4.5, 8); // Long tournament lance shaft
  m.save('SM_UnitKnight_HD');
}

// ============================================================================
// 2. SM_UnitArcher_HD — Hooded Royal Marksman + Curved English Longbow + Arrow Quiver + Cloak
// ============================================================================
{
  const m = new CharacterBuilder();
  m.use('FactionTrim');
  m.ellipsoid(0, 0, 114, 18, 22, 28, 6, 10);         // Tunic & ranger torso
  m.ellipsoid(0, 0, 154, 16, 15, 17, 6, 10);         // Sculpted medieval hood
  m.cape(-14, 22, 146, 36, 1.55, -26);               // Ranger cloak

  m.use('Leather');
  m.limb([0, -11, 88], [6, -13, 44], 10, 8, 8);      // Left thigh
  m.limb([6, -13, 44], [2, -13, 0], 8, 7, 8);        // Left boot
  m.limb([0,  11, 88], [-6, 13, 44], 10, 8, 8);      // Right thigh
  m.limb([-6, 13, 44], [-8, 13, 0], 8, 7, 8);        // Right boot
  m.limb([0, -22, 132], [38, -10, 132], 7.5, 6, 8);  // Extended bow arm
  m.limb([0,  22, 132], [18,  10, 132], 7.5, 6, 8);  // Drawing string arm
  m.limb([-18, 14, 96], [-24, -10, 152], 9, 8, 8);   // Back quiver full of arrows

  m.use('ArmorSteel');
  m.ellipsoid(0, -23, 134, 10, 10, 10, 4, 8);        // Light shoulder guard
  m.box(0, 0, 88, 34, 42, 10);                       // Leather/iron waist belt
  m.limb([52, 0, 132], [68, 0, 132], 3, 0.8, 6);     // Steel broadhead arrowhead

  m.use('Timber');
  // Curved English Longbow (4 smooth segments forming classic D-bow arc)
  m.limb([36, -8, 198], [48, -8, 164], 3.5, 4.5, 7);
  m.limb([48, -8, 164], [48, -8, 100], 4.5, 4.5, 7);
  m.limb([48, -8, 100], [36, -8,  66], 4.5, 3.5, 7);
  m.limb([16,  4, 132], [54, -4, 132], 2.2, 2.0, 6); // Nocked arrow shaft
  // Fletched arrows poking out of quiver
  for (const dy of [-5, 0, 5]) {
    m.limb([-23, -10 + dy, 150], [-27, -14 + dy, 168], 2, 1.5, 5);
  }
  m.save('SM_UnitArcher_HD');
}

// ============================================================================
// 3. SM_UnitHalberdier_HD — Heavy Vanguard Polearm Footman + Sallet Helm + Halberd + Tabard
// ============================================================================
{
  const m = new CharacterBuilder();
  m.use('FactionTrim');
  m.box(0, 0, 96, 36, 44, 52);                       // Heraldic surcoat tabard
  m.cape(-16, 24, 142, 34, 1.5, -24);                // Short armored half-cape
  m.ellipsoid(0, 0, 174, 12, 5, 10, 4, 8);           // Helmet crest

  m.use('ArmorSteel');
  m.ellipsoid(0, 0, 124, 22, 26, 30, 6, 12);         // Heavy steel breastplate
  m.ellipsoid(0, -28, 142, 14, 14, 14, 5, 10);       // Left pauldron
  m.ellipsoid(0,  28, 142, 14, 14, 14, 5, 10);       // Right pauldron
  m.ellipsoid(0, 0, 160, 16, 15, 16, 6, 10);         // Kettle/Sallet helm
  m.limb([0, 0, 155], [0, 0, 159], 24, 18, 12);      // Wide flared kettle-helm brim!
  // Armored legs & greaves
  m.limb([0, -12, 82], [6, -13, 42], 11, 9, 8);
  m.limb([6, -13, 42], [4, -13, 0], 9, 8, 8);
  m.limb([0,  12, 82], [-4, 13, 42], 11, 9, 8);
  m.limb([-4, 13, 42], [-6, 13, 0], 9, 8, 8);
  // Gauntleted arms gripping tall halberd
  m.limb([0, -26, 136], [24, -10, 114], 9, 7, 8);
  m.limb([0,  26, 136], [26,  14, 134], 9, 7, 8);
  // Iconic Halberd Steel Head (crescent axe blade + tall spear pike + rear armor hook)
  m.limb([28, 10, 212], [28, 10, 264], 5.5, 1.0, 8); // Top spear spike
  m.box(46, 10, 210, 34, 5, 42, 0.15, 0);            // Sweeping crescent axe blade
  m.box(12, 10, 214, 22, 5, 10, -0.3, 0);            // Rear armor-piercing beak

  m.use('Timber');
  m.limb([24, 10, 14], [28, 10, 216], 5.0, 4.8, 8);  // Heavy ashwood polearm shaft
  m.save('SM_UnitHalberdier_HD');
}

// ============================================================================
// 4. SM_MythicGiant_HD — Towering Armored Frost/Mountain Colossus + Jagged Monolith Hammer
// ============================================================================
{
  const m = new CharacterBuilder();
  m.use('FactionTrim');
  // Massive hulking frost-stone torso, bearded horned head, gigantic limbs
  m.ellipsoid(0, 0, 190, 52, 64, 62, 7, 12);         // Hulking colossus chest
  m.ellipsoid(8, 0, 258, 30, 28, 32, 6, 10);         // Giant head
  m.ellipsoid(20, 0, 238, 18, 22, 22, 5, 8);         // Thick braided war-beard
  m.limb([0, -32, 122], [8, -34, 62], 24, 20, 10);   // Left massive leg
  m.limb([8, -34, 62], [4, -34, 0], 21, 24, 10);
  m.limb([0,  32, 122], [-6, 34, 62], 24, 20, 10);   // Right massive leg
  m.limb([-6, 34, 62], [-8, 34, 0], 21, 24, 10);
  m.limb([0, -68, 224], [18, -76, 140], 22, 18, 9);  // Left giant arm
  m.limb([0,  68, 224], [46,  62, 154], 22, 18, 9);  // Right weapon arm

  m.use('Basalt');
  // Jagged crystal/stone shoulder plates & colossal monolith war-hammer head
  m.ellipsoid(0, -66, 232, 28, 32, 28, 5, 8);
  m.ellipsoid(0,  66, 232, 28, 32, 28, 5, 8);
  m.limb([-12, -62, 248], [-24, -84, 294], 12, 2, 6);// Shoulder horn spike L
  m.limb([-12,  62, 248], [-24,  84, 294], 12, 2, 6);// Shoulder horn spike R
  m.box(74, 58, 248, 72, 46, 56, 0.25, 0);           // Monolith stone war-hammer head!

  m.use('ArmorSteel');
  m.box(0, 0, 134, 88, 110, 34);                     // Iron-banded war belt & loin armor
  m.limb([12, -20, 278], [18, -36, 304], 7, 1.5, 6); // Helmet horn L
  m.limb([12,  20, 278], [18,  36, 304], 7, 1.5, 6); // Helmet horn R
  m.limb([40,  58, 70], [74,  58, 240], 11, 10, 8);  // Iron-shod hammer haft
  m.save('SM_MythicGiant_HD');
}

// ============================================================================
// 5. SM_UnitDragon_HD — Sweeping Mythic Winged War-Dragon (420-UU Wingspan + Horns + Tail!)
// ============================================================================
{
  const m = new CharacterBuilder();
  m.use('FactionTrim'); // Dragon armored scales
  // S-curved serpentine body & tail
  m.ellipsoid(15, 0, 155, 64, 34, 34, 7, 12);        // Muscular chest/thorax
  m.ellipsoid(-45, 0, 146, 44, 26, 24, 6, 10);       // Hindquarters
  // Sweeping tapering tail segments
  m.limb([-76, 0, 142], [-145,  14, 126], 20, 12, 9);
  m.limb([-145, 14, 126], [-218, -10, 118], 12, 6, 8);
  m.limb([-218, -10, 118], [-272, 6, 132], 6, 1.5, 7);
  // Proud arched neck & sculpted dragon skull/snout
  m.limb([62, 0, 168], [116, 0, 212], 22, 16, 10);
  m.limb([116, 0, 212], [156, 0, 224], 17, 14, 10);
  m.ellipsoid(176, 0, 222, 32, 16, 15, 6, 10);       // Upper skull & snout
  m.box(174, 0, 206, 42, 22, 10, 0.18, 0);           // Snarling lower jaw
  // Clawed forelimbs & hindlegs tucked for flight
  for (const s of [-1, 1]) {
    m.limb([42, s * 28, 134], [58, s * 40, 86], 13, 8, 8);
    m.limb([-44, s * 24, 132], [-60, s * 36, 84], 14, 9, 8);
    // Wing primary bones (swept dramatic dragon wings!)
    m.limb([30, s * 28, 174], [24, s * 118, 248], 11, 7, 8);    // Shoulder -> wing elbow
    m.limb([24, s * 118, 248], [-12, s * 230, 272], 7, 3.5, 8); // Elbow -> outer wingtip
    m.limb([24, s * 118, 248], [-68, s * 184, 218], 5, 2, 6);   // Wing finger rib 2
    m.limb([24, s * 118, 248], [-82, s * 116, 186], 5, 2, 6);   // Wing finger rib 3
  }
  // Dorsal spine ridge spikes
  for (let k = 0; k < 6; k++) {
    const sx = 95 - k * 34, sz = 205 - k * 11;
    m.limb([sx, 0, sz], [sx - 14, 0, sz + 26], 6, 1, 5);
  }

  // Sweeping Bat-Like Wing Membranes (double-sided!)
  m.use('Leather');
  for (const s of [-1, 1]) {
    const sh  = m.v(30, s * 28, 174, 0, 0.5);
    const elb = m.v(24, s * 118, 248, 0.5, 0);
    const tip = m.v(-12, s * 230, 272, 1, 0);
    const f2  = m.v(-68, s * 184, 218, 0.85, 0.85);
    const f3  = m.v(-82, s * 116, 186, 0.45, 0.95);
    const hip = m.v(-56, s * 26, 148, 0, 1);
    for (const [a, b, c] of [[sh, elb, f3], [sh, f3, hip], [elb, tip, f2], [elb, f2, f3]]) {
      m.tri(a, b, c); m.tri(a, c, b);
    }
  }

  // Swept Curved Dragon Horns & Glowing Eyes!
  m.use('EmberGlow');
  for (const s of [-1, 1]) {
    m.limb([150, s * 12, 232], [108, s * 28, 266], 6.5, 1.2, 7); // Crown horns
    m.ellipsoid(182, s * 13, 228, 5, 4, 4, 4, 6);                // Glowing dragon eyes
  }
  m.save('SM_UnitDragon_HD');
}

// ============================================================================
// 6. SM_SiegeCatapult_HD — Authentic Medieval Onager Siege Engine + 4 Iron Wheels + Stone Payload
// ============================================================================
{
  const m = new CharacterBuilder();
  m.use('Timber');
  // Heavy mortised oak chassis beams
  m.box(0, -48, 36, 176, 20, 24);
  m.box(0,  48, 36, 176, 20, 24);
  m.box(-72, 0, 36, 24, 118, 24);
  m.box( 72, 0, 36, 24, 118, 24);
  // Tall A-frame uprights & padded crossbeam stop
  m.limb([36, -48, 44], [24, -48, 128], 11, 10, 7);
  m.limb([36,  48, 44], [24,  48, 128], 11, 10, 7);
  m.limb([-18, -48, 44], [24, -48, 128], 9, 8, 7);
  m.limb([-18,  48, 44], [24,  48, 128], 9, 8, 7);
  m.box(24, 0, 124, 24, 118, 24);
  // Swept heavy throwing arm
  m.limb([12, 0, 44], [-86, 0, 138], 10, 8, 8);
  m.box(-94, 0, 144, 34, 34, 14, -0.5, 0); // Throwing cup cradle

  m.use('ArmorSteel');
  // 4 Heavy iron-rimmed war wheels with axle hubs
  for (const [wx, wy] of [[-58, -64], [-58, 64], [58, -64], [58, 64]]) {
    m.limb([wx, wy - 7, 30], [wx, wy + 7, 30], 30, 30, 14);
  }
  m.limb([12, -56, 44], [12, 56, 44], 12, 12, 10);   // Twisted torsion rope axle
  m.limb([-72, -54, 48], [-72, 54, 48], 8, 8, 8);    // Rear winch roller

  m.use('Stone');
  m.ellipsoid(-92, 0, 158, 20, 20, 20, 6, 10);       // Loaded siege stone boulder!
  m.save('SM_SiegeCatapult_HD');
}

console.log('All 6 PR #4 High-Detail Multi-Material Characters complete!');
