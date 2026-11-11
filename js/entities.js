/* ==========================================================================
   Citadel of Legends: Shattered Realms - Entity Definitions & Combat Behaviors
   ========================================================================== */

let _nextEntityId = 1;

/** Save/load support: ensure freshly spawned ids never collide with loaded ones. */
function getNextEntityId() {
    return _nextEntityId;
}
function setNextEntityId(n) {
    if (Number.isInteger(n) && n > _nextEntityId) _nextEntityId = n;
}
function resetEntityIds() {
    _nextEntityId = 1;
}

function entityCenter(e) {
    if (e.x !== undefined) return { x: e.x, y: e.y };
    return { x: e.gx + (e.w || 1) * 0.5, y: e.gy + (e.h || 1) * 0.5 };
}

class Building {
    constructor(type, gx, gy, isEnemy = false, faction = 'solaris') {
        this.id = _nextEntityId++;
        this.type = type;
        this.gx = gx;
        this.gy = gy;
        this.isEnemy = isEnemy;
        this.faction = faction;
        this.tag = null;

        const def = BUILDINGS_DEF[type] || {};
        this.name = def.name || type;
        this.w = def.w || 1;
        this.h = def.h || 1;
        this.maxHp = def.hp || 500;
        this.hp = this.maxHp;
        this.color = def.color || '#78350f';

        this.isTower = def.isTower || false;
        this.isWall = def.isWall || false;
        this.isGate = def.isGate || false;
        this.isCathedral = def.isCathedral || false;
        this.isRunestone = def.isRunestone || false;
        this.isCrucible = def.isCrucible || false;
        this.isCauldron = def.isCauldron || false;
        this.attackRange = this.isTower ? 7.5 : this.isCauldron ? 2.5 : 0;
        this.attackDamage = this.isTower ? 22 : this.isCauldron ? 40 : 0;
        this.attackCooldown = 0;
        this.attackRate = this.isCauldron ? 2.0 : 1.1; // seconds between volleys / pours
        this.healCooldown = 2.5;
        this.lastAttackerType = null;
    }

    containsTile(x, y) {
        return x >= this.gx && x < this.gx + this.w && y >= this.gy && y < this.gy + this.h;
    }

    takeDamage(amt, attacker = null) {
        if (attacker && attacker.type) this.lastAttackerType = attacker.type;
        this.hp = Math.max(0, this.hp - amt);
        return this.hp <= 0;
    }

    repair(amt = 150) {
        this.hp = Math.min(this.maxHp, this.hp + amt);
    }

    update(dt, game) {
        if (this.hp <= 0) return;
        const cx = this.gx + this.w * 0.5;
        const cy = this.gy + this.h * 0.5;

        // Cathedral Healing Sanctuary Aura
        if (this.isCathedral && !this.isEnemy) {
            this.healCooldown -= dt;
            if (this.healCooldown <= 0) {
                this.healCooldown = 2.5;
                let healed = false;
                queryUnitsNear(game, cx, cy, 5.5, u => !u.isEnemy && u.hp > 0 && u.hp < u.maxHp).forEach(u => {
                    u.hp = Math.min(u.maxHp, u.hp + 18);
                    game.spawnFloatingText('+18 HP', u.x, u.y, '#22c55e');
                    healed = true;
                });
                if (healed) Sound.playHeal();
            }
        }

        // Runestone: empowers nearby allies (+25% attack while in the aura)
        if (this.isRunestone && !this.isEnemy) {
            this.healCooldown -= dt;
            if (this.healCooldown <= 0) {
                this.healCooldown = 1.0;
                queryUnitsNear(game, cx, cy, 6.0, u => !u.isEnemy && u.hp > 0 && !u.isWorker).forEach(u => {
                    u.empoweredTimer = 1.5;
                });
            }
        }

        // Boiling Pitch Cauldron: automated area denial, consumes pitch
        if (this.isCauldron && !this.isEnemy) {
            if (this.attackCooldown > 0) {
                this.attackCooldown -= dt;
            } else {
                const foes = queryUnitsNear(game, cx, cy, this.attackRange, u => u.isEnemy && u.hp > 0 && !u.isFlying);
                const econ = game.economy;
                if (foes.length > 0 && econ && econ.res.pitch >= 1) {
                    econ.res.pitch -= 1;
                    foes.forEach(u => {
                        u.takeDamage(this.attackDamage, this, game);
                        game.spawnFloatingText(`-${this.attackDamage} Pitch`, u.x, u.y, '#f97316');
                        if (game.fx) game.fx.emitSparks(u.x, u.y, 4);
                    });
                    Sound.playShatter();
                    this.attackCooldown = this.attackRate;
                }
            }
        }

        // Defensive Watchtower Automated Defense
        if (this.isTower) {
            if (this.attackCooldown > 0) {
                this.attackCooldown -= dt;
            } else {
                const nearestEnemy = findNearestUnit(game, cx, cy, this.attackRange, u =>
                    u.isEnemy !== this.isEnemy && u.hp > 0 && !(u.isConcealed && u.isConcealed() && Math.hypot(u.x - cx, u.y - cy) > 1.5));

                if (nearestEnemy) {
                    Sound.playBowTwang();
                    game.spawnProjectile('arrow', cx, cy, nearestEnemy, this.attackDamage, this);
                    this.attackCooldown = this.attackRate;
                }
            }
        }
    }
}

class Unit {
    constructor(type, x, y, isEnemy = false, faction = 'solaris') {
        this.id = _nextEntityId++;
        this.type = type;
        this.x = x;
        this.y = y;
        this.isEnemy = isEnemy;
        this.faction = faction;

        const def = UNITS_DEF[type] || {};
        this.name = def.name || type;
        this.maxHp = def.hp || 100;
        this.hp = this.maxHp;
        this.atk = def.atk || 15;
        this.range = def.range || 1.2;
        this.speed = def.speed || 1.0;
        if (!isEnemy && FACTIONS_DEF[faction] && FACTIONS_DEF[faction].bonuses.unitSpeedMultiplier) {
            this.speed *= FACTIONS_DEF[faction].bonuses.unitSpeedMultiplier;
        }
        this.isFlying = def.isFlying || false;
        this.isSiege = def.isSiege || false;
        this.isWorker = def.isWorker || false;
        this.isHealer = def.isHealer || false;
        this.isLifesteal = def.isLifesteal || false;
        this.isStealthy = def.isStealthy || false;
        this.isGeneral = def.isGeneral || false;
        this.color = def.color || '#38bdf8';

        this.state = 'idle'; // 'idle', 'moving', 'attacking'
        this.path = [];
        this.waypointIndex = 0;
        this.targetEntity = null;
        this.attackCooldown = 0;
        this.attackRate = type === 'dragon' ? 1.8 : type === 'catapult' ? 2.5 : 1.1;
        this.healCooldown = 2.0;
        this.revealedTimer = 0;
        this.empoweredTimer = 0;
        this.lastAttackerType = null;
        this.waveId = 0;

        // Auto Aggro radius for soldiers
        this.aggroRadius = this.isWorker ? 0 : this.isEnemy ? 10.0 : 6.0;
        this.scanCooldown = 0;
    }

    /** Stealthy units are hidden from enemy targeting until they strike. */
    isConcealed() {
        return this.isStealthy && this.revealedTimer <= 0;
    }

    moveTo(tx, ty, game = null) {
        this.targetEntity = null;

        if (game && game.pathfinding) {
            this.path = game.pathfinding.findPath(this.x, this.y, tx, ty, this.isFlying, this.isEnemy);
            this.waypointIndex = 0;
            this.state = this.path.length > 0 ? 'moving' : 'idle';
        } else {
            this.path = [{ x: tx, y: ty }];
            this.waypointIndex = 0;
            this.state = 'moving';
        }
    }

    attackTarget(entity, game = null) {
        this.targetEntity = entity;
        this.state = 'attacking';

        if (game && game.pathfinding && entity) {
            const c = entityCenter(entity);
            this.path = game.pathfinding.findPath(this.x, this.y, c.x, c.y, this.isFlying, this.isEnemy);
            this.waypointIndex = 0;
        }
    }

    update(dt, game) {
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.revealedTimer > 0) this.revealedTimer -= dt;
        if (this.empoweredTimer > 0) this.empoweredTimer -= dt;

        // Paladin Healing Aura
        if (this.isHealer && !this.isEnemy) {
            this.healCooldown -= dt;
            if (this.healCooldown <= 0) {
                this.healCooldown = 2.0;
                let healed = false;
                queryUnitsNear(game, this.x, this.y, 3.5, u => !u.isEnemy && u !== this && u.hp > 0 && u.hp < u.maxHp).forEach(u => {
                    u.hp = Math.min(u.maxHp, u.hp + 14);
                    game.spawnFloatingText('+14 HP', u.x, u.y, '#22c55e');
                    healed = true;
                });
                if (healed) Sound.playHeal();
            }
        }

        // 1. Combat & Target Tracking
        if (this.state === 'attacking' && this.targetEntity) {
            if (this.targetEntity.hp <= 0) {
                this.targetEntity = null;
                this.state = 'idle';
                return;
            }

            // Retaliation: units sieging a structure turn on nearby defenders.
            if (this.targetEntity instanceof Building && !this.isWorker) {
                this.retaliateTimer = (this.retaliateTimer || 0) + dt;
                if (this.retaliateTimer >= 1.0) {
                    this.retaliateTimer = 0;
                    const threat = findNearestUnit(game, this.x, this.y, 3.5, u =>
                        u.isEnemy !== this.isEnemy && u.hp > 0 && !(u.isConcealed && u.isConcealed()));
                    if (threat) {
                        this.attackTarget(threat, game);
                        return;
                    }
                }
            }

            const c = entityCenter(this.targetEntity);
            const dist = Math.hypot(c.x - this.x, c.y - this.y);
            const reach = this.range + (this.targetEntity instanceof Building ? 0.5 + Math.max(this.targetEntity.w, this.targetEntity.h) * 0.5 : 0);

            if (dist <= reach) {
                if (this.attackCooldown <= 0) {
                    this.performAttack(this.targetEntity, game);
                    this.attackCooldown = this.attackRate;
                }
            } else {
                this.followWaypoints(dt, game, true);

                // Path exhausted but target still out of reach => the route is walled
                // off. Breach the nearest hostile structure blocking the way.
                if (!this.isFlying && (!this.path || this.waypointIndex >= this.path.length)) {
                    const blocker = this.findBlockingStructure(game);
                    if (blocker && blocker !== this.targetEntity) {
                        this.attackTarget(blocker, game);
                        return;
                    }
                }

                this.scanCooldown += dt;
                if (this.scanCooldown > 1.2) {
                    this.scanCooldown = 0;
                    if (this.targetEntity instanceof Unit && game.pathfinding) {
                        this.path = game.pathfinding.findPath(this.x, this.y, c.x, c.y, this.isFlying, this.isEnemy);
                        this.waypointIndex = 0;
                    }
                }
            }
            return;
        }

        // 2. Waypoint Movement
        if (this.state === 'moving') {
            this.followWaypoints(dt, game, false);
            return;
        }

        // 3. Autonomous Enemy Scanning (if Idle)
        if (this.state === 'idle' && !this.isWorker) {
            this.scanCooldown += dt;
            if (this.scanCooldown >= 0.5) {
                this.scanCooldown = 0;
                this.autoScanForEnemies(game);
            }
        }
    }

    followWaypoints(dt, game, keepAttacking = false) {
        if (!this.path || this.waypointIndex >= this.path.length) {
            if (!keepAttacking) this.state = 'idle';
            return;
        }

        const wp = this.path[this.waypointIndex];
        const dx = wp.x - this.x;
        const dy = wp.y - this.y;
        const dist = Math.hypot(dx, dy);

        const step = this.speed * dt * 1.6;
        if (dist <= step) {
            this.x = wp.x;
            this.y = wp.y;
            this.waypointIndex++;
            if (this.waypointIndex >= this.path.length && !keepAttacking) {
                this.state = 'idle';
            }
        } else {
            this.x += (dx / dist) * step;
            this.y += (dy / dist) * step;
        }
    }

    autoScanForEnemies(game) {
        const bestTarget = findNearestUnit(game, this.x, this.y, this.aggroRadius, u =>
            u.isEnemy !== this.isEnemy && u.hp > 0 &&
            !(u.isConcealed && u.isConcealed() && Math.hypot(u.x - this.x, u.y - this.y) > 1.5));

        if (bestTarget) {
            this.attackTarget(bestTarget, game);
            return;
        }

        let bestBuilding = null;
        let closestDist = this.aggroRadius + 2.0;
        for (const b of game.buildings) {
            if (b.isEnemy !== this.isEnemy && b.hp > 0) {
                const cx = b.gx + b.w * 0.5;
                const cy = b.gy + b.h * 0.5;
                const dist = Math.hypot(cx - this.x, cy - this.y);
                if (dist <= closestDist) {
                    closestDist = dist;
                    bestBuilding = b;
                }
            }
        }
        if (bestBuilding) {
            this.attackTarget(bestBuilding, game);
            return;
        }

        // Siege-wave attackers with nothing nearby resume the march on the keep.
        if (this.isEnemy && this.waveId && game.playerKeep && game.playerKeep.hp > 0) {
            this.attackTarget(game.playerKeep, game);
        }
    }

    /** Nearest opposing structure whose footprint is within reach of this unit. */
    findBlockingStructure(game) {
        let best = null;
        let bestD = 2.2;
        for (const b of game.buildings) {
            if (b.isEnemy === this.isEnemy || b.hp <= 0) continue;
            const dx = Math.max(b.gx - this.x, 0, this.x - (b.gx + b.w));
            const dy = Math.max(b.gy - this.y, 0, this.y - (b.gy + b.h));
            const d = Math.hypot(dx, dy);
            if (d < bestD) {
                bestD = d;
                best = b;
            }
        }
        return best;
    }

    currentAttack() {
        return Math.round(this.atk * (this.empoweredTimer > 0 ? 1.25 : 1));
    }

    performAttack(target, game) {
        if (this.isStealthy) this.revealedTimer = 3.0;
        const dmg = this.currentAttack();

        if (this.type === 'archer') {
            Sound.playBowTwang();
            game.spawnProjectile('arrow', this.x, this.y, target, dmg, this);
        } else if (this.type === 'catapult') {
            Sound.playBuild();
            game.spawnProjectile('boulder', this.x, this.y, target, dmg, this);
        } else if (this.type === 'dragon') {
            Sound.playDragonRoar();
            game.spawnProjectile('fire', this.x, this.y, target, dmg, this);
        } else {
            // Melee Strike
            Sound.playSwordClash();
            const killed = target.takeDamage(dmg, this, game);
            const c = entityCenter(target);
            game.spawnFloatingText(`-${dmg}`, c.x, c.y, this.isEnemy ? '#ef4444' : '#f59e0b');
            if (game.fx) {
                game.fx.emitSparks(c.x, c.y, 5);
                if (target instanceof Unit && target.type !== 'catapult') game.fx.emitBlood(c.x, c.y, 4);
            }

            // Vampire Lifesteal mechanic
            if (this.isLifesteal && this.hp < this.maxHp) {
                const healAmt = Math.min(this.maxHp - this.hp, Math.round(dmg * 0.35));
                this.hp = Math.min(this.maxHp, this.hp + healAmt);
                game.spawnFloatingText(`+${healAmt} HP`, this.x, this.y, '#dc2626');
                if (!this.isEnemy && game.campaign) game.campaign.recordLifesteal(healAmt);
            }

            if (killed) {
                if (target instanceof Building && game.handleBuildingDestruction) {
                    game.handleBuildingDestruction(target);
                }
                this.targetEntity = null;
                this.state = 'idle';
            }
        }
    }

    takeDamage(amt, attacker = null) {
        if (attacker && attacker.type) this.lastAttackerType = attacker.type;
        this.hp = Math.max(0, this.hp - amt);
        return this.hp <= 0;
    }
}

class Projectile {
    constructor(type, startX, startY, target, damage, source = null) {
        this.type = type;
        this.x = startX;
        this.y = startY;
        this.target = target;
        this.damage = damage;
        this.source = source;
        this.progress = 0;
        this.speed = type === 'arrow' ? 5.5 : type === 'fire' ? 3.8 : 3.0;

        this.startX = startX;
        this.startY = startY;
        const c = entityCenter(target);
        this.endX = c.x;
        this.endY = c.y;

        const dx = this.endX - startX;
        const dy = this.endY - startY;
        this.totalDist = Math.max(0.1, Math.hypot(dx, dy));
        this.arcHeight = 0;
    }

    update(dt, game) {
        this.progress = Math.min(1.0, this.progress + (this.speed * dt) / this.totalDist);
        this.x = this.startX + (this.endX - this.startX) * this.progress;
        this.y = this.startY + (this.endY - this.startY) * this.progress;

        // Parabolic height calculation
        this.arcHeight = Math.sin(this.progress * Math.PI) * (this.type === 'boulder' ? 42 : this.type === 'fire' ? 24 : 14);

        if (this.progress >= 1.0) {
            // Impact!
            if (this.target && this.target.hp > 0) {
                const killed = this.target.takeDamage(this.damage, this.source, game);
                game.spawnFloatingText(`-${this.damage}`, this.endX, this.endY, this.type === 'fire' ? '#ef4444' : '#f97316');

                if (killed && this.target instanceof Building && game.handleBuildingDestruction) {
                    game.handleBuildingDestruction(this.target);
                }
            }

            const sourceIsEnemy = this.source ? this.source.isEnemy : (this.target ? !this.target.isEnemy : null);
            const isFoe = (u) => u !== this.target && u.hp > 0 && (sourceIsEnemy === null || u.isEnemy !== sourceIsEnemy);

            // AoE Splash Damage for Catapults and Dragon Fire
            if (this.type === 'boulder') {
                Sound.playShatter();
                if (game.fx) game.fx.emitRubble(this.endX, this.endY, 8);
                queryUnitsNear(game, this.endX, this.endY, 1.8, isFoe).forEach(u => {
                    const splashDmg = Math.round(this.damage * 0.45);
                    u.takeDamage(splashDmg, this.source, game);
                    game.spawnFloatingText(`-${splashDmg}`, u.x, u.y, '#ea580c');
                });
            } else if (this.type === 'fire') {
                if (game.fx) game.fx.emitFlamePatch(this.endX, this.endY, this.source);
                queryUnitsNear(game, this.endX, this.endY, 2.2, isFoe).forEach(u => {
                    const splashDmg = Math.round(this.damage * 0.4);
                    u.takeDamage(splashDmg, this.source, game);
                    game.spawnFloatingText(`-${splashDmg}`, u.x, u.y, '#ef4444');
                });
            } else if (game.fx && this.target instanceof Unit) {
                game.fx.emitBlood(this.endX, this.endY, 3);
            }

            return true; // Finished
        }
        return false;
    }
}

class Particle {
    constructor(x, y, text, color = '#fef3c7', size = 12) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.size = size;
        this.life = 1.0;
        this.maxLife = 1.0;
        this.vy = -0.5; // Float upwards
    }

    update(dt) {
        this.life -= dt;
        this.y += this.vy * dt;
        return this.life <= 0;
    }
}

if (typeof globalThis !== 'undefined') {
    globalThis.Building = Building;
    globalThis.Unit = Unit;
    globalThis.Projectile = Projectile;
    globalThis.Particle = Particle;
    globalThis.entityCenter = entityCenter;
    globalThis.getNextEntityId = getNextEntityId;
    globalThis.setNextEntityId = setNextEntityId;
    globalThis.resetEntityIds = resetEntityIds;
}
