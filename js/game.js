/* ==========================================================================
   Citadel of Legends: Shattered Realms - Main Game Controller
   ========================================================================== */

class CitadelGame {
    constructor() {
        this.state = 'menu'; // 'menu', 'playing'
        this.faction = 'solaris';
        this.campaignMission = 1;
        this.mapType = 'valley';
        this.aiDifficulty = 'normal';

        this.gridSize = GAME_CONFIG.gridSize;
        this.map = [];
        this.buildings = [];
        this.units = [];
        this.projectiles = [];
        this.particles = [];

        this.camera = {
            x: 0,
            y: 0,
            zoom: 1.0,
            isDragging: false,
            startX: 0,
            startY: 0,
            hasDragged: false
        };

        this.activeTab = 'building';
        this.selectedTool = null;
        this.selectedEntity = null;

        this.economy = new EconomySystem(this);
        this.renderer = null;

        // Current Objective
        this.currentMissionData = null;
        this.objectiveCompleted = false;

        // Enemy Lord
        this.enemyKeep = null;
        this.enemySpawnTimer = 0;
    }

    init() {
        const canvas = document.getElementById('game-canvas');
        this.renderer = new IsometricRenderer(canvas, this);

        this.setupCanvasResize();
        this.setupInputListeners();
        this.setupKeyboardListeners();

        // Initial UI tab
        this.setTab('building');
    }

    setupCanvasResize() {
        const resize = () => {
            const canvas = this.renderer.canvas;
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = canvas.parentElement.clientHeight;
        };
        window.addEventListener('resize', resize);
        resize();
    }

    setupInputListeners() {
        const canvas = this.renderer.canvas;
        const dragThreshold = 6;
        let downClientX = 0;
        let downClientY = 0;

        // Prevent standard context menu on right click inside canvas
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        canvas.addEventListener('mousedown', (e) => {
            downClientX = e.clientX;
            downClientY = e.clientY;
            this.camera.isDragging = true;
            this.camera.startX = e.clientX - this.camera.x;
            this.camera.startY = e.clientY - this.camera.y;
            this.camera.hasDragged = false;
        });

        window.addEventListener('mousemove', (e) => {
            // Update hover tile for renderer ghost
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            if (mouseX >= 0 && mouseX <= canvas.width && mouseY >= 0 && mouseY <= canvas.height) {
                const world = this.renderer.screenToWorld(mouseX, mouseY);
                this.renderer.hoverTile = world;
            }

            if (this.camera.isDragging) {
                const moveDist = Math.hypot(e.clientX - downClientX, e.clientY - downClientY);
                if (moveDist > dragThreshold) {
                    this.camera.hasDragged = true;
                }
                this.camera.x = e.clientX - this.camera.startX;
                this.camera.y = e.clientY - this.camera.startY;
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (!this.camera.isDragging) return;
            this.camera.isDragging = false;

            // Only trigger placement or selection if mouse did NOT drag
            if (!this.camera.hasDragged && e.target === canvas) {
                const rect = canvas.getBoundingClientRect();
                const screenX = e.clientX - rect.left;
                const screenY = e.clientY - rect.top;
                const worldCoord = this.renderer.screenToWorld(screenX, screenY);

                if (e.button === 0) {
                    // Left Click: Place Building or Select Entity
                    if (this.selectedTool) {
                        this.tryPlaceBuilding(worldCoord.x, worldCoord.y);
                    } else {
                        this.selectEntityAt(worldCoord.x, worldCoord.y);
                    }
                } else if (e.button === 2) {
                    // Right Click: Cancel tool or issue unit order
                    if (this.selectedTool) {
                        this.clearSelectedTool();
                        Sound.playClick();
                    } else if (this.selectedEntity && this.selectedEntity instanceof Unit && !this.selectedEntity.isEnemy) {
                        // Check if targeting an enemy
                        const target = this.findEntityAt(worldCoord.x, worldCoord.y);
                        if (target && target.isEnemy) {
                            this.selectedEntity.attackTarget(target);
                            this.showToast(`Unit ordered to attack ${target.name}!`);
                            Sound.playSwordClash();
                        } else {
                            this.selectedEntity.moveTo(worldCoord.x + 0.5, worldCoord.y + 0.5);
                            this.showToast(`Unit ordered to move to (${worldCoord.x}, ${worldCoord.y})`);
                            Sound.playClick();
                        }
                    }
                }
            }
        });

        // Mouse Wheel Zoom
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = 1.12;
            if (e.deltaY < 0) {
                this.camera.zoom = Math.min(this.camera.zoom * zoomFactor, 2.5);
            } else {
                this.camera.zoom = Math.max(this.camera.zoom / zoomFactor, 0.45);
            }
        }, { passive: false });
    }

    setupKeyboardListeners() {
        window.addEventListener('keydown', (e) => {
            if (this.state !== 'playing') return;

            const panStep = 35;
            switch (e.key.toLowerCase()) {
                case 'w':
                case 'arrowup':
                    this.camera.y += panStep;
                    break;
                case 's':
                case 'arrowdown':
                    this.camera.y -= panStep;
                    break;
                case 'a':
                case 'arrowleft':
                    this.camera.x += panStep;
                    break;
                case 'd':
                case 'arrowright':
                    this.camera.x -= panStep;
                    break;
                case 'escape':
                    this.clearSelectedTool();
                    this.selectedEntity = null;
                    document.getElementById('inspector-card').classList.add('hidden');
                    break;
                case ' ':
                    this.centerOnKeep();
                    break;
                case '1':
                    this.setTab('building');
                    break;
                case '2':
                    this.setTab('military');
                    break;
                case '3':
                    this.setTab('defenses');
                    break;
                case '4':
                    this.setTab('mythic');
                    break;
            }
        });
    }

    centerOnKeep() {
        const keep = this.buildings.find(b => b.type === 'keep');
        if (keep) {
            const screen = this.renderer.worldToScreen(keep.gx + 1.5, keep.gy + 1.5);
            this.camera.x = -screen.x;
            this.camera.y = -screen.y;
            this.showToast("Camera centered on Citadel Keep");
        }
    }

    // --- Menu & Navigation ---
    showCampaignSelect() {
        document.getElementById('campaign-modal').classList.remove('hidden');
        Sound.playClick();
    }

    showSkirmishSetup() {
        document.getElementById('skirmish-modal').classList.remove('hidden');
        Sound.playClick();
    }

    hideModals() {
        document.getElementById('campaign-modal').classList.add('hidden');
        document.getElementById('skirmish-modal').classList.add('hidden');
        Sound.playClick();
    }

    toggleAudio() {
        const active = Sound.toggle();
        const textEl = document.getElementById('audio-btn-text');
        if (textEl) textEl.innerText = active ? 'Audio: ON' : 'Audio: OFF';
    }

    startCampaign(faction, missionId) {
        this.faction = faction;
        this.campaignMission = missionId;
        this.hideModals();

        const factionMissions = CAMPAIGN_MISSIONS[faction] || CAMPAIGN_MISSIONS.solaris;
        this.currentMissionData = factionMissions.find(m => m.id === missionId) || factionMissions[0];

        const biome = FACTIONS_DEF[faction]?.biome || 'valley';
        this.initGameWorld(biome);

        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('game-interface').classList.remove('hidden');

        this.state = 'playing';
        Sound.startAmbientMusic(this.faction);

        if (this.currentMissionData) {
            this.setObjective(this.currentMissionData.objective);
            this.showToast(`Campaign: ${this.currentMissionData.title}`);
        }

        this.runGameLoop();
    }

    launchSkirmish() {
        this.faction = document.getElementById('skirmish-faction').value;
        this.mapType = document.getElementById('skirmish-map').value;
        this.aiDifficulty = document.getElementById('skirmish-ai').value;
        this.currentMissionData = null;

        this.hideModals();
        this.initGameWorld(this.mapType);

        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('game-interface').classList.remove('hidden');

        this.state = 'playing';
        Sound.startAmbientMusic(this.faction);
        this.setObjective("Build defenses, recruit forces, and vanquish the rival lord!");
        this.showToast("Skirmish Battle Commenced!");

        this.runGameLoop();
    }

    returnToMenu() {
        this.state = 'menu';
        document.getElementById('game-interface').classList.add('hidden');
        document.getElementById('main-menu').classList.remove('hidden');
        Sound.playClick();
    }

    // --- World Initialization ---
    initGameWorld(mapType) {
        this.mapType = mapType;
        this.buildings = [];
        this.units = [];
        this.projectiles = [];
        this.particles = [];
        this.selectedTool = null;
        this.selectedEntity = null;
        this.objectiveCompleted = false;

        this.economy.reset(this.faction);

        // Generate Map Grid
        this.map = [];
        for (let x = 0; x < this.gridSize; x++) {
            this.map[x] = [];
            for (let y = 0; y < this.gridSize; y++) {
                let type = 'grass';
                if (mapType === 'tundra') type = 'snow';
                if (mapType === 'wasteland') type = 'blight';

                // Natural River
                if (x >= 28 && x <= 32 && y >= 8 && y <= 56) {
                    type = 'water';
                }

                // Rocky Outcrops
                if ((x >= 8 && x <= 11 && y >= 14 && y <= 17) ||
                    (x >= 45 && x <= 48 && y >= 40 && y <= 43)) {
                    type = 'rock';
                }

                this.map[x][y] = { type, occupied: false, buildingId: null };
            }
        }

        // Bridge across river
        for (let x = 28; x <= 32; x++) {
            this.map[x][30].type = mapType === 'tundra' ? 'snow' : mapType === 'wasteland' ? 'blight' : 'grass';
            this.map[x][31].type = mapType === 'tundra' ? 'snow' : mapType === 'wasteland' ? 'blight' : 'grass';
        }

        // Spawn Starting Buildings
        this.spawnBuilding('keep', 20, 28);
        this.spawnBuilding('stockpile', 17, 28);
        this.spawnBuilding('granary', 24, 28);

        // Spawn Initial Peasants
        for (let i = 0; i < 6; i++) {
            this.spawnPeasantAtKeep();
        }

        // Camera center on Keep
        this.centerOnKeep();

        this.updateUI();
    }

    spawnBuilding(type, gx, gy, isEnemy = false) {
        const building = new Building(type, gx, gy, isEnemy, this.faction);
        this.buildings.push(building);

        // Mark tiles as occupied
        for (let dx = 0; dx < building.w; dx++) {
            for (let dy = 0; dy < building.h; dy++) {
                const tile = this.map[gx + dx]?.[gy + dy];
                if (tile) {
                    tile.occupied = true;
                    tile.buildingId = building.id;
                }
            }
        }
        return building;
    }

    spawnPeasantAtKeep() {
        const keep = this.buildings.find(b => b.type === 'keep' && !b.isEnemy);
        const startX = keep ? keep.gx + 1.5 + (Math.random() * 2 - 1) : 20;
        const startY = keep ? keep.gy + 1.5 + (Math.random() * 2 - 1) : 28;

        const peasant = new Unit('peasant', startX, startY, false, this.faction);
        this.units.push(peasant);
        return peasant;
    }

    removePeasant() {
        const peasantIdx = this.units.findIndex(u => u.type === 'peasant' && !u.isEnemy);
        if (peasantIdx !== -1) {
            this.units.splice(peasantIdx, 1);
        }
    }

    // --- Placement Validation & Construction ---
    isValidPlacement(gx, gy, w, h) {
        // Bounds check
        if (gx < 0 || gy < 0 || gx + w > this.gridSize || gy + h > this.gridSize) {
            return false;
        }

        // Tile check
        for (let dx = 0; dx < w; dx++) {
            for (let dy = 0; dy < h; dy++) {
                const tile = this.map[gx + dx]?.[gy + dy];
                if (!tile || tile.occupied || tile.type === 'water' || tile.type === 'rock') {
                    return false;
                }
            }
        }
        return true;
    }

    tryPlaceBuilding(gx, gy) {
        if (!this.selectedTool) return;
        const key = this.selectedTool;

        // Check if tool is building or unit
        const bDef = BUILDINGS_DEF[key];
        const uDef = UNITS_DEF[key];

        if (bDef) {
            // Validate Placement
            if (!this.isValidPlacement(gx, gy, bDef.w, bDef.h)) {
                this.showToast('Invalid building site! Check obstacles or water.', true);
                Sound.playWarning();
                return;
            }

            // Verify Resources
            if (!this.economy.canAfford(bDef.cost)) {
                const missing = this.economy.getMissingResources(bDef.cost);
                this.showToast(`Insufficient Resources! Need: ${missing.join(', ')}`, true);
                Sound.playWarning();
                return;
            }

            // Deduct and construct
            this.economy.deductCost(bDef.cost);
            this.spawnBuilding(key, gx, gy, false);
            Sound.playBuild();
            this.spawnFloatingText(`+${bDef.name}`, gx + bDef.w / 2, gy + bDef.h / 2, '#22c55e');
            this.showToast(`Constructed ${bDef.name}`);

            this.checkObjectiveProgress();
            this.updateUI();
        } else if (uDef) {
            this.trainUnit(key);
        }
    }

    trainUnit(unitKey) {
        const def = UNITS_DEF[unitKey];
        if (!def) return;

        // Check Housing Capacity
        if (this.economy.pop.current >= this.economy.pop.max) {
            this.showToast('Cannot train: Housing capacity reached! Build Hovels.', true);
            Sound.playWarning();
            return;
        }

        // Check Full Resources Cost
        if (!this.economy.canAfford(def.cost)) {
            const missing = this.economy.getMissingResources(def.cost);
            this.showToast(`Insufficient Resources! Need: ${missing.join(', ')}`, true);
            Sound.playWarning();
            return;
        }

        // Deduct and Recruit
        this.economy.deductCost(def.cost);
        this.economy.pop.current++;

        // Find Barracks or Keep to spawn unit
        const rallyBuilding = this.buildings.find(b => b.type === 'barracks' || b.type === 'archery' || b.type === 'dragonRoost') ||
                              this.buildings.find(b => b.type === 'keep');
        const spawnX = rallyBuilding ? rallyBuilding.gx + rallyBuilding.w / 2 : 20;
        const spawnY = rallyBuilding ? rallyBuilding.gy + rallyBuilding.h / 2 : 28;

        const unit = new Unit(unitKey, spawnX, spawnY, false, this.faction);
        this.units.push(unit);

        if (unitKey === 'dragon') {
            Sound.playDragonRoar();
        } else {
            Sound.playSwordClash();
        }

        this.spawnFloatingText(`+${def.name}`, spawnX, spawnY, '#38bdf8');
        this.showToast(`Recruited ${def.name}`);

        this.checkObjectiveProgress();
        this.updateUI();
    }

    // --- Entity Selection & Inspection ---
    findEntityAt(gx, gy) {
        // Unit check first
        const unit = this.units.find(u => Math.hypot(u.x - (gx + 0.5), u.y - (gy + 0.5)) < 1.2);
        if (unit) return unit;

        // Building check
        return this.buildings.find(b => b.containsTile(gx, gy));
    }

    selectEntityAt(gx, gy) {
        const entity = this.findEntityAt(gx, gy);
        const card = document.getElementById('inspector-card');

        if (entity) {
            this.selectedEntity = entity;
            card.classList.remove('hidden');
            document.getElementById('inspector-title').innerText = entity.name;

            const def = BUILDINGS_DEF[entity.type] || UNITS_DEF[entity.type];
            document.getElementById('inspector-desc').innerText = def?.desc || '';

            let statsHtml = `<div>Health: <span class="font-bold text-white">${Math.ceil(entity.hp)} / ${entity.maxHp}</span></div>`;
            if (entity instanceof Unit) {
                statsHtml += `
                    <div>Attack: <span class="font-bold text-amber-300">${entity.atk}</span> &bull; Range: ${entity.range}</div>
                    <div>State: <span class="font-bold text-emerald-400 capitalize">${entity.state}</span></div>
                    <div class="text-[10px] text-stone-400 mt-1 italic">Right-click ground to move or enemy to attack.</div>
                `;
            } else if (entity instanceof Building) {
                statsHtml += `
                    <div>Footprint: ${entity.w}&times;${entity.h}</div>
                `;
                if (def.producer) {
                    statsHtml += `<div>Production: <span class="font-bold text-emerald-400">+${def.rate} ${def.producer.toUpperCase()}/s</span></div>`;
                }
            }

            document.getElementById('inspector-stats').innerHTML = statsHtml;
            Sound.playClick();
        } else {
            this.selectedEntity = null;
            card.classList.add('hidden');
        }
    }

    // --- Objective System ---
    setObjective(text) {
        const banner = document.getElementById('mission-objective-banner');
        const textEl = document.getElementById('objective-text');
        if (banner && textEl) {
            banner.classList.remove('hidden');
            textEl.innerText = text;
        }
    }

    checkObjectiveProgress() {
        if (!this.currentMissionData || this.objectiveCompleted) return;

        let completed = true;
        if (this.currentMissionData.reqBuildings) {
            for (const bType of this.currentMissionData.reqBuildings) {
                if (!this.buildings.some(b => b.type === bType)) {
                    completed = false;
                    break;
                }
            }
        }

        if (completed && this.currentMissionData.reqUnits) {
            for (const [uType, count] of Object.entries(this.currentMissionData.reqUnits)) {
                const currentCount = this.units.filter(u => u.type === uType).length;
                if (currentCount < count) {
                    completed = false;
                    break;
                }
            }
        }

        if (completed) {
            this.objectiveCompleted = true;
            this.economy.res.honor += 25;
            this.economy.res.gold += 100;
            this.showToast(`🎉 Objective Complete! +25 Honor, +100 Gold`);
            Sound.playCheer();
            this.setObjective(`COMPLETED: ${this.currentMissionData.title}`);
        }
    }

    // --- Particle & Projectile Spawners ---
    spawnFloatingText(text, gx, gy, color = '#fef3c7') {
        const particle = new Particle(gx, gy, text, color);
        this.particles.push(particle);
    }

    spawnProjectile(type, startX, startY, target, damage) {
        const p = new Projectile(type, startX, startY, target, damage);
        this.projectiles.push(p);
    }

    // --- UI Controls & Tray ---
    setTab(tab) {
        this.activeTab = tab;
        ['building', 'military', 'defenses', 'mythic'].forEach(t => {
            const btn = document.getElementById(`tab-btn-${t}`);
            if (btn) btn.classList.toggle('active', t === tab);
        });

        const tray = document.getElementById('action-tray');
        if (!tray) return;
        tray.innerHTML = '';

        let items = [];
        if (tab === 'building') {
            items = ['hovel', 'stockpile', 'granary', 'sawyer', 'quarry', 'mine', 'tar', 'hunter', 'bakery'];
        } else if (tab === 'military') {
            items = ['barracks', 'archery', 'siege', 'archer', 'halberdier', 'knight', 'catapult'];
        } else if (tab === 'defenses') {
            items = ['wall', 'tower', 'gatehouse'];
        } else if (tab === 'mythic') {
            items = ['dragonRoost', 'dragon', 'giant', 'werewolf'];
        }

        items.forEach(key => {
            const def = BUILDINGS_DEF[key] || UNITS_DEF[key];
            if (!def) return;
            const btn = document.createElement('button');
            btn.className = 'parchment-button px-3 py-2 rounded text-xs flex flex-col items-center justify-center min-w-[95px] shrink-0';
            btn.innerHTML = `
                <span class="font-bold text-amber-300 mb-0.5">${def.name}</span>
                <span class="text-[10px] text-stone-400">${this.formatCost(def.cost)}</span>
            `;
            btn.onclick = () => this.selectTool(key);
            tray.appendChild(btn);
        });

        this.clearSelectedTool();
    }

    formatCost(cost) {
        if (!cost || Object.keys(cost).length === 0) return 'Free';
        const parts = [];
        if (cost.gold) parts.push(`${cost.gold}G`);
        if (cost.wood) parts.push(`${cost.wood}W`);
        if (cost.stone) parts.push(`${cost.stone}S`);
        if (cost.iron) parts.push(`${cost.iron}I`);
        if (cost.pitch) parts.push(`${cost.pitch}P`);
        if (cost.honor) parts.push(`${cost.honor}H`);
        return parts.join(' ');
    }

    selectTool(key) {
        this.selectedTool = key;
        const def = BUILDINGS_DEF[key] || UNITS_DEF[key];
        this.showToast(`Selected: ${def.name}`);
        Sound.playClick();
    }

    clearSelectedTool() {
        this.selectedTool = null;
        if (this.renderer) {
            this.renderer.hoverTile = { x: -1, y: -1 };
        }
    }

    toggleEconomyModal() {
        const modal = document.getElementById('economy-modal');
        modal.classList.toggle('hidden');
        Sound.playClick();
    }

    updateRations(val) {
        this.economy.rations = parseInt(val);
        this.showToast('Rations policy updated');
        Sound.playClick();
    }

    updateTaxes(val) {
        this.economy.taxes = parseInt(val);
        this.showToast('Taxation policy updated');
        Sound.playClick();
    }

    showToast(msg, isWarning = false) {
        const banner = document.getElementById('toast-banner');
        if (!banner) return;
        banner.innerText = msg;
        banner.className = `absolute top-4 left-1/2 -translate-x-1/2 parchment-panel px-6 py-2 rounded-full font-bold text-sm shadow-2xl transition-opacity duration-300 z-30 pointer-events-none opacity-100 ${isWarning ? 'text-red-400 border-red-500' : 'text-amber-300 border-amber-500'}`;
        clearTimeout(this._toastTimeout);
        this._toastTimeout = setTimeout(() => {
            banner.classList.remove('opacity-100');
            banner.classList.add('opacity-0');
        }, 2800);
    }

    updateUI() {
        const res = this.economy.res;
        const pop = this.economy.pop;

        document.getElementById('res-wood').innerText = Math.floor(res.wood);
        document.getElementById('res-stone').innerText = Math.floor(res.stone);
        document.getElementById('res-iron').innerText = Math.floor(res.iron);
        document.getElementById('res-pitch').innerText = Math.floor(res.pitch);
        document.getElementById('res-gold').innerText = Math.floor(res.gold);
        document.getElementById('res-honor').innerText = Math.floor(res.honor);
        document.getElementById('res-food').innerText = Math.floor(res.food);
        document.getElementById('res-pop').innerText = `${pop.current} / ${pop.max}`;

        document.getElementById('popularity-badge').innerText = Math.floor(this.economy.popularity);
        const statusEl = document.getElementById('popularity-status');
        const popVal = this.economy.popularity;

        if (popVal >= 75) {
            statusEl.innerText = 'Rejoicing';
            statusEl.className = 'text-emerald-400 font-bold';
        } else if (popVal >= 50) {
            statusEl.innerText = 'Content';
            statusEl.className = 'text-green-400 font-bold';
        } else if (popVal >= 30) {
            statusEl.innerText = 'Unhappy';
            statusEl.className = 'text-amber-400 font-bold';
        } else {
            statusEl.innerText = 'Revolting';
            statusEl.className = 'text-red-500 font-bold';
        }
    }

    // --- Main Game Loop ---
    runGameLoop() {
        let lastTime = performance.now();

        const loop = (time) => {
            if (this.state !== 'playing') return;
            const dt = Math.min((time - lastTime) / 1000, 0.1);
            lastTime = time;

            this.update(dt);
            this.renderer.render();

            if (typeof requestAnimationFrame !== 'undefined') {
                requestAnimationFrame(loop);
            }
        };
        if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(loop);
        }
    }

    update(dt) {
        // 1. Update Economy
        this.economy.update(dt);

        // 2. Update Units
        for (let i = this.units.length - 1; i >= 0; i--) {
            const u = this.units[i];
            u.update(dt, this);
            if (u.hp <= 0) {
                this.units.splice(i, 1);
                this.spawnFloatingText("Dead", u.x, u.y, '#991b1b');
            }
        }

        // 3. Update Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            if (p.update(dt, this)) {
                this.projectiles.splice(i, 1);
            }
        }

        // 4. Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const part = this.particles[i];
            if (part.update(dt)) {
                this.particles.splice(i, 1);
            }
        }
    }
}

// Global Application Instance
const GameApp = new CitadelGame();
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        GameApp.init();
    });
}

if (typeof globalThis !== 'undefined') {
    globalThis.CitadelGame = CitadelGame;
    globalThis.GameApp = GameApp;
}
