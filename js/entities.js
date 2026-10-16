/* ==========================================================================
   Citadel of Legends: Shattered Realms - Entity Definitions & Behaviors
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
    }

    containsTile(x, y) {
        return x >= this.gx && x < this.gx + this.w && y >= this.gy && y < this.gy + this.h;
    }

    takeDamage(amt) {
        this.hp = Math.max(0, this.hp - amt);
        return this.hp <= 0;
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
        this.color = def.color || '#38bdf8';

        this.state = 'idle'; // 'idle', 'moving', 'attacking'
        this.targetX = x;
        this.targetY = y;
        this.targetEntity = null;
        this.attackCooldown = 0;
        this.attackRate = 1.2; // seconds per attack
    }

    moveTo(tx, ty) {
        this.targetX = tx;
        this.targetY = ty;
        this.targetEntity = null;
        this.state = 'moving';
    }

    attackTarget(entity) {
        this.targetEntity = entity;
        this.state = 'attacking';
    }

    update(dt, game) {
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }

        // Handle Target Entity Tracking
        if (this.state === 'attacking' && this.targetEntity) {
            if (this.targetEntity.hp <= 0) {
                this.targetEntity = null;
                this.state = 'idle';
                return;
            }

            const targetX = this.targetEntity.x !== undefined ? this.targetEntity.x : this.targetEntity.gx + 0.5;
            const targetY = this.targetEntity.y !== undefined ? this.targetEntity.y : this.targetEntity.gy + 0.5;

            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= this.range) {
                // In Attack Range
                if (this.attackCooldown <= 0) {
                    this.performAttack(this.targetEntity, game);
                    this.attackCooldown = this.attackRate;
                }
            } else {
                // Move towards target
                const moveDist = this.speed * dt;
                this.x += (dx / dist) * moveDist;
                this.y += (dy / dist) * moveDist;
            }
            return;
        }

        // Handle Movement
        if (this.state === 'moving') {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 0.15) {
                this.x = this.targetX;
                this.y = this.targetY;
                this.state = 'idle';
            } else {
                const moveDist = Math.min(dist, this.speed * dt * 1.5);
                this.x += (dx / dist) * moveDist;
                this.y += (dy / dist) * moveDist;
            }
        } else if (this.state === 'idle' && this.type === 'peasant') {
            // Gentle wandering for peasants around Keep
            if (Math.random() < 0.02) {
                this.x += (Math.random() - 0.5) * 0.15;
                this.y += (Math.random() - 0.5) * 0.15;
            }
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
            // Melee Attack
            Sound.playSwordClash();
            const killed = target.takeDamage(this.atk);
            game.spawnFloatingText(`-${this.atk}`, target.x || target.gx, target.y || target.gy, '#ef4444');
            if (killed) {
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
        this.speed = type === 'arrow' ? 4.5 : type === 'fire' ? 3.0 : 2.5;

        this.startX = startX;
        this.startY = startY;
        this.endX = target.x !== undefined ? target.x : target.gx + 0.5;
        this.endY = target.y !== undefined ? target.y : target.gy + 0.5;

        const dx = this.endX - startX;
        const dy = this.endY - startY;
        this.totalDist = Math.max(0.1, Math.sqrt(dx * dx + dy * dy));
    }

    update(dt, game) {
        this.progress += (this.speed * dt) / this.totalDist;
        this.x = this.startX + (this.endX - this.startX) * this.progress;
        this.y = this.startY + (this.endY - this.startY) * this.progress;

        if (this.progress >= 1.0) {
            // Impact!
            if (this.target && this.target.hp > 0) {
                this.target.takeDamage(this.damage);
                game.spawnFloatingText(`-${this.damage}`, this.endX, this.endY, '#f97316');
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
