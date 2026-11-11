/* ==========================================================================
   Citadel of Legends: Shattered Realms - Settings & Accessibility
   --------------------------------------------------------------------------
   Persisted (localStorage) player preferences: mixer volumes, high-contrast
   entity outlines, weather FX toggle, reduced motion, and rebindable keys.
   Storage is injectable for tests and every access is exception-safe so the
   game still runs in sandboxed iframes (common on web portals).
   ========================================================================== */

const SETTINGS_STORAGE_KEY = 'citadel.settings.v1';

const DEFAULT_KEYBINDS = {
    panUp: 'w',
    panDown: 's',
    panLeft: 'a',
    panRight: 'd',
    centerKeep: ' ',
    tabBuilding: '1',
    tabMilitary: '2',
    tabDefenses: '3',
    tabMythic: '4',
    pause: 'p',
    speedUp: ']',
    speedDown: '[',
    selectArmy: 'q',
    boilingPitch: 'f',
    quickSave: 'k',
    quickLoad: 'l',
    toggleMinimap: 'm'
};

const KEYBIND_LABELS = {
    panUp: 'Pan camera up',
    panDown: 'Pan camera down',
    panLeft: 'Pan camera left',
    panRight: 'Pan camera right',
    centerKeep: 'Center on Keep',
    tabBuilding: 'Buildings tab',
    tabMilitary: 'Military tab',
    tabDefenses: 'Walls & Towers tab',
    tabMythic: 'Mythic tab',
    pause: 'Pause / resume',
    speedUp: 'Increase game speed',
    speedDown: 'Decrease game speed',
    selectArmy: 'Select all military',
    boilingPitch: 'Pour boiling pitch',
    quickSave: 'Quick save (slot 1)',
    quickLoad: 'Quick load (slot 1)',
    toggleMinimap: 'Toggle minimap'
};

/** Keys that cannot be bound (reserved by the browser / console / menus). */
const RESERVED_KEYS = new Set(['escape', '`', '~', 'f5', 'f11', 'f12', 'tab', 'enter']);

const GAME_SPEEDS = [0, 1, 2, 5];

function safeStorage() {
    try {
        if (typeof localStorage !== 'undefined') {
            const k = '__citadel_probe__';
            localStorage.setItem(k, '1');
            localStorage.removeItem(k);
            return localStorage;
        }
    } catch (e) { /* blocked */ }
    return null;
}

class SettingsManager {
    constructor(storage = safeStorage()) {
        this.storage = storage;
        this.data = SettingsManager.defaults();
        this.load();
    }

    static defaults() {
        return {
            volumes: { master: 0.8, sfx: 0.9, music: 0.6 },
            audioEnabled: true,
            highContrast: false,
            weather: true,
            reducedMotion: false,
            showMinimap: true,
            keybinds: { ...DEFAULT_KEYBINDS }
        };
    }

    static normalizeKey(key) {
        if (typeof key !== 'string' || key.length === 0 || key.length > 12) return null;
        return key.length === 1 ? key.toLowerCase() : key.toLowerCase();
    }

    load() {
        if (!this.storage) return this.data;
        try {
            const raw = this.storage.getItem(SETTINGS_STORAGE_KEY);
            if (!raw || raw.length > 10000) return this.data;
            const parsed = JSON.parse(raw);
            this.merge(parsed);
        } catch (e) {
            this.data = SettingsManager.defaults();
        }
        return this.data;
    }

    merge(parsed) {
        if (!parsed || typeof parsed !== 'object') return;
        const d = this.data;
        if (parsed.volumes && typeof parsed.volumes === 'object') {
            for (const k of Object.keys(d.volumes)) {
                const v = Number(parsed.volumes[k]);
                if (Number.isFinite(v)) d.volumes[k] = Math.max(0, Math.min(1, v));
            }
        }
        for (const flag of ['audioEnabled', 'highContrast', 'weather', 'reducedMotion', 'showMinimap']) {
            if (typeof parsed[flag] === 'boolean') d[flag] = parsed[flag];
        }
        if (parsed.keybinds && typeof parsed.keybinds === 'object') {
            for (const action of Object.keys(DEFAULT_KEYBINDS)) {
                const key = SettingsManager.normalizeKey(parsed.keybinds[action]);
                if (key && !RESERVED_KEYS.has(key)) d.keybinds[action] = key;
            }
        }
    }

    save() {
        if (!this.storage) return false;
        try {
            this.storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.data));
            return true;
        } catch (e) {
            return false;
        }
    }

    get(key) {
        return this.data[key];
    }

    set(key, value) {
        if (!(key in this.data) || key === 'keybinds' || key === 'volumes') return false;
        if (typeof value !== typeof this.data[key]) return false;
        this.data[key] = value;
        this.save();
        return true;
    }

    setVolume(bus, value) {
        if (!(bus in this.data.volumes)) return false;
        const v = Number(value);
        if (!Number.isFinite(v)) return false;
        this.data.volumes[bus] = Math.max(0, Math.min(1, v));
        this.save();
        return true;
    }

    /**
     * Rebind an action. If the key is already bound to another action the two
     * bindings are swapped so no action is ever left unbound.
     * @returns {{ok:boolean, reason?:string, swappedWith?:string}}
     */
    rebind(action, key) {
        if (!(action in DEFAULT_KEYBINDS)) return { ok: false, reason: 'unknown action' };
        const k = SettingsManager.normalizeKey(key);
        if (!k) return { ok: false, reason: 'invalid key' };
        if (RESERVED_KEYS.has(k)) return { ok: false, reason: 'reserved key' };
        const binds = this.data.keybinds;
        const prev = binds[action];
        const clash = Object.keys(binds).find(a => a !== action && binds[a] === k);
        binds[action] = k;
        if (clash) binds[clash] = prev;
        this.save();
        return clash ? { ok: true, swappedWith: clash } : { ok: true };
    }

    resetKeybinds() {
        this.data.keybinds = { ...DEFAULT_KEYBINDS };
        this.save();
    }

    /** Map a KeyboardEvent.key to a bound action (or null). */
    actionForKey(key) {
        const k = SettingsManager.normalizeKey(key);
        if (!k) return null;
        const binds = this.data.keybinds;
        for (const action of Object.keys(binds)) {
            if (binds[action] === k) return action;
        }
        return null;
    }

    static displayKey(key) {
        if (key === ' ') return 'Space';
        if (!key) return '—';
        return key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1);
    }
}

if (typeof globalThis !== 'undefined') {
    globalThis.SettingsManager = SettingsManager;
    globalThis.DEFAULT_KEYBINDS = DEFAULT_KEYBINDS;
    globalThis.KEYBIND_LABELS = KEYBIND_LABELS;
    globalThis.RESERVED_KEYS = RESERVED_KEYS;
    globalThis.GAME_SPEEDS = GAME_SPEEDS;
    globalThis.SETTINGS_STORAGE_KEY = SETTINGS_STORAGE_KEY;
    globalThis.safeStorage = safeStorage;
}
