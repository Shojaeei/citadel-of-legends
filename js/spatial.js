/* ==========================================================================
   Citadel of Legends: Shattered Realms - Spatial Hash Grid
   --------------------------------------------------------------------------
   Uniform-grid spatial partitioning for O(1) average neighbour queries.
   The grid is rebuilt once per simulation step (cheap: one insert per unit)
   which avoids the bookkeeping bugs of incremental move/update schemes.
   ========================================================================== */

class SpatialHash {
    /**
     * @param {number} cellSize - World-tile edge length of one bucket. Should be
     *   close to the most common query radius (aggro ~6, splash ~2) so a query
     *   touches at most a 3x3 neighbourhood.
     */
    constructor(cellSize = 4) {
        this.cellSize = cellSize;
        this.cells = new Map();
        this.count = 0;
    }

    _key(cx, cy) {
        // Grid coordinates are small (map is 64 tiles), so pack into one int.
        return (cx + 512) * 2048 + (cy + 512);
    }

    clear() {
        this.cells.clear();
        this.count = 0;
    }

    insert(entity, x = entity.x, y = entity.y) {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        const key = this._key(cx, cy);
        let bucket = this.cells.get(key);
        if (!bucket) {
            bucket = [];
            this.cells.set(key, bucket);
        }
        bucket.push(entity);
        this.count++;
    }

    rebuild(entities) {
        this.clear();
        for (let i = 0; i < entities.length; i++) {
            const e = entities[i];
            if (e.hp > 0) this.insert(e);
        }
    }

    /**
     * Returns all entities whose (x, y) lies within radius r of (x, y).
     * @param {Function} [filter] optional predicate applied before the distance test.
     */
    queryRadius(x, y, r, filter = null) {
        const out = [];
        const cs = this.cellSize;
        const minCx = Math.floor((x - r) / cs);
        const maxCx = Math.floor((x + r) / cs);
        const minCy = Math.floor((y - r) / cs);
        const maxCy = Math.floor((y + r) / cs);
        const r2 = r * r;
        for (let cx = minCx; cx <= maxCx; cx++) {
            for (let cy = minCy; cy <= maxCy; cy++) {
                const bucket = this.cells.get(this._key(cx, cy));
                if (!bucket) continue;
                for (let i = 0; i < bucket.length; i++) {
                    const e = bucket[i];
                    if (filter && !filter(e)) continue;
                    const dx = e.x - x;
                    const dy = e.y - y;
                    if (dx * dx + dy * dy <= r2) out.push(e);
                }
            }
        }
        return out;
    }

    /** Nearest entity within r that satisfies filter, or null. */
    findNearest(x, y, r, filter = null) {
        let best = null;
        let bestD2 = r * r;
        const candidates = this.queryRadius(x, y, r, filter);
        for (let i = 0; i < candidates.length; i++) {
            const e = candidates[i];
            const dx = e.x - x;
            const dy = e.y - y;
            const d2 = dx * dx + dy * dy;
            if (d2 <= bestD2) {
                bestD2 = d2;
                best = e;
            }
        }
        return best;
    }
}

/**
 * Engine-wide helper: query units near a point. Uses the game's spatial hash
 * when present, otherwise falls back to a linear scan (keeps lightweight mock
 * game objects in unit tests working).
 */
function queryUnitsNear(game, x, y, r, filter = null) {
    if (game && game.unitHash && game.unitHash.count > 0) {
        return game.unitHash.queryRadius(x, y, r, filter);
    }
    const out = [];
    const units = (game && game.units) || [];
    const r2 = r * r;
    for (let i = 0; i < units.length; i++) {
        const u = units[i];
        if (filter && !filter(u)) continue;
        const dx = u.x - x;
        const dy = u.y - y;
        if (dx * dx + dy * dy <= r2) out.push(u);
    }
    return out;
}

function findNearestUnit(game, x, y, r, filter = null) {
    let best = null;
    let bestD2 = r * r;
    const list = queryUnitsNear(game, x, y, r, filter);
    for (let i = 0; i < list.length; i++) {
        const u = list[i];
        const d2 = (u.x - x) * (u.x - x) + (u.y - y) * (u.y - y);
        if (d2 <= bestD2) {
            bestD2 = d2;
            best = u;
        }
    }
    return best;
}

if (typeof globalThis !== 'undefined') {
    globalThis.SpatialHash = SpatialHash;
    globalThis.queryUnitsNear = queryUnitsNear;
    globalThis.findNearestUnit = findNearestUnit;
}
