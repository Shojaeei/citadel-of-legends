/* ==========================================================================
   Citadel of Legends: Shattered Realms - Economy & Population Simulation
   ========================================================================== */

class EconomySystem {
    constructor(game) {
        this.game = game;
        this.res = { ...GAME_CONFIG.startingResources };
        this.pop = { ...GAME_CONFIG.startingPopulation };
        this.popularity = GAME_CONFIG.startingPopularity;
        this.rations = 2; // 0: None, 1: Half, 2: Normal, 3: Extra
        this.taxes = 0;   // -2 to 3

        this.accumulatedTime = 0;
        this.economyTickInterval = 1.0; // 1 second per economy tick
        this.foodWarningIssued = false;
    }

    reset(faction = 'solaris') {
        this.res = { ...GAME_CONFIG.startingResources };
        this.pop = { ...GAME_CONFIG.startingPopulation };
        this.popularity = GAME_CONFIG.startingPopularity;
        this.rations = 2;
        this.taxes = 0;
        this.accumulatedTime = 0;
        this.foodWarningIssued = false;
    }

    canAfford(cost) {
        if (!cost) return true;
        for (const [resType, amount] of Object.entries(cost)) {
            if (amount && (this.res[resType] === undefined || this.res[resType] < amount)) {
                return false;
            }
        }
        return true;
    }

    getMissingResources(cost) {
        if (!cost) return [];
        const missing = [];
        for (const [resType, amount] of Object.entries(cost)) {
            if (amount && (this.res[resType] === undefined || this.res[resType] < amount)) {
                const deficit = amount - (this.res[resType] || 0);
                missing.push(`${deficit} ${resType.toUpperCase()}`);
            }
        }
        return missing;
    }

    deductCost(cost) {
        if (!this.canAfford(cost)) return false;
        for (const [resType, amount] of Object.entries(cost)) {
            if (amount) {
                this.res[resType] = Math.max(0, this.res[resType] - amount);
            }
        }
        return true;
    }

    update(dt) {
        this.accumulatedTime += dt;
        if (this.accumulatedTime >= this.economyTickInterval) {
            this.accumulatedTime -= this.economyTickInterval;
            this.tickEconomy();
        }
    }

    tickEconomy() {
        const factionData = FACTIONS_DEF[this.game.faction] || FACTIONS_DEF.solaris;
        const bonuses = factionData.bonuses || {};

        // 1. Calculate Housing Capacity
        let hovelCount = 0;
        this.game.buildings.forEach(b => {
            if (b.type === 'hovel') hovelCount++;
        });
        this.pop.max = 15 + (hovelCount * 5);

        // 2. Resource Production from Buildings
        this.game.buildings.forEach(b => {
            const def = BUILDINGS_DEF[b.type];
            if (def && def.producer && def.rate) {
                let production = def.rate;

                // Apply Faction Bonuses
                if (def.producer === 'stone' && bonuses.stoneRateMultiplier) {
                    production *= bonuses.stoneRateMultiplier;
                } else if (def.producer === 'iron' && bonuses.mineRateMultiplier) {
                    production *= bonuses.mineRateMultiplier;
                } else if (def.producer === 'pitch' && bonuses.tarRateMultiplier) {
                    production *= bonuses.tarRateMultiplier;
                } else if (def.producer === 'food' && bonuses.foodRateMultiplier) {
                    production *= bonuses.foodRateMultiplier;
                }

                if (this.res[def.producer] !== undefined) {
                    this.res[def.producer] += production;
                }
            }
        });

        // 3. Food Consumption & Rations
        // Rate per person per tick: 0: 0, 1: 0.15, 2: 0.3, 3: 0.5
        const rationRates = [0, 0.15, 0.3, 0.5];
        const foodConsumed = this.pop.current * rationRates[this.rations];
        
        let foodDeltaPop = 0;
        if (this.res.food >= foodConsumed) {
            this.res.food -= foodConsumed;
            this.foodWarningIssued = false;
            // Popularity effect of rations:
            if (this.rations === 0) foodDeltaPop = -8;
            else if (this.rations === 1) foodDeltaPop = -4;
            else if (this.rations === 2) foodDeltaPop = 0;
            else if (this.rations === 3) foodDeltaPop = 6;
        } else {
            // Starvation!
            this.res.food = 0;
            foodDeltaPop = -15;
            if (!this.foodWarningIssued) {
                this.game.showToast("⚠️ Granary empty! Peasants are starving!", true);
                Sound.playWarning();
                this.foodWarningIssued = true;
            }
        }

        // 4. Taxes & Royal Gifts
        let taxDeltaPop = 0;
        let taxGoldIncome = 0;
        const taxMultiplier = bonuses.taxIncomeMultiplier || 1.0;

        switch (this.taxes) {
            case -2: // Royal Gift
                if (this.res.gold >= 15) {
                    this.res.gold -= 15;
                    taxDeltaPop = +12;
                } else {
                    taxDeltaPop = +2;
                }
                break;
            case -1: // Small Gift
                if (this.res.gold >= 8) {
                    this.res.gold -= 8;
                    taxDeltaPop = +6;
                }
                break;
            case 0:  // No Taxes
                taxDeltaPop = 0;
                break;
            case 1:  // Low Taxes
                taxGoldIncome = Math.floor(this.pop.current * 0.8 * taxMultiplier);
                taxDeltaPop = -4;
                break;
            case 2:  // High Taxes
                taxGoldIncome = Math.floor(this.pop.current * 1.5 * taxMultiplier);
                taxDeltaPop = -10;
                break;
            case 3:  // Extortion
                taxGoldIncome = Math.floor(this.pop.current * 2.5 * taxMultiplier);
                taxDeltaPop = -18;
                break;
        }
        this.res.gold += taxGoldIncome;

        // 5. Update Popularity
        // Slight drift towards 75 if balanced
        const targetPop = Math.max(0, Math.min(100, this.popularity + foodDeltaPop + taxDeltaPop));
        // Smooth adjustment
        this.popularity = Math.round(this.popularity * 0.85 + targetPop * 0.15);

        // 6. Peasant Immigration / Emigration
        if (this.popularity >= 70 && this.pop.current < this.pop.max) {
            // New peasant arrives
            if (Math.random() < 0.35) {
                this.pop.current++;
                this.game.spawnPeasantAtKeep();
                this.game.showToast("A new peasant has arrived at the Keep!");
                Sound.playCheer();
            }
        } else if (this.popularity < 30 && this.pop.current > 3) {
            // Peasant abandons castle
            if (Math.random() < 0.25) {
                this.pop.current--;
                this.game.removePeasant();
                this.game.showToast("A disgruntled peasant has abandoned the castle!", true);
                Sound.playWarning();
            }
        }

        // 7. Update UI HUD
        this.game.updateUI();
    }
}

if (typeof globalThis !== 'undefined') {
    globalThis.EconomySystem = EconomySystem;
}
