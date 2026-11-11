/* ==========================================================================
   Citadel of Legends: Shattered Realms - Fog of War & Exploration Shroud
   --------------------------------------------------------------------------
   Two per-tile flag layers (explored / visible) plus a smoothed shade layer
   used by the renderer for soft alpha-gradient edges. Vision is recomputed
   on a fixed cadence (default 4 Hz) instead of every frame - vision changes
   slowly relative to 60 FPS rendering, so this saves ~90% of the work.
   ========================================================================== */

class FogOfWar {
    constructor(gridSize = 64) {
        this.gridSize = gridSize;
        this.enabled = true;
        this.explored = new Uint8Array(gridSize * gridSize);
        this.visible = new Uint8Array(gridSize * gridSize);
        this.shade = new Float32Array(gridSize * gridSize).fill(1);
        this._targetShade = new Float32Array(gridSize * gridSize).fill(1);
        this.updateInterval = 0.25;
        this._accum = this.updateInterval; // force an update on first tick
    }

    reset() {
        this.explored.fill(0);
        this.visible.fill(0);
        this.shade.fill(1);
        this._targetShade.fill(1);
        this._accum = this.updateInterval;
    }

    index(x, y) {
        return y * this.gridSize + x;
    }

    inBounds(x, y) {
        return x >= 0 && y >= 0 && x < this.gridSize && y < this.gridSize;
    }

    isVisible(x, y) {
        if (!this.enabled) return true;
        const gx = Math.floor(x);
        const gy = Math.floor(y);
        if (!this.inBounds(gx, gy)) return false;
        return this.visible[this.index(gx, gy)] === 1;
    }

    isExplored(x, y) {
        if (!this.enabled) return true;
        const gx = Math.floor(x);
        const gy = Math.floor(y);
        if (!this.inBounds(gx, gy)) return false;
        return this.explored[this.index(gx, gy)] === 1;
    }

    /** Mark a filled circle of tiles visible + explored. */
    reveal(cx, cy, radius) {
        const r2 = radius * radius;
        const minX = Math.max(0, Math.floor(cx - radius));
        const maxX = Math.min(this.gridSize - 1, Math.ceil(cx + radius));
        const minY = Math.max(0, Math.floor(cy - radius));
        const maxY = Math.min(this.gridSize - 1, Math.ceil(cy + radius));
        for (let x = minX; x <= maxX; x++) {
            const dx = x + 0.5 - cx;
            for (let y = minY; y <= maxY; y++) {
                const dy = y + 0.5 - cy;
                if (dx * dx + dy * dy <= r2) {
                    const i = y * this.gridSize + x;
                    this.visible[i] = 1;
                    this.explored[i] = 1;
                }
            }
        }
    }

    static visionRadiusFor(entity) {
        const V = (typeof VISION_DEF !== 'undefined') ? VISION_DEF : { keep: 12, tower: 10, building: 4, unit: 5, flying: 7 };
        if (entity.gx !== undefined) {
            if (entity.type === 'keep') return V.keep;
            if (entity.isTower) return V.tower;
            return V.building;
        }
        return entity.isFlying ? V.flying : V.unit;
    }

    /** Recompute vision from all friendly vision sources. */
    recompute(game) {
        this.visible.fill(0);
        for (const b of game.buildings) {
            if (b.isEnemy || b.hp <= 0) continue;
            this.reveal(b.gx + b.w / 2, b.gy + b.h / 2, FogOfWar.visionRadiusFor(b));
        }
        for (const u of game.units) {
            if (u.isEnemy || u.hp <= 0) continue;
            this.reveal(u.x, u.y, FogOfWar.visionRadiusFor(u));
        }
        this._computeTargetShade();
    }

    _computeTargetShade() {
        const n = this.gridSize;
        const raw = this._targetShade;
        for (let i = 0; i < raw.length; i++) {
            raw[i] = this.visible[i] ? 0 : this.explored[i] ? 0.55 : 0.94;
        }
        // One 3x3 box-blur pass gives the soft gradient edge the design calls for.
        const blurred = new Float32Array(raw.length);
        for (let x = 0; x < n; x++) {
            for (let y = 0; y < n; y++) {
                let sum = 0;
                let cnt = 0;
                for (let dx = -1; dx <= 1; dx++) {
                    const xx = x + dx;
                    if (xx < 0 || xx >= n) continue;
                    for (let dy = -1; dy <= 1; dy++) {
                        const yy = y + dy;
                        if (yy < 0 || yy >= n) continue;
                        sum += raw[yy * n + xx];
                        cnt++;
                    }
                }
                blurred[y * n + x] = sum / cnt;
            }
        }
        // Visible tiles never get darker than a faint vignette near the edge.
        for (let i = 0; i < raw.length; i++) {
            if (this.visible[i]) blurred[i] = Math.min(blurred[i], 0.25);
        }
        this._targetShade = blurred;
    }

    update(dt, game) {
        if (!this.enabled) return;
        this._accum += dt;
        if (this._accum >= this.updateInterval) {
            this._accum = 0;
            this.recompute(game);
        }
        // Ease displayed shade toward target for smooth reveal transitions.
        const k = Math.min(1, dt * 6);
        const s = this.shade;
        const t = this._targetShade;
        for (let i = 0; i < s.length; i++) {
            s[i] += (t[i] - s[i]) * k;
        }
    }

    getShade(x, y) {
        if (!this.enabled) return 0;
        return this.shade[this.index(x, y)];
    }

    /** Compact string encoding of explored flags for save files (RLE). */
    serializeExplored() {
        let out = '';
        let run = 0;
        let cur = this.explored[0];
        for (let i = 0; i < this.explored.length; i++) {
            if (this.explored[i] === cur) {
                run++;
            } else {
                out += `${cur}${run},`;
                cur = this.explored[i];
                run = 1;
            }
        }
        out += `${cur}${run}`;
        return out;
    }

    deserializeExplored(str) {
        if (typeof str !== 'string' || str.length > 20000) return false;
        const parts = str.split(',');
        const tmp = new Uint8Array(this.explored.length);
        let idx = 0;
        for (const p of parts) {
            if (!/^[01]\d{1,5}$/.test(p)) return false;
            const val = p.charCodeAt(0) - 48;
            const run = parseInt(p.slice(1), 10);
            if (idx + run > tmp.length) return false;
            tmp.fill(val, idx, idx + run);
            idx += run;
        }
        if (idx !== tmp.length) return false;
        this.explored.set(tmp);
        return true;
    }
}

if (typeof globalThis !== 'undefined') {
    globalThis.FogOfWar = FogOfWar;
}
