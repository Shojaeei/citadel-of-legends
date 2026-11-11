/* ==========================================================================
   Citadel of Legends: Shattered Realms - Monetization & Portal SDK Adapter
   --------------------------------------------------------------------------
   Design goals (player goodwill first):
     * No ads at all unless the build is running on an ad-funded portal.
     * Rewarded ads are always opt-in ("Royal Respite" -> +150 stone).
     * Interstitials only at natural breaks (mission transitions), capped to
       one per INTERSTITIAL_MIN_GAP seconds, never during combat.
     * Third-party SDK scripts are only injected after the portal is
       detected AND (for self-hosted builds) the player has consented.
     * Game audio is muted while any ad plays (portal requirement).

   Portal SDK APIs below match the publicly documented interfaces of each
   portal at the time of writing (CrazyGames SDK v3, Poki SDK v2,
   GameDistribution HTML5 SDK). Verify against each portal's current docs
   before submission - see docs/LAUNCH_CHECKLIST.md.
   ========================================================================== */

/** Single place to configure business links. Replace placeholders before launch. */
const BUSINESS_CONFIG = {
    supporterUrl: 'https://citadel-of-legends.itch.io/citadel-of-legends/purchase',
    wishlistUrl: 'https://citadel-of-legends.itch.io/citadel-of-legends',
    discordUrl: 'https://discord.gg/REPLACE_ME',
    privacyUrl: 'docs/PRIVACY.md',
    termsUrl: 'docs/TERMS.md',
    gameDistributionId: '',
    // SHA-256 hex digests of valid Royal Supporter codes (never ship plaintext
    // codes). Generate with: node scripts/generate_supporter_codes.js
    supporterCodeHashes: [
        // Demo code "AVALON-DEMO-0000" for QA; remove before launch.
        '855725f933f7a1905a485c28d9e14da89fb20fadfb7a506bdb8c580a9bbeb0d9'
    ]
};

const RESPITE_REWARD = { stone: 150 };
const RESPITE_COOLDOWN = 300;          // seconds of game time between rewarded ads
const INTERSTITIAL_MIN_GAP = 180;      // seconds (wall clock) between interstitials
const CONSENT_KEY = 'citadel.consent.v1';
const SUPPORTER_KEY = 'citadel.supporter.v1';

const PORTAL_SDK_URLS = {
    crazygames: 'https://sdk.crazygames.com/crazygames-sdk-v3.js',
    poki: 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js',
    gamedistribution: 'https://html5.api.gamedistribution.com/main.min.js'
};

/** Determine the distribution portal from config, URL param or host. */
function detectPortal(loc = (typeof location !== 'undefined' ? location : null), override = (typeof window !== 'undefined' ? window.CITADEL_PORTAL : undefined)) {
    const valid = ['none', 'itch', 'crazygames', 'poki', 'gamedistribution', 'desktop'];
    if (typeof override === 'string' && valid.includes(override)) return override;
    if (!loc) return 'none';
    try {
        const params = new URLSearchParams(loc.search || '');
        const p = params.get('portal');
        if (p && valid.includes(p)) return p;
        const host = String(loc.hostname || '');
        if (/(^|\.)crazygames\.com$/.test(host)) return 'crazygames';
        if (/(^|\.)poki(-gdn)?\.com$/.test(host)) return 'poki';
        if (/(^|\.)itch\.(io|zone)$/.test(host) || /(^|\.)hwcdn\.net$/.test(host)) return 'itch';
        if (/(^|\.)gamedistribution\.com$/.test(host)) return 'gamedistribution';
    } catch (e) { /* malformed URL */ }
    return 'none';
}

async function sha256Hex(text) {
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    if (typeof require === 'function') {
        return require('crypto').createHash('sha256').update(text).digest('hex');
    }
    throw new Error('No SHA-256 implementation available');
}

function normalizeSupporterCode(code) {
    return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

// ---------------------------------------------------------------------------
// Adapters. Each exposes: init(), gameplayStart(), gameplayStop(),
// interstitial() -> Promise<void>, rewarded() -> Promise<boolean>, hasAds.
// ---------------------------------------------------------------------------
class NoAdsAdapter {
    constructor(name = 'none') {
        this.name = name;
        this.hasAds = false;
    }
    async init() { return true; }
    gameplayStart() {}
    gameplayStop() {}
    async interstitial() {}
    async rewarded() { return false; }
}

class CrazyGamesAdapter {
    constructor() {
        this.name = 'crazygames';
        this.hasAds = true;
        this.sdk = null;
    }
    async init() {
        await loadScript(PORTAL_SDK_URLS.crazygames);
        this.sdk = window.CrazyGames && window.CrazyGames.SDK;
        if (this.sdk && this.sdk.init) await this.sdk.init();
        return !!this.sdk;
    }
    gameplayStart() { try { this.sdk && this.sdk.game.gameplayStart(); } catch (e) {} }
    gameplayStop() { try { this.sdk && this.sdk.game.gameplayStop(); } catch (e) {} }
    _request(type) {
        return new Promise((resolve) => {
            if (!this.sdk) return resolve(false);
            this.sdk.ad.requestAd(type, {
                adStarted: () => Monetization.onAdStart(),
                adFinished: () => { Monetization.onAdEnd(); resolve(true); },
                adError: () => { Monetization.onAdEnd(); resolve(false); }
            });
        });
    }
    async interstitial() { await this._request('midgame'); }
    rewarded() { return this._request('rewarded'); }
}

class PokiAdapter {
    constructor() {
        this.name = 'poki';
        this.hasAds = true;
        this.sdk = null;
    }
    async init() {
        await loadScript(PORTAL_SDK_URLS.poki);
        this.sdk = window.PokiSDK || null;
        if (this.sdk) {
            await this.sdk.init();
            this.sdk.gameLoadingFinished();
        }
        return !!this.sdk;
    }
    gameplayStart() { try { this.sdk && this.sdk.gameplayStart(); } catch (e) {} }
    gameplayStop() { try { this.sdk && this.sdk.gameplayStop(); } catch (e) {} }
    async interstitial() {
        if (!this.sdk) return;
        Monetization.onAdStart();
        try { await this.sdk.commercialBreak(); } finally { Monetization.onAdEnd(); }
    }
    async rewarded() {
        if (!this.sdk) return false;
        Monetization.onAdStart();
        try { return !!(await this.sdk.rewardedBreak()); } finally { Monetization.onAdEnd(); }
    }
}

class GameDistributionAdapter {
    constructor(gameId) {
        this.name = 'gamedistribution';
        this.hasAds = true;
        this.gameId = gameId;
        this._rewardGranted = false;
    }
    async init() {
        if (!this.gameId) return false;
        window.GD_OPTIONS = {
            gameId: this.gameId,
            onEvent: (event) => {
                if (event.name === 'SDK_GAME_PAUSE') Monetization.onAdStart();
                if (event.name === 'SDK_GAME_START') Monetization.onAdEnd();
                if (event.name === 'SDK_REWARDED_WATCH_COMPLETE') this._rewardGranted = true;
            }
        };
        await loadScript(PORTAL_SDK_URLS.gamedistribution);
        return typeof window.gdsdk !== 'undefined';
    }
    gameplayStart() {}
    gameplayStop() {}
    async interstitial() {
        if (window.gdsdk) { try { await window.gdsdk.showAd(); } catch (e) {} }
    }
    async rewarded() {
        if (!window.gdsdk) return false;
        this._rewardGranted = false;
        try { await window.gdsdk.showAd('rewarded'); } catch (e) { return false; }
        return this._rewardGranted;
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (typeof document === 'undefined') return reject(new Error('no DOM'));
        if (document.querySelector && document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
    });
}

function createAdapter(portal) {
    switch (portal) {
        case 'crazygames': return new CrazyGamesAdapter();
        case 'poki': return new PokiAdapter();
        case 'gamedistribution': return new GameDistributionAdapter(BUSINESS_CONFIG.gameDistributionId);
        default: return new NoAdsAdapter(portal);
    }
}

// ---------------------------------------------------------------------------
// Facade used by the game
// ---------------------------------------------------------------------------
const Monetization = {
    portal: 'none',
    adapter: new NoAdsAdapter(),
    ready: false,
    adPlaying: false,
    lastInterstitialAt: -Infinity,
    respiteCooldown: 0,
    respitesUsed: 0,
    game: null,
    storage: null,
    supporter: false,
    clock: () => (typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000),

    async init(game, { portal = detectPortal(), storage = (typeof safeStorage === 'function' ? safeStorage() : null) } = {}) {
        this.game = game;
        this.portal = portal;
        this.storage = storage;
        this.supporter = this._readSupporter();
        this.adapter = createAdapter(portal);
        // Portal-hosted builds: the portal's own CMP handles consent.
        // Self-hosted builds have no ads, so nothing third-party ever loads.
        if (this.adapter.hasAds) {
            try {
                this.ready = await this.adapter.init();
            } catch (e) {
                this.adapter = new NoAdsAdapter(portal);
                this.ready = false;
            }
        } else {
            this.ready = true;
        }
        return this.ready;
    },

    get rewardedAvailable() {
        return this.adapter.hasAds && this.ready && this.respiteCooldown <= 0 && !this.adPlaying;
    },

    update(dt) {
        if (this.respiteCooldown > 0) this.respiteCooldown = Math.max(0, this.respiteCooldown - dt);
    },

    onAdStart() {
        this.adPlaying = true;
        if (typeof Sound !== 'undefined' && Sound.muteForAd) Sound.muteForAd(true);
        if (this.game && this.game.setAdPause) this.game.setAdPause(true);
    },

    onAdEnd() {
        this.adPlaying = false;
        if (typeof Sound !== 'undefined' && Sound.muteForAd) Sound.muteForAd(false);
        if (this.game && this.game.setAdPause) this.game.setAdPause(false);
    },

    gameplayStart() { this.adapter.gameplayStart(); },
    gameplayStop() { this.adapter.gameplayStop(); },

    /** Interstitial at natural breaks only, frequency-capped. */
    async maybeInterstitial(reason = 'transition') {
        if (!this.adapter.hasAds || !this.ready || this.supporter) return false;
        const now = this.clock();
        if (now - this.lastInterstitialAt < INTERSTITIAL_MIN_GAP) return false;
        this.lastInterstitialAt = now;
        try { await this.adapter.interstitial(reason); } catch (e) { /* ad failure must never block play */ }
        return true;
    },

    /** Opt-in rewarded ad: "Royal Respite" grants emergency stone. */
    async requestRoyalRespite() {
        if (!this.rewardedAvailable) return { ok: false, reason: this.adapter.hasAds ? 'cooldown' : 'unavailable' };
        let granted = false;
        try { granted = await this.adapter.rewarded(); } catch (e) { granted = false; }
        if (!granted) return { ok: false, reason: 'not completed' };
        this.grantRespite();
        return { ok: true };
    },

    grantRespite() {
        if (!this.game || !this.game.economy) return false;
        for (const [k, v] of Object.entries(RESPITE_REWARD)) this.game.economy.res[k] += v;
        this.respiteCooldown = RESPITE_COOLDOWN;
        this.respitesUsed++;
        if (this.game.showToast) this.game.showToast(`Royal Respite granted: +${RESPITE_REWARD.stone} emergency stone!`);
        if (this.game.updateUI) this.game.updateUI();
        return true;
    },

    // ---- Consent (self-hosted builds; portals use their own CMP) ----
    getConsent() {
        if (!this.storage) return null;
        try {
            const raw = this.storage.getItem(CONSENT_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    },

    setConsent(choice) {
        const record = { essential: true, ads: choice === 'accept', at: new Date().toISOString(), version: 1 };
        if (this.storage) {
            try { this.storage.setItem(CONSENT_KEY, JSON.stringify(record)); } catch (e) {}
        }
        return record;
    },

    // ---- Royal Supporter Edition ----
    _readSupporter() {
        if (!this.storage) return false;
        try { return this.storage.getItem(SUPPORTER_KEY) === 'true'; } catch (e) { return false; }
    },

    async redeemSupporterCode(code) {
        const normalized = normalizeSupporterCode(code);
        if (!/^[A-Z0-9-]{8,40}$/.test(normalized)) return { ok: false, reason: 'Invalid code format' };
        const digest = await sha256Hex(normalized);
        if (!BUSINESS_CONFIG.supporterCodeHashes.includes(digest)) return { ok: false, reason: 'Code not recognised' };
        this.supporter = true;
        if (this.storage) {
            try { this.storage.setItem(SUPPORTER_KEY, 'true'); } catch (e) {}
        }
        return { ok: true };
    },

    openSupporterPage() {
        if (typeof window !== 'undefined' && window.open) {
            window.open(BUSINESS_CONFIG.supporterUrl, '_blank', 'noopener,noreferrer');
        }
    }
};

/** Developer commentary lines (Royal Supporter perk), keyed by game event. */
const DEV_COMMENTARY = {
    missionStart: 'Dev note: every mission is pure data in js/config.js - objectives are evaluated by a tiny rule engine in js/campaign.js.',
    firstBuild: 'Dev note: buildings are isometric prisms drawn from three polygons; no sprite sheets anywhere in the game.',
    firstWave: 'Dev note: waves now spawn through a timed queue instead of setTimeout, so pausing and saving mid-wave is safe.',
    dragon: 'Dev note: dragons ignore the A* passability grid and fly straight lines - their breath leaves burning patches.',
    fog: 'Dev note: fog of war recomputes 4x per second and is box-blurred for the soft shroud edge.',
    pitch: 'Dev note: boiling pitch was the first "active defense" we prototyped - it single-handedly made walls matter.',
    victory: 'Dev note: thank you for supporting an independent studio. Your banner flies gold because of you.'
};

if (typeof globalThis !== 'undefined') {
    globalThis.Monetization = Monetization;
    globalThis.BUSINESS_CONFIG = BUSINESS_CONFIG;
    globalThis.detectPortal = detectPortal;
    globalThis.sha256Hex = sha256Hex;
    globalThis.normalizeSupporterCode = normalizeSupporterCode;
    globalThis.NoAdsAdapter = NoAdsAdapter;
    globalThis.createAdapter = createAdapter;
    globalThis.RESPITE_REWARD = RESPITE_REWARD;
    globalThis.RESPITE_COOLDOWN = RESPITE_COOLDOWN;
    globalThis.INTERSTITIAL_MIN_GAP = INTERSTITIAL_MIN_GAP;
    globalThis.DEV_COMMENTARY = DEV_COMMENTARY;
}
