/* ==========================================================================
   Citadel of Legends: Shattered Realms - Main Game Controller (v1.0)
   ========================================================================== */

const UI_REFRESH_INTERVAL = 0.15; // seconds between HUD DOM refreshes
const OBJECTIVE_CHECK_INTERVAL = 0.5;
const DIFFICULTY_HP = { easy: 0.8, normal: 1.0, hard: 1.25 };
const SKIRMISH_WAVES = {
    easy: { enabled: true, firstDelay: 80, interval: 75, composition: 'standard' },
    normal: { enabled: true, firstDelay: 60, interval: 60, composition: 'standard' },
    hard: { enabled: true, firstDelay: 45, interval: 45, composition: 'standard' }
};

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function $id(id) {
    return typeof document !== 'undefined' ? document.getElementById(id) : null;
}

class CitadelGame {
    constructor() {
        this.state = 'menu'; // 'menu', 'playing', 'victory', 'defeat'
        this.faction = 'solaris';
        this.campaignMission = 1;
        this.mapType = 'valley';
        this.aiDifficulty = 'normal';
        this.simSpeed = 1.0;
        this.speedBeforePause = 1;
        this.briefingOpen = false;
        this.menuPaused = false;
        this.adPaused = false;

        this.gridSize = GAME_CONFIG.gridSize;
        this.map = [];
        this.buildings = [];
        this.buildingIndex = new Map();
        this.units = [];
        this.projectiles = [];
        this.particles = [];
        this.unitHash = new SpatialHash(4);

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
        this.selectedUnits = [];
        this.dragBox = { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 };
        this.repairMode = false;

        this.settings = new SettingsManager();
        this.economy = new EconomySystem(this);
        this.pathfinding = new PathfindingEngine(this);
        this.fog = new FogOfWar(this.gridSize);
        this.fx = new FxSystem();
        this.campaign = new CampaignDirector(this);
        this.saveSystem = new SaveSystem(this);
        this.renderer = null;
        this.minimap = null;
        this.touch = null;
        this.devConsole = null;

        // Current Objective & Missions
        this.currentMissionData = null;
        this.objectiveCompleted = false;
        this.taggedStructureCount = {};

        // Enemy AI Lord & Siege Wave System
        this.waveConfig = SKIRMISH_WAVES.normal;
        this.waveTimer = 60.0;
        this.currentWave = 0;
        this.spawnQueue = [];
        this.activeWaves = {};
        this.playerKeep = null;
        this.enemyKeep = null;

        this.stats = { enemiesKilled: 0, buildingsConstructed: 0, playTime: 0 };

        this._uiTimer = 0;
        this._objectiveTimer = 0;
        this._loopStarted = false;
        this._fps = 60;
        this._commentaryShown = {};
        this.rebindingAction = null;
    }

    init() {
        const canvas = $id('game-canvas');
        this.renderer = new IsometricRenderer(canvas, this);
        this.devConsole = new DevConsole(this);
        const mm = $id('minimap-canvas');
        if (mm) this.minimap = new Minimap(mm, this);
        this.touch = new TouchController(this, canvas);

        this.applySettings();
        this.setupCanvasResize();
        this.setupInputListeners();
        this.setupKeyboardListeners();

        this.setTab('building');
        this.renderCampaignMenu();
        this.refreshMainMenu();
        this.maybeShowConsentBanner();

        if (typeof Monetization !== 'undefined') {
            Monetization.init(this).then(() => this.refreshMonetizationUI()).catch(() => {});
        }
        this.registerServiceWorker();
        this.startLoop();
    }

    registerServiceWorker() {
        try {
            if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator &&
                typeof location !== 'undefined' && /^https?:$/.test(location.protocol) &&
                !(typeof window !== 'undefined' && window.CITADEL_DISABLE_SW)) {
                navigator.serviceWorker.register('sw.js').catch(() => { /* offline support optional */ });
            }
        } catch (e) { /* ignore */ }
    }

    applySettings() {
        const s = this.settings.data;
        Sound.setVolumes(s.volumes);
        if (Sound.enabled !== s.audioEnabled) Sound.toggle();
        this.fx.weatherEnabled = s.weather && !s.reducedMotion;
        const audioText = $id('audio-btn-text');
        if (audioText) audioText.innerText = Sound.enabled ? 'Audio: ON' : 'Audio: OFF';
        const mmWrap = $id('minimap-wrap');
        if (mmWrap) mmWrap.classList.toggle('hidden', !s.showMinimap);
    }

    resizeCanvas() {
        if (!this.renderer || !this.renderer.canvas) return;
        const canvas = this.renderer.canvas;
        const parent = canvas.parentElement;
        if (parent && parent.clientWidth > 0 && parent.clientHeight > 0) {
            if (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight) {
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;
                this.fx.resize(canvas.width, canvas.height);
            }
        }
    }

    setupCanvasResize() {
        const resize = () => this.resizeCanvas();
        window.addEventListener('resize', resize);
        this.resizeCanvas();
        if (typeof ResizeObserver !== 'undefined' && this.renderer && this.renderer.canvas && this.renderer.canvas.parentElement) {
            new ResizeObserver(() => this.resizeCanvas()).observe(this.renderer.canvas.parentElement);
        }
    }

    // ------------------------------------------------------------------
    // Camera helpers
    // ------------------------------------------------------------------
    panBy(dx, dy) {
        this.camera.x += dx;
        this.camera.y += dy;
    }

    /** Zoom keeping the world point under (px, py) fixed on screen. */
    zoomAt(px, py, factor) {
        if (!this.renderer || !this.renderer.canvas) return;
        const old = this.camera.zoom;
        const next = Math.max(0.45, Math.min(2.5, old * factor));
        if (next === old) return;
        const cw = this.renderer.canvas.width / 2;
        const ch = this.renderer.canvas.height / 2;
        const sx = (px - cw - this.camera.x) / old;
        const sy = (py - ch - this.camera.y) / old;
        this.camera.zoom = next;
        this.camera.x = px - cw - sx * next;
        this.camera.y = py - ch - sy * next;
    }

    centerCameraOn(gx, gy) {
        const sx = (gx - gy) * (GAME_CONFIG.tileWidth / 2);
        const sy = (gx + gy) * (GAME_CONFIG.tileHeight / 2);
        this.camera.x = -sx * this.camera.zoom;
        this.camera.y = -sy * this.camera.zoom;
    }

    centerOnKeep(silent = false) {
        const keep = this.playerKeep || this.buildings.find(b => b.type === 'keep' && !b.isEnemy);
        if (keep) {
            this.centerCameraOn(keep.gx + 1.5, keep.gy + 1.5);
            if (!silent && this.state === 'playing') this.showToast('Camera centered on Citadel Keep');
        }
    }

    // ------------------------------------------------------------------
    // Input
    // ------------------------------------------------------------------
    setupInputListeners() {
        const canvas = this.renderer.canvas;
        const dragThreshold = 6;
        let downClientX = 0;
        let downClientY = 0;

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            downClientX = e.clientX;
            downClientY = e.clientY;

            // Shift + left drag = marquee box selection. Plain drag = pan.
            if (e.button === 0 && e.shiftKey) {
                this.dragBox = { active: true, startX: mouseX, startY: mouseY, currentX: mouseX, currentY: mouseY };
                return;
            }
            this.camera.isDragging = true;
            this.camera.dragButton = e.button;
            this.camera.startX = e.clientX - this.camera.x;
            this.camera.startY = e.clientY - this.camera.y;
            this.camera.hasDragged = false;
        });

        window.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            if (mouseX >= 0 && mouseX <= canvas.width && mouseY >= 0 && mouseY <= canvas.height) {
                this.renderer.hoverTile = this.renderer.screenToWorld(mouseX, mouseY);
            }
            if (this.dragBox.active) {
                this.dragBox.currentX = mouseX;
                this.dragBox.currentY = mouseY;
                return;
            }
            if (this.camera.isDragging) {
                if (Math.hypot(e.clientX - downClientX, e.clientY - downClientY) > dragThreshold) {
                    this.camera.hasDragged = true;
                }
                if (this.camera.hasDragged) {
                    this.camera.x = e.clientX - this.camera.startX;
                    this.camera.y = e.clientY - this.camera.startY;
                }
            }
        });

        window.addEventListener('mouseup', (e) => {
            const rect = canvas.getBoundingClientRect();
            if (this.dragBox.active) {
                this.dragBox.active = false;
                this.selectInScreenBox(this.dragBox.startX, this.dragBox.startY, this.dragBox.currentX, this.dragBox.currentY);
                return;
            }
            if (!this.camera.isDragging) return;
            this.camera.isDragging = false;
            if (this.camera.hasDragged || e.target !== canvas) return;

            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            if (e.button === 0) this.handlePrimaryAction(sx, sy);
            else if (e.button === 2) this.handleCommandAction(sx, sy);
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            this.zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
        }, { passive: false });
    }

    selectInScreenBox(x0, y0, x1, y1) {
        const bx = Math.min(x0, x1);
        const by = Math.min(y0, y1);
        const bw = Math.abs(x1 - x0);
        const bh = Math.abs(y1 - y0);
        if (bw <= 12 || bh <= 12 || !this.renderer) return 0;
        const selected = [];
        this.units.forEach(u => {
            if (!u.isEnemy && !u.isWorker) {
                const screen = this.renderer.worldToScreen(u.x, u.y);
                const pixelX = this.renderer.canvas.width / 2 + this.camera.x + screen.x * this.camera.zoom;
                const pixelY = this.renderer.canvas.height / 2 + this.camera.y + screen.y * this.camera.zoom;
                if (pixelX >= bx && pixelX <= bx + bw && pixelY >= by && pixelY <= by + bh) selected.push(u);
            }
        });
        if (selected.length > 0) {
            this.selectedUnits = selected;
            this.selectedEntity = selected[0];
            this.showToast(`Selected ${selected.length} military units`);
            Sound.playSwordClash();
        }
        return selected.length;
    }

    /** Left click / tap: build with the active tool or select an entity. */
    handlePrimaryAction(screenX, screenY) {
        if (this.state !== 'playing' || !this.renderer) return;
        const w = this.renderer.screenToWorld(screenX, screenY);
        if (this.selectedTool) this.tryPlaceBuilding(w.x, w.y);
        else this.selectEntityAt(w.x, w.y);
    }

    /** Right click / long-press: cancel tool, or order selected units. */
    handleCommandAction(screenX, screenY) {
        if (this.state !== 'playing' || !this.renderer) return;
        const w = this.renderer.screenToWorld(screenX, screenY);
        if (this.selectedTool) {
            this.clearSelectedTool();
            Sound.playClick();
            return;
        }
        let squad = this.selectedUnits.filter(u => u.hp > 0);
        if (squad.length === 0 && this.selectedEntity instanceof Unit && !this.selectedEntity.isEnemy) squad = [this.selectedEntity];
        if (squad.length === 0) return;
        this.issueOrder(squad, w.x, w.y);
    }

    issueOrder(squad, gx, gy) {
        const target = this.findEntityAt(gx, gy);
        if (target && target.isEnemy && this.isEntityVisible(target)) {
            squad.forEach(u => u.attackTarget(target, this));
            this.showToast(`Ordered ${squad.length} unit${squad.length > 1 ? 's' : ''} to attack ${target.name}!`);
            Sound.playSwordClash();
        } else {
            squad.forEach((u, i) => {
                const angle = (i / squad.length) * Math.PI * 2;
                const spread = squad.length > 1 ? 0.7 + Math.floor(i / 8) * 0.6 : 0;
                u.moveTo(gx + 0.5 + Math.cos(angle) * spread, gy + 0.5 + Math.sin(angle) * spread, this);
            });
            this.showToast(`Ordered ${squad.length} unit${squad.length > 1 ? 's' : ''} to march`);
            Sound.playClick();
        }
    }

    setupKeyboardListeners() {
        window.addEventListener('keydown', (e) => {
            // Key-capture mode for the rebind UI takes priority over everything.
            if (this.rebindingAction) {
                e.preventDefault();
                e.stopPropagation();
                const action = this.rebindingAction;
                this.rebindingAction = null;
                if (e.key !== 'Escape') {
                    const res = this.settings.rebind(action, e.key);
                    if (!res.ok) this.showToast(`Cannot bind: ${res.reason}`, true);
                    else if (res.swappedWith) this.showToast(`Swapped with "${KEYBIND_LABELS[res.swappedWith]}"`);
                }
                this.renderSettingsKeybinds();
                return;
            }

            if (e.key === 'Escape') {
                if (this.closeTopModal()) return;
            }
            if (this.state !== 'playing') return;
            if (this.devConsole && this.devConsole.isOpen) return;
            const tag = e.target && e.target.tagName;
            if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

            const panStep = 40;
            switch (e.key) {
                case 'ArrowUp': this.panBy(0, panStep); return;
                case 'ArrowDown': this.panBy(0, -panStep); return;
                case 'ArrowLeft': this.panBy(panStep, 0); return;
                case 'ArrowRight': this.panBy(-panStep, 0); return;
                case 'Escape':
                    this.clearSelectedTool();
                    this.selectedEntity = null;
                    this.selectedUnits = [];
                    if ($id('inspector-card')) $id('inspector-card').classList.add('hidden');
                    return;
                case '+':
                case '=':
                    if (this.renderer) this.zoomAt(this.renderer.canvas.width / 2, this.renderer.canvas.height / 2, 1.12);
                    return;
                case '-':
                    if (this.renderer) this.zoomAt(this.renderer.canvas.width / 2, this.renderer.canvas.height / 2, 1 / 1.12);
                    return;
                default:
                    break;
            }

            const action = this.settings.actionForKey(e.key);
            if (!action) return;
            if (action === 'centerKeep') e.preventDefault();
            this.performAction(action);
        });
    }

    performAction(action) {
        const panStep = 40;
        switch (action) {
            case 'panUp': this.panBy(0, panStep); break;
            case 'panDown': this.panBy(0, -panStep); break;
            case 'panLeft': this.panBy(panStep, 0); break;
            case 'panRight': this.panBy(-panStep, 0); break;
            case 'centerKeep': this.centerOnKeep(); break;
            case 'tabBuilding': this.setTab('building'); break;
            case 'tabMilitary': this.setTab('military'); break;
            case 'tabDefenses': this.setTab('defenses'); break;
            case 'tabMythic': this.setTab('mythic'); break;
            case 'pause': this.togglePause(); break;
            case 'speedUp': this.cycleSpeed(1); break;
            case 'speedDown': this.cycleSpeed(-1); break;
            case 'selectArmy': this.selectAllMilitary(); break;
            case 'boilingPitch': this.triggerBoilingPitch(); break;
            case 'quickSave': this.saveToSlot('slot1'); break;
            case 'quickLoad': this.loadFromSlot('slot1'); break;
            case 'toggleMinimap': {
                const v = !this.settings.data.showMinimap;
                this.settings.set('showMinimap', v);
                this.applySettings();
                break;
            }
            default: return false;
        }
        return true;
    }

    // ------------------------------------------------------------------
    // Game speed & pause
    // ------------------------------------------------------------------
    setSpeed(speed) {
        if (!GAME_SPEEDS.includes(speed)) return false;
        if (speed > 0) this.speedBeforePause = speed;
        this.simSpeed = speed;
        this.refreshSpeedUI();
        if (speed === 0) Monetization.gameplayStop();
        else if (this.state === 'playing') Monetization.gameplayStart();
        return true;
    }

    togglePause() {
        if (this.simSpeed === 0) this.setSpeed(this.speedBeforePause || 1);
        else this.setSpeed(0);
        this.showToast(this.simSpeed === 0 ? 'Paused' : `Resumed (${this.simSpeed}x)`);
    }

    cycleSpeed(dir) {
        const idx = GAME_SPEEDS.indexOf(this.simSpeed);
        const next = GAME_SPEEDS[Math.max(0, Math.min(GAME_SPEEDS.length - 1, (idx === -1 ? 1 : idx) + dir))];
        this.setSpeed(next);
        this.showToast(next === 0 ? 'Paused' : `Game speed: ${next}x`);
    }

    refreshSpeedUI() {
        GAME_SPEEDS.forEach(s => {
            const b = $id(`speed-btn-${s}`);
            if (b) b.classList.toggle('active', this.simSpeed === s);
        });
        const ind = $id('pause-indicator');
        if (ind) ind.classList.toggle('hidden', this.simSpeed !== 0);
    }

    setAdPause(paused) {
        this.adPaused = !!paused;
    }

    isSimulationRunning() {
        return this.state === 'playing' && this.simSpeed > 0 && !this.briefingOpen && !this.menuPaused && !this.adPaused;
    }

    // ------------------------------------------------------------------
    // Menu & Navigation
    // ------------------------------------------------------------------
    showCampaignSelect() {
        this.renderCampaignMenu();
        $id('campaign-modal').classList.remove('hidden');
        Sound.playClick();
    }

    showSkirmishSetup() {
        $id('skirmish-modal').classList.remove('hidden');
        Sound.playClick();
    }

    hideModals() {
        ['campaign-modal', 'skirmish-modal', 'victory-modal', 'defeat-modal', 'save-modal', 'settings-modal', 'supporter-modal'].forEach(id => {
            const el = $id(id);
            if (el) el.classList.add('hidden');
        });
        this.menuPaused = false;
        Sound.playClick();
    }

    closeTopModal() {
        const order = ['settings-modal', 'save-modal', 'supporter-modal', 'economy-modal', 'campaign-modal', 'skirmish-modal'];
        for (const id of order) {
            const el = $id(id);
            if (el && el.classList && !el.classList.contains('hidden')) {
                el.classList.add('hidden');
                if (id === 'settings-modal' || id === 'save-modal' || id === 'supporter-modal') this.menuPaused = false;
                return true;
            }
        }
        return false;
    }

    toggleAudio() {
        const active = Sound.toggle();
        this.settings.set('audioEnabled', active);
        const textEl = $id('audio-btn-text');
        if (textEl) textEl.innerText = active ? 'Audio: ON' : 'Audio: OFF';
    }

    enterGameInterface() {
        $id('main-menu').classList.add('hidden');
        $id('game-interface').classList.remove('hidden');
        this.resizeCanvas();
        this.fx.setBiome(this.mapType, this.renderer ? this.renderer.canvas.width : 1280, this.renderer ? this.renderer.canvas.height : 720);
        this.centerOnKeep(true);
    }

    startCampaign(faction, missionId) {
        this.faction = FACTIONS_DEF[faction] ? faction : 'solaris';
        this.campaignMission = missionId;
        this.aiDifficulty = 'normal';
        this.hideModals();

        const factionMissions = CAMPAIGN_MISSIONS[this.faction];
        this.currentMissionData = factionMissions.find(m => m.id === missionId) || factionMissions[0];

        const biome = FACTIONS_DEF[this.faction].biome || 'valley';
        this.initGameWorld(biome);
        this.enterGameInterface();

        this.state = 'playing';
        this.setSpeed(1);
        Sound.startAmbientMusic(this.faction);

        const m = this.currentMissionData;
        this.setObjective(m.objective);
        this.showBriefing(m);
        if (this.devConsole) {
            this.devConsole.log(`Started Campaign Mission: ${m.title}`, 'HERALD');
            this.devConsole.log(m.dialogue, 'HERALD');
        }
        this.showDevCommentary('missionStart');
    }

    launchSkirmish() {
        const fEl = $id('skirmish-faction');
        this.faction = (fEl && FACTIONS_DEF[fEl.value]) ? fEl.value : (this.faction || 'solaris');
        const mEl = $id('skirmish-map');
        this.mapType = (mEl && ['valley', 'tundra', 'wasteland'].includes(mEl.value)) ? mEl.value : (this.mapType || 'valley');
        const aEl = $id('skirmish-ai');
        this.aiDifficulty = (aEl && DIFFICULTY_HP[aEl.value]) ? aEl.value : (this.aiDifficulty || 'normal');
        const fogEl = $id('skirmish-fog');
        this.currentMissionData = null;

        this.hideModals();
        this.initGameWorld(this.mapType);
        if (fogEl && fogEl.checked === false) this.fog.enabled = false;
        this.enterGameInterface();

        this.state = 'playing';
        this.setSpeed(1);
        Sound.startAmbientMusic(this.faction);
        this.setObjective('Destroy the rival enemy keep across the river to claim victory!');
        this.showToast('Skirmish Battle Commenced!');
        this.renderObjectiveTracker();

        if (this.devConsole) {
            this.devConsole.log(`Skirmish launched. Faction: ${this.faction.toUpperCase()} | AI Difficulty: ${this.aiDifficulty.toUpperCase()}`, 'HERALD');
        }
    }

    retryCurrent() {
        if (this.currentMissionData) this.startCampaign(this.faction, this.currentMissionData.id);
        else this.launchSkirmish();
    }

    returnToMenu() {
        this.state = 'menu';
        this.briefingOpen = false;
        $id('game-interface').classList.add('hidden');
        $id('main-menu').classList.remove('hidden');
        const br = $id('briefing-modal');
        if (br) br.classList.add('hidden');
        this.hideModals();
        Monetization.gameplayStop();
        this.refreshMainMenu();
        Monetization.maybeInterstitial('menu');
    }

    refreshMainMenu() {
        const cont = $id('continue-btn');
        if (cont) {
            const auto = this.saveSystem.describeSlot('auto');
            cont.classList.toggle('hidden', !auto || auto.corrupt);
            const label = $id('continue-label');
            if (label && auto && !auto.corrupt) label.innerText = auto.label;
        }
    }

    continueFromAutosave() {
        this.loadFromSlot('auto');
    }

    renderCampaignMenu() {
        const progress = CampaignDirector.loadProgress();
        ['solaris', 'frost', 'obsidian'].forEach(f => {
            const list = $id(`campaign-list-${f}`);
            if (!list) return;
            const p = progress[f];
            list.innerHTML = CAMPAIGN_MISSIONS[f].map(m => {
                const locked = m.id > p.unlocked;
                const star = p.bonus[String(m.id)] ? '<span class="text-amber-300" title="Bonus objective achieved">&#9733;</span>' : '<span class="text-stone-600">&#9734;</span>';
                return `<button ${locked ? 'disabled' : ''} onclick="GameApp.startCampaign('${f}', ${m.id})" class="parchment-button w-full text-left px-2.5 py-1.5 rounded text-[11px] flex items-center justify-between gap-2 mb-1.5" aria-label="Mission ${m.id}: ${escapeHtml(m.title)}${locked ? ' (locked)' : ''}">
                    <span>${locked ? '&#128274;' : ''} M${m.id}: ${escapeHtml(m.title)}</span>${star}</button>`;
            }).join('');
        });
    }

    // ------------------------------------------------------------------
    // Mission briefing
    // ------------------------------------------------------------------
    showBriefing(m) {
        const modal = $id('briefing-modal');
        if (!modal) return;
        this.briefingOpen = true;
        const f = FACTIONS_DEF[this.faction];
        $id('briefing-faction').innerText = `${f.bannerIcon} ${f.name} - Mission ${m.id}`;
        $id('briefing-title').innerText = m.title;
        $id('briefing-text').innerText = m.briefing || m.dialogue;
        $id('briefing-objectives').innerHTML = m.objectives.map(o => `<li class="flex gap-2"><span class="text-amber-400">&#9876;</span><span>${escapeHtml(o.label)}</span></li>`).join('') +
            (m.bonus ? `<li class="flex gap-2 text-amber-200/80 mt-1"><span>&#9733;</span><span>Bonus: ${escapeHtml(m.bonus.label)}</span></li>` : '');
        const waves = m.waves && m.waves.enabled
            ? `Enemy siege waves begin in ~${m.waves.firstDelay}s${m.waves.max ? ` (${m.waves.max} total)` : ''}.`
            : 'No siege waves are expected - focus on your economy.';
        $id('briefing-intel').innerText = waves;
        modal.classList.remove('hidden');
    }

    beginMission() {
        const modal = $id('briefing-modal');
        if (modal) modal.classList.add('hidden');
        this.briefingOpen = false;
        Monetization.gameplayStart();
        this.renderObjectiveTracker();
        Sound.playHorn();
    }

    // ------------------------------------------------------------------
    // World & Castle Initialization
    // ------------------------------------------------------------------
    /** Clears all dynamic world state; used by new games and save loading. */
    resetWorldState(mapType) {
        this.mapType = mapType;
        this.buildings = [];
        this.buildingIndex = new Map();
        this.units = [];
        this.projectiles = [];
        this.particles = [];
        this.unitHash.clear();
        this.selectedTool = null;
        this.selectedEntity = null;
        this.selectedUnits = [];
        this.objectiveCompleted = false;
        this.taggedStructureCount = {};
        this.spawnQueue = [];
        this.activeWaves = {};
        this.currentWave = 0;
        this.stats = { enemiesKilled: 0, buildingsConstructed: 0, playTime: 0 };
        this.fog.reset();
        this.fog.enabled = true;
        this.fx.clearCombat();
        this.campaign.reset();
        this.saveSystem.autosaveTimer = 0;
        this._commentaryShown = {};
        this.waveConfig = this.currentMissionData
            ? (this.currentMissionData.waves || { enabled: false })
            : (SKIRMISH_WAVES[this.aiDifficulty] || SKIRMISH_WAVES.normal);
        this.waveTimer = this.waveConfig.enabled ? this.waveConfig.firstDelay : 0;

        this.map = [];
        for (let x = 0; x < this.gridSize; x++) {
            this.map[x] = [];
            for (let y = 0; y < this.gridSize; y++) {
                this.map[x][y] = { type: 'grass', occupied: false, buildingId: null };
            }
        }
    }

    generateTerrain(mapType) {
        const base = mapType === 'tundra' ? 'snow' : mapType === 'wasteland' ? 'blight' : 'grass';
        for (let x = 0; x < this.gridSize; x++) {
            for (let y = 0; y < this.gridSize; y++) {
                let type = base;
                // Natural River dividing West and East
                if (x >= 29 && x <= 33 && y >= 6 && y <= 58) type = 'water';
                // Rocky Outcrops
                if ((x >= 8 && x <= 11 && y >= 12 && y <= 15) || (x >= 52 && x <= 55 && y >= 44 && y <= 47)) type = 'rock';
                this.map[x][y].type = type;
            }
        }
        // Fortified River Bridge Crossing
        for (let x = 29; x <= 33; x++) {
            for (let y = 29; y <= 32; y++) {
                this.map[x][y].type = base;
            }
        }
    }

    initGameWorld(mapType) {
        this.resetWorldState(mapType);
        this.economy.reset(this.faction);
        this.generateTerrain(mapType);

        // Player Stronghold (Western Region)
        this.playerKeep = this.spawnBuilding('keep', 18, 28, false, this.faction);
        this.spawnBuilding('stockpile', 15, 28, false, this.faction);
        this.spawnBuilding('granary', 22, 28, false, this.faction);

        // Starting peasants match the configured starting population.
        for (let i = 0; i < GAME_CONFIG.startingPopulation.current; i++) {
            this.spawnPeasantAtKeep();
        }

        // Enemy AI Lord Fortress (Eastern Shore)
        const enemyFaction = this.enemyFaction();
        this.enemyKeep = this.spawnBuilding('keep', 48, 28, true, enemyFaction);
        this.enemyKeep.name = 'Rival Dread Lord Keep';
        this.spawnBuilding('tower', 44, 25, true, enemyFaction);
        this.spawnBuilding('tower', 44, 33, true, enemyFaction);
        this.spawnBuilding('barracks', 52, 28, true, enemyFaction);

        for (let i = 0; i < 4; i++) {
            this.units.push(this.createEnemyUnit('halberdier', 45 + Math.random() * 4, 28 + (Math.random() * 4 - 2), enemyFaction));
        }

        if (this.currentMissionData) this.applyMissionSetup(this.currentMissionData);
        this.onWorldLoaded();
    }

    enemyFaction() {
        return this.faction === 'obsidian' ? 'solaris' : 'obsidian';
    }

    createEnemyUnit(type, x, y, faction) {
        const u = new Unit(type, x, y, true, faction);
        const mult = (DIFFICULTY_HP[this.aiDifficulty] || 1) * (1 + Math.max(0, this.currentWave - 4) * 0.08);
        u.maxHp = Math.round(u.maxHp * mult);
        u.hp = u.maxHp;
        return u;
    }

    applyMissionSetup(m) {
        if (m.startRes) {
            for (const [k, v] of Object.entries(m.startRes)) {
                if (this.economy.res[k] !== undefined) this.economy.res[k] = v;
            }
        }
        if (typeof m.taxes === 'number') {
            this.economy.taxes = m.taxes;
            const sel = $id('taxes-select');
            if (sel) sel.value = String(m.taxes);
        }
        const place = (list, isEnemy) => (list || []).forEach(s => {
            const def = BUILDINGS_DEF[s.type];
            // Scripted structures ignore unit occupancy (randomly placed defenders
            // must never be able to cancel a mission-critical building).
            if (!def || !this.isValidPlacement(s.gx, s.gy, def.w, def.h, { ignoreUnits: true })) return;
            const b = this.spawnBuilding(s.type, s.gx, s.gy, isEnemy, isEnemy ? this.enemyFaction() : this.faction);
            if (s.tag) {
                b.tag = s.tag;
                this.taggedStructureCount[s.tag] = (this.taggedStructureCount[s.tag] || 0) + 1;
            }
        });
        place(m.playerStructures, false);
        place(m.enemyStructures, true);
        if (m.enemyKeepName && this.enemyKeep) this.enemyKeep.name = m.enemyKeepName;
        if (m.enemyGeneral) {
            const general = this.createEnemyUnit('warlord', 46.5, 29.5, this.enemyFaction());
            if (m.enemyGeneral.name) general.name = m.enemyGeneral.name;
            general.aggroRadius = 7;
            this.units.push(general);
        }
    }

    onWorldLoaded() {
        this.rebuildBuildingIndex();
        this.unitHash.rebuild(this.units);
        this.fog.recompute(this);
        this.fog.shade.set(this.fog._targetShade);
        if (this.minimap) this.minimap.markTerrainDirty();
        if (this.renderer && this.renderer.markTerrainDirty) this.renderer.markTerrainDirty();
        if (this.renderer) this.fx.setBiome(this.mapType, this.renderer.canvas.width, this.renderer.canvas.height);
        this.centerOnKeep(true);
        this.updateUI();
        this.renderObjectiveTracker();
        const r = $id('rations-select');
        if (r) r.value = String(this.economy.rations);
        const t = $id('taxes-select');
        if (t) t.value = String(this.economy.taxes);
    }

    rebuildBuildingIndex() {
        this.buildingIndex = new Map();
        for (const b of this.buildings) this.buildingIndex.set(b.id, b);
    }

    spawnBuilding(type, gx, gy, isEnemy = false, faction = 'solaris') {
        const building = new Building(type, gx, gy, isEnemy, faction);
        this.buildings.push(building);
        this.buildingIndex.set(building.id, building);

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
        const startY = keep ? keep.gy + 3.4 + Math.random() * 0.5 : 28;
        const peasant = new Unit('peasant', startX, startY, false, this.faction);
        this.units.push(peasant);
        return peasant;
    }

    removePeasant() {
        const peasantIdx = this.units.findIndex(u => u.type === 'peasant' && !u.isEnemy);
        if (peasantIdx !== -1) this.units.splice(peasantIdx, 1);
    }

    handleBuildingDestruction(b) {
        if (!this.buildings.includes(b)) return; // already processed
        Sound.playBuild();
        this.spawnFloatingText('DESTROYED!', b.gx + b.w * 0.5, b.gy + b.h * 0.5, '#ef4444');
        this.fx.emitRubble(b.gx + b.w * 0.5, b.gy + b.h * 0.5, 18 + (b.w * b.h) * 6);

        for (let dx = 0; dx < b.w; dx++) {
            for (let dy = 0; dy < b.h; dy++) {
                const tile = this.map[b.gx + dx]?.[b.gy + dy];
                if (tile) {
                    tile.occupied = false;
                    tile.buildingId = null;
                }
            }
        }

        const idx = this.buildings.indexOf(b);
        if (idx !== -1) this.buildings.splice(idx, 1);
        this.buildingIndex.delete(b.id);
        if (this.selectedEntity === b) this.selectedEntity = null;

        if (b.isEnemy) {
            this.campaign.recordEnemyBuildingDestroyed(b);
            this.economy.res.honor += b.type === 'keep' ? 25 : 3;
        }

        if (b === this.playerKeep) {
            this.triggerDefeat();
        } else if (b === this.enemyKeep) {
            if (!this.currentMissionData) this.triggerVictory();
            else this.checkObjectiveProgress();
        } else if (this.currentMissionData) {
            this.checkObjectiveProgress();
        }
    }

    // ------------------------------------------------------------------
    // Wave Invasions & AI Lord
    // ------------------------------------------------------------------
    wavesExhausted() {
        const c = this.waveConfig;
        return !c || !c.enabled || (c.max && this.currentWave >= c.max);
    }

    buildWaveTroops(wave, composition, enemyFaction) {
        if (composition === 'cavalry') {
            const knights = Math.min(12, 3 + 2 * (wave - 1));
            return [...Array(knights).fill('knight'), 'archer', 'archer'];
        }
        if (wave === 1) return ['halberdier', 'halberdier', 'archer', 'archer'];
        if (wave === 2) return ['halberdier', 'halberdier', 'archer', 'archer', 'catapult'];
        if (wave === 3) return ['knight', 'knight', 'archer', 'archer', 'catapult', 'catapult'];
        const mythicUnit = enemyFaction === 'frost' ? 'giant' : enemyFaction === 'obsidian' ? 'werewolf' : 'paladin';
        const extra = Math.min(8, wave - 4);
        return [mythicUnit, 'knight', 'knight', 'catapult', 'catapult', 'archer', 'archer', ...Array(extra).fill('halberdier')];
    }

    triggerEnemyWave() {
        this.currentWave++;
        const cfg = this.waveConfig && this.waveConfig.enabled ? this.waveConfig : SKIRMISH_WAVES.normal;
        this.waveTimer = cfg.interval || 60;

        const enemyFaction = this.enemyKeep ? this.enemyKeep.faction : this.enemyFaction();
        const spawnX = this.enemyKeep ? this.enemyKeep.gx - 0.5 : 47;
        const spawnY = this.enemyKeep ? this.enemyKeep.gy + 1.5 : 29.5;
        const troops = this.buildWaveTroops(this.currentWave, cfg.composition, enemyFaction);
        const waveId = this.currentWave;
        this.activeWaves[waveId] = true;

        // Timed spawn queue (simulation-time, pausable, serializable) instead of setTimeout.
        troops.forEach((type, i) => {
            this.spawnQueue.push({
                type, delay: i * 0.25, waveId,
                x: spawnX + (Math.random() * 2 - 1), y: spawnY + (Math.random() * 2 - 1), faction: enemyFaction
            });
        });

        this.showToast(`INVASION! Wave ${this.currentWave} is marching across the river!`, true);
        Sound.playDragonRoar();
        this.showDevCommentary('firstWave');
        if (this.devConsole) this.devConsole.log(`Enemy Siege Wave ${this.currentWave} dispatched (${troops.join(', ')})!`, 'AI LORD');
        return troops;
    }

    processSpawnQueue(dt) {
        for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
            const q = this.spawnQueue[i];
            q.delay -= dt;
            if (q.delay > 0) continue;
            this.spawnQueue.splice(i, 1);
            const enemy = this.createEnemyUnit(q.type, q.x, q.y, q.faction);
            enemy.waveId = q.waveId;
            if (this.playerKeep) enemy.attackTarget(this.playerKeep, this);
            this.units.push(enemy);
        }
    }

    checkWaveCompletion() {
        for (const key of Object.keys(this.activeWaves)) {
            const waveId = Number(key);
            const pending = this.spawnQueue.some(q => q.waveId === waveId);
            const alive = this.units.some(u => u.isEnemy && u.waveId === waveId && u.hp > 0);
            if (!pending && !alive) {
                delete this.activeWaves[key];
                this.campaign.recordWaveSurvived();
                this.economy.res.honor += 5;
                this.showToast(`Wave ${waveId} repelled! +5 Honor`);
                Sound.playCheer();
                const res = this.saveSystem.autosave('wave');
                if (this.devConsole) this.devConsole.log(`Wave ${waveId} repelled. ${res.ok ? 'Auto-saved.' : 'Auto-save unavailable.'}`, 'HERALD');
                this.checkObjectiveProgress();
            }
        }
    }

    // ------------------------------------------------------------------
    // Placement Validation & Construction
    // ------------------------------------------------------------------
    isValidPlacement(gx, gy, w, h, { ignoreUnits = false } = {}) {
        if (gx < 0 || gy < 0 || gx + w > this.gridSize || gy + h > this.gridSize) return false;
        for (let dx = 0; dx < w; dx++) {
            for (let dy = 0; dy < h; dy++) {
                const tile = this.map[gx + dx]?.[gy + dy];
                if (!tile || tile.occupied || tile.type === 'water' || tile.type === 'rock') return false;
            }
        }
        // Units standing on the footprint block construction (prevents trapping).
        if (ignoreUnits) return true;
        for (const u of this.units) {
            if (u.hp > 0 && !u.isFlying && u.x >= gx && u.x < gx + w && u.y >= gy && u.y < gy + h) return false;
        }
        return true;
    }

    tryPlaceBuilding(gx, gy) {
        if (!this.selectedTool) return false;
        const key = this.selectedTool;
        const bDef = BUILDINGS_DEF[key];
        const uDef = UNITS_DEF[key];

        if (bDef) {
            if (this.fog.enabled && !this.fog.isExplored(gx, gy)) {
                this.showToast('You cannot build in unexplored territory!', true);
                Sound.playWarning();
                return false;
            }
            if (!this.isValidPlacement(gx, gy, bDef.w, bDef.h)) {
                this.showToast('Invalid building site! Check obstacles, troops or water.', true);
                Sound.playWarning();
                return false;
            }
            if (!this.economy.canAfford(bDef.cost)) {
                const missing = this.economy.getMissingResources(bDef.cost);
                this.showToast(`Insufficient Resources! Need: ${missing.join(', ')}`, true);
                Sound.playWarning();
                return false;
            }

            this.economy.deductCost(bDef.cost);
            this.spawnBuilding(key, gx, gy, false, this.faction);
            this.stats.buildingsConstructed++;
            this.campaign.recordBuilt(key);
            if (this.minimap) this.minimap.markTerrainDirty();
            Sound.playBuild();
            this.spawnFloatingText(`+${bDef.name}`, gx + bDef.w / 2, gy + bDef.h / 2, '#22c55e');
            this.showToast(`Constructed ${bDef.name}`);
            this.showDevCommentary('firstBuild');

            this.checkObjectiveProgress();
            this.updateUI();
            return true;
        } else if (uDef) {
            return this.trainUnit(key);
        }
        return false;
    }

    trainUnit(unitKey) {
        const def = UNITS_DEF[unitKey];
        if (!def || def.isGeneral) return false;

        let rallyBuilding = null;
        if (def.requires) {
            rallyBuilding = this.buildings.find(b => !b.isEnemy && b.type === def.requires);
            if (!rallyBuilding) {
                this.showToast(`Requires a ${BUILDINGS_DEF[def.requires].name} to recruit ${def.name}.`, true);
                Sound.playWarning();
                return false;
            }
        }

        if (this.economy.pop.current >= this.economy.pop.max) {
            this.showToast('Cannot train: Housing capacity reached! Build Hovels.', true);
            Sound.playWarning();
            return false;
        }

        if (!this.economy.canAfford(def.cost)) {
            const missing = this.economy.getMissingResources(def.cost);
            this.showToast(`Insufficient Resources! Need: ${missing.join(', ')}`, true);
            Sound.playWarning();
            return false;
        }

        this.economy.deductCost(def.cost);
        this.economy.pop.current++;

        rallyBuilding = rallyBuilding || this.buildings.find(b => !b.isEnemy && (b.type === 'barracks' || b.type === 'archery')) || this.playerKeep || this.buildings[0];
        const spawnX = rallyBuilding ? rallyBuilding.gx + rallyBuilding.w / 2 : 18;
        const spawnY = rallyBuilding ? rallyBuilding.gy + rallyBuilding.h + 0.4 : 28;

        const unit = new Unit(unitKey, spawnX, spawnY, false, this.faction);
        this.units.push(unit);
        this.campaign.recordTrained(unitKey);

        if (unitKey === 'dragon') {
            Sound.playDragonRoar();
            this.showDevCommentary('dragon');
        } else {
            Sound.playSwordClash();
        }

        this.spawnFloatingText(`+${def.name}`, spawnX, spawnY, '#38bdf8');
        this.showToast(`Recruited ${def.name}`);

        this.checkObjectiveProgress();
        this.updateUI();
        return true;
    }

    // ------------------------------------------------------------------
    // Entity Selection & Inspection
    // ------------------------------------------------------------------
    isEntityVisible(e) {
        if (!e.isEnemy || !this.fog.enabled) return true;
        if (e instanceof Building) return this.fog.isExplored(e.gx, e.gy);
        return this.fog.isVisible(e.x, e.y);
    }

    findEntityAt(gx, gy) {
        const unit = this.units.find(u => u.hp > 0 && Math.hypot(u.x - (gx + 0.5), u.y - (gy + 0.5)) < 1.2 && this.isEntityVisible(u));
        if (unit) return unit;
        return this.buildings.find(b => b.containsTile(gx, gy) && this.isEntityVisible(b));
    }

    selectEntityAt(gx, gy) {
        const entity = this.findEntityAt(gx, gy);
        const card = $id('inspector-card');

        if (entity) {
            this.selectedEntity = entity;
            this.selectedUnits = (entity instanceof Unit && !entity.isEnemy) ? [entity] : [];
            this.renderInspector(entity);
            card.classList.remove('hidden');
            Sound.playClick();
        } else {
            this.selectedEntity = null;
            this.selectedUnits = [];
            card.classList.add('hidden');
        }
    }

    renderInspector(entity) {
        $id('inspector-title').innerText = `${entity.name} ${entity.isEnemy ? '(Hostile)' : ''}`;
        const def = BUILDINGS_DEF[entity.type] || UNITS_DEF[entity.type];
        $id('inspector-desc').innerText = def?.desc || '';

        let statsHtml = `<div>Health: <span class="font-bold text-white">${Math.ceil(entity.hp)} / ${entity.maxHp}</span></div>`;
        if (entity instanceof Unit) {
            statsHtml += `
                <div>Attack: <span class="font-bold text-amber-300">${entity.currentAttack()}</span> &bull; Range: ${entity.range}</div>
                <div>State: <span class="font-bold text-emerald-400 capitalize">${escapeHtml(entity.state)}</span>${entity.isConcealed() ? ' &bull; <span class="text-purple-300">Concealed</span>' : ''}</div>
                <div class="text-[10px] text-stone-400 mt-1 italic">Right-click (or long-press) ground to march or an enemy to attack.</div>`;
        } else if (entity instanceof Building) {
            statsHtml += `<div>Footprint: ${entity.w}&times;${entity.h}</div>`;
            if (entity.isTower) statsHtml += '<div class="text-sky-300 font-bold">Watchtower Garrison: Automated Arrow Volleys</div>';
            if (entity.isCauldron) statsHtml += '<div class="text-orange-300 font-bold">Scalds adjacent invaders (1 Pitch per pour)</div>';
            if (def && def.producer) statsHtml += `<div>Production: <span class="font-bold text-emerald-400">+${def.rate} ${def.producer.toUpperCase()}/s</span></div>`;
            if (!entity.isEnemy && entity.hp < entity.maxHp) {
                statsHtml += `
                    <div class="mt-2 pt-2 border-t border-stone-700/60 flex items-center justify-between">
                        <span class="text-xs text-amber-200">Damaged: ${Math.round(entity.hp)}/${entity.maxHp} HP</span>
                        <button onclick="GameApp.repairBuilding(GameApp.selectedEntity)" class="parchment-button px-2.5 py-1 text-xs rounded text-amber-300 font-bold hover:text-white pointer-events-auto">&#128296; Repair (5W, 8S)</button>
                    </div>`;
            }
        }
        $id('inspector-stats').innerHTML = statsHtml;
    }

    // ------------------------------------------------------------------
    // Objective System
    // ------------------------------------------------------------------
    setObjective(text) {
        const banner = $id('mission-objective-banner');
        const textEl = $id('objective-text');
        if (banner && textEl) {
            banner.classList.remove('hidden');
            textEl.innerText = text;
        }
    }

    renderObjectiveTracker() {
        const el = $id('objective-tracker');
        if (!el) return;
        const m = this.currentMissionData;
        if (!m) {
            const keepHp = this.enemyKeep && this.buildings.includes(this.enemyKeep) ? Math.ceil(this.enemyKeep.hp) : 0;
            el.innerHTML = `<div class="font-bold text-amber-400 mb-1">Skirmish</div>
                <div class="flex gap-2"><span>&#9744;</span><span>Destroy ${escapeHtml(this.enemyKeep ? this.enemyKeep.name : 'the enemy keep')} (${keepHp} HP)</span></div>
                <div class="text-stone-400 mt-1">Waves repelled: ${this.campaign.stats.wavesSurvived}</div>`;
            return;
        }
        const rows = this.campaign.getObjectiveStatuses().map(s => {
            const showCount = s.target > 1 || ['population', 'resource', 'produced'].includes(s.obj.type);
            return `<div class="flex gap-2 ${s.done ? 'text-emerald-400' : ''}"><span aria-hidden="true">${s.done ? '&#9745;' : '&#9744;'}</span><span>${escapeHtml(s.obj.label)}${showCount ? ` <span class="text-stone-400">(${Math.min(s.current, s.target)}/${s.target})</span>` : ''}</span></div>`;
        }).join('');
        let bonusRow = '';
        if (m.bonus) {
            const b = this.campaign.evaluateBonus();
            const cls = b.failed ? 'text-red-400 line-through' : b.done ? 'text-amber-300' : 'text-amber-200/80';
            bonusRow = `<div class="flex gap-2 mt-1 ${cls}"><span>&#9733;</span><span>${escapeHtml(m.bonus.label)} <span class="text-stone-400 no-underline">(${escapeHtml(b.text)})</span></span></div>`;
        }
        el.innerHTML = `<div class="font-bold text-amber-400 mb-1">M${m.id}: ${escapeHtml(m.title)}</div>${rows}${bonusRow}`;
    }

    checkObjectiveProgress() {
        if (!this.currentMissionData || this.objectiveCompleted || this.state !== 'playing') return false;
        if (this.campaign.allPrimaryComplete()) {
            this.objectiveCompleted = true;
            this.completeMission();
            return true;
        }
        return false;
    }

    completeMission() {
        const m = this.currentMissionData;
        this.campaign.completedAt = this.stats.playTime;
        const bonus = this.campaign.evaluateBonus();
        const bonusAchieved = !!(m.bonus && bonus.done && !bonus.failed);
        this.economy.res.honor += 30;
        this.economy.res.gold += 150;
        CampaignDirector.recordMissionComplete(this.faction, m.id, bonusAchieved);
        if (this.devConsole) this.devConsole.log(`Mission Complete: ${m.title}!${bonusAchieved ? ' Bonus achieved!' : ''}`, 'HERALD');
        this.triggerVictory({ mission: m, bonusAchieved });
    }

    // ------------------------------------------------------------------
    // Victory & Defeat
    // ------------------------------------------------------------------
    triggerVictory(details = {}) {
        if (this.state === 'victory') return;
        this.state = 'victory';
        Sound.playCheer();
        Monetization.gameplayStop();
        this.showDevCommentary('victory');
        const m = details.mission || this.currentMissionData;
        const vModal = $id('victory-modal');
        if (vModal) {
            vModal.classList.remove('hidden');
            const title = $id('victory-title');
            if (title) title.innerText = m ? `${m.title}: Complete!` : 'VICTORY ACHIEVED!';
            let html = `
                <div>Play Time: ${Math.floor(this.stats.playTime / 60)}m ${Math.floor(this.stats.playTime % 60)}s</div>
                <div>Enemies Slain: ${this.stats.enemiesKilled}</div>
                <div>Structures Erected: ${this.stats.buildingsConstructed}</div>
                <div>Waves Repelled: ${this.campaign.stats.wavesSurvived}</div>
                <div>Final Popularity: ${Math.round(this.economy.popularity)}%</div>`;
            if (m && m.bonus) {
                html += `<div class="mt-2 font-bold ${details.bonusAchieved ? 'text-amber-300' : 'text-stone-500'}">&#9733; Bonus - ${escapeHtml(m.bonus.label)}: ${details.bonusAchieved ? 'ACHIEVED' : 'missed'}</div>`;
            }
            $id('victory-stats').innerHTML = html;
            const next = $id('victory-next-btn');
            if (next) {
                const hasNext = m && CAMPAIGN_MISSIONS[this.faction].some(x => x.id === m.id + 1);
                next.innerText = m ? (hasNext ? 'Next Mission' : 'Saga Complete') : 'Play Again';
            }
        }
        if (this.devConsole) this.devConsole.log('VICTORY! The Citadel has triumphed over its rivals!', 'HERALD');
    }

    triggerDefeat() {
        if (this.state === 'defeat') return;
        this.state = 'defeat';
        Sound.playWarning();
        Monetization.gameplayStop();
        const dModal = $id('defeat-modal');
        if (dModal) dModal.classList.remove('hidden');
        if (this.devConsole) this.devConsole.log('DEFEAT: Your Citadel Keep has fallen!', 'AI LORD');
    }

    victoryContinue() {
        if (!this.currentMissionData) {
            this.launchSkirmish();
            return;
        }
        this.advanceNextMission();
    }

    advanceNextMission() {
        const faction = this.faction || 'solaris';
        const factionMissions = CAMPAIGN_MISSIONS[faction] || CAMPAIGN_MISSIONS.solaris;
        const currentId = this.currentMissionData ? this.currentMissionData.id : 1;
        const nextMission = factionMissions.find(m => m.id === currentId + 1);
        Monetization.maybeInterstitial('mission');
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
            return 0;
        }
        this.economy.deductCost(cost);
        Sound.playShatter();
        this.showDevCommentary('pitch');

        const defenses = this.buildings.filter(b => !b.isEnemy && (b.type === 'wall' || b.type === 'tower' || b.type === 'gatehouse' || b.type === 'keep' || b.type === 'cauldron'));
        let burntCount = 0;
        const pitchSource = { type: 'pitch', isEnemy: false };

        this.units.forEach(u => {
            if (u.isEnemy && u.hp > 0) {
                const nearDefense = defenses.some(b => Math.hypot(u.x - (b.gx + b.w / 2), u.y - (b.gy + b.h / 2)) <= 4.0);
                if (nearDefense) {
                    u.takeDamage(75, pitchSource);
                    this.spawnFloatingText('-75 Fire', u.x, u.y, '#f97316');
                    this.fx.emitSparks(u.x, u.y, 6);
                    burntCount++;
                }
            }
        });

        this.showToast(`Boiling Pitch poured! ${burntCount} enemy invaders engulfed!`);
        if (this.devConsole) this.devConsole.log(`Boiling Pitch defense triggered: ${burntCount} enemies engulfed in flames!`, 'DEFENSE');
        this.updateUI();
        return burntCount;
    }

    // ------------------------------------------------------------------
    // Particles & Projectiles
    // ------------------------------------------------------------------
    spawnFloatingText(text, gx, gy, color = '#fef3c7') {
        if (this.particles.length > 300) this.particles.shift();
        this.particles.push(new Particle(gx, gy, text, color));
    }

    spawnProjectile(type, startX, startY, target, damage, source = null) {
        this.projectiles.push(new Projectile(type, startX, startY, target, damage, source));
    }

    // ------------------------------------------------------------------
    // UI Controls & Tray
    // ------------------------------------------------------------------
    setTab(tab) {
        this.activeTab = tab;
        ['building', 'military', 'defenses', 'mythic'].forEach(t => {
            const btn = $id(`tab-btn-${t}`);
            if (btn) btn.classList.toggle('active', t === tab);
        });

        const tray = $id('action-tray');
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
            items = ['wall', 'tower', 'gatehouse', 'cauldron'];
        } else if (tab === 'mythic') {
            items = ['dragonRoost', 'dragon', 'giant', 'werewolf'];
        }

        items.forEach(key => {
            const def = BUILDINGS_DEF[key] || UNITS_DEF[key];
            if (!def) return;
            const btn = document.createElement('button');
            btn.className = 'parchment-button px-3 py-2 rounded text-xs flex flex-col items-center justify-center min-w-[95px] shrink-0';
            const req = def.requires ? `<span class="text-[9px] text-sky-300/80">needs ${escapeHtml(BUILDINGS_DEF[def.requires].name.split(' ').slice(-1)[0])}</span>` : '';
            btn.innerHTML = `
                <span class="font-bold text-amber-300 mb-0.5">${escapeHtml(def.name)}</span>
                <span class="text-[10px] text-stone-400">${this.formatCost(def.cost)}</span>${req}`;
            btn.title = def.desc || def.name;
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
        return parts.join(' ') || 'Free';
    }

    selectTool(key) {
        const uDef = UNITS_DEF[key];
        if (uDef) {
            // Units are recruited immediately; no placement step needed.
            this.clearSelectedTool();
            this.trainUnit(key);
            return;
        }
        this.selectedTool = key;
        const def = BUILDINGS_DEF[key];
        this.showToast(`Selected: ${def.name} - click the map to build, right-click to cancel`);
        Sound.playClick();
    }

    clearSelectedTool() {
        this.selectedTool = null;
        if (this.renderer) this.renderer.hoverTile = { x: -1, y: -1 };
    }

    toggleEconomyModal() {
        $id('economy-modal').classList.toggle('hidden');
        Sound.playClick();
    }

    updateRations(val) {
        const v = parseInt(val, 10);
        if (![0, 1, 2, 3].includes(v)) return;
        this.economy.rations = v;
        this.showToast('Rations policy updated');
        Sound.playClick();
    }

    updateTaxes(val) {
        const v = parseInt(val, 10);
        if (![-2, -1, 0, 1, 2, 3].includes(v)) return;
        this.economy.taxes = v;
        this.campaign.recordTax(v);
        this.showToast('Taxation policy updated');
        Sound.playClick();
    }

    showToast(msg, isWarning = false) {
        const banner = $id('toast-banner');
        if (!banner) return;
        banner.innerText = msg;
        banner.className = `absolute top-4 left-1/2 -translate-x-1/2 parchment-panel px-6 py-2 rounded-full font-bold text-sm shadow-2xl transition-opacity duration-300 z-30 pointer-events-none opacity-100 max-w-[90%] text-center ${isWarning ? 'text-red-400 border-red-500' : 'text-amber-300 border-amber-500'}`;
        clearTimeout(this._toastTimeout);
        this._toastTimeout = setTimeout(() => {
            banner.classList.remove('opacity-100');
            banner.classList.add('opacity-0');
        }, 2800);
    }

    showDevCommentary(key) {
        if (typeof Monetization === 'undefined' || !Monetization.supporter || this._commentaryShown[key]) return;
        const line = typeof DEV_COMMENTARY !== 'undefined' ? DEV_COMMENTARY[key] : null;
        if (!line) return;
        this._commentaryShown[key] = true;
        const el = $id('dev-commentary');
        if (!el) return;
        el.innerText = line;
        el.classList.remove('hidden');
        clearTimeout(this._commentaryTimeout);
        this._commentaryTimeout = setTimeout(() => el.classList.add('hidden'), 9000);
    }

    updateUI() {
        const res = this.economy.res;
        const pop = this.economy.pop;
        const set = (id, v) => {
            const el = $id(id);
            if (el && el.innerText !== String(v)) el.innerText = v;
        };
        set('res-wood', Math.floor(res.wood));
        set('res-stone', Math.floor(res.stone));
        set('res-iron', Math.floor(res.iron));
        set('res-pitch', Math.floor(res.pitch));
        set('res-gold', Math.floor(res.gold));
        set('res-honor', Math.floor(res.honor));
        set('res-food', Math.floor(res.food));
        set('res-pop', `${pop.current} / ${pop.max}`);
        set('popularity-badge', Math.floor(this.economy.popularity));

        const statusEl = $id('popularity-status');
        const popVal = this.economy.popularity;
        if (statusEl) {
            let text = 'Revolting';
            let cls = 'text-red-500 font-bold';
            if (popVal >= 75) { text = 'Rejoicing'; cls = 'text-emerald-400 font-bold'; }
            else if (popVal >= 50) { text = 'Content'; cls = 'text-green-400 font-bold'; }
            else if (popVal >= 30) { text = 'Unhappy'; cls = 'text-amber-400 font-bold'; }
            if (statusEl.innerText !== text) {
                statusEl.innerText = text;
                statusEl.className = cls;
            }
        }

        const waveEl = $id('wave-countdown');
        if (waveEl) {
            let text;
            if (this.wavesExhausted()) {
                text = Object.keys(this.activeWaves).length > 0 ? 'Final wave engaged!' : (this.waveConfig && this.waveConfig.enabled ? 'All waves dispatched' : 'No sieges expected');
            } else {
                text = `Wave ${this.currentWave + 1}${this.waveConfig.max ? `/${this.waveConfig.max}` : ''} in: ${Math.max(0, Math.ceil(this.waveTimer))}s`;
            }
            if (waveEl.innerText !== text) waveEl.innerText = text;
        }
        this.refreshMonetizationUI();
    }

    refreshMonetizationUI() {
        const btn = $id('respite-btn');
        if (btn && typeof Monetization !== 'undefined') {
            btn.classList.toggle('hidden', !Monetization.adapter.hasAds);
            btn.disabled = !Monetization.rewardedAvailable;
            const cd = Math.ceil(Monetization.respiteCooldown);
            const label = cd > 0 ? `Respite (${Math.floor(cd / 60)}:${String(cd % 60).padStart(2, '0')})` : 'Royal Respite +150 Stone';
            if (btn.innerText !== label) btn.innerText = label;
        }
        const badge = $id('supporter-badge');
        if (badge && typeof Monetization !== 'undefined') badge.classList.toggle('hidden', !Monetization.supporter);
    }

    async requestRoyalRespite() {
        const res = await Monetization.requestRoyalRespite();
        if (!res.ok) this.showToast(res.reason === 'cooldown' ? 'Royal Respite is recharging.' : 'Royal Respite is unavailable right now.', true);
        this.refreshMonetizationUI();
    }

    // ------------------------------------------------------------------
    // Save / Load UI
    // ------------------------------------------------------------------
    saveToSlot(slot) {
        if (this.state !== 'playing') {
            this.showToast('You can only save during an active battle.', true);
            return false;
        }
        const res = this.saveSystem.saveToSlot(slot);
        this.showToast(res.ok ? `Game saved to ${slot === 'auto' ? 'auto-save' : slot.replace('slot', 'Slot ')}` : `Save failed: ${res.error}`, !res.ok);
        this.renderSaveSlots();
        return res.ok;
    }

    loadFromSlot(slot) {
        const res = this.saveSystem.loadFromSlot(slot);
        if (!res.ok) {
            this.showToast(`Load failed: ${res.error}`, true);
            return false;
        }
        this.afterLoad();
        return true;
    }

    afterLoad() {
        this.hideModals();
        const br = $id('briefing-modal');
        if (br) br.classList.add('hidden');
        this.briefingOpen = false;
        this.enterGameInterface();
        this.state = 'playing';
        this.setSpeed(this.simSpeed > 0 ? this.simSpeed : 1);
        this.setTab(this.activeTab || 'building');
        Sound.startAmbientMusic(this.faction);
        this.setObjective(this.currentMissionData ? this.currentMissionData.objective : 'Destroy the rival enemy keep across the river to claim victory!');
        this.renderObjectiveTracker();
        this.showToast('Game loaded. The realm endures!');
        Monetization.gameplayStart();
    }

    openSaveMenu() {
        const modal = $id('save-modal');
        if (!modal) return;
        this.menuPaused = this.state === 'playing';
        this.renderSaveSlots();
        modal.classList.remove('hidden');
        Sound.playClick();
    }

    renderSaveSlots() {
        const list = $id('save-slot-list');
        if (!list) return;
        const inGame = this.state === 'playing';
        list.innerHTML = SAVE_SLOTS.map(slot => {
            const info = this.saveSystem.describeSlot(slot);
            const name = slot === 'auto' ? 'Auto-save' : `Slot ${slot.slice(-1)}`;
            const desc = !info ? '<span class="text-stone-500">Empty</span>'
                : info.corrupt ? '<span class="text-red-400">Corrupt save</span>'
                    : `${escapeHtml(info.label)}<br><span class="text-stone-500">${escapeHtml(new Date(info.savedAt).toLocaleString())} &bull; ${Math.floor((info.elapsed || 0) / 60)}m played</span>`;
            const saveBtn = slot !== 'auto' && inGame ? `<button onclick="GameApp.saveToSlot('${slot}')" class="parchment-button px-2 py-1 rounded text-[11px]">Save</button>` : '';
            const loadBtn = info && !info.corrupt ? `<button onclick="GameApp.loadFromSlot('${slot}')" class="parchment-button px-2 py-1 rounded text-[11px] !bg-emerald-900">Load</button>` : '';
            const delBtn = info ? `<button onclick="GameApp.deleteSlot('${slot}')" class="parchment-button px-2 py-1 rounded text-[11px] !bg-red-950" aria-label="Delete ${name}">&times;</button>` : '';
            return `<div class="flex items-center justify-between gap-3 bg-stone-900/80 border border-stone-800 rounded p-2.5">
                <div class="text-xs"><div class="font-bold text-amber-300">${name}</div><div class="text-stone-300">${desc}</div></div>
                <div class="flex gap-1.5 shrink-0">${saveBtn}${loadBtn}${delBtn}</div></div>`;
        }).join('');
        const exp = $id('export-save-btn');
        if (exp) exp.disabled = !inGame;
    }

    deleteSlot(slot) {
        this.saveSystem.deleteSlot(slot);
        this.renderSaveSlots();
        this.refreshMainMenu();
    }

    exportSave() {
        if (this.state !== 'playing') return;
        this.saveSystem.exportToFile();
        this.showToast('Save exported as .citadelsave file');
    }

    async importSave(input) {
        const file = input && input.files && input.files[0];
        const res = await this.saveSystem.importFromFile(file);
        if (input) input.value = '';
        if (!res.ok) {
            this.showToast(`Import failed: ${res.error}`, true);
            return false;
        }
        this.afterLoad();
        return true;
    }

    // ------------------------------------------------------------------
    // Settings UI
    // ------------------------------------------------------------------
    openSettings() {
        const modal = $id('settings-modal');
        if (!modal) return;
        this.menuPaused = this.state === 'playing';
        const s = this.settings.data;
        ['master', 'sfx', 'music'].forEach(bus => {
            const el = $id(`vol-${bus}`);
            if (el) el.value = Math.round(s.volumes[bus] * 100);
            const lbl = $id(`vol-${bus}-label`);
            if (lbl) lbl.innerText = `${Math.round(s.volumes[bus] * 100)}%`;
        });
        ['highContrast', 'weather', 'reducedMotion', 'showMinimap'].forEach(k => {
            const el = $id(`set-${k}`);
            if (el) el.checked = !!s[k];
        });
        this.renderSettingsKeybinds();
        modal.classList.remove('hidden');
        Sound.playClick();
    }

    setVolume(bus, pct) {
        const v = Math.max(0, Math.min(100, Number(pct))) / 100;
        this.settings.setVolume(bus, v);
        Sound.setVolume(bus, v);
        const lbl = $id(`vol-${bus}-label`);
        if (lbl) lbl.innerText = `${Math.round(v * 100)}%`;
    }

    setSettingFlag(key, value) {
        this.settings.set(key, !!value);
        this.applySettings();
    }

    renderSettingsKeybinds() {
        const list = $id('keybind-list');
        if (!list) return;
        const binds = this.settings.data.keybinds;
        list.innerHTML = Object.keys(DEFAULT_KEYBINDS).map(action => {
            const capturing = this.rebindingAction === action;
            return `<div class="flex items-center justify-between gap-2 py-1 border-b border-stone-800/70">
                <span class="text-xs text-stone-300">${escapeHtml(KEYBIND_LABELS[action])}</span>
                <button onclick="GameApp.beginRebind('${action}')" class="parchment-button px-2 py-0.5 rounded text-[11px] min-w-[72px] ${capturing ? 'pulse-gold' : ''}" aria-label="Rebind ${escapeHtml(KEYBIND_LABELS[action])}">${capturing ? 'Press key…' : escapeHtml(SettingsManager.displayKey(binds[action]))}</button>
            </div>`;
        }).join('');
    }

    beginRebind(action) {
        this.rebindingAction = action;
        this.renderSettingsKeybinds();
    }

    resetKeybinds() {
        this.settings.resetKeybinds();
        this.renderSettingsKeybinds();
        this.showToast('Key bindings reset to defaults');
    }

    // ------------------------------------------------------------------
    // Consent & Supporter
    // ------------------------------------------------------------------
    maybeShowConsentBanner() {
        const banner = $id('consent-banner');
        if (!banner || typeof Monetization === 'undefined') return;
        Monetization.storage = Monetization.storage || safeStorage();
        if (!Monetization.getConsent()) banner.classList.remove('hidden');
    }

    setConsent(choice) {
        Monetization.setConsent(choice);
        const banner = $id('consent-banner');
        if (banner) banner.classList.add('hidden');
    }

    openSupporter() {
        const modal = $id('supporter-modal');
        if (!modal) return;
        this.menuPaused = this.state === 'playing';
        const status = $id('supporter-status');
        if (status) status.innerText = Monetization.supporter ? 'Royal Supporter perks are active. Thank you!' : '';
        modal.classList.remove('hidden');
    }

    async redeemSupporterCode() {
        const input = $id('supporter-code');
        const status = $id('supporter-status');
        const res = await Monetization.redeemSupporterCode(input ? input.value : '');
        if (status) status.innerText = res.ok ? 'Code accepted! Golden banners and developer commentary unlocked.' : res.reason;
        if (res.ok) {
            Sound.playCheer();
            this.refreshMonetizationUI();
        }
    }

    // ------------------------------------------------------------------
    // Main Game Loop (single rAF loop for the whole app lifetime)
    // ------------------------------------------------------------------
    startLoop() {
        if (this._loopStarted || typeof requestAnimationFrame === 'undefined') return;
        this._loopStarted = true;
        let lastTime = performance.now();
        let frame = 0;
        const loop = (time) => {
            const realDt = Math.min((time - lastTime) / 1000, 0.1);
            lastTime = time;
            frame++;
            if (realDt > 0) this._fps = this._fps * 0.95 + (1 / realDt) * 0.05;

            if (this.state !== 'menu' && this.renderer) {
                if (this.isSimulationRunning()) {
                    // Sub-step at high speeds to keep combat & pathing stable.
                    let remaining = realDt * this.simSpeed;
                    let steps = 0;
                    while (remaining > 1e-6 && steps++ < 6) {
                        const step = Math.min(remaining, 0.05);
                        this.update(step);
                        remaining -= step;
                    }
                } else if (this.state === 'playing') {
                    this.fx.update(0, null);
                }
                if (this.touch) this.touch.update(realDt);
                this.renderer.render();
                if (this.minimap && frame % 2 === 0 && this.settings.data.showMinimap) this.minimap.render();
                this.adaptQuality();
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    /** Back off particle density on slow devices to protect frame rate. */
    adaptQuality() {
        if (this._fps < 40 && this.fx.quality > 0.4) {
            this.fx.quality = Math.max(0.4, this.fx.quality - 0.2);
            this.fx.setBiome(this.mapType, this.fx.viewW, this.fx.viewH);
        }
    }

    /** Back-compat alias: earlier builds started a loop per mission. */
    runGameLoop() {
        this.startLoop();
    }

    update(dt) {
        this.resizeCanvas();
        this.stats.playTime += dt;

        // 0. Spatial index for this step
        this.unitHash.rebuild(this.units);

        // 1. Wave timer & siege invasions
        if (!this.wavesExhausted()) {
            this.waveTimer -= dt;
            if (this.waveTimer <= 0) this.triggerEnemyWave();
        }
        this.processSpawnQueue(dt);

        // 2. Economy
        this.economy.update(dt);

        // 3. Buildings (towers, auras, cauldrons)
        for (let i = 0; i < this.buildings.length; i++) {
            const b = this.buildings[i];
            if (b.update) b.update(dt, this);
        }

        // 4. Units
        for (let i = this.units.length - 1; i >= 0; i--) {
            const u = this.units[i];
            if (u.hp > 0) u.update(dt, this);
        }
        this.processDeaths();

        // 5. Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            if (this.projectiles[i].update(dt, this)) this.projectiles.splice(i, 1);
        }
        this.processDeaths();

        // 6. Floating text & FX
        for (let i = this.particles.length - 1; i >= 0; i--) {
            if (this.particles[i].update(dt)) this.particles.splice(i, 1);
        }
        this.fx.update(dt, this);
        this.processDeaths();

        // 7. Vision
        this.fog.update(dt, this);

        // 8. Waves, objectives, persistence, monetization timers
        this.checkWaveCompletion();
        this._objectiveTimer += dt;
        if (this._objectiveTimer >= OBJECTIVE_CHECK_INTERVAL) {
            this._objectiveTimer = 0;
            this.checkObjectiveProgress();
            this.renderObjectiveTracker();
        }
        const autosave = this.saveSystem.update(dt);
        if (autosave && autosave.ok && this.devConsole) this.devConsole.log('Auto-saved (3 minute interval).', 'SYSTEM');
        Monetization.update(dt);

        // 9. HUD (throttled - DOM writes are expensive)
        this._uiTimer += dt;
        if (this._uiTimer >= UI_REFRESH_INTERVAL) {
            this._uiTimer = 0;
            this.updateUI();
            if (this.selectedEntity && $id('inspector-card') && !$id('inspector-card').classList.contains('hidden')) {
                if (this.selectedEntity.hp > 0) this.renderInspector(this.selectedEntity);
            }
        }
    }

    processDeaths() {
        let removed = false;
        for (let i = this.units.length - 1; i >= 0; i--) {
            const u = this.units[i];
            if (u.hp > 0) continue;
            this.units.splice(i, 1);
            removed = true;
            this.spawnFloatingText('Slain', u.x, u.y, '#991b1b');
            this.fx.emitBlood(u.x, u.y, 10);
            if (u.isEnemy) {
                this.stats.enemiesKilled++;
                this.economy.res.gold += u.isGeneral ? 200 : 12;
                this.campaign.recordEnemyKilled(u);
                if (u.isGeneral) {
                    this.showToast(`${u.name} has been slain!`);
                    Sound.playCheer();
                }
            } else {
                // Fallen soldiers and peasants free their housing.
                this.economy.pop.current = Math.max(0, this.economy.pop.current - 1);
            }
            if (this.selectedEntity === u) this.selectedEntity = null;
        }
        if (removed && this.selectedUnits.length) this.selectedUnits = this.selectedUnits.filter(u => u.hp > 0);
    }
}

// Global Application Instance
const GameApp = new CitadelGame();
if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.readyState !== undefined) {
    window.addEventListener('DOMContentLoaded', () => {
        GameApp.init();
    });
}

if (typeof globalThis !== 'undefined') {
    globalThis.CitadelGame = CitadelGame;
    globalThis.GameApp = GameApp;
    globalThis.escapeHtml = escapeHtml;
    globalThis.SKIRMISH_WAVES = SKIRMISH_WAVES;
    globalThis.DIFFICULTY_HP = DIFFICULTY_HP;
}
