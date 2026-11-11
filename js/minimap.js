/* ==========================================================================
   Citadel of Legends: Shattered Realms - Radar Minimap
   --------------------------------------------------------------------------
   Orthogonal top-down projection of the 64x64 grid with terrain colours,
   entity blips, a live camera frustum polygon and click/drag-to-recenter.
   Terrain is cached to an offscreen layer and only re-baked when the map
   or the explored shroud changes, keeping per-frame cost to blips + frustum.
   ========================================================================== */

const MINIMAP_COLORS = {
    water: '#1d4ed8',
    rock: '#71717a',
    grass: '#15803d',
    snow: '#cbd5e1',
    blight: '#4c1d1d',
    timber: '#713f12',
    unexplored: '#050505',
    friendlyBuilding: '#22d3ee',
    friendlyKeep: '#facc15',
    friendlyUnit: '#f8fafc',
    friendlyWorker: '#4ade80',
    enemy: '#ef4444',
    resource: '#f59e0b',
    frustum: '#fde68a'
};

class Minimap {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
        this.game = game;
        this.terrainLayer = null;
        this._terrainDirty = true;
        this._lastExploredHash = -1;
        this._dragging = false;
        if (canvas && canvas.addEventListener) this.attachInput();
    }

    get size() {
        return this.canvas ? this.canvas.width : 180;
    }

    /** Pixels per grid tile. */
    static scaleFor(sizePx, gridSize) {
        return sizePx / gridSize;
    }

    static worldToMinimap(gx, gy, sizePx, gridSize) {
        const s = Minimap.scaleFor(sizePx, gridSize);
        return { x: gx * s, y: gy * s };
    }

    static minimapToWorld(px, py, sizePx, gridSize) {
        const s = Minimap.scaleFor(sizePx, gridSize);
        return {
            x: Math.max(0, Math.min(gridSize, px / s)),
            y: Math.max(0, Math.min(gridSize, py / s))
        };
    }

    /**
     * Camera frustum as 4 world-space corners (unclamped), computed by
     * inverse-projecting the viewport corners. In orthogonal grid space an
     * isometric screen rectangle becomes a rotated diamond/trapezoid.
     */
    static frustumWorldCorners(camera, viewW, viewH, tileW = 64, tileH = 32) {
        const toWorld = (px, py) => {
            const lx = (px - viewW / 2 - camera.x) / camera.zoom;
            const ly = (py - viewH / 2 - camera.y) / camera.zoom;
            return {
                x: (lx / (tileW / 2) + ly / (tileH / 2)) / 2,
                y: (ly / (tileH / 2) - lx / (tileW / 2)) / 2
            };
        };
        return [toWorld(0, 0), toWorld(viewW, 0), toWorld(viewW, viewH), toWorld(0, viewH)];
    }

    markTerrainDirty() {
        this._terrainDirty = true;
    }

    terrainColor(tile, x, y) {
        if (tile.type === 'water') return MINIMAP_COLORS.water;
        if (tile.type === 'rock') return MINIMAP_COLORS.rock;
        if (tile.type === 'snow') return (x + y) % 2 ? '#e2e8f0' : MINIMAP_COLORS.snow;
        if (tile.type === 'blight') return (x + y) % 2 ? '#3f1111' : MINIMAP_COLORS.blight;
        return (x + y) % 2 ? '#166534' : MINIMAP_COLORS.grass;
    }

    bakeTerrain() {
        if (typeof document === 'undefined' || !document.createElement) return;
        const g = this.game;
        const n = g.gridSize;
        if (!this.terrainLayer) {
            this.terrainLayer = document.createElement('canvas');
        }
        if (!this.terrainLayer.getContext) return;
        this.terrainLayer.width = n;
        this.terrainLayer.height = n;
        const tctx = this.terrainLayer.getContext('2d');
        const fog = g.fog;
        for (let x = 0; x < n; x++) {
            for (let y = 0; y < n; y++) {
                const tile = g.map[x] && g.map[x][y];
                if (!tile) continue;
                const explored = !fog || !fog.enabled || fog.explored[y * n + x];
                tctx.fillStyle = explored ? this.terrainColor(tile, x, y) : MINIMAP_COLORS.unexplored;
                tctx.fillRect(x, y, 1, 1);
            }
        }
        this._terrainDirty = false;
    }

    exploredHash() {
        const fog = this.game.fog;
        if (!fog || !fog.enabled) return 0;
        // Cheap change detector: count of explored tiles.
        let c = 0;
        const e = fog.explored;
        for (let i = 0; i < e.length; i++) c += e[i];
        return c;
    }

    render() {
        const ctx = this.ctx;
        if (!ctx) return;
        const g = this.game;
        const size = this.size;
        const n = g.gridSize;
        const s = size / n;
        const fog = g.fog;

        const h = this.exploredHash();
        if (this._terrainDirty || h !== this._lastExploredHash) {
            this._lastExploredHash = h;
            this.bakeTerrain();
        }

        ctx.save();
        ctx.clearRect(0, 0, size, size);
        ctx.imageSmoothingEnabled = false;
        if (this.terrainLayer) {
            ctx.drawImage(this.terrainLayer, 0, 0, size, size);
        }

        // Darken explored-but-not-visible tiles (memory of the map).
        if (fog && fog.enabled) {
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            for (let x = 0; x < n; x++) {
                for (let y = 0; y < n; y++) {
                    const i = y * n + x;
                    if (fog.explored[i] && !fog.visible[i]) ctx.fillRect(x * s, y * s, s, s);
                }
            }
        }

        // Buildings
        for (const b of g.buildings) {
            if (b.isEnemy && fog && fog.enabled && !fog.isExplored(b.gx, b.gy)) continue;
            if (b.isEnemy) ctx.fillStyle = MINIMAP_COLORS.enemy;
            else if (b.type === 'keep') ctx.fillStyle = MINIMAP_COLORS.friendlyKeep;
            else if (BUILDINGS_DEF[b.type] && BUILDINGS_DEF[b.type].producer) ctx.fillStyle = MINIMAP_COLORS.resource;
            else ctx.fillStyle = MINIMAP_COLORS.friendlyBuilding;
            ctx.fillRect(b.gx * s, b.gy * s, Math.max(2, b.w * s), Math.max(2, b.h * s));
        }

        // Units
        for (const u of g.units) {
            if (u.isEnemy && fog && fog.enabled && !fog.isVisible(u.x, u.y)) continue;
            ctx.fillStyle = u.isEnemy ? MINIMAP_COLORS.enemy : u.isWorker ? MINIMAP_COLORS.friendlyWorker : MINIMAP_COLORS.friendlyUnit;
            const r = u.type === 'dragon' ? 2.5 : 1.5;
            ctx.fillRect(u.x * s - r / 2, u.y * s - r / 2, r, r);
        }

        // Camera frustum
        if (g.renderer && g.renderer.canvas) {
            const corners = Minimap.frustumWorldCorners(g.camera, g.renderer.canvas.width, g.renderer.canvas.height, GAME_CONFIG.tileWidth, GAME_CONFIG.tileHeight);
            ctx.strokeStyle = MINIMAP_COLORS.frustum;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            corners.forEach((c, i) => {
                const px = c.x * s;
                const py = c.y * s;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            });
            ctx.closePath();
            ctx.stroke();
        }

        ctx.restore();
    }

    recenterFromEvent(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / (rect.width || this.canvas.width);
        const scaleY = this.canvas.height / (rect.height || this.canvas.height);
        const px = (e.clientX - rect.left) * scaleX;
        const py = (e.clientY - rect.top) * scaleY;
        const world = Minimap.minimapToWorld(px, py, this.size, this.game.gridSize);
        this.game.centerCameraOn(world.x, world.y);
    }

    attachInput() {
        const c = this.canvas;
        const stop = (e) => { e.stopPropagation(); };
        c.addEventListener('mousedown', (e) => {
            stop(e);
            e.preventDefault();
            this._dragging = true;
            this.recenterFromEvent(e);
        });
        window.addEventListener('mousemove', (e) => {
            if (this._dragging) this.recenterFromEvent(e);
        });
        window.addEventListener('mouseup', () => { this._dragging = false; });
        c.addEventListener('touchstart', (e) => {
            stop(e);
            e.preventDefault();
            if (e.touches[0]) this.recenterFromEvent(e.touches[0]);
            this._dragging = true;
        }, { passive: false });
        c.addEventListener('touchmove', (e) => {
            stop(e);
            e.preventDefault();
            if (this._dragging && e.touches[0]) this.recenterFromEvent(e.touches[0]);
        }, { passive: false });
        c.addEventListener('touchend', () => { this._dragging = false; });
        c.addEventListener('contextmenu', (e) => e.preventDefault());
    }
}

if (typeof globalThis !== 'undefined') {
    globalThis.Minimap = Minimap;
    globalThis.MINIMAP_COLORS = MINIMAP_COLORS;
}
