/* ==========================================================================
   Citadel of Legends: Shattered Realms - A* Grid Pathfinding Engine
   ========================================================================== */

class PathfindingEngine {
    constructor(game) {
        this.game = game;
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
            const building = this.game.buildings.find(b => b.id === tile.buildingId);
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
        const startGx = Math.floor(startX);
        const startGy = Math.floor(startY);
        const targetGx = Math.max(0, Math.min(this.game.gridSize - 1, Math.floor(endX)));
        const targetGy = Math.max(0, Math.min(this.game.gridSize - 1, Math.floor(endY)));

        // Direct line for flying units
        if (isFlying) {
            return [{ x: endX, y: endY }];
        }

        // If target tile itself is blocked (e.g. clicking on an enemy wall/keep to attack it),
        // find the closest passable adjacent neighbor to attack from
        let effectiveTargetGx = targetGx;
        let effectiveTargetGy = targetGy;

        if (!this.isTilePassable(targetGx, targetGy, isFlying, isEnemy)) {
            const neighbors = [
                { x: targetGx + 1, y: targetGy },
                { x: targetGx - 1, y: targetGy },
                { x: targetGx, y: targetGy + 1 },
                { x: targetGx, y: targetGy - 1 }
            ];
            const valid = neighbors.filter(n => this.isTilePassable(n.x, n.y, isFlying, isEnemy));
            if (valid.length > 0) {
                // Pick neighbor closest to start
                valid.sort((a, b) => Math.hypot(a.x - startGx, a.y - startGy) - Math.hypot(b.x - startGx, b.y - startGy));
                effectiveTargetGx = valid[0].x;
                effectiveTargetGy = valid[0].y;
            } else {
                return []; // Completely unreachable
            }
        }

        if (startGx === effectiveTargetGx && startGy === effectiveTargetGy) {
            return [{ x: endX, y: endY }];
        }

        // A* Priority Queue / Open and Closed Sets
        const openSet = [];
        const closedSet = new Uint8Array(this.game.gridSize * this.game.gridSize);
        const cameFrom = new Int32Array(this.game.gridSize * this.game.gridSize).fill(-1);
        const gScore = new Float32Array(this.game.gridSize * this.game.gridSize).fill(Infinity);
        const fScore = new Float32Array(this.game.gridSize * this.game.gridSize).fill(Infinity);

        const getIndex = (x, y) => y * this.game.gridSize + x;
        const startIndex = getIndex(startGx, startGy);
        const targetIndex = getIndex(effectiveTargetGx, effectiveTargetGy);

        gScore[startIndex] = 0;
        fScore[startIndex] = Math.hypot(effectiveTargetGx - startGx, effectiveTargetGy - startGy);
        openSet.push({ index: startIndex, x: startGx, y: startGy, f: fScore[startIndex] });

        const dirs = [
            { dx: 1, dy: 0, cost: 1.0 },
            { dx: -1, dy: 0, cost: 1.0 },
            { dx: 0, dy: 1, cost: 1.0 },
            { dx: 0, dy: -1, cost: 1.0 },
            // Diagonals (cost 1.414)
            { dx: 1, dy: 1, cost: 1.414 },
            { dx: -1, dy: 1, cost: 1.414 },
            { dx: 1, dy: -1, cost: 1.414 },
            { dx: -1, dy: -1, cost: 1.414 }
        ];

        let iterations = 0;
        const maxIterations = 2000; // Performance safeguard

        while (openSet.length > 0 && iterations++ < maxIterations) {
            // Find lowest fScore in openSet
            let lowestIdx = 0;
            for (let i = 1; i < openSet.length; i++) {
                if (openSet[i].f < openSet[lowestIdx].f) {
                    lowestIdx = i;
                }
            }

            const current = openSet.splice(lowestIdx, 1)[0];
            if (current.index === targetIndex) {
                // Reconstruct Path
                return this.reconstructPath(cameFrom, current.index, endX, endY);
            }

            closedSet[current.index] = 1;

            for (const dir of dirs) {
                const nx = current.x + dir.dx;
                const ny = current.y + dir.dy;

                if (!this.isTilePassable(nx, ny, isFlying, isEnemy)) {
                    continue;
                }

                // If diagonal, prevent corner cutting through two adjacent solid walls
                if (dir.dx !== 0 && dir.dy !== 0) {
                    if (!this.isTilePassable(current.x + dir.dx, current.y, isFlying, isEnemy) ||
                        !this.isTilePassable(current.x, current.y + dir.dy, isFlying, isEnemy)) {
                        continue;
                    }
                }

                const nIndex = getIndex(nx, ny);
                if (closedSet[nIndex]) continue;

                const tentativeG = gScore[current.index] + dir.cost;
                if (tentativeG < gScore[nIndex]) {
                    cameFrom[nIndex] = current.index;
                    gScore[nIndex] = tentativeG;
                    fScore[nIndex] = tentativeG + Math.hypot(effectiveTargetGx - nx, effectiveTargetGy - ny);

                    const existing = openSet.find(item => item.index === nIndex);
                    if (!existing) {
                        openSet.push({ index: nIndex, x: nx, y: ny, f: fScore[nIndex] });
                    } else {
                        existing.f = fScore[nIndex];
                    }
                }
            }
        }

        // Fallback: If no path found (e.g. fully walled without gates), walk as close as possible
        return [{ x: effectiveTargetGx + 0.5, y: effectiveTargetGy + 0.5 }];
    }

    reconstructPath(cameFrom, currentIndex, finalX, finalY) {
        const path = [];
        let curr = currentIndex;

        while (curr !== -1) {
            const gx = curr % this.game.gridSize;
            const gy = Math.floor(curr / this.game.gridSize);
            path.push({ x: gx + 0.5, y: gy + 0.5 });
            curr = cameFrom[curr];
        }

        path.reverse();
        // Replace last waypoint with exact target position if desired
        if (path.length > 0) {
            path[path.length - 1] = { x: finalX, y: finalY };
        }
        return path;
    }
}

if (typeof globalThis !== 'undefined') {
    globalThis.PathfindingEngine = PathfindingEngine;
}
