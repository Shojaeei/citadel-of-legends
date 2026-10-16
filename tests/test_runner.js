// Automated Test Suite for Citadel of Legends (Phase 1, Phase 2, Phase 3)
const fs = require('fs');
const path = require('path');

// Setup minimal Node globals for testing browser modules
global.window = {
    addEventListener: () => {},
    innerWidth: 1920,
    innerHeight: 1080
};

const mockElements = {};
function getOrCreateMockElement(id) {
    if (!mockElements[id]) {
        mockElements[id] = {
            id,
            innerText: '',
            innerHTML: '',
            className: '',
            classList: {
                classes: new Set(),
                add(c) { this.classes.add(c); },
                remove(c) { this.classes.delete(c); },
                toggle(c, force) {
                    if (force !== undefined) {
                        if (force) this.classes.add(c); else this.classes.delete(c);
                    } else {
                        if (this.classes.has(c)) this.classes.delete(c); else this.classes.add(c);
                    }
                },
                contains(c) { return this.classes.has(c); }
            },
            appendChild: (child) => child,
            addEventListener: () => {},
            value: ''
        };
    }
    return mockElements[id];
}

global.document = {
    getElementById: (id) => getOrCreateMockElement(id),
    createElement: (tag) => ({
        tag,
        className: '',
        innerHTML: '',
        classList: { add: () => {}, remove: () => {}, toggle: () => {} },
        appendChild: () => {}
    }),
    addEventListener: () => {}
};

// Load Modules
require('../js/config.js');
require('../js/audio.js');
require('../js/economy.js');
require('../js/pathfinding.js');
require('../js/entities.js');
require('../js/game.js');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
    if (condition) {
        passedTests++;
        console.log(`  \x1b[32m✔ PASS:\x1b[0m ${message}`);
    } else {
        failedTests++;
        console.error(`  \x1b[31m✖ FAIL:\x1b[0m ${message}`);
    }
}

function runTests() {
    console.log('\n--- Running Citadel of Legends Verification Suite ---\n');

    // 1. Config & Faction Asymmetry Tests
    console.log('[1. Configuration & Faction Asymmetry]');
    assert(BUILDINGS_DEF.cathedral !== undefined, 'Solaris Cathedral building defined');
    assert(BUILDINGS_DEF.runestone !== undefined, 'Frost Runestone building defined');
    assert(BUILDINGS_DEF.crucible !== undefined, 'Obsidian Crucible building defined');
    assert(UNITS_DEF.paladin !== undefined, 'Solaris Paladin champion defined');
    assert(UNITS_DEF.valkyrie !== undefined, 'Frost Valkyrie champion defined');
    assert(UNITS_DEF.vampire !== undefined, 'Obsidian Vampire champion defined');
    assert(CAMPAIGN_MISSIONS.solaris.length === 3, 'Solaris campaign has 3 complete missions');
    assert(CAMPAIGN_MISSIONS.frost.length === 3, 'Frost campaign has 3 complete missions');
    assert(CAMPAIGN_MISSIONS.obsidian.length === 3, 'Obsidian campaign has 3 complete missions');

    // 2. Economy & Food Consumption Tests
    console.log('\n[2. Economy & Popularity Simulation]');
    const mockGameInstance = {
        buildings: [],
        updateUI: () => {},
        spawnPeasantAtKeep: () => {},
        removePeasant: () => {},
        showToast: () => {}
    };
    const econ = new EconomySystem(mockGameInstance);
    econ.reset('solaris');
    assert(econ.res.gold === 250, 'Starting gold matches config');
    assert(econ.res.wood === 180, 'Starting wood matches config');
    assert(econ.canAfford({ wood: 50, stone: 30 }) === true, 'canAfford correctly verifies available resources');
    assert(econ.canAfford({ gold: 1000 }) === false, 'canAfford correctly rejects insufficient gold');

    econ.deductCost({ wood: 50, stone: 30 });
    assert(econ.res.wood === 130, 'Deducts wood correctly');
    assert(econ.res.stone === 90, 'Deducts stone correctly');

    // Food Consumption
    econ.res.food = 10;
    econ.pop.current = 10;
    econ.rations = 2; // Normal rations
    econ.update(2.0); // 2 second tick
    assert(econ.res.food < 10, 'Food consumed by population over time');

    // 3. Pathfinding (A*) Tests
    console.log('\n[3. A* Pathfinding]');
    const grid = [];
    const size = 20;
    for (let x = 0; x < size; x++) {
        grid[x] = [];
        for (let y = 0; y < size; y++) {
            grid[x][y] = { type: 'grass', occupied: false, buildingId: null };
        }
    }
    // Add obstacle line with a single gap (gate/bridge)
    for (let y = 0; y < size; y++) {
        if (y !== 10) {
            grid[10][y].type = 'water';
        }
    }

    const mockPfGame = {
        gridSize: size,
        map: grid,
        buildings: []
    };
    const pf = new PathfindingEngine(mockPfGame);
    const path = pf.findPath(5, 10, 15, 10, false, false);
    assert(path.length > 0, 'A* navigates across map');
    assert(path.some(p => Math.floor(p.x) === 10 && Math.floor(p.y) === 10), 'A* routes through gap/gateway');

    // 4. Combat, Faction Passives & AoE Splash Tests
    console.log('\n[4. Combat Mechanics & Special Faction Abilities]');
    
    // Paladin Holy Aura
    const paladin = new Unit('paladin', 10, 10, false, 'solaris');
    const woundedAlly = new Unit('knight', 11, 10, false, 'solaris');
    woundedAlly.hp = 100;
    const mockGame = {
        units: [paladin, woundedAlly],
        buildings: [],
        spawnFloatingText: () => {}
    };
    paladin.healCooldown = 0;
    paladin.update(1.0, mockGame);
    assert(woundedAlly.hp > 100, `Paladin Holy Aura heals nearby wounded allies (HP: ${woundedAlly.hp})`);

    // Vampire Lifesteal
    const vampire = new Unit('vampire', 20, 20, false, 'obsidian');
    vampire.hp = 100;
    const victim = new Unit('halberdier', 20.5, 20, true, 'solaris');
    vampire.performAttack(victim, mockGame);
    assert(vampire.hp > 100, `Vampire lifesteal restores health upon dealing melee damage (HP: ${vampire.hp})`);

    // Catapult AoE Splash Damage
    const catapultTarget = new Unit('halberdier', 30, 30, true, 'frost');
    const splashVictim = new Unit('halberdier', 30.5, 30.5, true, 'frost');
    catapultTarget.hp = 250;
    splashVictim.hp = 250;
    mockGame.units = [catapultTarget, splashVictim];
    
    const proj = new Projectile('boulder', 25, 25, catapultTarget, 80);
    // Simulate flight completion
    proj.progress = 1.0;
    const impactResult = proj.update(0.1, mockGame);
    assert(impactResult === true, 'Projectile terminates on landing');
    assert(catapultTarget.hp < 250, `Primary target takes direct catapult damage (HP: ${catapultTarget.hp})`);
    assert(splashVictim.hp < 250, `Adjacent unit takes AoE splash damage (HP: ${splashVictim.hp})`);

    // 5. Structure Damage & Repair System
    console.log('\n[5. Structure Integrity & Repair System]');
    const building = new Building('wall', 5, 5, false, 'solaris');
    building.hp = 200;
    assert(building.hp < building.maxHp, 'Building damaged state recognized');
    building.repair(300);
    assert(building.hp === 500, `Building repaired to max HP (HP: ${building.hp})`);

    // 6. Tactical Army Selection & Boiling Pitch Defense in GameApp
    console.log('\n[6. Tactical Abilities in CitadelGame]');
    const game = new CitadelGame();
    game.faction = 'solaris';
    game.initGameWorld('valley');

    // Spawn military units and workers
    const peasant = new Unit('peasant', 18, 28, false, 'solaris');
    const knight1 = new Unit('knight', 19, 28, false, 'solaris');
    const archer1 = new Unit('archer', 20, 28, false, 'solaris');
    game.units = [peasant, knight1, archer1];

    game.selectAllMilitary();
    assert(game.selectedUnits.length === 2, `Army selection filters workers and selects all ${game.selectedUnits.length} military units`);
    assert(!game.selectedUnits.includes(peasant), 'Army selection excludes non-military peasants');

    // Boiling Pitch Defense
    game.economy.res.pitch = 10;
    const enemyNearWall = new Unit('halberdier', 18.5, 28.5, true, 'obsidian'); // Near Keep
    enemyNearWall.hp = 250;
    const enemyFar = new Unit('halberdier', 50, 50, true, 'obsidian'); // Far away
    enemyFar.hp = 250;
    game.units.push(enemyNearWall, enemyFar);

    game.triggerBoilingPitch();
    assert(game.economy.res.pitch === 5, 'Boiling Pitch deducts 5 pitch from stockpile');
    assert(enemyNearWall.hp === 175, `Near invader takes 75 fire damage from boiling pitch (HP: ${enemyNearWall.hp})`);
    assert(enemyFar.hp === 250, 'Distant enemy is outside defensive pitch radius');

    // Campaign Progression
    game.faction = 'solaris';
    game.currentMissionData = CAMPAIGN_MISSIONS.solaris[0];
    game.advanceNextMission();
    assert(game.currentMissionData.id === 2, `Advance campaign moves to Mission 2 (${game.currentMissionData.title})`);

    // Results summary
    console.log(`\n===========================================`);
    console.log(`TEST SUITE RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log(`===========================================\n`);

    if (failedTests > 0) {
        process.exit(1);
    }
}

runTests();
