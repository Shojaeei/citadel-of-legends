/* ==========================================================================
   Citadel of Legends: Shattered Realms - Entity Definitions & Combat Behaviors
   ========================================================================== */

let _nextEntityId = 1;

class Building {
    constructor(type, gx, gy, isEnemy = false, faction = 'solaris') {
        this.id = _nextEntityId++;
        this.type = type;
        this.gx = gx;
        this.gy = gy;
        this.isEnemy = isEnemy;
        this.faction = faction;

        const def = BUILDINGS_DEF[type] || {};
        this.name = def.name || type;
        this.w = def.w || 1;
        this.h = def.h || 1;
        this.maxHp = def.hp || 500;
        this.hp = this.maxHp;
        this.color = def.color || '#78350f';

        // Defensive Tower combat stats
        this.isTower = def.isTower || false;
        this.isWall = def.isWall || false;
        this.isGate = def.isGate || false;
        this.isCathedral = def.isCathedral || false;
        this.isRunestone = def.isRunestone || false;
        this.isCrucible = def.isCrucible || false;
        this.attackRange = this.isTower ? 7.5 : 0;
        this.attackDamage = this.isTower ? 22 : 0;
        this.attackCooldown = 0;
        this.attackRate = 1.1; // seconds between tower volleys
        this.healCooldown = 2.5;
    }

    containsTile(x, y) {
        return x >= this.gx && x < this.gx + this.w && y >= this.gy && y < this.gy + this.h;
    }

    takeDamage(amt) {
        this.hp = Math.max(0, this.hp - amt);
        return this.hp <= 0;
    }

    repair(amt = 150) {
        this.hp = Math.min(this.maxHp, this.hp + amt);
    }

    update(dt, game) {
        // Cathedral Healing Sanctuary Aura
        if (this.isCathedral && !this.isEnemy && this.hp > 0) {
            this.healCooldown -= dt;
            if (this.healCooldown <= 0) {
                this.healCooldown = 2.5;
                let healed = false;
                const cx = this.gx + this.w * 0.5;
                const cy = this.gy + this.h * 0.5;
                game.units.forEach(u => {
                    if (!u.isEnemy && u.hp < u.maxHp && Math.hypot(u.x - cx, u.y - cy) <= 5.5) {
                        u.hp = Math.min(u.maxHp, u.hp + 18);
                        game.spawnFloatingText('+18 HP', u.x, u.y, '#22c55e');
                        healed = true;
                    }
                });
                if (healed) Sound.playHeal();
            }
        }

        // Defensive Watchtower Automated Defense
        if (this.isTower && this.hp > 0) {
            if (this.attackCooldown > 0) {
                this.attackCooldown -= dt;
            } else {
                // Find nearest hostile unit within range
                const centerX = this.gx + this.w * 0.5;
                const centerY = this.gy + this.h * 0.5;
                let nearestEnemy = null;
                let nearestDist = this.attackRange;

                for (const u of game.units) {
                    if (u.isEnemy !== this.isEnemy && u.hp > 0) {
                        const dist = Math.hypot(u.x - centerX, u.y - centerY);
                        if (dist <= nearestDist) {
                            nearestDist = dist;
                            nearestEnemy = u;
                        }
                    }
                }

                if (nearestEnemy) {
                    Sound.playBowTwang();
                    game.spawnProjectile('arrow', centerX, centerY, nearestEnemy, this.attackDamage);
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
        this.isFlying = def.isFlying || false;
        this.isSiege = def.isSiege || false;
        this.isWorker = def.isWorker || false;
        this.isHealer = def.isHealer || false;
        this.isLifesteal = def.isLifesteal || false;
        this.color = def.color || '#38bdf8';

        this.state = 'idle'; // 'idle', 'moving', 'attacking'
        this.path = [];
        this.waypointIndex = 0;
        this.targetEntity = null;
        this.attackCooldown = 0;
        this.attackRate = type === 'dragon' ? 1.8 : type === 'catapult' ? 2.5 : 1.1;
        this.healCooldown = 2.0;

        // Auto Aggro radius for soldiers
        this.aggroRadius = this.isWorker ? 0 : this.isEnemy ? 10.0 : 6.0;
        this.scanCooldown = 0;
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
            const targetX = entity.x !== undefined ? entity.x : entity.gx + (entity.w || 1) * 0.5;
            const targetY = entity.y !== undefined ? entity.y : entity.gy + (entity.h || 1) * 0.5;
            this.path = game.pathfinding.findPath(this.x, this.y, targetX, targetY, this.isFlying, this.isEnemy);
            this.waypointIndex = 0;
        }
    }

    update(dt, game) {
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }

        // Paladin Healing Aura
        if (this.isHealer && !this.isEnemy) {
            this.healCooldown -= dt;
            if (this.healCooldown <= 0) {
                this.healCooldown = 2.0;
                let healed = false;
                game.units.forEach(u => {
                    if (!u.isEnemy && u !== this && u.hp < u.maxHp && Math.hypot(u.x - this.x, u.y - this.y) <= 3.5) {
                        u.hp = Math.min(u.maxHp, u.hp + 14);
                        game.spawnFloatingText('+14 HP', u.x, u.y, '#22c55e');
                        healed = true;
                    }
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

            const targetX = this.targetEntity.x !== undefined ? this.targetEntity.x : this.targetEntity.gx + (this.targetEntity.w || 1) * 0.5;
            const targetY = this.targetEntity.y !== undefined ? this.targetEntity.y : this.targetEntity.gy + (this.targetEntity.h || 1) * 0.5;

            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const dist = Math.hypot(dx, dy);

            // Check if inside weapon attack range
            if (dist <= this.range + (this.targetEntity instanceof Building ? 0.8 : 0)) {
                if (this.attackCooldown <= 0) {
                    this.performAttack(this.targetEntity, game);
                    this.attackCooldown = this.attackRate;
                }
            } else {
                this.followWaypoints(dt, game);

                this.scanCooldown += dt;
                if (this.scanCooldown > 1.2) {
                    this.scanCooldown = 0;
                    if (this.targetEntity instanceof Unit) {
                        this.path = game.pathfinding.findPath(this.x, this.y, targetX, targetY, this.isFlying, this.isEnemy);
                        this.waypointIndex = 0;
                    }
                }
            }
            return;
        }

        // 2. Waypoint Movement
        if (this.state === 'moving') {
            this.followWaypoints(dt, game);
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

    followWaypoints(dt, game) {
        if (!this.path || this.waypointIndex >= this.path.length) {
            this.state = 'idle';
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
            if (this.waypointIndex >= this.path.length) {
                this.state = 'idle';
            }
        } else {
            this.x += (dx / dist) * step;
            this.y += (dy / dist) * step;
        }
    }

    autoScanForEnemies(game) {
        let bestTarget = null;
        let closestDist = this.aggroRadius;

        for (const u of game.units) {
            if (u.isEnemy !== this.isEnemy && u.hp > 0) {
                const dist = Math.hypot(u.x - this.x, u.y - this.y);
                if (dist <= closestDist) {
                    closestDist = dist;
                    bestTarget = u;
                }
            }
        }

        if (!bestTarget) {
            for (const b of game.buildings) {
                if (b.isEnemy !== this.isEnemy && b.hp > 0) {
                    const cx = b.gx + b.w * 0.5;
                    const cy = b.gy + b.h * 0.5;
                    const dist = Math.hypot(cx - this.x, cy - this.y);
                    if (dist <= closestDist + 2.0) {
                        closestDist = dist;
                        bestTarget = b;
                    }
                }
            }
        }

        if (bestTarget) {
            this.attackTarget(bestTarget, game);
        }
    }

    performAttack(target, game) {
        if (this.type === 'archer') {
            Sound.playBowTwang();
            game.spawnProjectile('arrow', this.x, this.y, target, this.atk);
        } else if (this.type === 'catapult') {
            Sound.playBuild();
            game.spawnProjectile('boulder', this.x, this.y, target, this.atk);
        } else if (this.type === 'dragon') {
            Sound.playDragonRoar();
            game.spawnProjectile('fire', this.x, this.y, target, this.atk);
        } else {
            // Melee Strike
            Sound.playSwordClash();
            const killed = target.takeDamage(this.atk);
            const targetX = target.x !== undefined ? target.x : target.gx + 0.5;
            const targetY = target.y !== undefined ? target.y : target.gy + 0.5;
            game.spawnFloatingText(`-${this.atk}`, targetX, targetY, this.isEnemy ? '#ef4444' : '#f59e0b');

            // Vampire Lifesteal mechanic
            if (this.isLifesteal && this.hp < this.maxHp) {
                const healAmt = Math.round(this.atk * 0.35);
                this.hp = Math.min(this.maxHp, this.hp + healAmt);
                game.spawnFloatingText(`+${healAmt} HP`, this.x, this.y, '#dc2626');
            }

            if (killed) {
                if (target instanceof Building) {
                    game.handleBuildingDestruction(target);
                }
                this.targetEntity = null;
                this.state = 'idle';
            }
        }
    }

    takeDamage(amt) {
        this.hp = Math.max(0, this.hp - amt);
        return this.hp <= 0;
    }
}

class Projectile {
    constructor(type, startX, startY, target, damage) {
        this.type = type;
        this.x = startX;
        this.y = startY;
        this.target = target;
        this.damage = damage;
        this.progress = 0;
        this.speed = type === 'arrow' ? 5.5 : type === 'fire' ? 3.8 : 3.0;

        this.startX = startX;
        this.startY = startY;
        this.endX = target.x !== undefined ? target.x : target.gx + (target.w || 1) * 0.5;
        this.endY = target.y !== undefined ? target.y : target.gy + (target.h || 1) * 0.5;

        const dx = this.endX - startX;
        const dy = this.endY - startY;
        this.totalDist = Math.max(0.1, Math.hypot(dx, dy));
        this.arcHeight = 0;
    }

    update(dt, game) {
        this.progress += (this.speed * dt) / this.totalDist;
        this.x = this.startX + (this.endX - this.startX) * this.progress;
        this.y = this.startY + (this.endY - this.startY) * this.progress;

        // Parabolic height calculation
        this.arcHeight = Math.sin(this.progress * Math.PI) * (this.type === 'boulder' ? 42 : this.type === 'fire' ? 24 : 14);

        if (this.progress >= 1.0) {
            // Impact!
            if (this.target && this.target.hp > 0) {
                const killed = this.target.takeDamage(this.damage);
                game.spawnFloatingText(`-${this.damage}`, this.endX, this.endY, this.type === 'fire' ? '#ef4444' : '#f97316');

                if (killed && this.target instanceof Building) {
                    game.handleBuildingDestruction(this.target);
                }
            }

            // AoE Splash Damage for Catapults and Dragon Fire
            if (this.type === 'boulder') {
                Sound.playShatter();
                game.units.forEach(u => {
                    if (u !== this.target && Math.hypot(u.x - this.endX, u.y - this.endY) <= 1.8) {
                        const splashDmg = Math.round(this.damage * 0.45);
                        u.takeDamage(splashDmg);
                        game.spawnFloatingText(`-${splashDmg}`, u.x, u.y, '#ea580c');
                    }
                });
            } else if (this.type === 'fire') {
                game.units.forEach(u => {
                    if (u !== this.target && Math.hypot(u.x - this.endX, u.y - this.endY) <= 2.2) {
                        const splashDmg = Math.round(this.damage * 0.4);
                        u.takeDamage(splashDmg);
                        game.spawnFloatingText(`-${splashDmg}`, u.x, u.y, '#ef4444');
                    }
                });
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
}
