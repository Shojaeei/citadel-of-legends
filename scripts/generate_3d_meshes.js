/* ==========================================================================
   Citadel of Legends - Procedural 3D Stronghold Legends Mesh Generator (.OBJ)
   Generates multi-material stylized 3D medieval castle, biome, and siege meshes
   Native Unreal Engine Coordinates: X=Forward, Y=Right, Z=Up (1 unit = 1 cm)
   UE OBJ Importer maps OBJ (vx, vy, vz) -> UE (vx, -vy, vz).
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.resolve(__dirname, '../assets_3d');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Companion MTL file so UE creates distinct Material Slots ('stone', 'timber', 'slate', 'gold', 'foliage')
const MTL_CONTENT = `# Citadel of Legends Shared Material Slots
newmtl stone
Kd 0.55 0.52 0.46
Ks 0.05 0.05 0.05

newmtl timber
Kd 0.28 0.16 0.08
Ks 0.02 0.02 0.02

newmtl slate
Kd 0.16 0.22 0.32
Ks 0.10 0.10 0.10

newmtl gold
Kd 0.90 0.68 0.12
Ks 0.80 0.70 0.20

newmtl foliage
Kd 0.10 0.36 0.10
Ks 0.02 0.02 0.02
`;

fs.writeFileSync(path.join(OUT_DIR, 'citadel.mtl'), MTL_CONTENT);

class ObjBuilder {
    constructor(name) {
        this.name = name;
        this.vertices = [];
        this.uvs = [];
        this.faces = []; // { mat, verts: [[vi, ti], ...] }
        this.currentMat = 'stone';
    }

    setMaterial(mat) {
        this.currentMat = mat;
    }

    // Native UE Z-up coordinates: x=Forward, y=Right, z=Up
    addVertex(x, y, z) {
        // UE maps OBJ (vx, vy, vz) -> UE (vx, -vy, vz)
        this.vertices.push([Number(x.toFixed(3)), Number((-y).toFixed(3)), Number(z.toFixed(3))]);
        return this.vertices.length;
    }

    addUV(u, v) {
        this.uvs.push([Number(u.toFixed(4)), Number(v.toFixed(4))]);
        return this.uvs.length;
    }

    addQuad(p0, p1, p2, p3) {
        const i0 = this.addVertex(...p0);
        const i1 = this.addVertex(...p1);
        const i2 = this.addVertex(...p2);
        const i3 = this.addVertex(...p3);

        const t0 = this.addUV(0, 0);
        const t1 = this.addUV(1, 0);
        const t2 = this.addUV(1, 1);
        const t3 = this.addUV(0, 1);

        // Two triangles with consistent outward winding
        this.faces.push({ mat: this.currentMat, verts: [[i0, t0], [i2, t2], [i1, t1]] });
        this.faces.push({ mat: this.currentMat, verts: [[i0, t0], [i3, t3], [i2, t2]] });
    }

    addTri(p0, p1, p2) {
        const i0 = this.addVertex(...p0);
        const i1 = this.addVertex(...p1);
        const i2 = this.addVertex(...p2);
        const t0 = this.addUV(0, 0);
        const t1 = this.addUV(1, 0);
        const t2 = this.addUV(0.5, 1);
        this.faces.push({ mat: this.currentMat, verts: [[i0, t0], [i2, t2], [i1, t1]] });
    }

    // Box centered at (cx, cy), standing from z0 to z0+sz (height along UE +Z)
    addBox(cx, cy, z0, sx, sy, sz, topTaper = 1.0) {
        const hx0 = sx * 0.5;
        const hy0 = sy * 0.5;
        const hx1 = hx0 * topTaper;
        const hy1 = hy0 * topTaper;
        const z1 = z0 + sz;

        const b0 = [cx - hx0, cy - hy0, z0];
        const b1 = [cx + hx0, cy - hy0, z0];
        const b2 = [cx + hx0, cy + hy0, z0];
        const b3 = [cx - hx0, cy + hy0, z0];

        const t0 = [cx - hx1, cy - hy1, z1];
        const t1 = [cx + hx1, cy - hy1, z1];
        const t2 = [cx + hx1, cy + hy1, z1];
        const t3 = [cx - hx1, cy + hy1, z1];

        // Bottom (facing -Z)
        this.addQuad(b0, b3, b2, b1);
        // Top (facing +Z)
        this.addQuad(t0, t1, t2, t3);
        // Front (+X)
        this.addQuad(b1, b2, t2, t1);
        // Back (-X)
        this.addQuad(b3, b0, t0, t3);
        // Right (+Y)
        this.addQuad(b2, b3, t3, t2);
        // Left (-Y)
        this.addQuad(b0, b1, t1, t0);
    }

    // Pyramid Roof sitting on (cx, cy, z0) rising along +Z by sz
    addPyramidRoof(cx, cy, z0, sx, sy, sz) {
        const hx = sx * 0.5;
        const hy = sy * 0.5;
        const apex = [cx, cy, z0 + sz];
        const b0 = [cx - hx, cy - hy, z0];
        const b1 = [cx + hx, cy - hy, z0];
        const b2 = [cx + hx, cy + hy, z0];
        const b3 = [cx - hx, cy + hy, z0];

        this.addQuad(b0, b3, b2, b1);
        this.addTri(b0, b1, apex);
        this.addTri(b1, b2, apex);
        this.addTri(b2, b3, apex);
        this.addTri(b3, b0, apex);
    }

    // Prism / Cylinder / Cone centered at (cx, cy, z0), height along +Z
    addPrism(cx, cy, z0, rBottom, rTop, height, sides = 8) {
        const z1 = z0 + height;
        const bot = [];
        const top = [];
        for (let i = 0; i < sides; i++) {
            const ang = (i / sides) * Math.PI * 2;
            const c = Math.cos(ang);
            const s = Math.sin(ang);
            bot.push([cx + c * rBottom, cy + s * rBottom, z0]);
            top.push([cx + c * rTop, cy + s * rTop, z1]);
        }

        // Sides
        for (let i = 0; i < sides; i++) {
            const next = (i + 1) % sides;
            if (rTop > 0.01) {
                this.addQuad(bot[i], bot[next], top[next], top[i]);
            } else {
                this.addTri(bot[i], bot[next], [cx, cy, z1]);
            }
        }

        // Caps
        for (let i = 1; i < sides - 1; i++) {
            this.addTri(bot[0], bot[i + 1], bot[i]);
            if (rTop > 0.01) {
                this.addTri(top[0], top[i], top[i + 1]);
            }
        }
    }

    addBattlements(cx, cy, z0, sx, sy, merlonW = 60, merlonH = 70, merlonThick = 45, step = 130) {
        const hx = sx * 0.5 - merlonThick * 0.5;
        const hy = sy * 0.5 - merlonThick * 0.5;

        const countX = Math.max(2, Math.floor(sx / step));
        for (let i = 0; i <= countX; i++) {
            const xPos = cx - sx * 0.5 + (i / countX) * sx;
            this.addBox(xPos, cy + hy, z0, merlonW, merlonThick, merlonH);
            this.addBox(xPos, cy - hy, z0, merlonW, merlonThick, merlonH);
        }

        const countY = Math.max(2, Math.floor(sy / step));
        for (let i = 1; i < countY; i++) {
            const yPos = cy - sy * 0.5 + (i / countY) * sy;
            this.addBox(cx + hx, yPos, z0, merlonThick, merlonW, merlonH);
            this.addBox(cx - hx, yPos, z0, merlonThick, merlonW, merlonH);
        }
    }

    toOBJ() {
        const lines = [
            `# Citadel of Legends: ${this.name}`,
            `mtllib citadel.mtl`,
            `o ${this.name}`
        ];
        for (const [x, y, z] of this.vertices) {
            lines.push(`v ${x} ${y} ${z}`);
        }
        for (const [u, v] of this.uvs) {
            lines.push(`vt ${u} ${v}`);
        }
        let lastMat = null;
        for (const f of this.faces) {
            if (f.mat !== lastMat) {
                lines.push(`usemtl ${f.mat}`);
                lastMat = f.mat;
            }
            const fStr = f.verts.map(([vi, ti]) => `${vi}/${ti}`).join(' ');
            lines.push(`f ${fStr}`);
        }
        return lines.join('\n') + '\n';
    }
}

// 1. SM_CitadelKeep (3x3 tile footprint = ~1120x1120 cm, Height 1550 cm along +Z)
function buildKeep() {
    const b = new ObjBuilder('SM_CitadelKeep');

    b.setMaterial('stone');
    b.addBox(0, 0, 0, 1100, 1100, 120, 0.94);
    b.addBox(0, 0, 120, 880, 880, 520, 0.95);
    b.addBattlements(0, 0, 640, 850, 850, 75, 75, 55, 160);

    // 4 Corner Bastion Turrets
    const cornerOffsets = [[-440, -440], [440, -440], [440, 440], [-440, 440]];
    for (const [ox, oy] of cornerOffsets) {
        b.setMaterial('stone');
        b.addBox(ox, oy, 0, 260, 260, 760, 0.92);
        b.addBattlements(ox, oy, 760, 260, 260, 55, 65, 40, 110);
        b.setMaterial('slate');
        b.addPyramidRoof(ox, oy, 790, 220, 220, 190);
    }

    // Grand Central Donjon Spire
    b.setMaterial('stone');
    b.addBox(0, 0, 640, 480, 480, 320, 0.95);
    b.setMaterial('slate');
    b.addPyramidRoof(0, 0, 960, 540, 540, 340);

    // Grand Entrance Arch & Heavy Oak Doors (+X Front face)
    b.setMaterial('stone');
    b.addBox(460, -140, 0, 120, 100, 360);
    b.addBox(460, 140, 0, 120, 100, 360);
    b.addBox(460, 0, 360, 130, 380, 110);
    b.setMaterial('timber');
    b.addBox(435, 0, 0, 60, 200, 350);

    // Heraldic Banner Mast & Royal Gold Flag
    b.setMaterial('timber');
    b.addPrism(0, 0, 1280, 14, 10, 260, 6);
    b.setMaterial('gold');
    b.addBox(0, 75, 1420, 12, 140, 95);
    b.addBox(465, 0, 480, 40, 120, 60);

    fs.writeFileSync(path.join(OUT_DIR, 'SM_CitadelKeep.obj'), b.toOBJ());
    console.log('✔ Generated SM_CitadelKeep.obj (Z-up)');
}

// 2. SM_Watchtower (1x1 tile = 380x380 cm base, 1020 cm tall)
function buildWatchtower() {
    const b = new ObjBuilder('SM_Watchtower');
    b.setMaterial('stone');
    b.addBox(0, 0, 0, 340, 340, 120, 0.92);
    b.addBox(0, 0, 120, 290, 290, 560, 0.94);
    b.addBox(0, 0, 680, 350, 350, 70);
    b.addBattlements(0, 0, 750, 350, 350, 60, 65, 45, 110);

    b.setMaterial('timber');
    b.addBox(0, 0, 660, 320, 320, 25);
    b.setMaterial('slate');
    b.addPrism(0, 0, 780, 210, 0, 240, 8);

    fs.writeFileSync(path.join(OUT_DIR, 'SM_Watchtower.obj'), b.toOBJ());
    console.log('✔ Generated SM_Watchtower.obj (Z-up)');
}

// 3. SM_StoneWall (1x1 modular curtain wall = 400x360x455 cm)
function buildStoneWall() {
    const b = new ObjBuilder('SM_StoneWall');
    b.setMaterial('stone');
    b.addBox(0, 0, 0, 400, 360, 380);
    for (let x = -140; x <= 140; x += 140) {
        b.addBox(x, 150, 380, 75, 55, 75);
        b.addBox(x, -150, 380, 75, 55, 75);
    }
    b.setMaterial('timber');
    b.addBox(0, 0, 378, 396, 220, 16);

    fs.writeFileSync(path.join(OUT_DIR, 'SM_StoneWall.obj'), b.toOBJ());
    console.log('✔ Generated SM_StoneWall.obj (Z-up)');
}

// 4. SM_Gatehouse (twin-tower archway open along X axis)
function buildGatehouse() {
    const b = new ObjBuilder('SM_Gatehouse');
    b.setMaterial('stone');
    b.addBox(0, -240, 0, 360, 260, 640, 0.94);
    b.addBox(0, 240, 0, 360, 260, 640, 0.94);
    b.addBattlements(0, -240, 640, 340, 240, 55, 65, 40, 110);
    b.addBattlements(0, 240, 640, 340, 240, 55, 65, 40, 110);

    b.addBox(0, 0, 360, 340, 240, 200);
    b.addBattlements(0, 0, 560, 340, 240, 60, 65, 45, 110);

    b.setMaterial('timber');
    b.addBox(0, 0, 290, 40, 220, 80);
    b.setMaterial('gold');
    b.addBox(175, 0, 470, 20, 100, 70);

    fs.writeFileSync(path.join(OUT_DIR, 'SM_Gatehouse.obj'), b.toOBJ());
    console.log('✔ Generated SM_Gatehouse.obj (Z-up)');
}

// 5. SM_PineTree & SM_BasaltBoulder
function buildEnvironmentProps() {
    const t = new ObjBuilder('SM_PineTree');
    t.setMaterial('timber');
    t.addPrism(0, 0, 0, 35, 22, 180, 6);
    t.setMaterial('foliage');
    t.addPrism(0, 0, 130, 160, 10, 220, 7);
    t.addPrism(0, 0, 240, 125, 8, 200, 7);
    t.addPrism(0, 0, 340, 85, 0, 180, 7);
    fs.writeFileSync(path.join(OUT_DIR, 'SM_PineTree.obj'), t.toOBJ());
    console.log('✔ Generated SM_PineTree.obj (Z-up)');

    const r = new ObjBuilder('SM_BasaltBoulder');
    r.setMaterial('stone');
    r.addBox(0, 0, 0, 320, 290, 210, 0.65);
    r.addBox(90, 60, 0, 180, 170, 140, 0.72);
    r.addBox(-80, -50, 0, 170, 190, 160, 0.6);
    fs.writeFileSync(path.join(OUT_DIR, 'SM_BasaltBoulder.obj'), r.toOBJ());
    console.log('✔ Generated SM_BasaltBoulder.obj (Z-up)');
}

buildKeep();
buildWatchtower();
buildStoneWall();
buildGatehouse();
buildEnvironmentProps();
