/* ==========================================================================
   Citadel of Legends: Shattered Realms - Isometric 2.5D Canvas Renderer
   ========================================================================== */

class IsometricRenderer {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game;

        this.tileW = GAME_CONFIG.tileWidth;
        this.tileH = GAME_CONFIG.tileHeight;

        this.hoverTile = { x: -1, y: -1 };
    }

    worldToScreen(gx, gy) {
        return {
            x: (gx - gy) * (this.tileW / 2),
            y: (gx + gy) * (this.tileH / 2)
        };
    }

    screenToWorld(screenX, screenY) {
        const localX = (screenX - this.canvas.width / 2 - this.game.camera.x) / this.game.camera.zoom;
        const localY = (screenY - 120 - this.game.camera.y) / this.game.camera.zoom;

        const gx = Math.floor((localX / (this.tileW / 2) + localY / (this.tileH / 2)) / 2);
        const gy = Math.floor((localY / (this.tileH / 2) - localX / (this.tileW / 2)) / 2);

        return {
            x: Math.max(0, Math.min(gx, this.game.gridSize - 1)),
            y: Math.max(0, Math.min(gy, this.game.gridSize - 1))
        };
    }

    render() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const ctx = this.ctx;

        // Background Atmosphere
        const isBlight = this.game.mapType === 'wasteland';
        const isSnow = this.game.mapType === 'tundra';
        ctx.fillStyle = isBlight ? '#180808' : isSnow ? '#0b132b' : '#08141e';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        // Camera Transform
        ctx.translate(w / 2 + this.game.camera.x, 120 + this.game.camera.y);
        ctx.scale(this.game.camera.zoom, this.game.camera.zoom);

        // 1. Render Terrain Tiles
        this.renderTerrain();

        // 2. Render Hover Footprint Preview (Ghost)
        this.renderHoverGhost();

        // 3. Render Depth-Sorted Entities (Buildings, Units, Projectiles)
        this.renderEntities();

        // 4. Render Floating Particles & Damage Numbers
        this.renderParticles();

        ctx.restore();

        // 5. Render Screen-Space Marquee Selection Box
        if (this.game.dragBox && this.game.dragBox.active) {
            const bx = Math.min(this.game.dragBox.startX, this.game.dragBox.currentX);
            const by = Math.min(this.game.dragBox.startY, this.game.dragBox.currentY);
            const bw = Math.abs(this.game.dragBox.currentX - this.game.dragBox.startX);
            const bh = Math.abs(this.game.dragBox.currentY - this.game.dragBox.startY);

            ctx.save();
            ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
            ctx.fillRect(bx, by, bw, bh);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(bx, by, bw, bh);
            ctx.restore();
        }
    }

    renderTerrain() {
        const ctx = this.ctx;
        const gridSize = this.game.gridSize;
        const halfW = this.tileW / 2;
        const halfH = this.tileH / 2;

        // Viewport bounds calculation for accurate frustum culling
        const viewMinX = -this.canvas.width / (2 * this.game.camera.zoom) - this.game.camera.x / this.game.camera.zoom - 100;
        const viewMaxX = this.canvas.width / (2 * this.game.camera.zoom) - this.game.camera.x / this.game.camera.zoom + 100;
        const viewMinY = -120 / this.game.camera.zoom - this.game.camera.y / this.game.camera.zoom - 100;
        const viewMaxY = (this.canvas.height - 120) / this.game.camera.zoom - this.game.camera.y / this.game.camera.zoom + 100;

        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridSize; y++) {
                const screen = this.worldToScreen(x, y);

                // Frustum culling
                if (screen.x < viewMinX - halfW || screen.x > viewMaxX + halfW ||
                    screen.y < viewMinY - halfH || screen.y > viewMaxY + halfH) {
                    continue;
                }

                const tile = this.game.map[x][y];

                // Draw Isometric Diamond
                ctx.beginPath();
                ctx.moveTo(screen.x, screen.y);
                ctx.lineTo(screen.x + halfW, screen.y + halfH);
                ctx.lineTo(screen.x, screen.y + this.tileH);
                ctx.lineTo(screen.x - halfW, screen.y + halfH);
                ctx.closePath();

                if (tile.type === 'water') {
                    ctx.fillStyle = '#1e40af';
                } else if (tile.type === 'rock') {
                    ctx.fillStyle = '#3f3f46';
                } else if (tile.type === 'snow') {
                    ctx.fillStyle = (x + y) % 2 === 0 ? '#e2e8f0' : '#cbd5e1';
                } else if (tile.type === 'blight') {
                    ctx.fillStyle = (x + y) % 2 === 0 ? '#3f1111' : '#2d0909';
                } else {
                    // Verdant Grass
                    ctx.fillStyle = (x + y) % 2 === 0 ? '#15803d' : '#166534';
                }

                ctx.fill();
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }

    renderHoverGhost() {
        if (!this.game.selectedTool) return;
        const def = BUILDINGS_DEF[this.game.selectedTool];
        if (!def) return; // Unit training does not show ground placement ghost

        const gx = this.hoverTile.x;
        const gy = this.hoverTile.y;
        if (gx < 0 || gy < 0) return;

        const isValid = this.game.isValidPlacement(gx, gy, def.w, def.h);
        const canAfford = this.game.economy.canAfford(def.cost);

        const ctx = this.ctx;
        const halfW = this.tileW / 2;
        const halfH = this.tileH / 2;

        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = isValid && canAfford ? '#22c55e' : '#ef4444';
        ctx.fillStyle = isValid && canAfford ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.4)';

        // Draw multi-tile boundary
        for (let dx = 0; dx < def.w; dx++) {
            for (let dy = 0; dy < def.h; dy++) {
                const screen = this.worldToScreen(gx + dx, gy + dy);
                ctx.beginPath();
                ctx.moveTo(screen.x, screen.y);
                ctx.lineTo(screen.x + halfW, screen.y + halfH);
                ctx.lineTo(screen.x, screen.y + this.tileH);
                ctx.lineTo(screen.x - halfW, screen.y + halfH);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        }

        // Draw translucent 3D box preview
        const baseScreen = this.worldToScreen(gx, gy);
        ctx.fillStyle = isValid && canAfford ? 'rgba(251, 191, 36, 0.5)' : 'rgba(239, 68, 68, 0.3)';
        ctx.fillRect(baseScreen.x - 20, baseScreen.y - 36, 40, 36);
        ctx.restore();
    }

    renderEntities() {
        const ctx = this.ctx;

        // Collect all renderables and sort by depth (isometric depth = gx + gy)
        const renderables = [];

        this.game.buildings.forEach(b => {
            renderables.push({
                type: 'building',
                depth: b.gx + b.gy + (b.w + b.h) * 0.5,
                obj: b
            });
        });

        this.game.units.forEach(u => {
            renderables.push({
                type: 'unit',
                depth: u.x + u.y,
                obj: u
            });
        });

        this.game.projectiles.forEach(p => {
            renderables.push({
                type: 'projectile',
                depth: p.x + p.y,
                obj: p
            });
        });

        // Sort ascending
        renderables.sort((a, b) => a.depth - b.depth);

        // Render sorted
        renderables.forEach(item => {
            if (item.type === 'building') {
                this.drawBuilding(item.obj);
            } else if (item.type === 'unit') {
                this.drawUnit(item.obj);
            } else if (item.type === 'projectile') {
                this.drawProjectile(item.obj);
            }
        });
    }

    drawBuilding(b) {
        const ctx = this.ctx;
        const screen = this.worldToScreen(b.gx + b.w / 2, b.gy + b.h / 2);
        const isSelected = this.game.selectedEntity === b;

        // Selection ring
        if (isSelected) {
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(screen.x, screen.y + 12, (b.w * this.tileW) * 0.45, (b.h * this.tileH) * 0.45, 0, 0, Math.PI * 2);
            ctx.strokeStyle = b.isEnemy ? '#ef4444' : '#fbbf24';
            ctx.lineWidth = 3;
            ctx.shadowColor = b.isEnemy ? '#dc2626' : '#f59e0b';
            ctx.shadowBlur = 12;
            ctx.stroke();
            ctx.restore();
        }

        // Draw 3D Isometric Architectural Block
        ctx.save();
        const baseW = b.w * 24;
        const baseH = b.h * 16;
        const height = b.type === 'keep' ? 65 : b.type === 'tower' ? 55 : b.type.includes('wall') ? 22 : 36;

        const cx = screen.x;
        const cy = screen.y;

        // Color shading based on friendly vs hostile
        const wallShadow = b.isEnemy ? '#450a0a' : b.type === 'keep' ? '#78350f' : b.type === 'wall' ? '#57534e' : '#451a03';
        const wallMid = b.isEnemy ? '#7f1d1d' : b.type === 'keep' ? '#92400e' : b.type === 'wall' ? '#78716c' : '#713f12';
        const wallTop = b.isEnemy ? '#991b1b' : b.type === 'keep' ? '#b45309' : b.type === 'wall' ? '#a8a29e' : '#a16207';

        // Left Face (Shadowed)
        ctx.fillStyle = wallShadow;
        ctx.beginPath();
        ctx.moveTo(cx - baseW, cy);
        ctx.lineTo(cx, cy + baseH);
        ctx.lineTo(cx, cy + baseH - height);
        ctx.lineTo(cx - baseW, cy - height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Right Face (Medium Shade)
        ctx.fillStyle = wallMid;
        ctx.beginPath();
        ctx.moveTo(cx, cy + baseH);
        ctx.lineTo(cx + baseW, cy);
        ctx.lineTo(cx + baseW, cy - height);
        ctx.lineTo(cx, cy + baseH - height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Top Roof / Walkway (Light Shade)
        ctx.fillStyle = wallTop;
        ctx.beginPath();
        ctx.moveTo(cx, cy - baseH - height + 10);
        ctx.lineTo(cx + baseW, cy - height);
        ctx.lineTo(cx, cy + baseH - height);
        ctx.lineTo(cx - baseW, cy - height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Architectural Details
        if (b.type === 'keep') {
            // Citadel Banner Pennant
            ctx.fillStyle = b.isEnemy ? '#991b1b' : '#38bdf8';
            ctx.fillRect(cx - 3, cy - height - 16, 6, 16);
            ctx.beginPath();
            ctx.moveTo(cx + 3, cy - height - 16);
            ctx.lineTo(cx + 18, cy - height - 10);
            ctx.lineTo(cx + 3, cy - height - 4);
            ctx.closePath();
            ctx.fill();
        } else if (b.type === 'tower') {
            // Conical Turret Roof
            ctx.fillStyle = b.isEnemy ? '#7f1d1d' : '#0284c7';
            ctx.beginPath();
            ctx.moveTo(cx, cy - height - 20);
            ctx.lineTo(cx + baseW + 4, cy - height);
            ctx.lineTo(cx - baseW - 4, cy - height);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else if (b.type === 'dragonRoost') {
            // Glowing Runes / Embers
            ctx.fillStyle = '#a855f7';
            ctx.shadowColor = '#c084fc';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(cx, cy - height + 2, 7, 0, Math.PI * 2);
            ctx.fill();
        } else if (b.type === 'cathedral') {
            // Holy Golden Cross & Spires
            ctx.fillStyle = '#facc15';
            ctx.shadowColor = '#fef08a';
            ctx.shadowBlur = 8;
            ctx.fillRect(cx - 2, cy - height - 20, 4, 20);
            ctx.fillRect(cx - 7, cy - height - 15, 14, 4);
        } else if (b.type === 'runestone') {
            // Glacial Runestone Monolith
            ctx.fillStyle = '#38bdf8';
            ctx.shadowColor = '#0284c7';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(cx, cy - height - 8, 6, 0, Math.PI * 2);
            ctx.fill();
        } else if (b.type === 'crucible') {
            // Blood Fire Crucible
            ctx.fillStyle = '#dc2626';
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(cx, cy - height - 10, 8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Building Label
        ctx.shadowBlur = 0;
        ctx.font = 'bold 11px Cinzel, serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = b.isEnemy ? '#f87171' : '#fef3c7';
        ctx.fillText(b.name, cx, cy - height - 8);

        // Health Bar if Damaged
        if (b.hp < b.maxHp) {
            this.drawHealthBar(cx, cy - height - 22, b.hp, b.maxHp, 36);
        }

        ctx.restore();
    }

    drawUnit(u) {
        const ctx = this.ctx;
        const screen = this.worldToScreen(u.x, u.y);
        const isSelected = this.game.selectedEntity === u || this.game.selectedUnits.includes(u);

        ctx.save();

        // Unit Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y + 12, u.type === 'dragon' ? 16 : 8, u.type === 'dragon' ? 8 : 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Selection Ring
        if (isSelected) {
            ctx.beginPath();
            ctx.ellipse(screen.x, screen.y + 12, 12, 6, 0, 0, Math.PI * 2);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2.5;
            ctx.stroke();
        } else if (u.isEnemy) {
            // Hostile Red Indicator Ring
            ctx.beginPath();
            ctx.ellipse(screen.x, screen.y + 12, 9, 4.5, 0, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // Unit Model Shape
        const altitude = u.isFlying ? -24 : 0;
        const unitY = screen.y + altitude;

        if (u.type === 'dragon') {
            // Faction Dragon
            ctx.fillStyle = u.faction === 'frost' ? '#38bdf8' : u.faction === 'obsidian' ? '#991b1b' : '#f59e0b';
            ctx.beginPath();
            ctx.arc(screen.x, unitY, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Wings
            ctx.fillStyle = '#fca5a5';
            ctx.beginPath();
            ctx.moveTo(screen.x - 14, unitY);
            ctx.lineTo(screen.x - 28, unitY - 14);
            ctx.lineTo(screen.x - 6, unitY - 4);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(screen.x + 14, unitY);
            ctx.lineTo(screen.x + 28, unitY - 14);
            ctx.lineTo(screen.x + 6, unitY - 4);
            ctx.closePath();
            ctx.fill();
        } else if (u.type === 'catapult') {
            // Timber Catapult Body
            ctx.fillStyle = '#78350f';
            ctx.fillRect(screen.x - 10, unitY - 8, 20, 14);
            ctx.fillStyle = '#451a03';
            ctx.beginPath();
            ctx.arc(screen.x - 6, unitY + 6, 4, 0, Math.PI * 2);
            ctx.arc(screen.x + 6, unitY + 6, 4, 0, Math.PI * 2);
            ctx.fill();
        } else if (u.type === 'paladin') {
            // Avalon Holy Paladin
            ctx.fillStyle = '#facc15';
            ctx.shadowColor = '#fef08a';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(screen.x, unitY - 2, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Golden Shield
            ctx.fillStyle = '#eab308';
            ctx.fillRect(screen.x - 10, unitY - 5, 4, 10);
            ctx.shadowBlur = 0;
        } else if (u.type === 'valkyrie') {
            // Frost Valkyrie (Winged)
            ctx.fillStyle = '#7dd3fc';
            ctx.beginPath();
            ctx.arc(screen.x, unitY - 6, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Azure Wings
            ctx.fillStyle = '#bae6fd';
            ctx.beginPath();
            ctx.moveTo(screen.x - 7, unitY - 6);
            ctx.lineTo(screen.x - 18, unitY - 14);
            ctx.lineTo(screen.x - 3, unitY - 3);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(screen.x + 7, unitY - 6);
            ctx.lineTo(screen.x + 18, unitY - 14);
            ctx.lineTo(screen.x + 3, unitY - 3);
            ctx.closePath();
            ctx.fill();
        } else if (u.type === 'vampire') {
            // Vampire Bloodknight
            ctx.fillStyle = '#991b1b';
            ctx.beginPath();
            ctx.arc(screen.x, unitY - 2, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Dark Crimson Cape
            ctx.fillStyle = '#450a0a';
            ctx.fillRect(screen.x - 8, unitY - 3, 3, 9);
        } else if (u.type === 'knight') {
            // Sun-Blade Knight
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(screen.x, unitY - 2, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Shield
            ctx.fillStyle = '#d97706';
            ctx.fillRect(screen.x - 9, unitY - 4, 4, 8);
        } else if (u.type === 'giant') {
            // Frost Giant
            ctx.fillStyle = '#bae6fd';
            ctx.beginPath();
            ctx.arc(screen.x, unitY - 6, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        } else if (u.type === 'werewolf') {
            // Night-Stalker Werewolf
            ctx.fillStyle = '#450a0a';
            ctx.beginPath();
            ctx.arc(screen.x, unitY, 7, 0, Math.PI * 2);
            ctx.fill();
        } else if (u.type === 'archer') {
            // Archer
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.arc(screen.x, unitY, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        } else {
            // Peasant / Soldier
            ctx.fillStyle = u.color || '#38bdf8';
            ctx.beginPath();
            ctx.arc(screen.x, unitY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        // Health Bar if Damaged or Selected
        if (isSelected || u.hp < u.maxHp) {
            this.drawHealthBar(screen.x, unitY - 14, u.hp, u.maxHp, 22);
        }

        ctx.restore();
    }

    drawProjectile(p) {
        const ctx = this.ctx;
        const screen = this.worldToScreen(p.x, p.y);
        const visualY = screen.y - (p.arcHeight || 0);

        ctx.save();

        // Parabolic Ground Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y + 6, p.type === 'boulder' ? 6 : 4, p.type === 'boulder' ? 3 : 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Projectile Body
        if (p.type === 'arrow') {
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(screen.x - 3, visualY - 3);
            ctx.lineTo(screen.x + 3, visualY + 3);
            ctx.stroke();
        } else if (p.type === 'boulder') {
            ctx.fillStyle = '#78716c';
            ctx.beginPath();
            ctx.arc(screen.x, visualY - 4, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#292524';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        } else if (p.type === 'fire') {
            ctx.fillStyle = '#ef4444';
            ctx.shadowColor = '#f97316';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(screen.x, visualY - 6, 8, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    drawHealthBar(cx, cy, current, max, width = 30) {
        const ctx = this.ctx;
        const pct = Math.max(0, Math.min(1, current / max));
        const height = 4;
        const startX = cx - width / 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(startX - 1, cy - 1, width + 2, height + 2);

        ctx.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#eab308' : '#ef4444';
        ctx.fillRect(startX, cy, width * pct, height);
    }

    renderParticles() {
        const ctx = this.ctx;
        ctx.save();
        ctx.font = 'bold 12px MedievalSharp, cursive';
        ctx.textAlign = 'center';

        this.game.particles.forEach(p => {
            const screen = this.worldToScreen(p.x, p.y);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.fillText(p.text, screen.x, screen.y);
        });

        ctx.restore();
    }
}

if (typeof globalThis !== 'undefined') {
    globalThis.IsometricRenderer = IsometricRenderer;
}
