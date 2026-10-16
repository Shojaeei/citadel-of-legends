/* ==========================================================================
   Citadel of Legends: Shattered Realms - Main Game Controller (Phase 2)
   ========================================================================== */

class CitadelGame {
    constructor() {
        this.state = 'menu'; // 'menu', 'playing', 'victory', 'defeat'
        this.faction = 'solaris';
        this.campaignMission = 1;
        this.mapType = 'valley';
        this.aiDifficulty = 'normal';
        this.simSpeed = 1.0;

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
        this.selectedUnits = []; // Multi-unit selection
        this.dragBox = { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 };
        this.repairMode = false;

        this.economy = new EconomySystem(this);
        this.pathfinding = new PathfindingEngine(this);
        this.renderer = null;
        this.devConsole = null;

        // Current Objective & Missions
        this.currentMissionData = null;
        this.objectiveCompleted = false;

        // Enemy AI Lord & Siege Wave System
        this.waveTimer = 60.0; // Seconds until next wave
        this.waveInterval = 60.0;
        this.currentWave = 0;
        this.maxWaves = 4;
        this.playerKeep = null;
        this.enemyKeep = null;

        // Stats tracking
        this.stats = {
            enemiesKilled: 0,
            buildingsConstructed: 0,
            playTime: 0
        };
    }

    init() {
        const canvas = document.getElementById('game-canvas');
        this.renderer = new IsometricRenderer(canvas, this);
        this.devConsole = new DevConsole(this);

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

        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            downClientX = e.clientX;
            downClientY = e.clientY;

            // Shift-drag or drag without tool activates marquee box selection
            if (e.button === 0 && (e.shiftKey || !this.selectedTool)) {
                this.dragBox = { active: true, startX: mouseX, startY: mouseY, currentX: mouseX, currentY: mouseY };
            }

            this.camera.isDragging = true;
            this.camera.startX = e.clientX - this.camera.x;
            this.camera.startY = e.clientY - this.camera.y;
            this.camera.hasDragged = false;
        });

        window.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            if (mouseX >= 0 && mouseX <= canvas.width && mouseY >= 0 && mouseY <= canvas.height) {
                const world = this.renderer.screenToWorld(mouseX, mouseY);
                this.renderer.hoverTile = world;

                if (this.dragBox && this.dragBox.active) {
                    this.dragBox.currentX = mouseX;
                    this.dragBox.currentY = mouseY;
                }
            }

            if (this.camera.isDragging && (!this.dragBox || !this.dragBox.active || !e.shiftKey)) {
                const moveDist = Math.hypot(e.clientX - downClientX, e.clientY - downClientY);
                if (moveDist > dragThreshold) {
                    this.camera.hasDragged = true;
                }
                this.camera.x = e.clientX - this.camera.startX;
                this.camera.y = e.clientY - this.camera.startY;
            }
        });

        window.addEventListener('mouseup', (e) => {
            // Check Marquee Box Selection
            if (this.dragBox && this.dragBox.active) {
                const bx = Math.min(this.dragBox.startX, this.dragBox.currentX);
                const by = Math.min(this.dragBox.startY, this.dragBox.currentY);
                const bw = Math.abs(this.dragBox.currentX - this.dragBox.startX);
                const bh = Math.abs(this.dragBox.currentY - this.dragBox.startY);
                this.dragBox.active = false;

                if (bw > 12 && bh > 12) {
                    const selected = [];
                    this.units.forEach(u => {
                        if (!u.isEnemy && !u.isWorker) {
                            const screen = this.renderer.worldToScreen(u.x, u.y);
                            const pixelX = this.renderer.canvas.width / 2 + this.camera.x + screen.x * this.camera.zoom;
                            const pixelY = 120 + this.camera.y + screen.y * this.camera.zoom;
                            if (pixelX >= bx && pixelX <= bx + bw && pixelY >= by && pixelY <= by + bh) {
                                selected.push(u);
                            }
                        }
                    });

                    if (selected.length > 0) {
                        this.selectedUnits = selected;
                        this.selectedEntity = selected[0];
                        this.showToast(`Selected ${selected.length} military units (Shift+Drag Box)`);
                        Sound.playSwordClash();
                        this.camera.isDragging = false;
                        return;
                    }
                }
            }

            if (!this.camera.isDragging) return;
            this.camera.isDragging = false;

            if (!this.camera.hasDragged && e.target === canvas) {
                const rect = canvas.getBoundingClientRect();
                const screenX = e.clientX - rect.left;
                const screenY = e.clientY - rect.top;
                const worldCoord = this.renderer.screenToWorld(screenX, screenY);

                if (e.button === 0) {
                    // Left Click
                    if (this.selectedTool) {
                        this.tryPlaceBuilding(worldCoord.x, worldCoord.y);
                    } else {
                        this.selectEntityAt(worldCoord.x, worldCoord.y);
                    }
                } else if (e.button === 2) {
                    // Right Click: Cancel tool or issue orders to selected military units
                    if (this.selectedTool) {
                        this.clearSelectedTool();
                        Sound.playClick();
                    } else if (this.selectedUnits.length > 0) {
                        const target = this.findEntityAt(worldCoord.x, worldCoord.y);
                        if (target && target.isEnemy) {
                            // Attack target command
                            this.selectedUnits.forEach(u => u.attackTarget(target, this));
                            this.showToast(`Ordered ${this.selectedUnits.length} units to attack ${target.name}!`);
                            Sound.playSwordClash();
                        } else {
                            // Move command with waypoint dispersion
                            this.selectedUnits.forEach((u, i) => {
                                const offsetAngle = (i / this.selectedUnits.length) * Math.PI * 2;
                                const spread = this.selectedUnits.length > 1 ? 0.7 : 0;
                                const tx = worldCoord.x + 0.5 + Math.cos(offsetAngle) * spread;
                                const ty = worldCoord.y + 0.5 + Math.sin(offsetAngle) * spread;
                                u.moveTo(tx, ty, this);
                            });
                            this.showToast(`Ordered ${this.selectedUnits.length} units to march`);
                            Sound.playClick();
                        }
                    } else if (this.selectedEntity && this.selectedEntity instanceof Unit && !this.selectedEntity.isEnemy) {
                        const target = this.findEntityAt(worldCoord.x, worldCoord.y);
                        if (target && target.isEnemy) {
                            this.selectedEntity.attackTarget(target, this);
                            this.showToast(`Unit ordered to attack ${target.name}!`);
                            Sound.playSwordClash();
                        } else {
                            this.selectedEntity.moveTo(worldCoord.x + 0.5, worldCoord.y + 0.5, this);
                            this.showToast(`Unit moving to (${worldCoord.x}, ${worldCoord.y})`);
                            Sound.playClick();
                        }
                    }
                }
            }
        });

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

            // Don't trigger game hotkeys if user is typing in dev console
            if (this.devConsole && this.devConsole.isOpen) return;

            const panStep = 40;
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
                    this.selectedUnits = [];
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
        const keep = this.playerKeep || this.buildings.find(b => b.type === 'keep' && !b.isEnemy);
        if (keep && this.renderer) {
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
        const vModal = document.getElementById('victory-modal');
        if (vModal) vModal.classList.add('hidden');
        const dModal = document.getElementById('defeat-modal');
        if (dModal) dModal.classList.add('hidden');
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
            if (this.devConsole) {
                this.devConsole.log(`Started Campaign Mission: ${this.currentMissionData.title}`, 'HERALD');
                this.devConsole.log(this.currentMissionData.dialogue, 'HERALD');
            }
        }

        this.runGameLoop();
    }

    launchSkirmish() {
        const fEl = document.getElementById('skirmish-faction');
        this.faction = (fEl && fEl.value) ? fEl.value : (this.faction || 'solaris');

        const mEl = document.getElementById('skirmish-map');
        this.mapType = (mEl && mEl.value) ? mEl.value : (this.mapType || 'valley');

        const aEl = document.getElementById('skirmish-ai');
        this.aiDifficulty = (aEl && aEl.value) ? aEl.value : (this.aiDifficulty || 'normal');
        this.currentMissionData = null;

        this.hideModals();
        this.initGameWorld(this.mapType);

        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('game-interface').classList.remove('hidden');

        this.state = 'playing';
        Sound.startAmbientMusic(this.faction);
        this.setObjective("Destroy the rival enemy keep across the river to claim victory!");
        this.showToast("Skirmish Battle Commenced!");

        if (this.devConsole) {
            this.devConsole.log(`Skirmish launched. Faction: ${this.faction.toUpperCase()} | AI Difficulty: ${this.aiDifficulty.toUpperCase()}`, 'HERALD');
        }

        this.runGameLoop();
    }

    returnToMenu() {
        this.state = 'menu';
        document.getElementById('game-interface').classList.add('hidden');
        document.getElementById('main-menu').classList.remove('hidden');
        this.hideModals();
        Sound.playClick();
    }

    // --- World & Castle Initialization ---
    initGameWorld(mapType) {
        this.mapType = mapType;
        this.buildings = [];
        this.units = [];
        this.projectiles = [];
        this.particles = [];
        this.selectedTool = null;
        this.selectedEntity = null;
        this.selectedUnits = [];
        this.objectiveCompleted = false;

        this.currentWave = 0;
        this.waveTimer = this.aiDifficulty === 'hard' ? 45.0 : this.aiDifficulty === 'easy' ? 80.0 : 60.0;
        this.stats = { enemiesKilled: 0, buildingsConstructed: 0, playTime: 0 };

        this.economy.reset(this.faction);

        // Generate Map Grid
        this.map = [];
        for (let x = 0; x < this.gridSize; x++) {
            this.map[x] = [];
            for (let y = 0; y < this.gridSize; y++) {
                let type = 'grass';
                if (mapType === 'tundra') type = 'snow';
                if (mapType === 'wasteland') type = 'blight';

                // Natural River dividing West and East
                if (x >= 29 && x <= 33 && y >= 6 && y <= 58) {
                    type = 'water';
                }

                // Rocky Outcrops
                if ((x >= 8 && x <= 11 && y >= 12 && y <= 15) ||
                    (x >= 52 && x <= 55 && y >= 44 && y <= 47)) {
                    type = 'rock';
                }

                this.map[x][y] = { type, occupied: false, buildingId: null };
            }
        }

        // Fortified River Bridge Crossing
        for (let x = 29; x <= 33; x++) {
            for (let y = 29; y <= 32; y++) {
                this.map[x][y].type = mapType === 'tundra' ? 'snow' : mapType === 'wasteland' ? 'blight' : 'grass';
            }
        }

        // Spawn Player Stronghold (Western Region)
        this.playerKeep = this.spawnBuilding('keep', 18, 28, false, this.faction);
        this.spawnBuilding('stockpile', 15, 28, false, this.faction);
        this.spawnBuilding('granary', 22, 28, false, this.faction);

        // Spawn Starting Peasants
        for (let i = 0; i < 6; i++) {
            this.spawnPeasantAtKeep();
        }

        // Spawn Enemy AI Lord Fortress (Eastern Shore)
        const enemyFaction = this.faction === 'obsidian' ? 'solaris' : 'obsidian';
        this.enemyKeep = this.spawnBuilding('keep', 48, 28, true, enemyFaction);
        this.enemyKeep.name = "Rival Dread Lord Keep";
        this.spawnBuilding('tower', 44, 25, true, enemyFaction);
        this.spawnBuilding('tower', 44, 33, true, enemyFaction);
        this.spawnBuilding('barracks', 52, 28, true, enemyFaction);

        // Enemy Initial Defenders
        for (let i = 0; i < 4; i++) {
            const defender = new Unit('halberdier', 45 + (Math.random() * 4), 28 + (Math.random() * 4 - 2), true, enemyFaction);
            this.units.push(defender);
        }

        this.centerOnKeep();
        this.updateUI();
    }

    spawnBuilding(type, gx, gy, isEnemy = false, faction = 'solaris') {
        const building = new Building(type, gx, gy, isEnemy, faction);
        this.buildings.push(building);

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
        const keep = this.playerKeep || this.buildings.find(b => b.type === 'keep' && !b.isEnemy);
        const startX = keep ? keep.gx + 1.5 + (Math.random() * 2 - 1) : 18;
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

    handleBuildingDestruction(b) {
        Sound.playBuild();
        this.spawnFloatingText(`DESTROYED!`, b.gx + b.w * 0.5, b.gy + b.h * 0.5, '#ef4444');

        // Clear occupancy
        for (let dx = 0; dx < b.w; dx++) {
            for (let dy = 0; dy < b.h; dy++) {
                const tile = this.map[b.gx + dx]?.[b.gy + dy];
                if (tile) {
                    tile.occupied = false;
                    tile.buildingId = null;
                }
            }
        }

        // Remove from list
        const idx = this.buildings.indexOf(b);
        if (idx !== -1) {
            this.buildings.splice(idx, 1);
        }

        // Check Keep destruction
        if (b === this.playerKeep) {
            this.triggerDefeat();
        } else if (b === this.enemyKeep) {
            this.triggerVictory();
        }
    }

    // --- Wave Invasions & AI Lord ---
    triggerEnemyWave() {
        this.currentWave++;
        this.waveTimer = this.aiDifficulty === 'hard' ? 45.0 : 60.0;

        const enemyFaction = this.enemyKeep ? this.enemyKeep.faction : 'obsidian';
        const spawnX = this.enemyKeep ? this.enemyKeep.gx : 48;
        const spawnY = this.enemyKeep ? this.enemyKeep.gy : 28;

        let troops = [];
        if (this.currentWave === 1) {
            troops = ['halberdier', 'halberdier', 'archer', 'archer'];
        } else if (this.currentWave === 2) {
            troops = ['halberdier', 'halberdier', 'archer', 'archer', 'catapult'];
        } else if (this.currentWave === 3) {
            troops = ['knight', 'knight', 'archer', 'archer', 'catapult', 'catapult'];
        } else {
            const mythicUnit = enemyFaction === 'frost' ? 'giant' : enemyFaction === 'obsidian' ? 'werewolf' : 'dragon';
            troops = [mythicUnit, 'knight', 'knight', 'catapult', 'catapult', 'archer', 'archer'];
        }

        troops.forEach((uType, i) => {
            setTimeout(() => {
                const enemy = new Unit(uType, spawnX + (Math.random() * 2 - 1), spawnY + (Math.random() * 2 - 1), true, enemyFaction);
                // Target player's keep
                if (this.playerKeep) {
                    enemy.attackTarget(this.playerKeep, this);
                }
                this.units.push(enemy);
            }, i * 200);
        });

        this.showToast(`⚔️ INVASION! Wave ${this.currentWave} is marching across the river!`, true);
        Sound.playDragonRoar();

        if (this.devConsole) {
            this.devConsole.log(`Enemy Siege Wave ${this.currentWave} dispatched (${troops.join(', ')})!`, 'AI LORD');
        }
    }

    // --- Placement Validation & Construction ---
    isValidPlacement(gx, gy, w, h) {
        if (gx < 0 || gy < 0 || gx + w > this.gridSize || gy + h > this.gridSize) {
            return false;
        }

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

        const bDef = BUILDINGS_DEF[key];
        const uDef = UNITS_DEF[key];

        if (bDef) {
            if (!this.isValidPlacement(gx, gy, bDef.w, bDef.h)) {
                this.showToast('Invalid building site! Check obstacles or water.', true);
                Sound.playWarning();
                return;
            }

            if (!this.economy.canAfford(bDef.cost)) {
                const missing = this.economy.getMissingResources(bDef.cost);
                this.showToast(`Insufficient Resources! Need: ${missing.join(', ')}`, true);
                Sound.playWarning();
                return;
            }

            this.economy.deductCost(bDef.cost);
            this.spawnBuilding(key, gx, gy, false, this.faction);
            this.stats.buildingsConstructed++;
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

        if (this.economy.pop.current >= this.economy.pop.max) {
            this.showToast('Cannot train: Housing capacity reached! Build Hovels.', true);
            Sound.playWarning();
            return;
        }

        if (!this.economy.canAfford(def.cost)) {
            const missing = this.economy.getMissingResources(def.cost);
            this.showToast(`Insufficient Resources! Need: ${missing.join(', ')}`, true);
            Sound.playWarning();
            return;
        }

        this.economy.deductCost(def.cost);
        this.economy.pop.current++;

        const rallyBuilding = this.buildings.find(b => !b.isEnemy && (b.type === 'barracks' || b.type === 'archery' || b.type === 'dragonRoost')) ||
                              this.playerKeep || this.buildings[0];
        const spawnX = rallyBuilding ? rallyBuilding.gx + rallyBuilding.w / 2 : 18;
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
        const unit = this.units.find(u => Math.hypot(u.x - (gx + 0.5), u.y - (gy + 0.5)) < 1.2);
        if (unit) return unit;
        return this.buildings.find(b => b.containsTile(gx, gy));
    }

    selectEntityAt(gx, gy) {
        const entity = this.findEntityAt(gx, gy);
        const card = document.getElementById('inspector-card');

        if (entity) {
            this.selectedEntity = entity;
            if (entity instanceof Unit && !entity.isEnemy) {
                this.selectedUnits = [entity];
            } else {
                this.selectedUnits = [];
            }

            card.classList.remove('hidden');
            document.getElementById('inspector-title').innerText = `${entity.name} ${entity.isEnemy ? '(Hostile)' : ''}`;

            const def = BUILDINGS_DEF[entity.type] || UNITS_DEF[entity.type];
            document.getElementById('inspector-desc').innerText = def?.desc || '';

            let statsHtml = `<div>Health: <span class="font-bold text-white">${Math.ceil(entity.hp)} / ${entity.maxHp}</span></div>`;
            if (entity instanceof Unit) {
                statsHtml += `
                    <div>Attack: <span class="font-bold text-amber-300">${entity.atk}</span> &bull; Range: ${entity.range}</div>
                    <div>State: <span class="font-bold text-emerald-400 capitalize">${entity.state}</span></div>
                    <div class="text-[10px] text-stone-400 mt-1 italic">Right-click ground to march or enemy to attack.</div>
                `;
            } else if (entity instanceof Building) {
                statsHtml += `<div>Footprint: ${entity.w}&times;${entity.h}</div>`;
                if (entity.isTower) {
                    statsHtml += `<div class="text-sky-300 font-bold">Watchtower Garrison: Automated Arrow Volleys</div>`;
                }
                if (def.producer) {
                    statsHtml += `<div>Production: <span class="font-bold text-emerald-400">+${def.rate} ${def.producer.toUpperCase()}/s</span></div>`;
                }
                if (!entity.isEnemy && entity.hp < entity.maxHp) {
                    statsHtml += `
                        <div class="mt-2 pt-2 border-t border-stone-700/60 flex items-center justify-between">
                            <span class="text-xs text-amber-200">Damaged: ${Math.round(entity.hp)}/${entity.maxHp} HP</span>
                            <button onclick="GameApp.repairBuilding(GameApp.selectedEntity)" class="parchment-button px-2.5 py-1 text-xs rounded text-amber-300 font-bold hover:text-white pointer-events-auto">
                                🔨 Repair (5W, 8S)
                            </button>
                        </div>
                    `;
                }
            }

            document.getElementById('inspector-stats').innerHTML = statsHtml;
            Sound.playClick();
        } else {
            this.selectedEntity = null;
            this.selectedUnits = [];
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
                if (!this.buildings.some(b => b.type === bType && !b.isEnemy)) {
                    completed = false;
                    break;
                }
            }
        }

        if (completed && this.currentMissionData.reqUnits) {
            for (const [uType, count] of Object.entries(this.currentMissionData.reqUnits)) {
                const currentCount = this.units.filter(u => u.type === uType && !u.isEnemy).length;
                if (currentCount < count) {
                    completed = false;
                    break;
                }
            }
        }

        if (completed) {
            this.objectiveCompleted = true;
            this.economy.res.honor += 30;
            this.economy.res.gold += 150;
            this.showToast(`🎉 Objective Complete! +30 Honor, +150 Gold`);
            Sound.playCheer();
            this.setObjective(`COMPLETED: ${this.currentMissionData.title}`);

            if (this.devConsole) {
                this.devConsole.log(`Mission Objective Completed: ${this.currentMissionData.title}!`, 'HERALD');
            }
        }
    }

    // --- Victory & Defeat Modals ---
    triggerVictory() {
        this.state = 'victory';
        Sound.playCheer();
        const vModal = document.getElementById('victory-modal');
        if (vModal) {
            vModal.classList.remove('hidden');
            document.getElementById('victory-stats').innerHTML = `
                <div>Play Time: ${Math.floor(this.stats.playTime)} seconds</div>
                <div>Enemies Slain: ${this.stats.enemiesKilled}</div>
                <div>Structures Erected: ${this.stats.buildingsConstructed}</div>
                <div>Final Popularity: ${this.economy.popularity}%</div>
            `;
        }
        if (this.devConsole) {
            this.devConsole.log("VICTORY! The Citadel has triumphed over its rivals!", 'HERALD');
        }
    }

    triggerDefeat() {
        this.state = 'defeat';
        Sound.playWarning();
        const dModal = document.getElementById('defeat-modal');
        if (dModal) {
            dModal.classList.remove('hidden');
        }
        if (this.devConsole) {
            this.devConsole.log("DEFEAT: Your Citadel Keep has fallen!", 'AI LORD');
        }
    }

    advanceNextMission() {
        const faction = this.faction || 'solaris';
        const factionMissions = CAMPAIGN_MISSIONS[faction] || CAMPAIGN_MISSIONS.solaris;
        const currentId = this.currentMissionData ? this.currentMissionData.id : 1;
        const nextMission = factionMissions.find(m => m.id === currentId + 1);
        if (nextMission) {
            this.startCampaign(faction, nextMission.id);
        } else {
            this.showToast('You have conquered all campaign missions for this faction! Hail Sovereign!', false);
            this.returnToMenu();
        }
    }

    selectAllMilitary() {
        const military = this.units.filter(u => !u.isEnemy && !u.isWorker);
        if (military.length === 0) {
            this.showToast('No active military units found in your garrison!', true);
            return;
        }
        this.selectedUnits = military;
        this.selectedEntity = military[0];
        this.showToast(`Selected all ${military.length} military units!`);
        Sound.playSwordClash();
    }

    repairBuilding(b) {
        if (!b || b.isEnemy) return;
        if (b.hp >= b.maxHp) {
            this.showToast('Structure is already at full structural integrity.');
            return;
        }
        const cost = { wood: 5, stone: 8 };
        if (!this.economy.canAfford(cost)) {
            const missing = this.economy.getMissingResources(cost);
            this.showToast(`Cannot repair: Need ${missing.join(', ')}`, true);
            Sound.playWarning();
            return;
        }
        this.economy.deductCost(cost);
        b.repair(300);
        Sound.playBuild();
        this.spawnFloatingText('+Repair', b.gx + b.w / 2, b.gy + b.h / 2, '#38bdf8');
        this.showToast(`Repaired ${b.name} (+300 HP)`);
        this.selectEntityAt(b.gx, b.gy);
        this.updateUI();
    }

    triggerBoilingPitch() {
        const cost = { pitch: 5 };
        if (!this.economy.canAfford(cost)) {
            this.showToast('Boiling Pitch requires 5 Pitch from your stockpile!', true);
            Sound.playWarning();
            return;
        }
        this.economy.deductCost(cost);
        Sound.playShatter();

        const defenses = this.buildings.filter(b => !b.isEnemy && (b.type === 'wall' || b.type === 'tower' || b.type === 'gatehouse' || b.type === 'keep'));
        let burntCount = 0;

        this.units.forEach(u => {
            if (u.isEnemy) {
                const nearDefense = defenses.some(b => {
                    const cx = b.gx + b.w / 2;
                    const cy = b.gy + b.h / 2;
                    return Math.hypot(u.x - cx, u.y - cy) <= 4.0;
                });
                if (nearDefense) {
                    u.takeDamage(75, this);
                    this.spawnFloatingText('-75 Fire', u.x, u.y, '#f97316');
                    burntCount++;
                }
            }
        });

        this.showToast(`🔥 Boiling Pitch poured! ${burntCount} enemy invaders engulfed!`);
        if (this.devConsole) {
            this.devConsole.log(`Boiling Pitch defense triggered: ${burntCount} enemies engulfed in flames!`, 'DEFENSE');
        }
        this.updateUI();
    }

    // --- Particles & Projectiles ---
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
            if (this.faction === 'solaris') items.push('cathedral');
            else if (this.faction === 'frost') items.push('runestone');
            else if (this.faction === 'obsidian') items.push('crucible');
        } else if (tab === 'military') {
            items = ['barracks', 'archery', 'siege', 'archer', 'halberdier', 'knight', 'catapult'];
            if (this.faction === 'solaris') items.push('paladin');
            else if (this.faction === 'frost') items.push('valkyrie');
            else if (this.faction === 'obsidian') items.push('vampire');
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

        // Wave HUD Countdown
        const waveEl = document.getElementById('wave-countdown');
        if (waveEl) {
            waveEl.innerText = `Wave ${this.currentWave + 1} in: ${Math.ceil(this.waveTimer)}s`;
        }
    }

    // --- Main Game Loop ---
    runGameLoop() {
        let lastTime = performance.now();

        const loop = (time) => {
            if (this.state !== 'playing') return;
            const rawDt = Math.min((time - lastTime) / 1000, 0.1);
            lastTime = time;
            const dt = rawDt * this.simSpeed;

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
        this.stats.playTime += dt;

        // 1. Update Wave Timer & Siege Invasions
        this.waveTimer -= dt;
        if (this.waveTimer <= 0) {
            this.triggerEnemyWave();
        }

        // 2. Update Economy
        this.economy.update(dt);

        // 3. Update Defensive Buildings (e.g. Watchtowers)
        this.buildings.forEach(b => {
            if (b.update) b.update(dt, this);
        });

        // 4. Update Units
        for (let i = this.units.length - 1; i >= 0; i--) {
            const u = this.units[i];
            u.update(dt, this);
            if (u.hp <= 0) {
                if (u.isEnemy) {
                    this.stats.enemiesKilled++;
                    this.economy.res.gold += 12; // Gold bounty for defeating enemy
                }
                this.units.splice(i, 1);
                this.spawnFloatingText("Slain", u.x, u.y, '#991b1b');
            }
        }

        // 5. Update Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            if (p.update(dt, this)) {
                this.projectiles.splice(i, 1);
            }
        }

        // 6. Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const part = this.particles[i];
            if (part.update(dt)) {
                this.particles.splice(i, 1);
            }
        }

        // Update UI every tick
        this.updateUI();
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
