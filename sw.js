/* ==========================================================================
   Citadel of Legends: Shattered Realms - Service Worker (offline play)
   --------------------------------------------------------------------------
   Strategy:
     * Precache the full game shell on install (100% offline gameplay).
     * Cache-first for same-origin GET requests; network fallback with
       runtime caching for anything not precached.
     * Navigations fall back to the cached index.html when offline.
     * Cross-origin requests (portal ad SDKs) are never cached or intercepted.
   Bump CACHE_VERSION on every release (scripts/build_web_release.js does
   this automatically from package.json) so clients pick up new assets.
   ========================================================================== */

const CACHE_VERSION = 'citadel-v1.0.0';

const PRECACHE = [
    './',
    './index.html',
    './manifest.json',
    './css/tailwind.css',
    './css/style.css',
    './assets/fonts/cinzel-latin-var.woff2',
    './assets/fonts/medievalsharp-latin.woff2',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon.png',
    './js/config.js',
    './js/spatial.js',
    './js/settings.js',
    './js/audio.js',
    './js/economy.js',
    './js/pathfinding.js',
    './js/entities.js',
    './js/fog.js',
    './js/fx.js',
    './js/campaign.js',
    './js/save_system.js',
    './js/minimap.js',
    './js/touch.js',
    './js/monetization.js',
    './js/renderer.js',
    './js/devconsole.js',
    './js/game.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k.startsWith('citadel-') && k !== CACHE_VERSION).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // never touch third-party (ads/SDKs)

    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req).catch(() => caches.match('./index.html', { ignoreSearch: true }))
        );
        return;
    }

    event.respondWith(
        caches.match(req, { ignoreSearch: true }).then((cached) => {
            if (cached) return cached;
            return fetch(req).then((res) => {
                if (res && res.ok && res.type === 'basic') {
                    const copy = res.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
                }
                return res;
            });
        })
    );
});

if (typeof module !== 'undefined') {
    module.exports = { CACHE_VERSION, PRECACHE };
}
