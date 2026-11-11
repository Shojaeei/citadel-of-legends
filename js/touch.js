/* ==========================================================================
   Citadel of Legends: Shattered Realms - Mobile / Tablet Touch Controls
   --------------------------------------------------------------------------
   Gestures on the game canvas:
     * 1-finger tap          -> primary action (select / build)  [= left click]
     * 1-finger long-press   -> command (move / attack)          [= right click]
     * 1-finger drag         -> pan camera
     * 2-finger pinch        -> zoom around the gesture midpoint
     * 2-finger drag         -> pan camera
   Plus an on-screen virtual joystick for continuous panning, shown on
   coarse-pointer devices only.
   ========================================================================== */

const TOUCH_TAP_MAX_MOVE = 10;      // px
const TOUCH_LONG_PRESS_MS = 520;

/** Pure gesture math (unit-tested). */
function computePinch(prev, curr) {
    const dist = (t) => Math.hypot(t[0].x - t[1].x, t[0].y - t[1].y);
    const mid = (t) => ({ x: (t[0].x + t[1].x) / 2, y: (t[0].y + t[1].y) / 2 });
    const d0 = Math.max(1, dist(prev));
    const d1 = Math.max(1, dist(curr));
    const m0 = mid(prev);
    const m1 = mid(curr);
    return { scale: d1 / d0, dx: m1.x - m0.x, dy: m1.y - m0.y, midX: m1.x, midY: m1.y };
}

/** Joystick knob offset -> normalized pan vector with a dead zone. */
function joystickVector(dx, dy, radius, deadZone = 0.15) {
    const len = Math.hypot(dx, dy);
    if (len === 0) return { x: 0, y: 0 };
    const clamped = Math.min(len, radius);
    const mag = clamped / radius;
    if (mag < deadZone) return { x: 0, y: 0 };
    const scaled = (mag - deadZone) / (1 - deadZone);
    return { x: (dx / len) * scaled, y: (dy / len) * scaled };
}

class TouchController {
    constructor(game, canvas) {
        this.game = game;
        this.canvas = canvas;
        this.touches = [];
        this.mode = 'none'; // 'none' | 'single' | 'pinch'
        this.startPos = null;
        this.moved = false;
        this.longPressTimer = null;
        this.longPressFired = false;
        this.joystick = { active: false, vx: 0, vy: 0 };
        if (canvas && canvas.addEventListener) this.attach();
    }

    static isTouchDevice() {
        if (typeof window === 'undefined') return false;
        try {
            return ('ontouchstart' in window) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        } catch (e) {
            return false;
        }
    }

    _pt(t) {
        const rect = this.canvas.getBoundingClientRect();
        return { x: t.clientX - rect.left, y: t.clientY - rect.top, id: t.identifier };
    }

    attach() {
        const c = this.canvas;
        c.addEventListener('touchstart', (e) => this.onStart(e), { passive: false });
        c.addEventListener('touchmove', (e) => this.onMove(e), { passive: false });
        c.addEventListener('touchend', (e) => this.onEnd(e), { passive: false });
        c.addEventListener('touchcancel', (e) => this.onEnd(e), { passive: false });
        this.attachJoystick();
    }

    clearLongPress() {
        if (this.longPressTimer) clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
    }

    onStart(e) {
        e.preventDefault();
        const pts = Array.from(e.touches).map(t => this._pt(t));
        this.touches = pts;
        if (pts.length === 1) {
            this.mode = 'single';
            this.startPos = { ...pts[0] };
            this.moved = false;
            this.longPressFired = false;
            this.clearLongPress();
            this.longPressTimer = setTimeout(() => {
                if (!this.moved && this.mode === 'single') {
                    this.longPressFired = true;
                    this.game.handleCommandAction(this.startPos.x, this.startPos.y);
                    if (navigator.vibrate) {
                        try { navigator.vibrate(15); } catch (err) { /* unsupported */ }
                    }
                }
            }, TOUCH_LONG_PRESS_MS);
        } else if (pts.length >= 2) {
            this.mode = 'pinch';
            this.clearLongPress();
        }
    }

    onMove(e) {
        e.preventDefault();
        const pts = Array.from(e.touches).map(t => this._pt(t));
        if (this.mode === 'single' && pts.length === 1) {
            const p = pts[0];
            const prev = this.touches[0] || p;
            if (Math.hypot(p.x - this.startPos.x, p.y - this.startPos.y) > TOUCH_TAP_MAX_MOVE) {
                this.moved = true;
                this.clearLongPress();
            }
            if (this.moved) this.game.panBy(p.x - prev.x, p.y - prev.y);
            if (this.game.renderer) this.game.renderer.hoverTile = this.game.renderer.screenToWorld(p.x, p.y);
        } else if (pts.length >= 2 && this.touches.length >= 2) {
            this.mode = 'pinch';
            const g = computePinch(this.touches.slice(0, 2), pts.slice(0, 2));
            this.game.panBy(g.dx, g.dy);
            this.game.zoomAt(g.midX, g.midY, g.scale);
        }
        this.touches = pts;
    }

    onEnd(e) {
        e.preventDefault();
        const remaining = Array.from(e.touches).map(t => this._pt(t));
        if (this.mode === 'single' && remaining.length === 0) {
            this.clearLongPress();
            if (!this.moved && !this.longPressFired && this.startPos) {
                this.game.handlePrimaryAction(this.startPos.x, this.startPos.y);
            }
            this.mode = 'none';
        } else if (remaining.length === 0) {
            this.mode = 'none';
        }
        this.touches = remaining;
    }

    attachJoystick() {
        if (typeof document === 'undefined') return;
        const base = document.getElementById('touch-joystick');
        const knob = document.getElementById('touch-joystick-knob');
        if (!base || !knob || !base.addEventListener) return;
        if (TouchController.isTouchDevice()) base.classList.remove('hidden');
        const radius = 40;
        let originX = 0;
        let originY = 0;
        const move = (t) => {
            const dx = t.clientX - originX;
            const dy = t.clientY - originY;
            const len = Math.hypot(dx, dy) || 1;
            const k = Math.min(len, radius) / len;
            knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
            const v = joystickVector(dx, dy, radius);
            this.joystick.vx = v.x;
            this.joystick.vy = v.y;
        };
        base.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const rect = base.getBoundingClientRect();
            originX = rect.left + rect.width / 2;
            originY = rect.top + rect.height / 2;
            this.joystick.active = true;
            move(e.touches[0]);
        }, { passive: false });
        base.addEventListener('touchmove', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.touches[0]) move(e.touches[0]);
        }, { passive: false });
        const end = (e) => {
            e.preventDefault();
            this.joystick = { active: false, vx: 0, vy: 0 };
            knob.style.transform = 'translate(0px, 0px)';
        };
        base.addEventListener('touchend', end, { passive: false });
        base.addEventListener('touchcancel', end, { passive: false });
    }

    /** Called from the render loop with real (unscaled) frame time. */
    update(realDt) {
        if (!this.joystick.active) return;
        const speed = 650; // px per second at full deflection
        this.game.panBy(-this.joystick.vx * speed * realDt, -this.joystick.vy * speed * realDt);
    }
}

if (typeof globalThis !== 'undefined') {
    globalThis.TouchController = TouchController;
    globalThis.computePinch = computePinch;
    globalThis.joystickVector = joystickVector;
}
