/* ==========================================================================
   Citadel of Legends: Shattered Realms - A* Grid Pathfinding Engine
   --------------------------------------------------------------------------
   v1.0: binary-heap open set (O(log n) pop instead of O(n) scan), lazy
   decrease-key, and O(1) building lookups via the game's id index.
   ========================================================================== */

class MinHeap {
    constructor() {
        this.items = [];
    }

    get size() {
        return this.items.length;
    }

    push(node) {
        const a = this.items;
        a.push(node);
        let i = a.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (a[parent].f <= a[i].f) break;
            [a[parent], a[i]] = [a[i], a[parent]];
            i = parent;
        }
    }

    pop() {
        const a = this.items;
        if (a.length === 0) return undefined;
        const top = a[0];
        const last = a.pop();
        if (a.length > 0) {
            a[0] = last;
            let i = 0;
            const n = a.length;
            for (;;) {
                const l = 2 * i + 1;
                const r = l + 1;
                let m = i;
                if (l < n && a[l].f < a[m].f) m = l;
                if (r < n && a[r].f < a[m].f) m = r;
                if (m === i) break;
                [a[m], a[i]] = [a[i], a[m]];
                i = m;
            }
        }
        return top;
    }
}

class PathfindingEngine {
    constructor(game) {
        this.game = game;
        this.maxIterations = 4096; // a full 64x64 grid; prevents pathological stalls
    }

    getBuildingById(id) {
        if (this.game.buildingIndex) return this.game.buildingIndex.get(id) || null;
        return (this.game.buildings || []).find(b => b.id === id) || null;
    }

    isTilePassable(x, y, isFlying = false, isEnemy = false) {
        if (x < 0 || y < 0 || x >= this.game.gridSize || y >= this.game.gridSize) {
            return false;
        }

        // Flying units can pass over everything
        if (isFlying) return true;

        const tile = this.game.map[x]?.[y];
        if (!tile) return false;

        // Impassable natural terrain
        if (tile.type === 'water' || tile.type === 'rock') {
            return false;
        }

        // Check building obstruction
        if (tile.occupied && tile.buildingId) {
            const building = this.getBuildingById(tile.buildingId);
            if (building) {
                // Friendly Gatehouse is passable by friendly troops
                if (building.type === 'gatehouse' && building.isEnemy === isEnemy) {
                    return true;
                }
                // All other buildings (walls, towers, keeps) block pathfinding
                return false;
            }
        }

        return true;
    }

    findPath(startX, startY, endX, endY, isFlying = false, isEnemy = false) {
        const size = this.game.gridSize;
        const startGx = Math.max(0, Math.min(size - 1, Math.floor(startX)));
        const startGy = Math.max(0, Math.min(size - 1, Math.floor(startY)));
        const targetGx = Math.max(0, Math.min(size - 1, Math.floor(endX)));
        const targetGy = Math.max(0, Math.min(size - 1, Math.floor(endY)));

        // Direct line for flying units
        if (isFlying) {
            return [{ x: endX, y: endY }];
        }

        // If the target tile is blocked (e.g. attacking a wall/keep), path to the
        // passable tile closest to the start that lies within 2 rings of it.
        let effectiveTargetGx = targetGx;
        let effectiveTargetGy = targetGy;

        if (!this.isTilePassable(targetGx, targetGy, false, isEnemy)) {
            const candidates = [];
            for (let ring = 1; ring <= 3 && candidates.length === 0; ring++) {
                for (let dx = -ring; dx <= ring; dx++) {
                    for (let dy = -ring; dy <= ring; dy++) {
                        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
                        const nx = targetGx + dx;
                        const ny = targetGy + dy;
                        if (this.isTilePassable(nx, ny, false, isEnemy)) candidates.push({ x: nx, y: ny });
                    }
                }
            }
            if (candidates.length === 0) return []; // Completely unreachable
            candidates.sort((a, b) => Math.hypot(a.x - startGx, a.y - startGy) - Math.hypot(b.x - startGx, b.y - startGy));
            effectiveTargetGx = candidates[0].x;
            effectiveTargetGy = candidates[0].y;
        }

        if (startGx === effectiveTargetGx && startGy === effectiveTargetGy) {
            return [{ x: endX, y: endY }];
        }

        const n = size * size;
        const closedSet = new Uint8Array(n);
        const cameFrom = new Int32Array(n).fill(-1);
        const gScore = new Float32Array(n).fill(Infinity);

        const getIndex = (x, y) => y * size + x;
        const startIndex = getIndex(startGx, startGy);
        const targetIndex = getIndex(effectiveTargetGx, effectiveTargetGy);
        const heuristic = (x, y) => {
            // Octile distance: admissible & consistent for 8-way movement.
            const dx = Math.abs(effectiveTargetGx - x);
            const dy = Math.abs(effectiveTargetGy - y);
            return (dx + dy) + (1.414 - 2) * Math.min(dx, dy);
        };

        const open = new MinHeap();
        gScore[startIndex] = 0;
        open.push({ index: startIndex, x: startGx, y: startGy, f: heuristic(startGx, startGy) });

        const dirs = PathfindingEngine.DIRS;
        let iterations = 0;
        let bestIndex = startIndex;
        let bestH = heuristic(startGx, startGy);

        while (open.size > 0 && iterations++ < this.maxIterations) {
            const current = open.pop();
            if (closedSet[current.index]) continue; // stale heap entry (lazy decrease-key)
            if (current.index === targetIndex) {
                return this.reconstructPath(cameFrom, current.index, endX, endY);
            }
            closedSet[current.index] = 1;

            const h = heuristic(current.x, current.y);
            if (h < bestH) {
                bestH = h;
                bestIndex = current.index;
            }

            for (let d = 0; d < dirs.length; d++) {
                const dir = dirs[d];
                const nx = current.x + dir.dx;
                const ny = current.y + dir.dy;

                if (!this.isTilePassable(nx, ny, false, isEnemy)) continue;

                // Prevent diagonal corner cutting through solid tiles
                if (dir.dx !== 0 && dir.dy !== 0) {
                    if (!this.isTilePassable(current.x + dir.dx, current.y, false, isEnemy) ||
                        !this.isTilePassable(current.x, current.y + dir.dy, false, isEnemy)) {
                        continue;
                    }
                }

                const nIndex = getIndex(nx, ny);
                if (closedSet[nIndex]) continue;

                const tentativeG = gScore[current.index] + dir.cost;
                if (tentativeG < gScore[nIndex]) {
                    cameFrom[nIndex] = current.index;
                    gScore[nIndex] = tentativeG;
                    open.push({ index: nIndex, x: nx, y: ny, f: tentativeG + heuristic(nx, ny) });
                }
            }
        }

        // No complete path (e.g. fully walled in): walk to the closest reachable tile.
        if (bestIndex !== startIndex) {
            const bx = bestIndex % size;
            const by = Math.floor(bestIndex / size);
            return this.reconstructPath(cameFrom, bestIndex, bx + 0.5, by + 0.5);
        }
        return [{ x: effectiveTargetGx + 0.5, y: effectiveTargetGy + 0.5 }];
    }

    reconstructPath(cameFrom, currentIndex, finalX, finalY) {
        const path = [];
        let curr = currentIndex;
        const size = this.game.gridSize;

        while (curr !== -1) {
            const gx = curr % size;
            const gy = Math.floor(curr / size);
            path.push({ x: gx + 0.5, y: gy + 0.5 });
            curr = cameFrom[curr];
        }

        path.reverse();
        // Drop the start tile centre (unit is already there) and use the exact target.
        if (path.length > 1) path.shift();
        if (path.length > 0) {
            path[path.length - 1] = { x: finalX, y: finalY };
        }
        return path;
    }
}

PathfindingEngine.DIRS = [
    { dx: 1, dy: 0, cost: 1.0 },
    { dx: -1, dy: 0, cost: 1.0 },
    { dx: 0, dy: 1, cost: 1.0 },
    { dx: 0, dy: -1, cost: 1.0 },
    { dx: 1, dy: 1, cost: 1.414 },
    { dx: -1, dy: 1, cost: 1.414 },
    { dx: 1, dy: -1, cost: 1.414 },
    { dx: -1, dy: -1, cost: 1.414 }
];

if (typeof globalThis !== 'undefined') {
    globalThis.PathfindingEngine = PathfindingEngine;
    globalThis.MinHeap = MinHeap;
}
