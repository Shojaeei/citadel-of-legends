// =============================================================================
// Citadel of Legends - Automated Verification Suite (v1.0 Gold Master)
// -----------------------------------------------------------------------------
// Zero-dependency Node test runner. Covers engine, gameplay, campaign,
// persistence, performance, monetization, distribution and business assets.
// Usage: node tests/test_runner.js        (exit code 1 on any failure)
// =============================================================================
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

// ---------------------------------------------------------------------------
// Minimal browser environment
// ---------------------------------------------------------------------------
global.window = {
    addEventListener: () => {},
    innerWidth: 1920,
    innerHeight: 1080
};

const mockElements = {};
function makeElement(id = '') {
    return {
        id,
        innerText: '',
        innerHTML: '',
        textContent: '',
        className: '',
        value: '',
        checked: false,
        disabled: false,
        style: {},
        children: [],
        classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            toggle(c, force) {
                if (force !== undefined) {
                    if (force) this.classes.add(c); else this.classes.delete(c);
                } else if (this.classes.has(c)) this.classes.delete(c); else this.classes.add(c);
            },
            contains(c) { return this.classes.has(c); }
        },
        appendChild(child) { this.children.push(child); return child; },
        addEventListener: () => {},
        setAttribute() {},
        focus() {},
        remove() {}
    };
}
function getOrCreateMockElement(id) {
    if (!mockElements[id]) mockElements[id] = makeElement(id);
    return mockElements[id];
}

global.document = {
    getElementById: (id) => getOrCreateMockElement(id),
    createElement: (tag) => makeElement(tag),
    addEventListener: () => {},
    querySelector: () => null,
    body: makeElement('body'),
    head: makeElement('head')
};

class MemoryStorage {
    constructor() { this.map = new Map(); }
    getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
    setItem(k, v) { this.map.set(k, String(v)); }
    removeItem(k) { this.map.delete(k); }
    get length() { return this.map.size; }
}

// Load modules in browser dependency order
[
    'config', 'spatial', 'settings', 'audio', 'economy', 'pathfinding', 'entities',
    'fog', 'fx', 'campaign', 'save_system', 'minimap', 'touch', 'monetization',
    'renderer', 'devconsole', 'game'
].forEach(m => require(`../js/${m}.js`));

// ---------------------------------------------------------------------------
// Tiny test harness
// ---------------------------------------------------------------------------
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, message) {
    if (condition) {
        passedTests++;
        console.log(`  \x1b[32m✔ PASS:\x1b[0m ${message}`);
    } else {
        failedTests++;
        failures.push(message);
        console.error(`  \x1b[31m✖ FAIL:\x1b[0m ${message}`);
    }
}

async function section(title, fn) {
    console.log(`\n[${title}]`);
    try {
        await fn();
    } catch (e) {
        failedTests++;
        failures.push(`${title}: threw ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`);
        console.error(`  \x1b[31m✖ FAIL:\x1b[0m section threw: ${e && e.stack ? e.stack : e}`);
    }
}

function freshGame({ faction = 'solaris', map = 'valley', difficulty = 'normal' } = {}) {
    const g = new CitadelGame();
    g.faction = faction;
    g.aiDifficulty = difficulty;
    g.saveSystem.storage = new MemoryStorage();
    g.initGameWorld(map);
    g.state = 'playing';
    return g;
}

function campaignGame(faction, missionId) {
    const g = new CitadelGame();
    g.saveSystem.storage = new MemoryStorage();
    g.startCampaign(faction, missionId);
    g.beginMission();
    return g;
}

function kill(g, unit, killer = null) {
    if (killer) unit.takeDamage(unit.hp + 1, killer);
    else unit.hp = 0;
    g.processDeaths();
}

function pngSize(rel) {
    const buf = fs.readFileSync(path.join(ROOT, rel));
    if (buf.toString('ascii', 1, 4) !== 'PNG') return null;
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// ---------------------------------------------------------------------------
async function runTests() {
    console.log('\n--- Running Citadel of Legends Verification Suite (v1.0) ---');

    await section('1. Configuration & Faction Asymmetry', () => {
        assert(BUILDINGS_DEF.cathedral !== undefined, 'Solaris Cathedral building defined');
        assert(BUILDINGS_DEF.runestone !== undefined, 'Frost Runestone building defined');
        assert(BUILDINGS_DEF.crucible !== undefined, 'Obsidian Crucible building defined');
        assert(UNITS_DEF.paladin !== undefined, 'Solaris Paladin champion defined');
        assert(UNITS_DEF.valkyrie !== undefined, 'Frost Valkyrie champion defined');
        assert(UNITS_DEF.vampire !== undefined, 'Obsidian Vampire champion defined');
        assert(CAMPAIGN_MISSIONS.solaris.length === 3, 'Solaris campaign has 3 complete missions');
        assert(CAMPAIGN_MISSIONS.frost.length === 3, 'Frost campaign has 3 complete missions');
        assert(CAMPAIGN_MISSIONS.obsidian.length === 3, 'Obsidian campaign has 3 complete missions');
        assert(BUILDINGS_DEF.cauldron && BUILDINGS_DEF.cauldron.isCauldron, 'Boiling Pitch Cauldron defense defined');
        assert(UNITS_DEF.warlord && UNITS_DEF.warlord.isGeneral, 'Enemy Warlord (general) unit defined');
        assert(VISION_DEF.keep === 12 && VISION_DEF.tower === 10 && VISION_DEF.unit === 5, 'Vision radii match spec (Keep 12, Tower 10, Unit 5)');
        assert(typeof GAME_VERSION === 'string' && GAME_VERSION === JSON.parse(read('package.json')).version, 'GAME_VERSION matches package.json');
        const missingReq = Object.values(UNITS_DEF).filter(u => u.requires && !BUILDINGS_DEF[u.requires]);
        assert(missingReq.length === 0, 'Every unit building requirement references a real building');
    });

    await section('2. Economy & Popularity Simulation', () => {
        const mockGameInstance = { buildings: [], updateUI: () => {}, spawnPeasantAtKeep: () => {}, removePeasant: () => {}, showToast: () => {} };
        const econ = new EconomySystem(mockGameInstance);
        econ.reset('solaris');
        assert(econ.res.gold === 250, 'Starting gold matches config');
        assert(econ.res.wood === 180, 'Starting wood matches config');
        assert(econ.canAfford({ wood: 50, stone: 30 }) === true, 'canAfford correctly verifies available resources');
        assert(econ.canAfford({ gold: 1000 }) === false, 'canAfford correctly rejects insufficient gold');
        econ.deductCost({ wood: 50, stone: 30 });
        assert(econ.res.wood === 130, 'Deducts wood correctly');
        assert(econ.res.stone === 90, 'Deducts stone correctly');
        econ.res.food = 10;
        econ.pop.current = 10;
        econ.rations = 2;
        econ.update(2.0);
        assert(econ.res.food < 10, 'Food consumed by population over time');

        const g = freshGame();
        g.spawnBuilding('cathedral', 12, 20, false, 'solaris');
        const honor0 = g.economy.res.honor;
        g.economy.tickEconomy();
        assert(g.economy.res.honor === honor0 + 2, 'Cathedral generates +2 Arcane Honor per tick (as described)');
        const go = freshGame({ faction: 'obsidian', map: 'wasteland' });
        go.spawnBuilding('crucible', 12, 20, false, 'obsidian');
        const p0 = go.economy.res.pitch;
        go.economy.tickEconomy();
        assert(go.economy.res.pitch === p0 + 4, 'Blood Crucible transmutes +4 Pitch per tick (as described)');
        const ticks0 = g.economy.tickCount;
        g.economy.update(3.0);
        assert(g.economy.tickCount === ticks0 + 3, 'Economy catches up on multiple ticks at high game speed');
        const realRandom = Math.random;
        Math.random = () => 0.1;
        g.economy.popularity = 95;
        g.economy.pop.max = 100;
        const popBefore = g.economy.pop.current;
        g.economy.tickEconomy();
        Math.random = realRandom;
        assert(g.economy.pop.current >= popBefore + 1, 'High popularity attracts immigrants faster (scaled arrivals)');
        const ser = g.economy.serialize();
        const e2 = new EconomySystem(g);
        e2.deserialize({ ...ser, popularity: 999, taxes: 99, res: { ...ser.res, gold: -50 } });
        assert(e2.popularity === 100 && e2.taxes === 3 && e2.res.gold === 0, 'Economy deserialize clamps out-of-range values');
    });

    await section('3. A* Pathfinding (binary heap)', () => {
        const size = 20;
        const grid = [];
        for (let x = 0; x < size; x++) {
            grid[x] = [];
            for (let y = 0; y < size; y++) grid[x][y] = { type: 'grass', occupied: false, buildingId: null };
        }
        for (let y = 0; y < size; y++) if (y !== 10) grid[10][y].type = 'water';
        const pf = new PathfindingEngine({ gridSize: size, map: grid, buildings: [] });
        const p = pf.findPath(5, 10, 15, 10, false, false);
        assert(p.length > 0, 'A* navigates across map');
        assert(p.some(pt => Math.floor(pt.x) === 10 && Math.floor(pt.y) === 10), 'A* routes through gap/gateway');
        const last = p[p.length - 1];
        assert(last.x === 15 && last.y === 10, 'Path ends exactly on requested target');

        const h = new MinHeap();
        [5, 1, 9, 3, 7, 2, 8].forEach(f => h.push({ f }));
        const order = [];
        while (h.size) order.push(h.pop().f);
        assert(order.join(',') === '1,2,3,5,7,8,9', 'MinHeap pops in ascending priority order');

        grid[10][10].type = 'water'; // seal the gap
        const sealed = pf.findPath(5, 10, 15, 10, false, false);
        assert(sealed.length > 0 && Math.floor(sealed[sealed.length - 1].x) <= 9, 'Unreachable target falls back to closest reachable tile');
        for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) grid[x][y].type = 'water';
        grid[2][2].type = 'grass';
        assert(pf.findPath(2, 2, 15, 15, false, false).length === 0, 'Fully enclosed (no passable neighbour) target returns empty path');
        assert(pf.findPath(2, 2, 15, 15, true, false).length === 1, 'Flying units ignore terrain and fly direct');

        const g = freshGame();
        let t = process.hrtime.bigint();
        for (let i = 0; i < 200; i++) g.pathfinding.findPath(2 + (i % 10), 2 + (i % 50), 60, 60 - (i % 40), false, true);
        const ms = Number(process.hrtime.bigint() - t) / 1e6;
        assert(ms < 1500, `200 cross-map river paths in ${ms.toFixed(0)}ms (< 1500ms budget)`);
        const gate = g.spawnBuilding('gatehouse', 25, 40, false, 'solaris');
        assert(g.pathfinding.isTilePassable(25, 40, false, false) === true, 'Friendly gatehouse is passable for friendly troops');
        assert(g.pathfinding.isTilePassable(25, 40, false, true) === false, 'Gatehouse blocks enemy troops');
        assert(g.buildingIndex.get(gate.id) === gate, 'Building id index provides O(1) occupancy lookups');
    });

    await section('4. Combat Mechanics & Special Faction Abilities', () => {
        const paladin = new Unit('paladin', 10, 10, false, 'solaris');
        const woundedAlly = new Unit('knight', 11, 10, false, 'solaris');
        woundedAlly.hp = 100;
        const mockGame = { units: [paladin, woundedAlly], buildings: [], spawnFloatingText: () => {} };
        paladin.healCooldown = 0;
        paladin.update(1.0, mockGame);
        assert(woundedAlly.hp > 100, `Paladin Holy Aura heals nearby wounded allies (HP: ${woundedAlly.hp})`);

        const vampire = new Unit('vampire', 20, 20, false, 'obsidian');
        vampire.hp = 100;
        const victim = new Unit('halberdier', 20.5, 20, true, 'solaris');
        vampire.performAttack(victim, mockGame);
        assert(vampire.hp > 100, `Vampire lifesteal restores health upon dealing melee damage (HP: ${vampire.hp})`);

        const catapultTarget = new Unit('halberdier', 30, 30, true, 'frost');
        const splashVictim = new Unit('halberdier', 30.5, 30.5, true, 'frost');
        catapultTarget.hp = 250;
        splashVictim.hp = 250;
        mockGame.units = [catapultTarget, splashVictim];
        const proj = new Projectile('boulder', 25, 25, catapultTarget, 80);
        proj.progress = 1.0;
        const impactResult = proj.update(0.1, mockGame);
        assert(impactResult === true, 'Projectile terminates on landing');
        assert(catapultTarget.hp < 250, `Primary target takes direct catapult damage (HP: ${catapultTarget.hp})`);
        assert(splashVictim.hp < 250, `Adjacent unit takes AoE splash damage (HP: ${splashVictim.hp})`);

        const friendlyCat = new Unit('catapult', 20, 30, false, 'solaris');
        const foe = new Unit('halberdier', 30, 30, true, 'obsidian');
        const ally = new Unit('knight', 30.4, 30.4, false, 'solaris');
        mockGame.units = [friendlyCat, foe, ally];
        const p2 = new Projectile('boulder', 20, 30, foe, 80, friendlyCat);
        p2.progress = 1;
        p2.update(0.1, mockGame);
        assert(ally.hp === ally.maxHp, 'Splash damage never hits the shooter\'s own allies');
        assert(foe.lastAttackerType === 'catapult', 'Damage records the attacker type for kill attribution');
    });

    await section('5. Structure Integrity & Repair System', () => {
        const building = new Building('wall', 5, 5, false, 'solaris');
        building.hp = 200;
        assert(building.hp < building.maxHp, 'Building damaged state recognized');
        building.repair(300);
        assert(building.hp === 500, `Building repaired (HP: ${building.hp})`);
        building.repair(9999);
        assert(building.hp === building.maxHp, 'Repair never exceeds max HP');
    });

    await section('6. Tactical Abilities in CitadelGame', () => {
        const game = new CitadelGame();
        game.faction = 'solaris';
        game.initGameWorld('valley');
        const peasant = new Unit('peasant', 18, 28, false, 'solaris');
        const knight1 = new Unit('knight', 19, 28, false, 'solaris');
        const archer1 = new Unit('archer', 20, 28, false, 'solaris');
        game.units = [peasant, knight1, archer1];
        game.selectAllMilitary();
        assert(game.selectedUnits.length === 2, `Army selection filters workers and selects all ${game.selectedUnits.length} military units`);
        assert(!game.selectedUnits.includes(peasant), 'Army selection excludes non-military peasants');

        game.economy.res.pitch = 10;
        const enemyNearWall = new Unit('halberdier', 18.5, 28.5, true, 'obsidian');
        enemyNearWall.hp = 250;
        const enemyFar = new Unit('halberdier', 50, 50, true, 'obsidian');
        enemyFar.hp = 250;
        game.units.push(enemyNearWall, enemyFar);
        game.triggerBoilingPitch();
        assert(game.economy.res.pitch === 5, 'Boiling Pitch deducts 5 pitch from stockpile');
        assert(enemyNearWall.hp === 175, `Near invader takes 75 fire damage from boiling pitch (HP: ${enemyNearWall.hp})`);
        assert(enemyFar.hp === 250, 'Distant enemy is outside defensive pitch radius');

        game.faction = 'solaris';
        game.currentMissionData = CAMPAIGN_MISSIONS.solaris[0];
        game.advanceNextMission();
        assert(game.currentMissionData.id === 2, `Advance campaign moves to Mission 2 (${game.currentMissionData.title})`);
    });

    await section('7. Spatial Hash Grid', () => {
        const hash = new SpatialHash(4);
        const pts = [];
        for (let i = 0; i < 600; i++) pts.push({ x: Math.random() * 64, y: Math.random() * 64, hp: 1, id: i });
        hash.rebuild(pts);
        assert(hash.count === 600, 'Spatial hash indexes all live entities');
        let mismatches = 0;
        for (let q = 0; q < 50; q++) {
            const x = Math.random() * 64;
            const y = Math.random() * 64;
            const r = 1 + Math.random() * 8;
            const a = new Set(hash.queryRadius(x, y, r).map(p => p.id));
            const b = new Set(pts.filter(p => Math.hypot(p.x - x, p.y - y) <= r).map(p => p.id));
            if (a.size !== b.size || [...a].some(id => !b.has(id))) mismatches++;
        }
        assert(mismatches === 0, 'Radius queries exactly match brute force on 50 random probes');
        const nearest = hash.findNearest(10, 10, 64);
        const brute = pts.reduce((best, p) => (Math.hypot(p.x - 10, p.y - 10) < Math.hypot(best.x - 10, best.y - 10) ? p : best));
        assert(nearest.id === brute.id, 'findNearest returns the true nearest entity');
        hash.rebuild([{ x: 5, y: 5, hp: 0 }]);
        assert(hash.count === 0, 'Dead entities are excluded from the index');
        assert(queryUnitsNear({ units: [{ x: 1, y: 1 }, { x: 9, y: 9 }] }, 0, 0, 2).length === 1, 'queryUnitsNear falls back to linear scan without a hash');
    });

    await section('8. Fog of War & Exploration Shroud', () => {
        const g = freshGame();
        assert(g.fog.isVisible(19, 29), 'Keep tile is visible at start');
        assert(g.fog.isVisible(30, 29), 'Keep grants 12-tile vision (tile 11 away is visible)');
        assert(!g.fog.isVisible(46, 29) && !g.fog.isExplored(46, 29), 'Enemy keep starts hidden and unexplored');
        const scout = new Unit('knight', 45.5, 10.5, false, 'solaris');
        g.units.push(scout);
        g.fog.recompute(g);
        assert(g.fog.isVisible(48, 10), 'Units grant 5-tile vision radius');
        assert(!g.fog.isVisible(52, 10), 'Tiles beyond unit vision stay hidden');
        scout.x = 20; scout.y = 30;
        g.fog.recompute(g);
        assert(!g.fog.isVisible(45, 10) && g.fog.isExplored(45, 10), 'Explored tiles persist after the scout leaves');
        const t = new Building('tower', 0, 0, false, 'solaris');
        t.isTower = true;
        assert(FogOfWar.visionRadiusFor(t) === 10, 'Watchtowers grant 10-tile vision');
        const enc = g.fog.serializeExplored();
        const f2 = new FogOfWar(64);
        assert(f2.deserializeExplored(enc) && f2.explored.every((v, i) => v === g.fog.explored[i]), 'Explored map round-trips through RLE encoding');
        assert(!f2.deserializeExplored('1999999') && !f2.deserializeExplored('x12'), 'Malformed RLE is rejected');
        g.fog.update(1, g);
        const s = g.fog.getShade(19, 29);
        const s2 = g.fog.getShade(60, 60);
        assert(s < 0.3 && s2 > 0.8, 'Shade layer: visible tiles clear, unexplored tiles dark');
        g.fog.enabled = false;
        assert(g.fog.isVisible(60, 60), 'Fog can be disabled (skirmish option / dev console)');
    });

    await section('9. Radar Minimap', () => {
        const p = Minimap.worldToMinimap(32, 16, 180, 64);
        assert(p.x === 90 && p.y === 45, 'World -> minimap projection scales correctly');
        const w = Minimap.minimapToWorld(p.x, p.y, 180, 64);
        assert(Math.abs(w.x - 32) < 1e-9 && Math.abs(w.y - 16) < 1e-9, 'Minimap -> world is the exact inverse');
        assert(Minimap.minimapToWorld(-50, 999, 180, 64).x === 0 && Minimap.minimapToWorld(-50, 999, 180, 64).y === 64, 'Minimap clicks are clamped to the map');
        const g = new CitadelGame();
        g.camera.zoom = 1.5;
        g.centerCameraOn(32, 32);
        const c = Minimap.frustumWorldCorners(g.camera, 1280, 720);
        const cx = c.reduce((a, q) => a + q.x, 0) / 4;
        const cy = c.reduce((a, q) => a + q.y, 0) / 4;
        assert(Math.abs(cx - 32) < 1e-6 && Math.abs(cy - 32) < 1e-6, 'Camera frustum is centred on the camera target (zoom-aware)');
        g.camera.zoom = 0.5;
        const wide = Minimap.frustumWorldCorners(g.camera, 1280, 720);
        assert(Math.abs(wide[1].x - wide[0].x) > Math.abs(c[1].x - c[0].x), 'Zooming out widens the frustum');
    });

    await section('10. Particle FX & Biome Weather', () => {
        const fx = new FxSystem();
        fx.setBiome('tundra', 800, 600);
        assert(fx.weather.length === WEATHER_PROFILES.tundra.count, 'Frostbound tundra spawns snow flurries');
        fx.setBiome('wasteland', 800, 600);
        assert(WEATHER_PROFILES.wasteland.kind === 'ash' && fx.weather.length > 0, 'Obsidian wasteland spawns cinder/ash');
        fx.setBiome('valley', 800, 600);
        assert(WEATHER_PROFILES.valley.kind === 'motes', 'Solaris valley spawns golden motes');
        for (let i = 0; i < 200; i++) fx.emitBlood(5, 5, 8);
        assert(fx.combat.length <= MAX_COMBAT_PARTICLES, 'Combat particles are hard-capped for performance');
        fx.emitSparks(1, 1);
        fx.emitRubble(2, 2);
        fx.update(5);
        assert(fx.combat.length === 0, 'Combat particles expire');
        const foe = new Unit('halberdier', 10, 10, true, 'obsidian');
        const friend = new Unit('knight', 10.2, 10.2, false, 'solaris');
        fx.emitFlamePatch(10, 10, { isEnemy: false });
        fx.update(0.6, { units: [foe, friend] });
        assert(foe.hp < foe.maxHp && friend.hp === friend.maxHp, 'Dragon-breath flame patches burn enemies only');
        fx.update(5, { units: [foe] });
        assert(fx.flames.length === 0, 'Flame patches burn out');
        const p0 = fx.weather[0].y;
        fx.update(0.5);
        assert(fx.weather[0].y !== p0, 'Weather particles animate');
    });

    await section('11. Audio Mixer', () => {
        const s = new SoundEngine();
        assert(s.setVolume('music', 1.7) && s.volumes.music === 1, 'Volume is clamped to [0, 1]');
        assert(s.setVolume('sfx', -2) && s.volumes.sfx === 0, 'Negative volume clamps to 0');
        assert(s.setVolume('bogus', 0.5) === false, 'Unknown mixer bus is rejected');
        s.setVolumes({ master: 0.3, music: 'NaN' });
        assert(s.volumes.master === 0.3 && s.volumes.music === 0, 'Bulk volume update sanitises input');
        let threw = false;
        try {
            s.playClick(); s.playDragonRoar(); s.startAmbientMusic('frost'); s.previewFaction('obsidian'); s.stopAmbient(); s.muteForAd(true); s.muteForAd(false);
        } catch (e) { threw = true; }
        assert(!threw, 'Audio API is safe to call with no AudioContext (headless / blocked autoplay)');
        assert(typeof s.playBirdsong === 'function' && typeof s.playWolfHowl === 'function' && typeof s.playCrackle === 'function', 'Faction soundscape voices exist (birdsong, wolf howl, campfire crackle)');
    });

    await section('12. Settings, Accessibility & Rebindable Keys', () => {
        const mem = new MemoryStorage();
        const st = new SettingsManager(mem);
        assert(st.actionForKey('W') === 'panUp' && st.actionForKey(' ') === 'centerKeep', 'Default keybinds resolve (case-insensitive)');
        const res = st.rebind('pause', 'w');
        assert(res.ok && res.swappedWith === 'panUp' && st.data.keybinds.panUp === 'p', 'Rebinding to a used key swaps bindings (no action left unbound)');
        assert(st.rebind('pause', 'Escape').ok === false, 'Reserved keys cannot be bound');
        assert(st.rebind('notAnAction', 'x').ok === false, 'Unknown actions are rejected');
        st.setVolume('music', 0.25);
        st.set('highContrast', true);
        const st2 = new SettingsManager(mem);
        assert(st2.data.keybinds.pause === 'w' && st2.data.volumes.music === 0.25 && st2.data.highContrast === true, 'Settings persist across sessions');
        assert(st.set('highContrast', 'yes') === false, 'Settings reject wrongly-typed values');
        mem.setItem(SETTINGS_STORAGE_KEY, '{not json');
        const st3 = new SettingsManager(mem);
        assert(st3.data.keybinds.panUp === 'w', 'Corrupt settings storage falls back to defaults');
        mem.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ keybinds: { pause: 'escape', panUp: 42 }, volumes: { master: 9 } }));
        const st4 = new SettingsManager(mem);
        assert(st4.data.keybinds.pause === 'p' && st4.data.volumes.master === 1, 'Tampered settings are sanitised on load');
        st.resetKeybinds();
        assert(st.data.keybinds.pause === 'p', 'Keybinds reset to defaults');
        assert(new SettingsManager(null).save() === false, 'Settings degrade gracefully without storage');
        assert(SettingsManager.displayKey(' ') === 'Space', 'Key labels are human readable');
    });

    await section('13. Game Speed, Camera & Input', () => {
        const g = freshGame();
        assert(g.setSpeed(5) && g.simSpeed === 5, 'Game speed can be set to 5x Ultra');
        assert(g.setSpeed(3) === false, 'Unsupported speeds are rejected');
        g.togglePause();
        assert(g.simSpeed === 0 && !g.isSimulationRunning(), 'Pause (0x) halts the simulation');
        g.togglePause();
        assert(g.simSpeed === 5, 'Unpause restores previous speed');
        g.cycleSpeed(-1);
        assert(g.simSpeed === 2, 'Speed cycling steps through 0/1/2/5');
        g.briefingOpen = true;
        assert(!g.isSimulationRunning(), 'Simulation pauses while a mission briefing is open');
        g.briefingOpen = false;

        g.renderer = { canvas: { width: 1000, height: 800 } };
        g.camera = { x: 37, y: -12, zoom: 1 };
        const px = 700, py = 300;
        const before = { x: (px - 500 - g.camera.x) / g.camera.zoom, y: (py - 400 - g.camera.y) / g.camera.zoom };
        g.zoomAt(px, py, 1.5);
        const after = { x: (px - 500 - g.camera.x) / g.camera.zoom, y: (py - 400 - g.camera.y) / g.camera.zoom };
        assert(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9 && g.camera.zoom === 1.5, 'Zoom keeps the world point under the cursor fixed');
        g.zoomAt(px, py, 100);
        assert(g.camera.zoom === 2.5, 'Zoom is clamped to 2.5x');
        g.camera.zoom = 2;
        g.centerCameraOn(10, 20);
        assert(g.camera.x === -((10 - 20) * 32) * 2 && g.camera.y === -((10 + 20) * 16) * 2, 'centerCameraOn accounts for zoom (fixes off-centre keep focus)');
        g.panBy(5, -5);
        assert(g.camera.x === 645 && g.camera.y === -965, 'panBy offsets the camera');
        g.settings = new SettingsManager(new MemoryStorage());
        assert(g.performAction('speedUp') && g.simSpeed === 5, 'Keybound actions dispatch (speedUp)');
        assert(g.performAction('nonsense') === false, 'Unknown actions are ignored');

        const r = new IsometricRenderer({ getContext: () => ({}), width: 1280, height: 720 }, { camera: { x: 0, y: 0, zoom: 1 }, gridSize: 64 });
        const scr = r.worldToScreen(20.5, 30.5);
        const back = r.screenToWorld(scr.x + 640, scr.y + 360);
        assert(back.x === 20 && back.y === 30, 'Isometric projection round-trips screen <-> world');
    });

    await section('14. Construction, Recruitment & Population', () => {
        const g = freshGame();
        g.economy.res.gold = 1000; g.economy.res.wood = 1000; g.economy.res.iron = 500; g.economy.res.stone = 500;
        assert(g.trainUnit('archer') === false, 'Archers require an Archery Range');
        g.spawnBuilding('archery', 12, 34, false, 'solaris');
        assert(g.trainUnit('archer') === true && g.campaign.stats.trained.archer === 1, 'Recruitment succeeds once the range exists and is tracked');
        assert(g.trainUnit('warlord') === false, 'Enemy-only generals cannot be recruited');
        g.economy.pop.current = g.economy.pop.max;
        assert(g.trainUnit('giant') === false, 'Housing cap blocks recruitment');
        g.economy.pop.current = 5;
        const pop0 = g.economy.pop.current;
        const peasant = g.units.find(u => u.type === 'peasant');
        kill(g, peasant);
        assert(g.economy.pop.current === pop0 - 1, 'Fallen friendly units free their housing slot');
        g.selectTool('hovel');
        assert(g.tryPlaceBuilding(60, 60) === false, 'Cannot build in unexplored territory');
        assert(g.tryPlaceBuilding(30, 20) === false, 'Cannot build on water');
        const u = g.units.find(x => !x.isEnemy);
        assert(g.isValidPlacement(Math.floor(u.x), Math.floor(u.y), 1, 1) === false, 'Units standing on a footprint block construction');
        assert(g.isValidPlacement(Math.floor(u.x), Math.floor(u.y), 1, 1, { ignoreUnits: true }) === true, 'Scripted mission structures ignore unit occupancy (regression: random defenders cancelled O3 gatehouses)');
        g.selectTool('hovel');
        assert(g.tryPlaceBuilding(16, 24) === true && g.campaign.stats.built.hovel === 1, 'Valid construction succeeds and is tracked');
        const before = g.economy.res.wood;
        g.selectTool('dragon');
        assert(g.selectedTool === null, 'Selecting a unit recruits immediately instead of entering placement mode');
        assert(g.economy.res.wood === before, 'Failed dragon recruit (no roost) costs nothing');
    });

    await section('15. Defensive Structures, Stealth & Siege AI', () => {
        const g = freshGame({ faction: 'obsidian', map: 'wasteland' });
        const cauldron = g.spawnBuilding('cauldron', 24, 20, false, 'obsidian');
        const raider = new Unit('halberdier', 24.5, 21.5, true, 'solaris');
        g.units.push(raider);
        g.economy.res.pitch = 3;
        g.unitHash.rebuild(g.units);
        cauldron.update(0.1, g);
        assert(raider.hp === raider.maxHp - 40 && g.economy.res.pitch === 2, 'Pitch cauldron scalds adjacent invaders and consumes 1 pitch');
        g.economy.res.pitch = 0;
        cauldron.attackCooldown = 0;
        const hp1 = raider.hp;
        cauldron.update(0.1, g);
        assert(raider.hp === hp1, 'Cauldron stays cold without pitch');

        const tower = g.buildings.find(b => b.isEnemy && b.type === 'tower');
        const vamp = new Unit('vampire', tower.gx + 2.5, tower.gy + 2.2, false, 'obsidian');
        g.units = [vamp];
        g.projectiles = [];
        g.unitHash.rebuild(g.units);
        tower.attackCooldown = 0;
        tower.update(0.1, g);
        assert(g.projectiles.length === 0 && vamp.isConcealed(), 'Concealed Bloodknight is invisible to enemy watchtowers');
        vamp.performAttack(tower, g);
        assert(!vamp.isConcealed(), 'Bloodknight is revealed after striking');
        tower.attackCooldown = 0;
        tower.update(0.1, g);
        assert(g.projectiles.length === 1, 'Revealed Bloodknight is targeted');

        const gf = freshGame({ faction: 'frost', map: 'tundra' });
        const rune = gf.spawnBuilding('runestone', 12, 20, false, 'frost');
        const k = new Unit('knight', 13, 21, false, 'frost');
        gf.units.push(k);
        gf.unitHash.rebuild(gf.units);
        rune.healCooldown = 0;
        rune.update(0.1, gf);
        assert(k.currentAttack() === Math.round(48 * 1.25), 'Runestone aura empowers nearby allies (+25% attack)');

        const gs = freshGame();
        const wall = gs.spawnBuilding('wall', 41, 10, true === false, 'solaris');
        const sieger = new Unit('halberdier', 40.5, 10.5, true, 'obsidian');
        sieger.targetEntity = gs.playerKeep;
        sieger.state = 'attacking';
        sieger.path = [];
        gs.units.push(sieger);
        gs.unitHash.rebuild(gs.units);
        sieger.update(0.1, gs);
        assert(sieger.targetEntity === wall, 'Stuck siege troops breach the blocking wall instead of idling');

        const defender = new Unit('knight', 41, 12, false, 'solaris');
        sieger.targetEntity = wall;
        sieger.retaliateTimer = 0;
        gs.units.push(defender);
        gs.unitHash.rebuild(gs.units);
        sieger.update(1.1, gs);
        assert(sieger.targetEntity === defender, 'Siege troops retaliate against nearby defenders');

        const idleRaider = new Unit('knight', 50, 50, true, 'obsidian');
        idleRaider.waveId = 3;
        gs.units = [idleRaider];
        gs.unitHash.rebuild(gs.units);
        idleRaider.autoScanForEnemies(gs);
        assert(idleRaider.targetEntity === gs.playerKeep, 'Idle wave troops resume the march on the keep');
    });

    await section('16. Siege Waves & AI Lord', () => {
        const g = freshGame();
        const troops = g.triggerEnemyWave();
        assert(g.spawnQueue.length === troops.length && g.units.filter(u => u.waveId === 1).length === 0, 'Waves queue troops (no setTimeout) for pause/save safety');
        g.processSpawnQueue(0.1);
        assert(g.units.filter(u => u.waveId === 1).length === 1, 'Spawn queue releases troops on simulation time');
        g.processSpawnQueue(5);
        const wave = g.units.filter(u => u.waveId === 1);
        assert(wave.length === troops.length && wave.every(u => u.targetEntity === g.playerKeep), 'Whole wave spawns and marches on the player keep');
        wave.forEach(u => kill(g, u));
        g.checkWaveCompletion();
        assert(g.campaign.stats.wavesSurvived === 1, 'Repelled waves are counted');
        assert(g.saveSystem.storage.getItem('citadel.save.auto') !== null, 'Repelling a wave triggers an auto-save');
        const cav = g.buildWaveTroops(3, 'cavalry', 'obsidian');
        assert(cav.filter(t => t === 'knight').length === 7, 'Cavalry waves scale armored knights per wave');
        assert(g.buildWaveTroops(6, 'standard', 'frost').includes('giant'), 'Late waves bring faction mythic units');
        const hard = freshGame({ difficulty: 'hard' });
        assert(hard.createEnemyUnit('halberdier', 40, 30, 'obsidian').maxHp === Math.round(180 * 1.25), 'Hard difficulty scales enemy health');
        const easy = freshGame({ difficulty: 'easy' });
        assert(easy.waveTimer === SKIRMISH_WAVES.easy.firstDelay && hard.waveTimer === SKIRMISH_WAVES.hard.firstDelay, 'First-wave timer depends on difficulty');
        const s2 = campaignGame('solaris', 2);
        s2.currentWave = 5;
        assert(s2.wavesExhausted(), 'Mission wave caps stop further invasions');
        const s1 = campaignGame('solaris', 1);
        assert(s1.wavesExhausted(), 'Economic missions can disable sieges entirely');
    });

    await section('17. Narrative Campaign (9 missions)', () => {
        const expected = {
            solaris: ['The Gathering Storm', "Siege of Camelot's Gate", "Dragon's Dawn"],
            frost: ['The Glacial Trail', 'Frostpeak Pass Ambush', "The Ice Wyvern's Domain"],
            obsidian: ['Transylvanian Reckoning', 'Blood Crucible Bastion', 'Eclipse of the Abyss']
        };
        for (const f of Object.keys(expected)) {
            assert(CAMPAIGN_MISSIONS[f].map(m => m.title).join('|') === expected[f].join('|'), `${FACTIONS_DEF[f].name} mission titles match the PLANS table`);
        }
        const all = [].concat(...Object.values(CAMPAIGN_MISSIONS));
        assert(all.every(m => m.objectives.length > 0 && m.bonus && m.briefing && m.objective), 'Every mission has objectives, a bonus, a briefing and a summary');

        const s1 = campaignGame('solaris', 1);
        assert(s1.briefingOpen === false && s1.state === 'playing', 'Mission starts after the briefing is dismissed');
        ['hovel', 'sawyer', 'hunter'].forEach((t, i) => s1.spawnBuilding(t, 12 + i, 20, false, 'solaris'));
        s1.economy.pop.current = 150;
        assert(!s1.campaign.allPrimaryComplete(), 'Primary objectives require ALL conditions');
        s1.economy.res.food = 800;
        s1.checkObjectiveProgress();
        assert(s1.state === 'victory', 'S1: settlement + 150 population + 800 food completes the mission');
        assert(s1.campaign.evaluateBonus().done, 'S1 bonus: zero starvation achieved');

        const s2 = campaignGame('solaris', 2);
        assert(s2.buildings.filter(b => b.tag === 'outerTower').length === 3, 'S2: three outer towers are placed');
        assert(s2.campaign.evaluateBonus().done, 'S2 bonus on track while towers stand');
        s2.handleBuildingDestruction(s2.buildings.find(b => b.tag === 'outerTower'));
        assert(s2.campaign.evaluateBonus().failed, 'S2 bonus fails when an outer tower falls');
        for (let i = 0; i < 5; i++) s2.campaign.recordWaveSurvived();
        s2.checkObjectiveProgress();
        assert(s2.state === 'victory', 'S2: surviving 5 waves completes the mission');

        const s3 = campaignGame('solaris', 3);
        const general = s3.units.find(u => u.isGeneral);
        assert(s3.enemyKeep.name === 'Blackfang Keep' && general && general.name === 'Blackfang Warlord', 'S3: Blackfang Keep and its warlord are deployed');
        const dragon = new Unit('dragon', general.x - 3, general.y, false, 'solaris');
        const breath = new Projectile('fire', dragon.x, dragon.y, general, general.hp + 10, dragon);
        breath.progress = 1;
        breath.update(0.1, s3);
        s3.processDeaths();
        assert(s3.campaign.stats.generalSlain && s3.campaign.evaluateBonus().done, 'S3 bonus: general slain by the dragon is attributed');
        s3.spawnBuilding('cathedral', 12, 20, false, 'solaris');
        s3.campaign.recordTrained('dragon');
        s3.handleBuildingDestruction(s3.enemyKeep);
        assert(s3.state === 'victory', 'S3: cathedral + dragon + Blackfang Keep destroyed completes the mission');

        const f1 = campaignGame('frost', 1);
        const q = f1.spawnBuilding('quarry', 12, 20, false, 'frost');
        f1.economy.tickEconomy();
        assert(Math.abs(f1.campaign.stats.produced.stone - 6.5) < 1e-9 && q, 'F1: quarry output (with +30% Frost bonus) counts toward "quarry 500 basalt"');
        f1.selectTool('hovel');
        f1.tryPlaceBuilding(16, 24);
        assert(f1.campaign.evaluateBonus().failed, 'F1 bonus fails after building a wood cabin (Hovel)');
        f1.campaign.recordProduction('stone', 500);
        [0, 1, 2].forEach(i => f1.spawnBuilding('hunter', 12 + i, 23, false, 'frost'));
        f1.checkObjectiveProgress();
        assert(f1.state === 'victory', 'F1: 500 basalt + 3 hunter outposts completes the mission');

        const f2 = campaignGame('frost', 2);
        const inPass = new Unit('knight', 31, 30, true, 'obsidian');
        const outPass = new Unit('knight', 50, 50, true, 'obsidian');
        f2.units.push(inPass, outPass);
        kill(f2, inPass);
        kill(f2, outPass);
        assert(f2.campaign.stats.regionKills === 1, 'F2 bonus: only kills inside the pass bottleneck count');
        f2.economy.res.gold = 2000; f2.economy.res.iron = 500; f2.economy.res.honor = 200; f2.economy.res.stone = 500;
        f2.economy.pop.max = 99;
        f2.trainUnit('giant'); f2.trainUnit('giant');
        assert(f2.trainUnit('valkyrie') === false, 'Valkyries require the Frostbound Runestone');
        f2.spawnBuilding('runestone', 12, 20, false, 'frost');
        f2.trainUnit('valkyrie'); f2.trainUnit('valkyrie');
        for (let i = 0; i < 4; i++) f2.campaign.recordWaveSurvived();
        f2.checkObjectiveProgress();
        assert(f2.state === 'victory', 'F2: giants + valkyries + 4 repelled charges completes the mission');

        const f3 = campaignGame('frost', 3);
        f3.stats.playTime = 700;
        assert(f3.campaign.evaluateBonus().done, 'F3 bonus on track under 12 minutes');
        f3.stats.playTime = 721;
        assert(f3.campaign.evaluateBonus().failed, 'F3 bonus fails after 12 minutes');
        kill(f3, f3.units.find(u => u.isGeneral));
        assert(f3.campaign.evaluateObjective({ type: 'killGeneral' }).done, 'F3: vanquishing the Northern Warlord is tracked');

        const o1 = campaignGame('obsidian', 1);
        assert(o1.economy.taxes === 2 && o1.campaign.evaluateBonus().done, 'O1 starts at High tax with bonus on track');
        o1.updateTaxes(1);
        assert(o1.campaign.evaluateBonus().failed, 'O1 bonus fails when tax drops below High');

        const o2 = campaignGame('obsidian', 2);
        o2.spawnBuilding('crucible', 12, 20, false, 'obsidian');
        o2.economy.res.gold = 2000; o2.economy.res.pitch = 500; o2.economy.res.honor = 500; o2.economy.pop.max = 99;
        o2.trainUnit('vampire');
        const v = o2.units.find(u => u.type === 'vampire' && !u.isEnemy);
        v.hp = 50;
        v.performAttack(new Unit('halberdier', v.x + 0.5, v.y, true, 'solaris'), o2);
        assert(o2.campaign.stats.lifestealHealed > 0, 'O2 bonus: lifesteal healing is accumulated');
        o2.handleBuildingDestruction(o2.buildings.find(b => b.isEnemy && b.type === 'barracks'));
        assert(o2.campaign.evaluateObjective({ type: 'destroyBuildingType', building: 'barracks' }).done, 'O2: razing the garrison barracks is tracked');

        const o3 = campaignGame('obsidian', 3);
        const gates = o3.buildings.filter(b => b.tag === 'enemyGate');
        assert(gates.length === 3 && o3.enemyKeep.name === 'Imperial Citadel', 'O3: Imperial Citadel guarded by three gatehouses');
        gates.forEach(b => o3.handleBuildingDestruction(b));
        assert(o3.campaign.evaluateBonus().done, 'O3 bonus: all enemy gatehouses destroyed');

        const mem = new MemoryStorage();
        CampaignDirector.recordMissionComplete('frost', 1, true, mem);
        const prog = CampaignDirector.loadProgress(mem);
        assert(prog.frost.unlocked === 2 && prog.frost.bonus['1'] === true && prog.solaris.unlocked === 1, 'Completing a mission unlocks the next and records the bonus star');
        CampaignDirector.recordMissionComplete('frost', 3, false, mem);
        assert(CampaignDirector.loadProgress(mem).frost.unlocked === 3, 'Unlock level is clamped to the final mission');
        mem.setItem(CAMPAIGN_PROGRESS_KEY, '{"frost":{"unlocked":"999"}}');
        assert(CampaignDirector.loadProgress(mem).frost.unlocked === 1, 'Tampered campaign progress is rejected');
    });

    await section('18. Persistence Engine (Save / Load / Export)', () => {
        const g = freshGame({ faction: 'frost', map: 'tundra' });
        g.economy.res.gold = 777;
        g.economy.taxes = 2;
        const tower = g.spawnBuilding('tower', 25, 25, false, 'frost');
        tower.hp = 1000;
        tower.tag = 'testTag';
        const k = new Unit('knight', 26.5, 27.5, false, 'frost');
        k.attackTarget(g.enemyKeep, g);
        g.units.push(k);
        g.triggerEnemyWave();
        g.processSpawnQueue(0.1);
        g.stats.playTime = 321;
        g.campaign.recordWaveSurvived();
        g.fog.recompute(g);
        const json = JSON.stringify(g.saveSystem.serialize());
        const data = JSON.parse(json);
        assert(data.format === SAVE_FORMAT && data.schema === 1, 'Save is tagged with format & schema version');
        assert(['wood', 'stone', 'iron', 'pitch', 'gold', 'food', 'honor'].every(r => r in data.economy.res), 'Save captures the full stockpile');
        assert(Array.isArray(data.units[0].path) && 'targetId' in data.units[0], 'Units serialize path and target id');

        const g2 = new CitadelGame();
        g2.saveSystem.storage = new MemoryStorage();
        g2.saveSystem.apply(data);
        assert(g2.faction === 'frost' && g2.mapType === 'tundra', 'Load restores faction and map');
        assert(g2.economy.res.gold === 777 && g2.economy.taxes === 2, 'Load restores economy and policy');
        assert(g2.buildings.length === g.buildings.length && g2.units.length === g.units.length, 'Load restores every building and unit');
        const t2 = g2.buildings.find(b => b.id === tower.id);
        assert(t2 && t2.hp === 1000 && t2.tag === 'testTag', 'Building HP and tags survive the round trip');
        const k2 = g2.units.find(u => u.id === k.id);
        assert(k2 && k2.targetEntity === g2.enemyKeep, 'Attack targets are re-linked by id after load');
        assert(g2.map[30][20].type === 'water' && g2.map[30][30].type === 'snow', 'Terrain is restored from the save');
        assert(g2.spawnQueue.length === g.spawnQueue.length && g2.activeWaves[1] === true, 'Pending wave spawns and active waves are restored');
        assert(g2.stats.playTime === 321 && g2.campaign.stats.wavesSurvived === 1, 'Elapsed time and campaign telemetry are restored');
        assert(g2.fog.explored.every((v, i) => v === g.fog.explored[i]), 'Fog exploration is restored');
        const maxId = Math.max(...g2.units.map(u => u.id), ...g2.buildings.map(b => b.id));
        assert(new Unit('peasant', 1, 1).id > maxId, 'New entities never collide with loaded ids');
        assert(g2.pathfinding.isTilePassable(25, 25) === false, 'Building occupancy is rebuilt (pathfinding respects loaded walls)');

        const tamper = (fn) => { const d = JSON.parse(json); fn(d); return g2.saveSystem.importFromString(JSON.stringify(d)); };
        assert(!tamper(d => { d.format = 'other-game'; }).ok, 'Rejects saves from other games');
        assert(!tamper(d => { d.units[0].type = 'nuke'; }).ok, 'Rejects unknown unit types');
        assert(!tamper(d => { d.buildings[0].gx = 63; }).ok, 'Rejects out-of-bounds buildings');
        assert(!tamper(d => { d.units[1].id = d.units[0].id; }).ok, 'Rejects duplicate entity ids');
        assert(!tamper(d => { d.schema = 99; }).ok, 'Rejects unsupported future schemas');
        assert(!tamper(d => { d.map.tiles = '<' + d.map.tiles.slice(1); }).ok, 'Rejects corrupted terrain data');
        assert(!g2.saveSystem.importFromString('{oops').ok, 'Rejects invalid JSON');
        assert(!g2.saveSystem.importFromString('x'.repeat(MAX_IMPORT_BYTES + 1)).ok, 'Rejects oversized files');
        const polluted = JSON.parse(json);
        const evil = JSON.parse('{"__proto__": {"pwned": true}, "gold": 5}');
        polluted.economy.res = evil;
        g2.saveSystem.importFromString(JSON.stringify(polluted));
        assert(({}).pwned === undefined, 'Prototype-pollution payloads have no effect');
        assert(g2.economy.res.gold === 5 && g2.economy.res.wood !== undefined, 'Partial resource blocks merge safely');

        const ss = g.saveSystem;
        assert(ss.saveToSlot('slot2').ok, 'Manual save to slot 2 succeeds');
        const info = ss.describeSlot('slot2');
        assert(info && /Skirmish/.test(info.label) && info.faction === 'frost', 'Slot metadata describes the save');
        assert(ss.saveToSlot('slot9').ok === false, 'Unknown slots are rejected');
        g.economy.res.gold = 1;
        assert(ss.loadFromSlot('slot2').ok && g.economy.res.gold === 777, 'Loading a slot restores the saved state');
        assert(ss.deleteSlot('slot2') && ss.describeSlot('slot2') === null, 'Slots can be deleted');
        assert(ss.loadFromSlot('slot3').ok === false, 'Loading an empty slot reports an error');
        ss.storage.setItem('citadel.save.slot3', '{garbage');
        assert(ss.describeSlot('slot3').corrupt === true, 'Corrupt slots are flagged, not crashed on');

        ss.autosaveTimer = 0;
        ss.storage.removeItem('citadel.save.auto');
        assert(ss.update(AUTOSAVE_INTERVAL - 1) === null, 'No auto-save before the 3-minute interval');
        assert(ss.update(2).ok && ss.storage.getItem('citadel.save.auto'), 'Auto-save fires every 3 minutes of game time');
        const noStore = new SaveSystem(g, null);
        assert(noStore.saveToSlot('slot1').ok === false, 'Saving without storage fails gracefully (sandboxed iframes)');

        const c = campaignGame('obsidian', 3);
        c.saveSystem.storage = new MemoryStorage();
        c.saveSystem.saveToSlot('slot1');
        const c2 = new CitadelGame();
        c2.saveSystem.storage = c.saveSystem.storage;
        c2.saveSystem.loadFromSlot('slot1');
        assert(c2.currentMissionData && c2.currentMissionData.title === 'Eclipse of the Abyss' && c2.taggedStructureCount.enemyGate === 3, 'Campaign missions (incl. bonus tracking) survive save/load');
    });

    await section('19. Performance & Hardening (250+ entities)', () => {
        const g = freshGame();
        g.fog.enabled = true;
        for (let i = 0; i < 260; i++) {
            const enemy = i % 2 === 1;
            g.units.push(new Unit(enemy ? 'halberdier' : 'knight', enemy ? 36 + Math.random() * 6 : 22 + Math.random() * 6, 18 + Math.random() * 24, enemy, enemy ? 'obsidian' : 'solaris'));
        }
        assert(g.units.length >= 250, `Stress scenario holds ${g.units.length} units`);
        for (let i = 0; i < 10; i++) g.update(1 / 60); // warm up JIT
        const frames = 180;
        const t = process.hrtime.bigint();
        for (let i = 0; i < frames; i++) g.update(1 / 60);
        const avg = Number(process.hrtime.bigint() - t) / 1e6 / frames;
        assert(avg < 16.6, `Simulation step averages ${avg.toFixed(2)}ms with 250+ units (< 16.6ms = 60 FPS budget)`);
        assert(g.unitHash.count > 0, 'Spatial hash is rebuilt every simulation step');
        const before = g.particles.length;
        for (let i = 0; i < 1000; i++) g.spawnFloatingText('x', 1, 1);
        assert(g.particles.length <= 301 && before <= 301, 'Floating combat text is capped');
    });

    await section('20. Touch Controls', () => {
        const pinch = computePinch([{ x: 0, y: 0 }, { x: 100, y: 0 }], [{ x: 0, y: 0 }, { x: 200, y: 0 }]);
        assert(pinch.scale === 2 && pinch.dx === 50 && pinch.midX === 100, 'Pinch gesture yields zoom scale and midpoint pan');
        assert(computePinch([{ x: 0, y: 0 }, { x: 0, y: 0 }], [{ x: 0, y: 0 }, { x: 10, y: 0 }]).scale === 10, 'Degenerate pinch start does not divide by zero');
        assert(joystickVector(4, 0, 40).x === 0, 'Joystick dead zone ignores tiny deflections');
        const full = joystickVector(80, 0, 40);
        assert(full.x === 1 && full.y === 0, 'Joystick deflection is clamped to the ring');
        const diag = joystickVector(20, 20, 40);
        assert(diag.x > 0 && diag.y > 0 && Math.hypot(diag.x, diag.y) < 1, 'Partial diagonal deflection scales proportionally');
        const g = freshGame();
        const tc = new TouchController(g, null);
        const cx = g.camera.x;
        tc.joystick = { active: true, vx: 1, vy: 0 };
        tc.update(0.1);
        assert(g.camera.x < cx, 'Virtual joystick pans the camera continuously');
        assert(typeof g.handlePrimaryAction === 'function' && typeof g.handleCommandAction === 'function', 'Tap and long-press map to primary/command actions');
    });

    await section('21. Monetization & Portal SDK Adapter', async () => {
        assert(detectPortal({ search: '?portal=poki', hostname: 'example.com' }, undefined) === 'poki', 'Portal detected from ?portal= param');
        assert(detectPortal({ search: '', hostname: 'games.crazygames.com' }, undefined) === 'crazygames', 'Portal detected from CrazyGames host');
        assert(detectPortal({ search: '', hostname: 'studio.itch.io' }, undefined) === 'itch', 'Portal detected from itch.io host');
        assert(detectPortal({ search: '?portal=evil', hostname: 'x.com' }, undefined) === 'none', 'Unknown portals fall back to no-ads');
        assert(detectPortal(null, 'desktop') === 'desktop', 'Explicit override (desktop build) wins');
        assert(createAdapter('poki').hasAds && !createAdapter('itch').hasAds, 'Ad adapters only on ad-funded portals');

        const g = freshGame();
        const mem = new MemoryStorage();
        await Monetization.init(g, { portal: 'none', storage: mem });
        assert(Monetization.ready && !Monetization.rewardedAvailable, 'Self-hosted build: no ads, no third-party scripts');
        assert((await Monetization.requestRoyalRespite()).reason === 'unavailable', 'Royal Respite unavailable without an ad portal');

        let interstitials = 0;
        Monetization.adapter = { hasAds: true, async rewarded() { return true; }, async interstitial() { interstitials++; }, gameplayStart() {}, gameplayStop() {} };
        Monetization.ready = true;
        Monetization.respiteCooldown = 0;
        g.economy.res.stone = 0;
        const r1 = await Monetization.requestRoyalRespite();
        assert(r1.ok && g.economy.res.stone === RESPITE_REWARD.stone, 'Completed rewarded ad grants +150 emergency stone');
        assert((await Monetization.requestRoyalRespite()).reason === 'cooldown', 'Rewarded ads are rate-limited');
        Monetization.update(RESPITE_COOLDOWN);
        assert(Monetization.rewardedAvailable, 'Royal Respite recharges after the cooldown');
        Monetization.adapter.rewarded = async () => false;
        assert((await Monetization.requestRoyalRespite()).ok === false && g.economy.res.stone === 150, 'Skipped ads grant nothing');

        let now = 1000;
        Monetization.clock = () => now;
        Monetization.lastInterstitialAt = -Infinity;
        Monetization.supporter = false;
        assert(await Monetization.maybeInterstitial() === true, 'Interstitial shown at a natural break');
        now = 1000 + INTERSTITIAL_MIN_GAP - 1;
        assert(await Monetization.maybeInterstitial() === false, 'Interstitials are frequency-capped');
        now = 1000 + INTERSTITIAL_MIN_GAP + 1;
        Monetization.supporter = true;
        assert(await Monetization.maybeInterstitial() === false && interstitials === 1, 'Royal Supporters never see interstitials');
        Monetization.supporter = false;

        let muted = null;
        const realMute = Sound.muteForAd;
        Sound.muteForAd = (m) => { muted = m; };
        Monetization.onAdStart();
        assert(muted === true && g.adPaused === true && !g.isSimulationRunning(), 'Ads mute audio and pause the simulation');
        Monetization.onAdEnd();
        assert(muted === false && g.adPaused === false, 'Audio and simulation resume after the ad');
        Sound.muteForAd = realMute;

        const ok = await Monetization.redeemSupporterCode(' avalon-demo-0000 ');
        assert(ok.ok && Monetization.supporter && mem.getItem('citadel.supporter.v1') === 'true', 'Valid supporter code unlocks perks (verified by local SHA-256 hash)');
        Monetization.supporter = false;
        assert((await Monetization.redeemSupporterCode('WRONG-CODE-1234')).ok === false, 'Invalid supporter codes are rejected');
        assert((await Monetization.redeemSupporterCode('<script>alert(1)</script>')).reason === 'Invalid code format', 'Malformed codes are rejected before hashing');
        assert(!read('js/monetization.js').includes('AVALON-DEMO-0000\''), 'Plaintext supporter codes are never shipped (hashes only)');
        const rec = Monetization.setConsent('essential');
        assert(rec.ads === false && JSON.parse(mem.getItem('citadel.consent.v1')).essential === true, 'Consent choice is recorded locally');
        assert(Object.keys(DEV_COMMENTARY).length >= 6, 'Developer commentary mode has content for supporters');
    });

    await section('22. Developer Console', () => {
        const g = freshGame();
        const dc = new DevConsole(g);
        const gold = g.economy.res.gold;
        dc.executeCommand('/gold 100');
        assert(g.economy.res.gold === gold + 100, '/gold grants resources');
        const n = g.units.length;
        dc.executeCommand('/spawn knight 3');
        assert(g.units.length === n + 3, '/spawn adds units');
        dc.executeCommand('/spawn knight 99999');
        assert(g.units.length === n + 3 + 200, '/spawn count is capped to protect performance');
        dc.executeCommand('/fog');
        assert(g.fog.enabled === false, '/fog toggles fog of war');
        dc.executeCommand('/speed 2');
        assert(g.simSpeed === 2, '/speed sets game speed');
        assert(dc.escapeHtml('<img onerror=x>') === '&lt;img onerror=x&gt;', 'Console output is HTML-escaped (no XSS via chat)');
        dc.executeCommand('/killall');
        assert(g.units.every(u => !u.isEnemy), '/killall removes all enemies');
    });

    await section('23. PWA: Manifest & Offline Service Worker', () => {
        const m = JSON.parse(read('manifest.json'));
        assert(m.name && m.short_name && m.start_url && m.display === 'standalone', 'Manifest declares standalone app metadata');
        assert(m.orientation === 'landscape', 'Manifest locks landscape orientation');
        const sizes = m.icons.map(i => i.sizes);
        assert(sizes.includes('192x192') && sizes.includes('512x512') && m.icons.some(i => i.purpose === 'maskable'), 'Manifest has 192, 512 and maskable icons');
        const badIcons = m.icons.filter(i => i.type === 'image/png').filter(i => { const d = pngSize(i.src); return !d || `${d.w}x${d.h}` !== i.sizes; });
        assert(badIcons.length === 0, 'Every PNG icon exists with the declared dimensions');
        const sw = read('sw.js');
        const pre = JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
        const missing = pre.filter(p => p !== './' && !exists(p.replace(/^\.\//, '')));
        assert(missing.length === 0, `All ${pre.length} precached assets exist`);
        const html = read('index.html');
        const refs = [...html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)].map(x => './' + x[1]);
        const notCached = refs.filter(r => !pre.includes(r));
        assert(notCached.length === 0, 'Every script & stylesheet in index.html is precached for 100% offline play');
        assert(/url\.origin !== self\.location\.origin\) return/.test(sw), 'Service worker never intercepts third-party (ad SDK) requests');
        assert(/caches\.delete/.test(sw) && /CACHE_VERSION/.test(sw), 'Old caches are purged on version bump');
        assert(/rel="manifest"/.test(html) && /serviceWorker\.register\('sw\.js'\)/.test(read('js/game.js')), 'Game links the manifest and registers the service worker');
    });

    await section('24. Zero Runtime Dependencies', () => {
        const html = read('index.html');
        assert(!/<script[^>]+src="https?:/i.test(html), 'No remote scripts (Tailwind CDN removed)');
        assert(!/<link[^>]+href="https?:/i.test(html), 'No remote stylesheets');
        assert(!/fonts\.googleapis/.test(read('css/style.css')), 'Fonts are self-hosted (no Google Fonts request)');
        assert(exists('css/tailwind.css') && read('css/tailwind.css').length > 5000, 'Precompiled Tailwind utilities are bundled');
        ['assets/fonts/cinzel-latin-var.woff2', 'assets/fonts/medievalsharp-latin.woff2', 'assets/fonts/OFL-Cinzel.txt', 'assets/fonts/OFL-MedievalSharp.txt'].forEach(f => assert(exists(f), `Bundled: ${f}`));
        const pkg = JSON.parse(read('package.json'));
        assert(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0, 'package.json declares no runtime dependencies');
        const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map(x => x[1]);
        assert(scripts.every(s => exists(s)), 'Every referenced game script exists');
        assert(scripts.indexOf('js/config.js') === 0 && scripts[scripts.length - 1] === 'js/game.js', 'Scripts load in dependency order');
        const ids = [...html.matchAll(/id="([^"]+)"/g)].map(x => x[1]);
        const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
        assert(dupes.length === 0, 'index.html has no duplicate element ids');
        const required = ['minimap-canvas', 'briefing-modal', 'save-modal', 'settings-modal', 'supporter-modal', 'consent-banner', 'objective-tracker', 'touch-joystick', 'speed-btn-0', 'speed-btn-5', 'respite-btn'];
        assert(required.every(id => ids.includes(id)), 'All v1.0 UI surfaces are present in index.html');
    });

    await section('25. Web Release Packaging', () => {
        const { readZip } = require('../scripts/zip.js');
        const build = require('../scripts/build_web_release.js');
        const out = fs.mkdtempSync(path.join(os.tmpdir(), 'citadel-dist-'));
        const realArgv = process.argv;
        const realLog = console.log;
        process.argv = ['node', 'build', '--out', out];
        console.log = () => {};
        let manifest;
        try { manifest = build.main(); } finally { process.argv = realArgv; console.log = realLog; }
        assert(manifest.bundles.length === 4, 'Builds web, CrazyGames, Poki and website bundles');
        const web = readZip(fs.readFileSync(path.join(out, 'citadel_of_legends_v1.0_web.zip')));
        const names = web.map(e => e.name);
        assert(names.includes('index.html') && !names.some(n => n.includes('/index.html') && n !== 'index.html'), 'index.html sits at the archive root (portal requirement)');
        assert(build.GAME_FILES.every(f => names.includes(f)), 'Web bundle contains every shipping file (CRC-verified)');
        assert(!names.some(n => n.startsWith('tests/') || n.startsWith('scripts/') || n.includes('node_modules')), 'No tests or tooling leak into the bundle');
        const swInZip = web.find(e => e.name === 'sw.js').data.toString();
        assert(swInZip.includes(`citadel-v${build.VERSION}`), 'Bundled service worker cache is versioned from package.json');
        const cg = readZip(fs.readFileSync(path.join(out, 'citadel_of_legends_v1.0_crazygames.zip')));
        const cgIndex = cg.find(e => e.name === 'index.html').data.toString();
        assert(cgIndex.includes('window.CITADEL_PORTAL = "crazygames"') && cgIndex.includes('CITADEL_DISABLE_SW'), 'CrazyGames bundle enables its SDK adapter and disables the SW');
        const site = readZip(fs.readFileSync(path.join(out, 'citadel_of_legends_v1.0_website.zip')));
        const siteIndex = site.find(e => e.name === 'index.html').data.toString();
        assert(siteIndex.includes('play/index.html') && !siteIndex.includes('../'), 'Website bundle rewrites links to /play');
        assert(site.some(e => e.name === 'play/js/game.js') && site.some(e => e.name === 'presskit.html'), 'Website bundle ships the game under /play plus the press kit');
        const sums = fs.readFileSync(path.join(out, 'SHA256SUMS.txt'), 'utf8');
        const crypto = require('crypto');
        const okSums = manifest.bundles.every(b => sums.includes(`${crypto.createHash('sha256').update(fs.readFileSync(path.join(out, b.file))).digest('hex')}  ${b.file}`));
        assert(okSums, 'SHA256SUMS.txt matches every bundle');
        const first = fs.readFileSync(path.join(out, 'citadel_of_legends_v1.0_web.zip'));
        console.log = () => {};
        process.argv = ['node', 'build', '--out', out];
        try { build.main(); } finally { process.argv = realArgv; console.log = realLog; }
        assert(Buffer.compare(first, fs.readFileSync(path.join(out, 'citadel_of_legends_v1.0_web.zip'))) === 0, 'Builds are byte-for-byte reproducible');
        fs.rmSync(out, { recursive: true, force: true });
    });

    await section('26. Desktop Edition (Electron)', () => {
        const sec = require('../desktop/security.js');
        const root = path.join(ROOT, 'desktop/app');
        assert(sec.resolveAppPath('app://citadel/index.html', root) === path.join(root, 'index.html'), 'app:// URLs map into the bundled game');
        assert(sec.resolveAppPath('app://citadel/', root) === path.join(root, 'index.html'), 'Root URL serves index.html');
        assert(sec.resolveAppPath('app://citadel/..%2F..%2Fetc%2Fpasswd', root) === null, 'Encoded path traversal is blocked');
        assert(sec.resolveAppPath('app://citadel/js/%00.js', root) === null, 'Null-byte paths are blocked');
        assert(sec.resolveAppPath('file:///etc/passwd', root) === null, 'Non-app schemes are rejected');
        assert(sec.isSafeExternalUrl('https://itch.io') && !sec.isSafeExternalUrl('javascript:alert(1)') && !sec.isSafeExternalUrl('file:///c:/x'), 'Only https/mailto links open externally');
        assert(sec.CSP.includes("default-src 'self'") && !sec.CSP.includes('unsafe-eval') && sec.CSP.includes("object-src 'none'"), 'Strict CSP: self-only, no eval, no plugins');
        const main = read('desktop/main.js');
        assert(/contextIsolation: true/.test(main) && /sandbox: true/.test(main) && /nodeIntegration: false/.test(main), 'Renderer is sandboxed with context isolation and no Node integration');
        assert(/setWindowOpenHandler/.test(main) && /will-navigate/.test(main) && /setPermissionRequestHandler/.test(main), 'Navigation, popups and permission requests are locked down');
        const dpkg = JSON.parse(read('desktop/package.json'));
        const pinned = Object.values(dpkg.devDependencies).every(v => /^\d+\.\d+\.\d+$/.test(v));
        assert(pinned, 'Desktop toolchain versions are pinned exactly');
        const targets = [dpkg.build.win, dpkg.build.mac, dpkg.build.linux].map(t => t.target.map(x => x.target).join(','));
        assert(/nsis/.test(targets[0]) && /dmg/.test(targets[1]) && /AppImage/.test(targets[2]), 'Builds Windows (.exe), macOS (.dmg) and Linux (.AppImage) targets');
        assert(/exposeInMainWorld\('CITADEL_PORTAL', 'desktop'\)/.test(read('desktop/preload.js')), 'Preload exposes only inert config flags');
    });

    await section('27. Legal & Compliance Suite', () => {
        const privacy = read('docs/PRIVACY.md');
        assert(/GDPR/.test(privacy) && /CCPA/.test(privacy) && /COPPA/.test(privacy), 'Privacy policy covers GDPR, CCPA and COPPA');
        const keys = ['citadel.save.', 'citadel.settings.v1', 'citadel.campaign.progress', 'citadel.consent.v1', 'citadel.supporter.v1'];
        assert(keys.every(k => privacy.includes(k)), 'Privacy policy discloses every localStorage key the game uses');
        const codeKeys = [SETTINGS_STORAGE_KEY, CAMPAIGN_PROGRESS_KEY, 'citadel.consent.v1', 'citadel.supporter.v1'];
        assert(codeKeys.every(k => read('js/settings.js').includes(k) || read('js/campaign.js').includes(k) || read('js/monetization.js').includes(k)), 'Disclosed keys match the keys used in code');
        assert(/do not sell or share/i.test(privacy) && /analytics/i.test(privacy), 'Privacy policy states no selling/sharing and no analytics');
        const terms = read('docs/TERMS.md');
        assert(/Acceptable use/i.test(terms) && /Limitation of liability/i.test(terms) && /Governing law/i.test(terms), 'Terms of Service cover use, liability and governing law');
        const eula = read('docs/EULA.md');
        assert(/License grant/i.test(eula) && /Content Creator Permission/.test(eula) && /Open Font License/.test(eula), 'EULA grants a licence, permits creators and credits OFL fonts');
        const html = read('index.html');
        assert(/id="consent-banner"/.test(html) && /docs\/PRIVACY\.md/.test(html) && /docs\/TERMS\.md/.test(html), 'In-game consent banner and legal links are present');
    });

    await section('28. Marketing Funnel & Press Kit', () => {
        const lp = read('marketing/index.html');
        assert(/Play Free in Browser/.test(lp) && /Download Desktop Edition/.test(lp), 'Landing page has primary and secondary CTAs');
        assert(/id="hero-canvas"/.test(lp), 'Hero has an animated canvas preview');
        assert(/id="faction-panel"/.test(lp) && /previewFaction/.test(lp) && /UNITS_DEF/.test(lp), 'Faction explorer with audio preview and live troop stats');
        assert(/id="signup"/.test(lp) && /signup-consent/.test(lp) && /data-endpoint/.test(lp), 'Community capture form with consent checkbox');
        assert(/Zero Dependencies/.test(lp) && /Web Audio API/.test(lp) && /HTML5 Canvas/.test(lp), 'Social proof / technology badges');
        assert(/application\/ld\+json/.test(lp) && /og:image/.test(lp), 'SEO: structured data and Open Graph tags');
        const refs = [...lp.matchAll(/(?:src|href)="((?:assets|\.\.)\/[^"#]+)"/g)].map(x => path.normalize(path.join('marketing', x[1])));
        const broken = refs.filter(r => !exists(r));
        assert(broken.length === 0, `Landing page has no broken local links${broken.length ? ': ' + broken.join(', ') : ''}`);
        const pk = read('marketing/presskit.html');
        ['Factsheet', 'Description', 'History', 'Features', 'Videos', 'Images', 'Logo', 'Contact'].forEach(s => assert(pk.includes(s), `Press kit section: ${s}`));
        const words = (id) => pk.match(new RegExp(`id="${id}">([\\s\\S]*?)</p>`))[1].trim().split(/\s+/).length;
        assert(Math.abs(words('pitch-40') - 40) <= 5 && Math.abs(words('pitch-100') - 100) <= 5, `Elevator pitches are ~40 and ~100 words (${words('pitch-40')}/${words('pitch-100')})`);
        const pkRefs = [...pk.matchAll(/(?:src|href)="((?:assets|\.\.)\/[^"#]+)"/g)].map(x => path.normalize(path.join('marketing', x[1])));
        assert(pkRefs.filter(r => !exists(r)).length === 0, 'Press kit has no broken asset links');
        const shots = fs.readdirSync(path.join(ROOT, 'marketing/assets/screenshots')).filter(f => f.endsWith('.png'));
        assert(shots.length >= 4 && shots.every(f => { const d = pngSize(`marketing/assets/screenshots/${f}`); return d && d.w === 1920 && d.h === 1080; }), 'At least 4 full-HD in-engine screenshots');
        const og = pngSize('marketing/assets/og-image.png');
        assert(og && og.w === 1200 && og.h === 630, 'Open Graph card is 1200x630');
        assert(fs.readFileSync(path.join(ROOT, 'marketing/assets/gameplay.gif')).toString('ascii', 0, 6).startsWith('GIF8'), 'Gameplay GIF capture exists');
        ['logo.svg', 'logo.png', 'crest-solaris.svg', 'crest-frost.svg', 'crest-obsidian.svg'].forEach(f => assert(exists(`marketing/assets/${f}`), `Brand asset: ${f}`));
    });

    await section('29. Go-To-Market & Launch Operations', () => {
        const gtm = read('docs/GTM_STRATEGY.md');
        assert(/T-14/.test(gtm) && /Launch Day/.test(gtm) && /Show HN/.test(gtm), 'GTM covers soft launch, launch day and Show HN phases');
        ['r/WebGames', 'r/IndieGaming', 'r/StrategyGames'].forEach(s => assert(gtm.includes(s), `GTM targets ${s}`));
        const templates = (gtm.match(/^### Template \d+/gm) || []).length;
        assert(templates === 10, `GTM includes exactly 10 promotional copy templates (${templates})`);
        assert(/KPI/i.test(gtm), 'GTM defines KPIs');
        const checklist = read('docs/LAUNCH_CHECKLIST.md');
        assert(/\[STUDIO LEGAL NAME\]/.test(checklist) && /supporter/i.test(checklist) && /data-endpoint/.test(checklist), 'Launch checklist lists every placeholder the owner must fill');
        assert(exists('scripts/generate_supporter_codes.js'), 'Supporter code generator exists');
        const { generateCodes } = require('../scripts/generate_supporter_codes.js');
        const codes = generateCodes(3);
        const crypto = require('crypto');
        assert(codes.length === 3 && codes.every(c => /^AVALON-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c.code) && c.sha256 === crypto.createHash('sha256').update(c.code).digest('hex')), 'Generated supporter codes are well-formed and hash-verifiable');
        assert(exists('.github/workflows/ci.yml') && /node tests\/test_runner\.js/.test(read('.github/workflows/ci.yml')), 'CI runs the verification suite on every push');
        assert(exists('CHANGELOG.md') && /1\.0\.0/.test(read('CHANGELOG.md')), 'CHANGELOG documents the 1.0.0 release');
    });

    await section('30. Portal SDK Contract Tests (fake SDKs, documented interfaces)', async () => {
        const loaded = [];
        const realLoad = PortalLoader.load;
        PortalLoader.load = async (src) => { loaded.push(src); };
        const events = [];
        try {
            // CrazyGames SDK v3: window.CrazyGames.SDK.{init, game.gameplayStart/Stop, ad.requestAd(type, callbacks)}
            window.CrazyGames = { SDK: {
                init: async () => events.push('cg:init'),
                game: { gameplayStart: () => events.push('cg:start'), gameplayStop: () => events.push('cg:stop') },
                ad: { requestAd: (type, cb) => { events.push(`cg:ad:${type}`); cb.adStarted(); type === 'rewarded' ? cb.adFinished() : cb.adError('no fill'); } }
            } };
            const cg = createAdapter('crazygames');
            assert(await cg.init() === true && loaded[0] === PORTAL_SDK_URLS.crazygames && events.includes('cg:init'), 'CrazyGames: SDK script loaded from the official URL and initialised');
            cg.gameplayStart(); cg.gameplayStop();
            assert(events.includes('cg:start') && events.includes('cg:stop'), 'CrazyGames: gameplay start/stop signalled');
            assert(await cg.rewarded() === true && events.includes('cg:ad:rewarded'), 'CrazyGames: completed rewarded ad resolves true');
            await cg.interstitial();
            assert(events.includes('cg:ad:midgame') && Monetization.adPlaying === false, 'CrazyGames: midgame ad errors never leave the game paused');

            // Poki SDK v2: PokiSDK.{init, gameLoadingFinished, gameplayStart/Stop, commercialBreak, rewardedBreak}
            window.PokiSDK = {
                init: async () => events.push('poki:init'),
                gameLoadingFinished: () => events.push('poki:loaded'),
                gameplayStart: () => events.push('poki:start'),
                gameplayStop: () => events.push('poki:stop'),
                commercialBreak: async () => events.push('poki:break'),
                rewardedBreak: async () => { events.push('poki:reward'); return false; }
            };
            const poki = createAdapter('poki');
            assert(await poki.init() === true && events.includes('poki:loaded'), 'Poki: init + gameLoadingFinished called');
            await poki.interstitial();
            assert(events.includes('poki:break') && !Monetization.adPlaying, 'Poki: commercialBreak runs and play resumes');
            assert(await poki.rewarded() === false && events.includes('poki:reward'), 'Poki: skipped rewardedBreak grants nothing');
            window.PokiSDK.commercialBreak = async () => { throw new Error('adblock'); };
            try { await poki.interstitial(); } catch (e) { /* expected: rejection propagates after cleanup */ }
            assert(Monetization.adPlaying === false, 'Poki: SDK exceptions still restore audio and simulation');

            // GameDistribution: window.GD_OPTIONS {gameId,onEvent}, gdsdk.showAd(type)
            BUSINESS_CONFIG.gameDistributionId = 'test-game-id';
            const gd = createAdapter('gamedistribution');
            window.gdsdk = { showAd: async (type) => { if (type === 'rewarded') window.GD_OPTIONS.onEvent({ name: 'SDK_REWARDED_WATCH_COMPLETE' }); } };
            assert(await gd.init() === true && window.GD_OPTIONS.gameId === 'test-game-id', 'GameDistribution: GD_OPTIONS configured before SDK load');
            assert(await gd.rewarded() === true, 'GameDistribution: SDK_REWARDED_WATCH_COMPLETE grants the reward');
            assert(await createAdapter('gamedistribution').init.call({ gameId: '' }) === false, 'GameDistribution: missing game id disables ads instead of crashing');
            BUSINESS_CONFIG.gameDistributionId = '';

            // Failure to load an SDK (ad blocker) must degrade to no-ads, never block play.
            PortalLoader.load = async () => { throw new Error('blocked'); };
            const g = freshGame();
            await Monetization.init(g, { portal: 'poki', storage: new MemoryStorage() });
            assert(Monetization.adapter.hasAds === false && Monetization.ready === false, 'Blocked SDK script falls back to the no-ads adapter');
        } finally {
            PortalLoader.load = realLoad;
            delete window.CrazyGames; delete window.PokiSDK; delete window.gdsdk; delete window.GD_OPTIONS;
            Monetization.adapter = new NoAdsAdapter();
        }
    });

    await section('31. Legal Compliance Audit (claims vs. code)', () => {
        const jsFiles = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'));
        const src = Object.fromEntries(jsFiles.map(f => [f, read(`js/${f}`)]));
        const netApis = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket|EventSource\s*\(|document\.cookie/;
        const offenders = jsFiles.filter(f => netApis.test(src[f]));
        assert(offenders.length === 0, `Privacy claim "no analytics/tracking": no network or cookie APIs in game code${offenders.length ? ' (found in ' + offenders.join(', ') + ')' : ''}`);
        const remoteUrls = jsFiles.flatMap(f => (src[f].match(/https?:\/\/[^'"\s)]+/g) || []).map(u => [f, u]))
            .filter(([f, u]) => !(f === 'monetization.js'));
        assert(remoteUrls.length === 0, 'Only the portal adapter references remote URLs');
        const sdkHosts = Object.values(PORTAL_SDK_URLS).map(u => new URL(u).hostname);
        assert(sdkHosts.every(h => /(crazygames|poki|gamedistribution)\.com$/.test(h)), 'Third-party scripts are limited to the disclosed ad portals');
        const usedKeys = new Set();
        for (const f of jsFiles) for (const m of src[f].matchAll(/['"`](citadel\.[a-z0-9.]*)['"`]/gi)) usedKeys.add(m[1]);
        const privacy = read('docs/PRIVACY.md');
        const undisclosed = [...usedKeys].filter(k => !privacy.includes(k.replace(/\.$/, '')));
        assert(usedKeys.size >= 5 && undisclosed.length === 0, `Every storage key used in code is disclosed in the Privacy Policy${undisclosed.length ? ': missing ' + undisclosed.join(', ') : ''}`);
        assert(!/\bgoogleapis|google-analytics|gtag\(|facebook\.net|doubleclick/.test(Object.values(src).join('\n') + read('index.html')), 'No analytics or ad-tracking tags in the game shell');
        assert(/serviceWorker/.test(privacy) || /service worker/i.test(privacy), 'Privacy Policy discloses the offline service worker cache');
        assert(read('js/save_system.js').includes('MAX_IMPORT_BYTES') && /untrusted input/.test(privacy), 'Security claim (validated imports) matches implementation');

        const legal = ['docs/PRIVACY.md', 'docs/TERMS.md', 'docs/EULA.md'];
        const brokenLinks = [];
        for (const f of legal) {
            for (const m of read(f).matchAll(/\]\(([^)#\s]+)\)/g)) {
                if (/^https?:/.test(m[1])) continue;
                if (!exists(path.join(path.dirname(f), m[1]))) brokenLinks.push(`${f} -> ${m[1]}`);
            }
        }
        assert(brokenLinks.length === 0, `Cross-references between legal documents resolve${brokenLinks.length ? ': ' + brokenLinks.join(', ') : ''}`);
        const checklist = read('docs/LAUNCH_CHECKLIST.md');
        const scanned = [...legal, 'marketing/index.html', 'marketing/presskit.html', 'desktop/package.json'];
        const placeholders = new Set();
        for (const f of scanned) for (const m of read(f).matchAll(/\[([A-Z][A-Z ,/&-]{3,})\]/g)) placeholders.add(m[1]);
        assert(placeholders.size >= 8, `Placeholder scan is effective (${placeholders.size} distinct placeholders found)`);
        const untracked = [...placeholders].filter(p => !checklist.includes(`[${p}]`));
        assert(untracked.length === 0, `Every legal/marketing placeholder is tracked in the launch checklist${untracked.length ? ': ' + untracked.join(', ') : ''}`);
        for (const f of legal) assert(/Effective date:\*\* 11 November 2026/.test(read(f)) && /Version:\*\* 1\.0/.test(read(f)), `${f} carries an effective date and version`);
        assert(/16 or older/.test(read('marketing/index.html')) && /16 or older/.test(privacy), 'Newsletter age gate matches the Privacy Policy (16+)');
        const eula = read('docs/EULA.md');
        assert(/monetised content/i.test(eula) && /monetization/i.test(read('docs/GTM_STRATEGY.md')) && /EULA §4/.test(read('docs/GTM_STRATEGY.md')), 'Creator outreach promises match the EULA Content Creator Permission');
    });

    console.log('\n===========================================');
    console.log(`TEST SUITE RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('===========================================\n');
    if (failures.length) {
        console.log('Failures:');
        failures.forEach(f => console.log('  - ' + f));
    }
    process.exit(failedTests > 0 ? 1 : 0);
}

runTests();
