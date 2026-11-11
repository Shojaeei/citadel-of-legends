/* ==========================================================================
   Citadel of Legends: Shattered Realms - Configuration & Game Data
   ========================================================================== */

const GAME_VERSION = '1.0.0';

const GAME_CONFIG = {
    gridSize: 64,
    tileWidth: 64,
    tileHeight: 32,
    startingResources: {
        wood: 180,
        stone: 120,
        iron: 60,
        pitch: 25,
        gold: 250,
        honor: 15,
        food: 80
    },
    startingPopulation: {
        current: 6,
        max: 15
    },
    startingPopularity: 80
};

const BUILDINGS_DEF = {
    keep: {
        id: 'keep',
        name: 'Royal Citadel Keep',
        desc: 'The heart and seat of power of your castle. Peasants gather here and taxes are stored.',
        category: 'building',
        w: 3, h: 3,
        hp: 2500,
        cost: { gold: 0, wood: 0, stone: 0, iron: 0, pitch: 0, honor: 0 },
        workers: 0,
        color: '#b45309'
    },
    hovel: {
        id: 'hovel',
        name: 'Peasant Hovel',
        desc: 'Modest dwelling that expands castle population capacity by +5 peasants.',
        category: 'building',
        w: 1, h: 1,
        hp: 250,
        cost: { wood: 20 },
        housing: 5,
        workers: 0,
        color: '#854d0e'
    },
    stockpile: {
        id: 'stockpile',
        name: 'Resource Stockpile',
        desc: 'Storage ground for timber, basalt blocks, mythril ore, and pitch tar barrels.',
        category: 'building',
        w: 2, h: 2,
        hp: 600,
        cost: { wood: 25 },
        workers: 0,
        color: '#a16207'
    },
    granary: {
        id: 'granary',
        name: 'Castle Granary',
        desc: 'Secures and distributes bread, meat, and grain to the castle population.',
        category: 'building',
        w: 2, h: 2,
        hp: 500,
        cost: { wood: 25 },
        workers: 0,
        color: '#ca8a04'
    },
    sawyer: {
        id: 'sawyer',
        name: 'Ironwood Sawyer',
        desc: 'Lumber mill where workers fell and process ironwood timber (+6 Wood/tick).',
        category: 'building',
        w: 1, h: 1,
        hp: 300,
        cost: { wood: 15 },
        producer: 'wood',
        rate: 6,
        workers: 1,
        color: '#713f12'
    },
    quarry: {
        id: 'quarry',
        name: 'Basalt Quarry',
        desc: 'Deep rock excavation pit producing sturdy basalt stone blocks (+5 Stone/tick).',
        category: 'building',
        w: 2, h: 2,
        hp: 450,
        cost: { wood: 30 },
        producer: 'stone',
        rate: 5,
        workers: 2,
        color: '#57534e'
    },
    mine: {
        id: 'mine',
        name: 'Mythril Mine',
        desc: 'Underground shaft extracting precious mythril ore for weapons and armor (+3 Iron/tick).',
        category: 'building',
        w: 2, h: 2,
        hp: 500,
        cost: { wood: 40, stone: 15 },
        producer: 'iron',
        rate: 3,
        workers: 2,
        color: '#0891b2'
    },
    tar: {
        id: 'tar',
        name: 'Brimstone Tar Rig',
        desc: 'Extracts volatile subterranean pitch used for boiling tar defenses and catapult ammunition (+3 Pitch/tick).',
        category: 'building',
        w: 1, h: 1,
        hp: 300,
        cost: { wood: 25, stone: 5 },
        producer: 'pitch',
        rate: 3,
        workers: 1,
        color: '#c2410c'
    },
    hunter: {
        id: 'hunter',
        name: "Hunter's Lodge",
        desc: 'Rangers stalk wild game across the valleys to supply the granary with venison (+5 Food/tick).',
        category: 'building',
        w: 1, h: 1,
        hp: 280,
        cost: { wood: 20 },
        producer: 'food',
        rate: 5,
        workers: 1,
        color: '#15803d'
    },
    bakery: {
        id: 'bakery',
        name: 'Crown Bakery',
        desc: 'Bakes hearty golden loaves, providing high-efficiency food output (+8 Food/tick).',
        category: 'building',
        w: 1, h: 1,
        hp: 350,
        cost: { wood: 30, stone: 10 },
        producer: 'food',
        rate: 8,
        workers: 2,
        color: '#eab308'
    },
    barracks: {
        id: 'barracks',
        name: 'Garrison Barracks',
        desc: 'Trains and equips infantry, halberdiers, and stalwart knights.',
        category: 'military',
        w: 2, h: 2,
        hp: 1000,
        cost: { wood: 50, stone: 30 },
        workers: 0,
        color: '#475569'
    },
    archery: {
        id: 'archery',
        name: 'Archery Range',
        desc: 'Trains runebow fletchers and sharpshooter archers.',
        category: 'military',
        w: 2, h: 2,
        hp: 800,
        cost: { wood: 45, stone: 15 },
        workers: 0,
        color: '#0d9488'
    },
    siege: {
        id: 'siege',
        name: 'Siege Workshop',
        desc: 'Engineers construct destructive catapults and heavy ballistas.',
        category: 'military',
        w: 2, h: 2,
        hp: 1100,
        cost: { wood: 65, stone: 40, iron: 20 },
        workers: 0,
        color: '#b91c1c'
    },
    wall: {
        id: 'wall',
        name: 'Basalt Wall',
        desc: 'Solid stone defensive wall. Impassable to enemy ground troops.',
        category: 'defenses',
        w: 1, h: 1,
        hp: 600,
        cost: { stone: 4 },
        workers: 0,
        isWall: true,
        color: '#78716c'
    },
    tower: {
        id: 'tower',
        name: 'Fortified Watchtower',
        desc: 'Defensive bastion granting elevated vantage and firing range.',
        category: 'defenses',
        w: 1, h: 1,
        hp: 1400,
        cost: { stone: 30, iron: 5 },
        workers: 0,
        isTower: true,
        color: '#52525b'
    },
    gatehouse: {
        id: 'gatehouse',
        name: 'Castle Gatehouse',
        desc: 'Heavy reinforced portcullis allowing friendly passage while repelling sieges.',
        category: 'defenses',
        w: 2, h: 1,
        hp: 1800,
        cost: { wood: 25, stone: 50 },
        workers: 0,
        isGate: true,
        color: '#44403c'
    },
    dragonRoost: {
        id: 'dragonRoost',
        name: 'Dragon Roost Dais',
        desc: 'Ancient arcane aerie dedicated to summoning and housing your faction dragon.',
        category: 'mythic',
        w: 2, h: 2,
        hp: 2200,
        cost: { wood: 100, stone: 120, iron: 40, honor: 35 },
        workers: 0,
        mythic: true,
        color: '#7e22ce'
    },
    cathedral: {
        id: 'cathedral',
        name: 'Cathedral of Avalon',
        desc: 'Sacred Arthurian sanctuary. Generates Arcane Honor (+2/s) and radiates an aura healing nearby wounded troops.',
        category: 'mythic',
        w: 2, h: 2,
        hp: 1600,
        cost: { wood: 75, stone: 100, gold: 80, honor: 15 },
        workers: 0,
        isCathedral: true,
        color: '#facc15'
    },
    runestone: {
        id: 'runestone',
        name: 'Frostbound Runestone',
        desc: 'Ancient glacial monolith carved with elder runes. Generates Arcane Honor (+2/s) and empowers nearby allies.',
        category: 'mythic',
        w: 2, h: 2,
        hp: 1700,
        cost: { stone: 120, iron: 30, gold: 60, honor: 15 },
        workers: 0,
        isRunestone: true,
        color: '#0284c7'
    },
    crucible: {
        id: 'crucible',
        name: 'Blood Crucible Spire',
        desc: 'Unholy gothic spire that transmutes darkness into boiling tar (+4 Pitch/s) and generates Arcane Honor (+2/s).',
        category: 'mythic',
        w: 2, h: 2,
        hp: 1500,
        cost: { wood: 60, stone: 90, pitch: 20, gold: 70, honor: 15 },
        workers: 0,
        isCrucible: true,
        color: '#991b1b'
    },
    cauldron: {
        id: 'cauldron',
        name: 'Boiling Pitch Cauldron',
        desc: 'Iron cauldron of seething brimstone. Automatically scalds invaders within 2.5 tiles (consumes 1 Pitch per pour).',
        category: 'defenses',
        w: 1, h: 1,
        hp: 700,
        cost: { stone: 20, iron: 10, pitch: 10 },
        workers: 0,
        isCauldron: true,
        color: '#9a3412'
    }
};

/** Vision radii (tiles) used by the Fog of War system. */
const VISION_DEF = {
    keep: 12,
    tower: 10,
    building: 4,
    unit: 5,
    flying: 7
};

const UNITS_DEF = {
    peasant: {
        id: 'peasant',
        name: 'Castle Peasant',
        desc: 'Humble worker, tax contributor, and castle builder.',
        cost: { gold: 8 },
        hp: 60,
        atk: 6,
        range: 1.1,
        speed: 1.2,
        isWorker: true,
        color: '#94a3b8'
    },
    archer: {
        id: 'archer',
        requires: 'archery',
        name: 'Runebow Archer',
        desc: 'Skilled ranged soldier deadly from castle battlements and towers.',
        cost: { gold: 20, wood: 15 },
        hp: 90,
        atk: 18,
        range: 6.5,
        speed: 1.05,
        projectile: 'arrow',
        color: '#34d399'
    },
    halberdier: {
        id: 'halberdier',
        requires: 'barracks',
        name: 'Iron Halberdier',
        desc: 'Disciplined infantry armed with armor-piercing polearms. High health.',
        cost: { gold: 28, iron: 12 },
        hp: 180,
        atk: 28,
        range: 1.2,
        speed: 0.95,
        color: '#38bdf8'
    },
    knight: {
        id: 'knight',
        requires: 'barracks',
        name: 'Sun-Blade Knight',
        desc: 'Noble armored champion. Swift and deadly in close quarters.',
        cost: { gold: 55, iron: 25 },
        hp: 300,
        atk: 48,
        range: 1.2,
        speed: 1.2,
        color: '#fbbf24'
    },
    giant: {
        id: 'giant',
        name: 'Frost Giant',
        desc: 'Colossal mountain brute whose ground-slam pulverizes infantry and gates.',
        cost: { gold: 75, iron: 35, stone: 15 },
        hp: 650,
        atk: 75,
        range: 1.6,
        speed: 0.7,
        color: '#bae6fd'
    },
    werewolf: {
        id: 'werewolf',
        name: 'Night-Stalker Werewolf',
        desc: 'Ferocious beast that leaps across obstacles at blistering speed.',
        cost: { gold: 60, pitch: 15 },
        hp: 240,
        atk: 60,
        range: 1.2,
        speed: 1.65,
        color: '#f87171'
    },
    catapult: {
        id: 'catapult',
        requires: 'siege',
        name: 'Siege Catapult',
        desc: 'Heavy timber war engine designed to batter down walls and fortresses from far away.',
        cost: { gold: 90, wood: 50, stone: 15 },
        hp: 350,
        atk: 110,
        range: 9.0,
        speed: 0.55,
        isSiege: true,
        projectile: 'boulder',
        color: '#ea580c'
    },
    paladin: {
        id: 'paladin',
        requires: 'cathedral',
        name: 'Avalon Paladin',
        desc: 'Holy champion clad in blessed steel. Radiates an aura that heals nearby wounded allies.',
        cost: { gold: 65, iron: 25, honor: 15 },
        hp: 360,
        atk: 52,
        range: 1.3,
        speed: 1.1,
        isHealer: true,
        color: '#fde047'
    },
    valkyrie: {
        id: 'valkyrie',
        requires: 'runestone',
        name: 'Frost Valkyrie',
        desc: 'Winged shieldmaiden soaring across obstacles with armor-piercing glacial spears.',
        cost: { gold: 60, iron: 20, honor: 15 },
        hp: 280,
        atk: 55,
        range: 2.2,
        speed: 1.5,
        isFlying: true,
        color: '#7dd3fc'
    },
    vampire: {
        id: 'vampire',
        requires: 'crucible',
        name: 'Vampire Bloodknight',
        desc: 'Undead noble of the night. Siphons health from slain adversaries to heal himself in combat.',
        cost: { gold: 70, pitch: 20, honor: 15 },
        hp: 320,
        atk: 58,
        range: 1.3,
        speed: 1.35,
        isLifesteal: true,
        isStealthy: true,
        color: '#dc2626'
    },
    warlord: {
        id: 'warlord',
        name: 'Enemy Warlord',
        desc: 'Commander of the rival host. Slaying the Warlord breaks the enemy chain of command.',
        cost: { gold: 0 },
        hp: 1600,
        atk: 70,
        range: 1.5,
        speed: 0.8,
        isGeneral: true,
        color: '#f43f5e'
    },
    dragon: {
        id: 'dragon',
        requires: 'dragonRoost',
        name: 'Faction Dragon',
        desc: 'Apex mythical terror. Flies over terrain and showers foes with destructive breath.',
        cost: { gold: 250, honor: 60 },
        hp: 1400,
        atk: 140,
        range: 5.5,
        speed: 1.9,
        isFlying: true,
        projectile: 'dragonBreath',
        color: '#ef4444'
    }
};

const FACTIONS_DEF = {
    solaris: {
        name: 'Solaris Order',
        ruler: 'King Arthur',
        biome: 'valley',
        primaryColor: '#f59e0b',
        bannerIcon: '☀️',
        description: 'Chivalric realm of light. Boasts disciplined Sun-Blade Knights, Avalon Paladins, prolific bakeries, Cathedral of Avalon, and the Solaris Dragon.',
        bonuses: {
            taxIncomeMultiplier: 1.2,
            foodRateMultiplier: 1.15,
            specialUnit: 'paladin',
            specialBuilding: 'cathedral'
        }
    },
    frost: {
        name: 'Frostbound Covenant',
        ruler: 'Siegfried the Dragon-Slayer',
        biome: 'tundra',
        primaryColor: '#38bdf8',
        bannerIcon: '❄️',
        description: 'Hardened clan of northern peaks. Masters of stonecraft, hunter traditions, Frost Valkyries, Frost Giants, Runestone Dais, and Ice Wyverns.',
        bonuses: {
            stoneRateMultiplier: 1.3,
            mineRateMultiplier: 1.2,
            specialUnit: 'valkyrie',
            specialBuilding: 'runestone'
        }
    },
    obsidian: {
        name: 'Obsidian Scourge',
        ruler: 'Count Vlad Dracula',
        biome: 'wasteland',
        primaryColor: '#ef4444',
        bannerIcon: '🦇',
        description: 'Ruthless dread lords of brimstone and blood. Commands terrifying Vampire Bloodknights, Werewolves, Blood Crucible Spires, and the Abyss Dragon.',
        bonuses: {
            tarRateMultiplier: 1.4,
            unitSpeedMultiplier: 1.15,
            specialUnit: 'vampire',
            specialBuilding: 'crucible'
        }
    }
};

/* --------------------------------------------------------------------------
   Narrative Campaign (v1.0): 3 factions x 3 missions.
   Objective types are evaluated by CampaignDirector (js/campaign.js):
     buildings      - own at least one of each listed building type
     buildingCount  - own >= target of one building type
     population     - population >= target
     resource       - stockpile res >= target
     produced       - cumulative production of res >= target this mission
     trained        - cumulative recruits of unit type >= target
     wavesSurvived  - fully repelled siege waves >= target
     destroyEnemyKeep / destroyBuildingType / killGeneral
   Bonus types: noStarvation, structuresStanding, generalSlainBy, noBuild,
     regionKills, timeLimit, minTax, lifesteal, destroyAllTagged
   -------------------------------------------------------------------------- */
const CAMPAIGN_MISSIONS = {
    solaris: [
        {
            id: 1,
            title: 'The Gathering Storm',
            objective: 'Establish the settlement, grow to 150 population and hoard 800 food.',
            briefing: 'Storm clouds gather over the Valley of Avalon. Saxon raiders have burned the river farms, and the displaced flock to your banner. Raise hovels, feed the multitude, and fill the granary before winter.',
            dialogue: "Sire, the Saxons have pillaged the riverlands! Thousands seek refuge. Build homes, fill the granary, and let none go hungry.",
            waves: { enabled: false },
            objectives: [
                { type: 'buildings', types: ['hovel', 'granary', 'sawyer', 'hunter'], label: "Establish the settlement (Hovel, Granary, Sawyer, Hunter's Lodge)" },
                { type: 'population', target: 150, label: 'Reach 150 population' },
                { type: 'resource', res: 'food', target: 800, label: 'Hoard 800 food in the granary' }
            ],
            bonus: { type: 'noStarvation', label: 'Zero peasant starvation' },
            startRes: { wood: 400, stone: 180, gold: 300 }
        },
        {
            id: 2,
            title: "Siege of Camelot's Gate",
            objective: 'Survive 5 siege waves using boiling pitch and archer towers.',
            briefing: "Enemy vanguard banners crest the eastern hills. Camelot's outer towers are all that stand between the horde and the keep. Stockpile pitch, man the towers, and hold for five assaults.",
            dialogue: "Enemy vanguard banners spot the horizon. Station archers along the walls and keep the pitch boiling!",
            waves: { enabled: true, firstDelay: 50, interval: 55, max: 5, composition: 'standard' },
            playerStructures: [
                { type: 'tower', gx: 25, gy: 24, tag: 'outerTower' },
                { type: 'tower', gx: 26, gy: 30, tag: 'outerTower' },
                { type: 'tower', gx: 25, gy: 35, tag: 'outerTower' }
            ],
            objectives: [
                { type: 'wavesSurvived', target: 5, label: 'Survive 5 siege waves' }
            ],
            bonus: { type: 'structuresStanding', tag: 'outerTower', label: 'Keep all outer towers standing' },
            startRes: { pitch: 60, stone: 220, iron: 80, gold: 350 }
        },
        {
            id: 3,
            title: "Dragon's Dawn",
            objective: 'Consecrate the Cathedral, recruit the Solaris Dragon, destroy Blackfang Keep.',
            briefing: 'The warlord of Blackfang has sworn to drown Avalon in ash. Consecrate the Cathedral of Avalon, awaken the Solaris Dragon, and carry the dawn across the river.',
            dialogue: "The ancient darkness awakens. Only the fire of the Solaris Dragon can break Blackfang's hold!",
            waves: { enabled: true, firstDelay: 90, interval: 70, composition: 'standard' },
            enemyKeepName: 'Blackfang Keep',
            enemyGeneral: { name: 'Blackfang Warlord' },
            objectives: [
                { type: 'buildings', types: ['cathedral'], label: 'Consecrate the Cathedral of Avalon' },
                { type: 'trained', unit: 'dragon', target: 1, label: 'Recruit the Solaris Dragon' },
                { type: 'destroyEnemyKeep', label: 'Destroy Blackfang Keep' }
            ],
            bonus: { type: 'generalSlainBy', unit: 'dragon', label: 'Slay the enemy general with your Dragon' },
            startRes: { gold: 450, honor: 60, stone: 260, wood: 300, iron: 100 }
        }
    ],
    frost: [
        {
            id: 1,
            title: 'The Glacial Trail',
            objective: 'Quarry 500 basalt and establish 3 hunter outposts in the frozen tundra.',
            briefing: 'The Covenant marches north along the Glacial Trail. Timber is scarce and the cold is merciless. Cut basalt from the ice and send rangers to hunt the tundra elk.',
            dialogue: "The blizzards freeze our marrow. Quarry stone for the battlements and set hunters upon the elk herds.",
            waves: { enabled: true, firstDelay: 120, interval: 90, max: 2, composition: 'standard' },
            objectives: [
                { type: 'produced', res: 'stone', target: 500, label: 'Quarry 500 basalt' },
                { type: 'buildingCount', building: 'hunter', target: 3, label: 'Establish 3 hunter outposts' }
            ],
            bonus: { type: 'noBuild', building: 'hovel', label: 'Build zero wood cabins (Hovels)' }
        },
        {
            id: 2,
            title: 'Frostpeak Pass Ambush',
            objective: 'Repel the armored cavalry with Frost Giants and Valkyrie dive strikes.',
            briefing: 'Armored cavalry thunder toward Frostpeak Pass. Wake the Frost Giants from the mountain halls and call the Valkyries down from the storm. The bridge is the bottleneck: make it a graveyard.',
            dialogue: "Hostile riders seek to cross Frostpeak. Let our Giants shatter their charge at the bridge!",
            waves: { enabled: true, firstDelay: 70, interval: 55, max: 4, composition: 'cavalry' },
            objectives: [
                { type: 'trained', unit: 'giant', target: 2, label: 'Muster 2 Frost Giants' },
                { type: 'trained', unit: 'valkyrie', target: 2, label: 'Summon 2 Frost Valkyries' },
                { type: 'wavesSurvived', target: 4, label: 'Repel 4 cavalry charges' }
            ],
            bonus: { type: 'regionKills', target: 25, region: { x0: 26, y0: 26, x1: 37, y1: 35 }, label: 'Slay 25 enemies in the pass bottleneck' },
            startRes: { gold: 500, iron: 160, stone: 180, honor: 40 }
        },
        {
            id: 3,
            title: "The Ice Wyvern's Domain",
            objective: 'Raise the Aerie, hatch the Ice Wyvern and vanquish the Northern Warlord.',
            briefing: 'Beneath the glacial summit sleeps an Ice Wyvern egg older than the Covenant itself. Raise an aerie on the mountain, hatch the beast, and end the Northern Warlord who would claim it.',
            dialogue: "The Wyvern stirs beneath the glacial peaks. Awaken the beast and claim mastery over the North!",
            waves: { enabled: true, firstDelay: 100, interval: 70, composition: 'standard' },
            enemyKeepName: "Warlord's Hold",
            enemyGeneral: { name: 'Northern Warlord' },
            objectives: [
                { type: 'buildings', types: ['dragonRoost'], label: 'Raise the Wyvern Aerie on the glacier' },
                { type: 'trained', unit: 'dragon', target: 1, label: 'Hatch the Ice Wyvern' },
                { type: 'killGeneral', label: 'Vanquish the Northern Warlord' }
            ],
            bonus: { type: 'timeLimit', seconds: 720, label: 'Complete in under 12 minutes' },
            startRes: { gold: 450, honor: 70, stone: 300, wood: 260, iron: 120 }
        }
    ],
    obsidian: [
        {
            id: 1,
            title: 'Transylvanian Reckoning',
            objective: 'Harvest 300 brimstone and build 4 Boiling Pitch Cauldrons.',
            briefing: 'The peasants whisper of a reckoning. Let them whisper - and pay. Tap the brimstone seams beneath the bog and ring the keep with cauldrons of boiling pitch.',
            dialogue: "Darkness falls upon the valley. Siphon the brimstone and prepare our boiling defenses. And the tithe stays High.",
            waves: { enabled: true, firstDelay: 120, interval: 80, max: 3, composition: 'standard' },
            taxes: 2,
            objectives: [
                { type: 'produced', res: 'pitch', target: 300, label: 'Harvest 300 brimstone pitch' },
                { type: 'buildingCount', building: 'cauldron', target: 4, label: 'Build 4 Boiling Pitch Cauldrons' }
            ],
            bonus: { type: 'minTax', min: 2, label: 'Never lower tax rate below High' },
            startRes: { gold: 300, stone: 200, iron: 80 }
        },
        {
            id: 2,
            title: 'Blood Crucible Bastion',
            objective: 'Raise Vampire Bloodknights and infiltrate the enemy garrison.',
            briefing: 'A mortal garrison squats upon the old Crucible grounds. Raise a Blood Crucible, call forth the Bloodknights, and let them slip unseen past the watchtowers to raze the barracks.',
            dialogue: "The moonlight beckons. Our Bloodknights walk unseen - feast upon the garrison!",
            waves: { enabled: true, firstDelay: 90, interval: 65, composition: 'standard' },
            objectives: [
                { type: 'trained', unit: 'vampire', target: 3, label: 'Raise 3 Vampire Bloodknights' },
                { type: 'destroyBuildingType', building: 'barracks', label: 'Infiltrate and raze the enemy garrison barracks' }
            ],
            bonus: { type: 'lifesteal', target: 1000, label: 'Regenerate 1000 HP via lifesteal' },
            startRes: { gold: 500, honor: 60, pitch: 100, stone: 220, wood: 220 }
        },
        {
            id: 3,
            title: 'Eclipse of the Abyss',
            objective: 'Build 3 catapults, summon the Abyss Dragon and breach the Imperial Citadel.',
            briefing: 'The eclipse is upon us. The Imperial Citadel hides behind three great gatehouses. Batter them with catapults, then unleash the Abyss Dragon upon the throne room.',
            dialogue: "The eclipse is upon us! Unleash the Abyss Dragon to swallow their citadel in ash.",
            waves: { enabled: true, firstDelay: 100, interval: 65, composition: 'standard' },
            enemyKeepName: 'Imperial Citadel',
            enemyStructures: [
                { type: 'gatehouse', gx: 42, gy: 28, tag: 'enemyGate' },
                { type: 'gatehouse', gx: 42, gy: 31, tag: 'enemyGate' },
                { type: 'gatehouse', gx: 46, gy: 26, tag: 'enemyGate' }
            ],
            objectives: [
                { type: 'trained', unit: 'catapult', target: 3, label: 'Build 3 siege catapults' },
                { type: 'trained', unit: 'dragon', target: 1, label: 'Summon the Abyss Dragon' },
                { type: 'destroyEnemyKeep', label: 'Breach the Imperial Citadel' }
            ],
            bonus: { type: 'destroyAllTagged', tag: 'enemyGate', label: 'Destroy all enemy gatehouses' },
            startRes: { gold: 600, honor: 70, wood: 360, stone: 260, iron: 120 }
        }
    ]
};

if (typeof globalThis !== 'undefined') {
    globalThis.GAME_CONFIG = GAME_CONFIG;
    globalThis.BUILDINGS_DEF = BUILDINGS_DEF;
    globalThis.UNITS_DEF = UNITS_DEF;
    globalThis.FACTIONS_DEF = FACTIONS_DEF;
    globalThis.CAMPAIGN_MISSIONS = CAMPAIGN_MISSIONS;
    globalThis.VISION_DEF = VISION_DEF;
    globalThis.GAME_VERSION = GAME_VERSION;
}
