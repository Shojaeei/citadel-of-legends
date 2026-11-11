/* ==========================================================================
   Citadel of Legends: Shattered Realms - Persistence Engine
   --------------------------------------------------------------------------
   * 3 manual localStorage slots + 1 rolling auto-save slot
   * Auto-save every 3 minutes of game time and on every repelled siege wave
   * Export / import of `.citadelsave` JSON files via the HTML5 File API

   SECURITY: imported files are untrusted user input. Nothing is ever eval'd;
   every field is type-checked, whitelisted against game definitions, clamped
   to legal ranges, and size-limited before it touches live game state.
   ========================================================================== */

const SAVE_FORMAT = 'citadel-of-legends-save';
const SAVE_SCHEMA_VERSION = 1;
const SAVE_SLOTS = ['slot1', 'slot2', 'slot3', 'auto'];
const SAVE_KEY_PREFIX = 'citadel.save.';
const AUTOSAVE_INTERVAL = 180; // seconds of game time
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_SAVED_UNITS = 2000;
const MAX_SAVED_BUILDINGS = 2000;
const TILE_CODES = { grass: 'g', water: 'w', rock: 'r', snow: 's', blight: 'b' };
const TILE_FROM_CODE = { g: 'grass', w: 'water', r: 'rock', s: 'snow', b: 'blight' };

class SaveValidationError extends Error {}

function isNum(v) {
    return typeof v === 'number' && Number.isFinite(v);
}

function clampNum(v, lo, hi, dflt) {
    return isNum(v) ? Math.max(lo, Math.min(hi, v)) : dflt;
}

class SaveSystem {
    constructor(game, storage = (typeof safeStorage === 'function' ? safeStorage() : null)) {
        this.game = game;
        this.storage = storage;
        this.autosaveTimer = 0;
    }

    // ------------------------------------------------------------------
    // Serialization
    // ------------------------------------------------------------------
    serialize() {
        const g = this.game;
        const n = g.gridSize;
        let mapStr = '';
        for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
                mapStr += TILE_CODES[g.map[x][y].type] || 'g';
            }
        }

        return {
            format: SAVE_FORMAT,
            schema: SAVE_SCHEMA_VERSION,
            gameVersion: typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '1.0.0',
            savedAt: new Date().toISOString(),
            game: {
                mode: g.currentMissionData ? 'campaign' : 'skirmish',
                faction: g.faction,
                mapType: g.mapType,
                aiDifficulty: g.aiDifficulty,
                missionId: g.currentMissionData ? g.currentMissionData.id : null,
                elapsed: g.stats.playTime,
                tick: g.economy.tickCount || 0,
                simSpeed: g.simSpeed,
                stats: { ...g.stats },
                objectiveCompleted: !!g.objectiveCompleted,
                taggedStructureCount: { ...(g.taggedStructureCount || {}) }
            },
            economy: g.economy.serialize(),
            map: { size: n, tiles: mapStr },
            fog: g.fog ? { enabled: g.fog.enabled, explored: g.fog.serializeExplored() } : null,
            buildings: g.buildings.map(b => ({
                id: b.id, type: b.type, gx: b.gx, gy: b.gy, hp: b.hp, maxHp: b.maxHp,
                level: b.level || 1, isUnderConstruction: !!b.isUnderConstruction,
                isEnemy: b.isEnemy, faction: b.faction, name: b.name, tag: b.tag || null
            })),
            units: g.units.map(u => ({
                id: u.id, type: u.type, x: u.x, y: u.y, hp: u.hp, maxHp: u.maxHp,
                faction: u.faction, isEnemy: u.isEnemy, state: u.state,
                targetId: u.targetEntity ? u.targetEntity.id : null,
                path: (u.path || []).slice(u.waypointIndex || 0, (u.waypointIndex || 0) + 64).map(p => [+p.x.toFixed(2), +p.y.toFixed(2)]),
                waveId: u.waveId || 0,
                name: u.name
            })),
            waves: {
                timer: g.waveTimer,
                current: g.currentWave,
                tier: g.aiDifficulty,
                slain: g.stats.enemiesKilled,
                spawnQueue: (g.spawnQueue || []).map(q => ({ type: q.type, delay: q.delay, waveId: q.waveId, x: q.x, y: q.y, faction: q.faction })),
                activeWaves: Object.keys(g.activeWaves || {}).map(Number)
            },
            campaign: g.campaign ? g.campaign.serialize() : null,
            playerKeepId: g.playerKeep ? g.playerKeep.id : null,
            enemyKeepId: g.enemyKeep ? g.enemyKeep.id : null,
            nextEntityId: typeof getNextEntityId === 'function' ? getNextEntityId() : 0
        };
    }

    // ------------------------------------------------------------------
    // Validation (pure; throws SaveValidationError)
    // ------------------------------------------------------------------
    static validate(data, gridSize = 64) {
        const fail = (msg) => { throw new SaveValidationError(msg); };
        if (!data || typeof data !== 'object' || Array.isArray(data)) fail('Save root must be an object');
        if (data.format !== SAVE_FORMAT) fail('Not a Citadel of Legends save file');
        if (!Number.isInteger(data.schema) || data.schema < 1 || data.schema > SAVE_SCHEMA_VERSION) fail(`Unsupported save schema: ${data.schema}`);
        const gm = data.game;
        if (!gm || typeof gm !== 'object') fail('Missing game block');
        if (!FACTIONS_DEF[gm.faction]) fail('Invalid faction');
        if (!['valley', 'tundra', 'wasteland'].includes(gm.mapType)) fail('Invalid map type');
        if (!['easy', 'normal', 'hard'].includes(gm.aiDifficulty)) fail('Invalid difficulty');
        if (gm.missionId !== null && gm.missionId !== undefined) {
            const missions = CAMPAIGN_MISSIONS[gm.faction] || [];
            if (!missions.some(m => m.id === gm.missionId)) fail('Invalid mission id');
        }
        if (!data.map || data.map.size !== gridSize || typeof data.map.tiles !== 'string' || data.map.tiles.length !== gridSize * gridSize) fail('Invalid map block');
        if (!/^[gwrsb]+$/.test(data.map.tiles)) fail('Invalid map tile codes');
        if (!Array.isArray(data.buildings) || data.buildings.length > MAX_SAVED_BUILDINGS) fail('Invalid buildings list');
        if (!Array.isArray(data.units) || data.units.length > MAX_SAVED_UNITS) fail('Invalid units list');
        const ids = new Set();
        for (const b of data.buildings) {
            if (!b || typeof b !== 'object') fail('Invalid building entry');
            if (!BUILDINGS_DEF[b.type]) fail(`Unknown building type: ${String(b.type).slice(0, 32)}`);
            if (!Number.isInteger(b.id) || b.id < 1 || ids.has(b.id)) fail('Invalid or duplicate building id');
            ids.add(b.id);
            const def = BUILDINGS_DEF[b.type];
            if (!Number.isInteger(b.gx) || !Number.isInteger(b.gy) || b.gx < 0 || b.gy < 0 || b.gx + def.w > gridSize || b.gy + def.h > gridSize) fail('Building out of bounds');
            if (!isNum(b.hp)) fail('Invalid building hp');
            if (typeof b.isEnemy !== 'boolean') fail('Invalid building allegiance');
        }
        for (const u of data.units) {
            if (!u || typeof u !== 'object') fail('Invalid unit entry');
            if (!UNITS_DEF[u.type]) fail(`Unknown unit type: ${String(u.type).slice(0, 32)}`);
            if (!Number.isInteger(u.id) || u.id < 1 || ids.has(u.id)) fail('Invalid or duplicate unit id');
            ids.add(u.id);
            if (!isNum(u.x) || !isNum(u.y) || u.x < 0 || u.y < 0 || u.x > gridSize || u.y > gridSize) fail('Unit out of bounds');
            if (!isNum(u.hp)) fail('Invalid unit hp');
            if (typeof u.isEnemy !== 'boolean') fail('Invalid unit allegiance');
            if (u.path !== undefined && (!Array.isArray(u.path) || u.path.length > 256)) fail('Invalid unit path');
        }
        if (!data.economy || typeof data.economy !== 'object') fail('Missing economy block');
        return true;
    }

    // ------------------------------------------------------------------
    // Deserialization into the live game
    // ------------------------------------------------------------------
    apply(data) {
        const g = this.game;
        SaveSystem.validate(data, g.gridSize);
        const gm = data.game;
        const n = g.gridSize;

        g.faction = gm.faction;
        g.aiDifficulty = gm.aiDifficulty;
        g.currentMissionData = gm.missionId ? (CAMPAIGN_MISSIONS[gm.faction].find(m => m.id === gm.missionId) || null) : null;
        g.campaignMission = gm.missionId || 1;

        // Rebuild an empty world shell (terrain from the save, not regenerated)
        g.resetWorldState(gm.mapType);
        for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
                g.map[x][y] = { type: TILE_FROM_CODE[data.map.tiles[y * n + x]], occupied: false, buildingId: null };
            }
        }

        g.economy.reset(g.faction);
        g.economy.deserialize(data.economy);

        const st = gm.stats || {};
        g.stats = {
            enemiesKilled: Math.round(clampNum(st.enemiesKilled, 0, 1e7, 0)),
            buildingsConstructed: Math.round(clampNum(st.buildingsConstructed, 0, 1e7, 0)),
            playTime: clampNum(gm.elapsed, 0, 1e8, 0)
        };
        g.objectiveCompleted = gm.objectiveCompleted === true;
        g.simSpeed = GAME_SPEEDS.includes(gm.simSpeed) && gm.simSpeed > 0 ? gm.simSpeed : 1;
        g.taggedStructureCount = {};
        if (gm.taggedStructureCount && typeof gm.taggedStructureCount === 'object') {
            for (const [k, v] of Object.entries(gm.taggedStructureCount)) {
                if (/^[a-zA-Z]{1,24}$/.test(k) && Number.isInteger(v) && v >= 0 && v < 100) g.taggedStructureCount[k] = v;
            }
        }

        const byId = new Map();
        let maxId = 0;
        for (const b of data.buildings) {
            const building = g.spawnBuilding(b.type, b.gx, b.gy, b.isEnemy, FACTIONS_DEF[b.faction] ? b.faction : g.faction);
            building.id = b.id;
            building.hp = clampNum(b.hp, 0, building.maxHp, building.maxHp);
            building.level = Number.isInteger(b.level) ? Math.max(1, Math.min(5, b.level)) : 1;
            building.isUnderConstruction = b.isUnderConstruction === true;
            if (typeof b.name === 'string' && b.name.length <= 48) building.name = b.name;
            if (typeof b.tag === 'string' && /^[a-zA-Z]{1,24}$/.test(b.tag)) building.tag = b.tag;
            // Re-stamp occupancy with the restored id
            for (let dx = 0; dx < building.w; dx++) {
                for (let dy = 0; dy < building.h; dy++) {
                    const tile = g.map[building.gx + dx] && g.map[building.gx + dx][building.gy + dy];
                    if (tile) tile.buildingId = building.id;
                }
            }
            byId.set(building.id, building);
            maxId = Math.max(maxId, building.id);
        }
        g.rebuildBuildingIndex();

        const pendingTargets = [];
        for (const u of data.units) {
            const unit = new Unit(u.type, u.x, u.y, u.isEnemy, FACTIONS_DEF[u.faction] ? u.faction : g.faction);
            unit.id = u.id;
            unit.maxHp = clampNum(u.maxHp, 1, 100000, unit.maxHp);
            unit.hp = clampNum(u.hp, 0, unit.maxHp, unit.maxHp);
            unit.state = ['idle', 'moving', 'attacking'].includes(u.state) ? u.state : 'idle';
            unit.waveId = Number.isInteger(u.waveId) ? u.waveId : 0;
            if (typeof u.name === 'string' && u.name.length <= 48) unit.name = u.name;
            unit.path = Array.isArray(u.path)
                ? u.path.filter(p => Array.isArray(p) && isNum(p[0]) && isNum(p[1])).map(p => ({ x: clampNum(p[0], 0, n, 0), y: clampNum(p[1], 0, n, 0) }))
                : [];
            unit.waypointIndex = 0;
            if (unit.state === 'moving' && unit.path.length === 0) unit.state = 'idle';
            if (Number.isInteger(u.targetId)) pendingTargets.push([unit, u.targetId]);
            g.units.push(unit);
            byId.set(unit.id, unit);
            maxId = Math.max(maxId, unit.id);
        }
        for (const [unit, tid] of pendingTargets) {
            const t = byId.get(tid);
            if (t && t.isEnemy !== unit.isEnemy) unit.targetEntity = t;
            else if (unit.state === 'attacking') unit.state = 'idle';
        }

        g.playerKeep = byId.get(data.playerKeepId) || g.buildings.find(b => b.type === 'keep' && !b.isEnemy) || null;
        g.enemyKeep = byId.get(data.enemyKeepId) || g.buildings.find(b => b.type === 'keep' && b.isEnemy) || null;

        if (typeof setNextEntityId === 'function') {
            setNextEntityId(Math.max(maxId + 1, Number.isInteger(data.nextEntityId) ? data.nextEntityId : 0));
        }

        const w = data.waves || {};
        g.waveTimer = clampNum(w.timer, 0, 3600, 60);
        g.currentWave = Math.round(clampNum(w.current, 0, 10000, 0));
        g.spawnQueue = Array.isArray(w.spawnQueue)
            ? w.spawnQueue.filter(q => q && UNITS_DEF[q.type]).slice(0, 200).map(q => ({
                type: q.type,
                delay: clampNum(q.delay, 0, 60, 0),
                waveId: Number.isInteger(q.waveId) ? q.waveId : 0,
                x: clampNum(q.x, 0, n, 48),
                y: clampNum(q.y, 0, n, 28),
                faction: FACTIONS_DEF[q.faction] ? q.faction : 'obsidian'
            }))
            : [];
        g.activeWaves = {};
        if (Array.isArray(w.activeWaves)) {
            w.activeWaves.filter(Number.isInteger).slice(0, 100).forEach(id => { g.activeWaves[id] = true; });
        }

        if (g.fog) {
            g.fog.reset();
            if (data.fog && typeof data.fog === 'object') {
                g.fog.enabled = data.fog.enabled !== false;
                g.fog.deserializeExplored(data.fog.explored);
            }
        }
        if (g.campaign) {
            g.campaign.reset();
            g.campaign.deserialize(data.campaign);
        }
        g.onWorldLoaded();
        return true;
    }

    // ------------------------------------------------------------------
    // Storage slots
    // ------------------------------------------------------------------
    static slotKey(slot) {
        if (!SAVE_SLOTS.includes(slot)) throw new SaveValidationError(`Unknown save slot: ${slot}`);
        return SAVE_KEY_PREFIX + slot;
    }

    saveToSlot(slot) {
        if (!this.storage) return { ok: false, error: 'Browser storage is unavailable (private mode or blocked by the host page).' };
        try {
            const data = this.serialize();
            this.storage.setItem(SaveSystem.slotKey(slot), JSON.stringify(data));
            return { ok: true, savedAt: data.savedAt };
        } catch (e) {
            return { ok: false, error: e && e.name === 'QuotaExceededError' ? 'Storage quota exceeded' : String(e.message || e) };
        }
    }

    loadFromSlot(slot) {
        if (!this.storage) return { ok: false, error: 'Browser storage is unavailable.' };
        try {
            const raw = this.storage.getItem(SaveSystem.slotKey(slot));
            if (!raw) return { ok: false, error: 'Slot is empty' };
            this.apply(JSON.parse(raw));
            return { ok: true };
        } catch (e) {
            return { ok: false, error: String(e.message || e) };
        }
    }

    deleteSlot(slot) {
        if (!this.storage) return false;
        try {
            this.storage.removeItem(SaveSystem.slotKey(slot));
            return true;
        } catch (e) {
            return false;
        }
    }

    /** Lightweight metadata for the save/load menu (no full parse of state). */
    describeSlot(slot) {
        if (!this.storage) return null;
        try {
            const raw = this.storage.getItem(SaveSystem.slotKey(slot));
            if (!raw) return null;
            const d = JSON.parse(raw);
            if (!d || d.format !== SAVE_FORMAT || !d.game) return { corrupt: true };
            const mission = d.game.missionId && CAMPAIGN_MISSIONS[d.game.faction]
                ? CAMPAIGN_MISSIONS[d.game.faction].find(m => m.id === d.game.missionId) : null;
            return {
                savedAt: d.savedAt,
                faction: d.game.faction,
                label: mission ? `${FACTIONS_DEF[d.game.faction].name} - ${mission.title}` : `Skirmish - ${FACTIONS_DEF[d.game.faction] ? FACTIONS_DEF[d.game.faction].name : '?'}`,
                elapsed: d.game.elapsed,
                wave: d.waves ? d.waves.current : 0
            };
        } catch (e) {
            return { corrupt: true };
        }
    }

    // ------------------------------------------------------------------
    // Auto-save
    // ------------------------------------------------------------------
    update(dt) {
        this.autosaveTimer += dt;
        if (this.autosaveTimer >= AUTOSAVE_INTERVAL) {
            this.autosaveTimer = 0;
            return this.autosave('timer');
        }
        return null;
    }

    autosave(reason = 'manual') {
        const result = this.saveToSlot('auto');
        result.reason = reason;
        return result;
    }

    // ------------------------------------------------------------------
    // File export / import
    // ------------------------------------------------------------------
    exportToString() {
        return JSON.stringify(this.serialize(), null, 1);
    }

    exportToFile() {
        if (typeof document === 'undefined' || typeof Blob === 'undefined') return false;
        const text = this.exportToString();
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.href = url;
        a.download = `citadel_${this.game.faction}_${stamp}.citadelsave`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(url);
            a.remove();
        }, 0);
        return true;
    }

    importFromString(text) {
        if (typeof text !== 'string') return { ok: false, error: 'Invalid file contents' };
        if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: 'Save file is too large' };
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            return { ok: false, error: 'File is not valid JSON' };
        }
        try {
            this.apply(data);
            return { ok: true };
        } catch (e) {
            return { ok: false, error: String(e.message || e) };
        }
    }

    importFromFile(file) {
        return new Promise((resolve) => {
            if (!file) return resolve({ ok: false, error: 'No file selected' });
            if (file.size > MAX_IMPORT_BYTES) return resolve({ ok: false, error: 'Save file is too large' });
            const reader = new FileReader();
            reader.onload = () => resolve(this.importFromString(String(reader.result)));
            reader.onerror = () => resolve({ ok: false, error: 'Could not read file' });
            reader.readAsText(file);
        });
    }
}

if (typeof globalThis !== 'undefined') {
    globalThis.SaveSystem = SaveSystem;
    globalThis.SaveValidationError = SaveValidationError;
    globalThis.SAVE_FORMAT = SAVE_FORMAT;
    globalThis.SAVE_SLOTS = SAVE_SLOTS;
    globalThis.AUTOSAVE_INTERVAL = AUTOSAVE_INTERVAL;
    globalThis.MAX_IMPORT_BYTES = MAX_IMPORT_BYTES;
}
