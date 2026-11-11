/* ==========================================================================
   Citadel of Legends: Shattered Realms - Particle FX & Biome Weather
   --------------------------------------------------------------------------
   Pooled, allocation-light particle system:
     * Weather (screen space): golden motes (Solaris/valley), snow flurries
       (Frost/tundra), cinder embers & ash (Obsidian/wasteland).
     * Combat (world space): sword sparks, blood splatter, rubble dust on
       structure collapse, lingering flame patches after dragon breath.
   Hard caps keep the worst case bounded on low-end mobile devices.
   ========================================================================== */

const WEATHER_PROFILES = {
    valley: { kind: 'motes', count: 45, colors: ['#fde68a', '#fcd34d', '#fef3c7'], vy: [-6, -14], vx: [-6, 6], size: [1.2, 2.6] },
    tundra: { kind: 'snow', count: 120, colors: ['#ffffff', '#e0f2fe', '#f1f5f9'], vy: [22, 48], vx: [-14, 4], size: [1.2, 3.0] },
    wasteland: { kind: 'ash', count: 80, colors: ['#f97316', '#fb923c', '#78716c', '#a8a29e'], vy: [-18, -6], vx: [-10, 10], size: [1.0, 2.4] }
};

const MAX_COMBAT_PARTICLES = 500;
const MAX_FLAME_PATCHES = 24;

function rand(min, max) {
    return min + Math.random() * (max - min);
}

class FxSystem {
    constructor() {
        this.weather = [];
        this.combat = [];
        this.flames = [];
        this.weatherEnabled = true;
        this.biome = 'valley';
        this.viewW = 1280;
        this.viewH = 720;
        this.quality = 1.0; // scaled down automatically if FPS drops
    }

    setBiome(biome, viewW = this.viewW, viewH = this.viewH) {
        this.biome = WEATHER_PROFILES[biome] ? biome : 'valley';
        this.viewW = viewW;
        this.viewH = viewH;
        this.weather = [];
        const prof = WEATHER_PROFILES[this.biome];
        const count = Math.round(prof.count * this.quality);
        for (let i = 0; i < count; i++) this.weather.push(this._spawnWeather(prof, true));
    }

    clearCombat() {
        this.combat = [];
        this.flames = [];
    }

    _spawnWeather(prof, anywhere) {
        const p = {
            x: rand(0, this.viewW),
            y: anywhere ? rand(0, this.viewH) : (prof.vy[0] > 0 ? -5 : this.viewH + 5),
            vx: rand(prof.vx[0], prof.vx[1]),
            vy: rand(prof.vy[0], prof.vy[1]),
            size: rand(prof.size[0], prof.size[1]),
            color: prof.colors[Math.floor(Math.random() * prof.colors.length)],
            phase: Math.random() * Math.PI * 2,
            alpha: rand(0.35, 0.9)
        };
        return p;
    }

    resize(viewW, viewH) {
        if (viewW === this.viewW && viewH === this.viewH) return;
        this.viewW = viewW;
        this.viewH = viewH;
    }

    // ---- Combat emitters (world-space coordinates in grid tiles) ----
    _push(p) {
        if (this.combat.length >= MAX_COMBAT_PARTICLES) this.combat.shift();
        this.combat.push(p);
    }

    emitSparks(x, y, n = 6) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = rand(1.2, 3.2);
            this._push({ kind: 'spark', x, y, z: rand(8, 16), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rand(20, 60), life: rand(0.2, 0.45), maxLife: 0.45, color: Math.random() < 0.5 ? '#fde047' : '#fb923c', size: 1.6 });
        }
    }

    emitBlood(x, y, n = 8) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = rand(0.4, 1.6);
            this._push({ kind: 'blood', x, y, z: rand(4, 10), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rand(10, 35), life: rand(0.4, 0.8), maxLife: 0.8, color: Math.random() < 0.5 ? '#991b1b' : '#7f1d1d', size: rand(1.5, 2.8) });
        }
    }

    emitRubble(x, y, n = 26) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = rand(0.3, 1.4);
            this._push({ kind: 'dust', x: x + rand(-0.6, 0.6), y: y + rand(-0.6, 0.6), z: rand(0, 30), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rand(5, 25), life: rand(0.9, 1.8), maxLife: 1.8, color: Math.random() < 0.5 ? '#a8a29e' : '#78716c', size: rand(3, 7) });
        }
    }

    emitFlamePatch(x, y, owner = null) {
        if (this.flames.length >= MAX_FLAME_PATCHES) this.flames.shift();
        this.flames.push({ x, y, life: 4.0, maxLife: 4.0, radius: 1.1, tick: 0, ownerIsEnemy: owner ? !!owner.isEnemy : null });
    }

    /**
     * @param {number} dt - simulation delta (seconds)
     * @param {object} [game] - when provided, flame patches deal light burn damage
     */
    update(dt, game = null) {
        // Weather
        if (this.weatherEnabled) {
            const prof = WEATHER_PROFILES[this.biome];
            for (let i = 0; i < this.weather.length; i++) {
                const p = this.weather[i];
                p.phase += dt * 2;
                p.x += (p.vx + Math.sin(p.phase) * (prof.kind === 'snow' ? 10 : 6)) * dt;
                p.y += p.vy * dt;
                if (p.y > this.viewH + 10 || p.y < -10 || p.x < -10 || p.x > this.viewW + 10) {
                    this.weather[i] = this._spawnWeather(prof, false);
                    if (p.x < -10 || p.x > this.viewW + 10) this.weather[i].y = rand(0, this.viewH);
                }
            }
        }

        // Combat particles
        for (let i = this.combat.length - 1; i >= 0; i--) {
            const p = this.combat[i];
            p.life -= dt;
            if (p.life <= 0) {
                this.combat.splice(i, 1);
                continue;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z = Math.max(0, p.z + p.vz * dt);
            p.vz -= 120 * dt; // gravity (screen px/s^2 on the z axis)
            if (p.kind === 'dust') {
                p.vx *= 0.96;
                p.vy *= 0.96;
                p.vz = Math.max(p.vz, 4);
            }
        }

        // Flame patches
        for (let i = this.flames.length - 1; i >= 0; i--) {
            const f = this.flames[i];
            f.life -= dt;
            if (f.life <= 0) {
                this.flames.splice(i, 1);
                continue;
            }
            if (game) {
                f.tick += dt;
                if (f.tick >= 0.5) {
                    f.tick = 0;
                    const victims = queryUnitsNear(game, f.x, f.y, f.radius, u => u.hp > 0 && !u.isFlying && (f.ownerIsEnemy === null || u.isEnemy !== f.ownerIsEnemy));
                    for (const u of victims) u.takeDamage(4, null, game);
                }
            }
        }
    }

    get totalParticles() {
        return this.weather.length + this.combat.length + this.flames.length;
    }

    /** Draw world-space combat FX. Caller has applied the camera transform. */
    renderWorld(ctx, worldToScreen) {
        for (const f of this.flames) {
            const s = worldToScreen(f.x, f.y);
            const a = Math.min(1, f.life / 1.2) * 0.75;
            const flicker = 0.85 + Math.random() * 0.3;
            const grad = ctx.createRadialGradient(s.x, s.y + 16, 2, s.x, s.y + 16, 30 * flicker);
            grad.addColorStop(0, `rgba(253, 186, 116, ${a})`);
            grad.addColorStop(0.5, `rgba(234, 88, 12, ${a * 0.7})`);
            grad.addColorStop(1, 'rgba(127, 29, 29, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(s.x, s.y + 16, 30 * flicker, 15 * flicker, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        for (const p of this.combat) {
            const s = worldToScreen(p.x, p.y);
            ctx.globalAlpha = Math.max(0, Math.min(1, p.life / (p.maxLife * 0.6)));
            ctx.fillStyle = p.color;
            if (p.kind === 'dust') {
                ctx.beginPath();
                ctx.arc(s.x, s.y + 12 - p.z, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(s.x - p.size / 2, s.y + 12 - p.z - p.size / 2, p.size, p.size);
            }
        }
        ctx.globalAlpha = 1;
    }

    /** Draw screen-space weather on top of the scene. */
    renderWeather(ctx) {
        if (!this.weatherEnabled) return;
        const prof = WEATHER_PROFILES[this.biome];
        for (const p of this.weather) {
            ctx.globalAlpha = p.alpha * (prof.kind === 'motes' ? 0.6 + 0.4 * Math.sin(p.phase * 1.5) : 1);
            ctx.fillStyle = p.color;
            if (prof.kind === 'motes') {
                ctx.shadowColor = '#fde68a';
                ctx.shadowBlur = 6;
            }
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;
    }
}

if (typeof globalThis !== 'undefined') {
    globalThis.FxSystem = FxSystem;
    globalThis.WEATHER_PROFILES = WEATHER_PROFILES;
    globalThis.MAX_COMBAT_PARTICLES = MAX_COMBAT_PARTICLES;
}
