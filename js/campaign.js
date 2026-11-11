/* ==========================================================================
   Citadel of Legends: Shattered Realms - Campaign Director
   --------------------------------------------------------------------------
   Data-driven objective evaluation for the 9-mission narrative campaign.
   Mission definitions live in js/config.js (CAMPAIGN_MISSIONS). This module
   owns per-mission telemetry (production, recruits, kills, bonus tracking),
   objective progress strings for the HUD, and campaign unlock persistence.
   ========================================================================== */

const CAMPAIGN_PROGRESS_KEY = 'citadel.campaign.progress';

function createMissionStats() {
    return {
        produced: { wood: 0, stone: 0, iron: 0, pitch: 0, food: 0, gold: 0, honor: 0 },
        trained: {},
        built: {},
        destroyedEnemyTypes: {},
        wavesSurvived: 0,
        starved: false,
        enemyKeepDestroyed: false,
        generalSlain: false,
        generalKiller: null,
        regionKills: 0,
        minTax: Infinity,
        lifestealHealed: 0
    };
}

class CampaignDirector {
    constructor(game) {
        this.game = game;
        this.stats = createMissionStats();
        this.completedAt = null;
    }

    reset() {
        this.stats = createMissionStats();
        this.completedAt = null;
    }

    get mission() {
        return this.game.currentMissionData;
    }

    // ---- Telemetry hooks (called by game / economy / entities) ----
    recordProduction(res, amount) {
        if (this.stats.produced[res] === undefined) this.stats.produced[res] = 0;
        this.stats.produced[res] += amount;
    }

    recordTrained(unitType) {
        this.stats.trained[unitType] = (this.stats.trained[unitType] || 0) + 1;
    }

    recordBuilt(buildingType) {
        this.stats.built[buildingType] = (this.stats.built[buildingType] || 0) + 1;
    }

    recordEnemyBuildingDestroyed(b) {
        this.stats.destroyedEnemyTypes[b.type] = (this.stats.destroyedEnemyTypes[b.type] || 0) + 1;
        if (b === this.game.enemyKeep) this.stats.enemyKeepDestroyed = true;
    }

    recordEnemyKilled(unit) {
        const m = this.mission;
        if (unit.isGeneral) {
            this.stats.generalSlain = true;
            this.stats.generalKiller = unit.lastAttackerType || null;
        }
        if (m && m.bonus && m.bonus.type === 'regionKills') {
            const r = m.bonus.region;
            if (unit.x >= r.x0 && unit.x <= r.x1 && unit.y >= r.y0 && unit.y <= r.y1) {
                this.stats.regionKills++;
            }
        }
    }

    recordStarvation() {
        this.stats.starved = true;
    }

    recordTax(level) {
        this.stats.minTax = Math.min(this.stats.minTax, level);
    }

    recordLifesteal(amount) {
        this.stats.lifestealHealed += amount;
    }

    recordWaveSurvived() {
        this.stats.wavesSurvived++;
    }

    // ---- Evaluation ----
    countFriendlyBuildings(type) {
        return this.game.buildings.filter(b => !b.isEnemy && b.type === type && b.hp > 0).length;
    }

    evaluateObjective(obj) {
        const g = this.game;
        const s = this.stats;
        switch (obj.type) {
            case 'buildings': {
                const have = obj.types.filter(t => this.countFriendlyBuildings(t) > 0).length;
                return { done: have === obj.types.length, current: have, target: obj.types.length };
            }
            case 'buildingCount': {
                const c = this.countFriendlyBuildings(obj.building);
                return { done: c >= obj.target, current: c, target: obj.target };
            }
            case 'population': {
                const c = g.economy.pop.current;
                return { done: c >= obj.target, current: c, target: obj.target };
            }
            case 'resource': {
                const c = Math.floor(g.economy.res[obj.res] || 0);
                return { done: c >= obj.target, current: c, target: obj.target };
            }
            case 'produced': {
                const c = Math.floor(s.produced[obj.res] || 0);
                return { done: c >= obj.target, current: c, target: obj.target };
            }
            case 'trained': {
                const c = s.trained[obj.unit] || 0;
                return { done: c >= obj.target, current: c, target: obj.target };
            }
            case 'units': {
                const c = g.units.filter(u => !u.isEnemy && u.type === obj.unit).length;
                return { done: c >= obj.target, current: c, target: obj.target };
            }
            case 'wavesSurvived': {
                return { done: s.wavesSurvived >= obj.target, current: s.wavesSurvived, target: obj.target };
            }
            case 'destroyEnemyKeep':
                return { done: s.enemyKeepDestroyed, current: s.enemyKeepDestroyed ? 1 : 0, target: 1 };
            case 'destroyBuildingType': {
                const c = s.destroyedEnemyTypes[obj.building] || 0;
                return { done: c >= (obj.target || 1), current: c, target: obj.target || 1 };
            }
            case 'killGeneral':
                return { done: s.generalSlain, current: s.generalSlain ? 1 : 0, target: 1 };
            case 'kills': {
                const c = g.stats.enemiesKilled;
                return { done: c >= obj.target, current: c, target: obj.target };
            }
            default:
                return { done: false, current: 0, target: 1 };
        }
    }

    /**
     * Bonus objectives are judged at mission end, but we expose a live
     * "still achievable / achieved" view for the HUD.
     * @returns {{done:boolean, failed:boolean, text:string}}
     */
    evaluateBonus(bonus = this.mission && this.mission.bonus) {
        if (!bonus) return { done: false, failed: false, text: '' };
        const g = this.game;
        const s = this.stats;
        switch (bonus.type) {
            case 'noStarvation':
                return { done: !s.starved, failed: s.starved, text: s.starved ? 'failed' : 'on track' };
            case 'structuresStanding': {
                const total = g.buildings.filter(b => b.tag === bonus.tag).length;
                const expected = g.taggedStructureCount ? g.taggedStructureCount[bonus.tag] || 0 : total;
                const ok = total >= expected && expected > 0;
                return { done: ok, failed: !ok, text: `${total}/${expected} standing` };
            }
            case 'generalSlainBy': {
                if (!s.generalSlain) return { done: false, failed: false, text: 'general lives' };
                const ok = s.generalKiller === bonus.unit;
                return { done: ok, failed: !ok, text: ok ? 'achieved' : 'failed' };
            }
            case 'noBuild': {
                const c = s.built[bonus.building] || 0;
                return { done: c === 0, failed: c > 0, text: c === 0 ? 'on track' : 'failed' };
            }
            case 'regionKills':
                return { done: s.regionKills >= bonus.target, failed: false, text: `${s.regionKills}/${bonus.target}` };
            case 'timeLimit': {
                const t = g.stats.playTime;
                const ok = t <= bonus.seconds;
                const left = Math.max(0, Math.ceil(bonus.seconds - t));
                return { done: ok, failed: !ok, text: ok ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left` : 'time expired' };
            }
            case 'minTax': {
                const ok = s.minTax >= bonus.min;
                return { done: ok, failed: !ok, text: ok ? 'on track' : 'failed' };
            }
            case 'lifesteal': {
                const c = Math.floor(s.lifestealHealed);
                return { done: c >= bonus.target, failed: false, text: `${c}/${bonus.target} HP` };
            }
            case 'destroyAllTagged': {
                const remaining = g.buildings.filter(b => b.tag === bonus.tag).length;
                const total = g.taggedStructureCount ? g.taggedStructureCount[bonus.tag] || 0 : remaining;
                return { done: remaining === 0 && total > 0, failed: false, text: `${total - remaining}/${total}` };
            }
            default:
                return { done: false, failed: false, text: '' };
        }
    }

    getObjectiveStatuses() {
        const m = this.mission;
        if (!m || !m.objectives) return [];
        return m.objectives.map(obj => ({ obj, ...this.evaluateObjective(obj) }));
    }

    allPrimaryComplete() {
        const statuses = this.getObjectiveStatuses();
        return statuses.length > 0 && statuses.every(s => s.done);
    }

    // ---- Persistence of campaign unlocks ----
    static getStorage() {
        try {
            if (typeof localStorage !== 'undefined') return localStorage;
        } catch (e) { /* storage blocked (privacy mode / sandboxed iframe) */ }
        return null;
    }

    static loadProgress(storage = CampaignDirector.getStorage()) {
        const empty = { solaris: { unlocked: 1, bonus: {} }, frost: { unlocked: 1, bonus: {} }, obsidian: { unlocked: 1, bonus: {} } };
        if (!storage) return empty;
        try {
            const raw = storage.getItem(CAMPAIGN_PROGRESS_KEY);
            if (!raw) return empty;
            const parsed = JSON.parse(raw);
            for (const f of Object.keys(empty)) {
                const p = parsed[f];
                if (p && Number.isInteger(p.unlocked)) {
                    empty[f].unlocked = Math.max(1, Math.min(3, p.unlocked));
                    if (p.bonus && typeof p.bonus === 'object') {
                        for (const k of ['1', '2', '3']) if (p.bonus[k] === true) empty[f].bonus[k] = true;
                    }
                }
            }
        } catch (e) { /* corrupt progress: fall back to defaults */ }
        return empty;
    }

    static recordMissionComplete(faction, missionId, bonusAchieved, storage = CampaignDirector.getStorage()) {
        const progress = CampaignDirector.loadProgress(storage);
        if (!progress[faction]) return progress;
        progress[faction].unlocked = Math.min(3, Math.max(progress[faction].unlocked, missionId + 1));
        if (bonusAchieved) progress[faction].bonus[String(missionId)] = true;
        if (storage) {
            try { storage.setItem(CAMPAIGN_PROGRESS_KEY, JSON.stringify(progress)); } catch (e) { /* quota */ }
        }
        return progress;
    }

    serialize() {
        const s = JSON.parse(JSON.stringify(this.stats, (k, v) => (v === Infinity ? 'Infinity' : v)));
        return s;
    }

    deserialize(data) {
        const fresh = createMissionStats();
        if (data && typeof data === 'object') {
            for (const k of Object.keys(fresh)) {
                if (data[k] === undefined) continue;
                if (typeof fresh[k] === 'object' && fresh[k] !== null) {
                    if (data[k] && typeof data[k] === 'object') {
                        for (const [kk, vv] of Object.entries(data[k])) {
                            if (typeof vv === 'number' && Number.isFinite(vv) && /^[a-zA-Z]{1,24}$/.test(kk)) fresh[k][kk] = vv;
                        }
                    }
                } else if (k === 'minTax') {
                    fresh.minTax = data.minTax === 'Infinity' ? Infinity : (Number.isFinite(data.minTax) ? data.minTax : Infinity);
                } else if (typeof fresh[k] === typeof data[k]) {
                    fresh[k] = data[k];
                } else if (k === 'generalKiller' && (typeof data[k] === 'string' || data[k] === null)) {
                    fresh[k] = data[k] && UNITS_DEF[data[k]] ? data[k] : null;
                }
            }
        }
        this.stats = fresh;
    }
}

if (typeof globalThis !== 'undefined') {
    globalThis.CampaignDirector = CampaignDirector;
    globalThis.createMissionStats = createMissionStats;
    globalThis.CAMPAIGN_PROGRESS_KEY = CAMPAIGN_PROGRESS_KEY;
}
