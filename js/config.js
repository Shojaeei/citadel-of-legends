/* ==========================================================================
   Citadel of Legends: Shattered Realms - Configuration & Game Data
   ========================================================================== */

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
        current: 8,
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
    }
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
    dragon: {
        id: 'dragon',
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
        description: 'Chivalric realm of light. Boasts disciplined Sun-Blade Knights, prolific bakeries, and the Solaris Dragon.',
        bonuses: {
            taxIncomeMultiplier: 1.2,
            foodRateMultiplier: 1.15,
            specialUnit: 'knight'
        }
    },
    frost: {
        name: 'Frostbound Covenant',
        ruler: 'Siegfried the Dragon-Slayer',
        biome: 'tundra',
        primaryColor: '#38bdf8',
        bannerIcon: '❄️',
        description: 'Hardened clan of northern peaks. Masters of stonecraft, hunter traditions, Frost Giants, and Ice Wyverns.',
        bonuses: {
            stoneRateMultiplier: 1.3,
            mineRateMultiplier: 1.2,
            specialUnit: 'giant'
        }
    },
    obsidian: {
        name: 'Obsidian Scourge',
        ruler: 'Count Vlad Dracula',
        biome: 'wasteland',
        primaryColor: '#ef4444',
        bannerIcon: '🦇',
        description: 'Ruthless dread lords of brimstone and blood. Commands terrifying Werewolves, boiling tar defenses, and the Abyss Dragon.',
        bonuses: {
            tarRateMultiplier: 1.4,
            unitSpeedMultiplier: 1.15,
            specialUnit: 'werewolf'
        }
    }
};

const CAMPAIGN_MISSIONS = {
    solaris: [
        {
            id: 1,
            title: 'The Saxon Incursion',
            objective: 'Build a Hovel, Sawyer, Hunter Camp, and Granary to secure your foundation.',
            reqBuildings: ['hovel', 'sawyer', 'hunter', 'granary'],
            targetPop: 12,
            dialogue: "Sire, the Saxons have pillaged the riverlands! We must establish our citadel's supply lines before their raiders descend."
        },
        {
            id: 2,
            title: "Siege of Camelot's Gate",
            objective: 'Construct a Barracks and recruit 5 Halberdiers and 4 Runebow Archers.',
            reqUnits: { halberdier: 5, archer: 4 },
            dialogue: "Enemy vanguard banners spot the horizon. Station archers along the walls and muster the garrison!"
        },
        {
            id: 3,
            title: 'Shadow Over Avalon',
            objective: 'Erect the Dragon Roost Dais and summon the Solaris Dragon to cleanse the land.',
            reqBuildings: ['dragonRoost'],
            reqUnits: { dragon: 1 },
            dialogue: "The ancient darkness awakens. Only the fire of the Solaris Dragon can break the final siege!"
        }
    ],
    frost: [
        {
            id: 1,
            title: 'Evil Approaches the Glacier',
            objective: 'Establish a Basalt Quarry and two Hovels in the frozen wastes.',
            reqBuildings: ['quarry', 'hovel'],
            dialogue: "The freezing blizzards freeze our marrow. Construct shelters and quarry stone for fortress battlements."
        },
        {
            id: 2,
            title: 'Frostpeak Pass Ambush',
            objective: 'Train 3 Frost Giants and 5 Runebow Archers to defend the mountain pass.',
            reqUnits: { giant: 3, archer: 5 },
            dialogue: "Hostile mountain warbands seek to cross Frostpeak. Let our Frost Giants shatter their advance!"
        },
        {
            id: 3,
            title: 'Wrath of the Ice Wyvern',
            objective: 'Erect the Dragon Roost and hatch the Ice Wyvern.',
            reqBuildings: ['dragonRoost'],
            reqUnits: { dragon: 1 },
            dialogue: "The Wyvern stirs beneath the glacial peaks. Awaken the beast and claim mastery over the North!"
        }
    ],
    obsidian: [
        {
            id: 1,
            title: 'Transylvanian Night',
            objective: 'Erect a Brimstone Tar Rig and Sawyer in the blighted bog.',
            reqBuildings: ['tar', 'sawyer'],
            dialogue: "Darkness falls upon the valley. Siphon the brimstone pitch to prepare our boiling defenses."
        },
        {
            id: 2,
            title: 'Blood Crucible Bastion',
            objective: 'Summon 5 Night-Stalker Werewolves and erect an Archery Range.',
            reqUnits: { werewolf: 5 },
            reqBuildings: ['archery'],
            dialogue: "The moonlight beckons. Release the wolf pack upon the mortal invaders!"
        },
        {
            id: 3,
            title: 'Eclipse of the Abyss',
            objective: 'Summon the Abyss Dragon and annihilate the rival fortress.',
            reqBuildings: ['dragonRoost'],
            reqUnits: { dragon: 1 },
            dialogue: "The eclipse is upon us! Unleash the Abyss Dragon to swallow their citadel in ash."
        }
    ]
};

if (typeof globalThis !== 'undefined') {
    globalThis.GAME_CONFIG = GAME_CONFIG;
    globalThis.BUILDINGS_DEF = BUILDINGS_DEF;
    globalThis.UNITS_DEF = UNITS_DEF;
    globalThis.FACTIONS_DEF = FACTIONS_DEF;
    globalThis.CAMPAIGN_MISSIONS = CAMPAIGN_MISSIONS;
}
