// =============================================================================
// Citadel of Legends - Browser End-to-End Smoke Suite (Playwright / Chromium)
// -----------------------------------------------------------------------------
// Exercises the real game in a real browser: menus, campaign briefing, build
// & recruit via the UI, minimap navigation, speed controls, save -> reload ->
// load, settings persistence, offline PWA reload, mobile touch layout, and the
// marketing site. Portable replacement for the old Windows-only CDP scripts.
// Usage: node tests/e2e_smoke.js   (requires the `playwright` package)
// =============================================================================
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.md': 'text/plain', '.gif': 'image/gif', '.txt': 'text/plain' };

let passed = 0;
let failed = 0;
function check(cond, msg) {
    if (cond) { passed++; console.log(`  \x1b[32m✔\x1b[0m ${msg}`); } else { failed++; console.error(`  \x1b[31m✖ ${msg}\x1b[0m`); }
}

function serve() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
            if (!rel || rel.endsWith('/')) rel += 'index.html';
            const file = path.resolve(ROOT, rel);
            if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                res.writeHead(404);
                res.end('not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
            fs.createReadStream(file).pipe(res);
        });
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

function watch(page, bucket) {
    page.on('pageerror', e => bucket.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') bucket.push(`console: ${m.text()}`); });
    page.on('requestfailed', r => { if (r.url().startsWith('http://127.0.0.1')) bucket.push(`requestfailed: ${r.url()}`); });
    page.on('response', r => { if (r.status() >= 400 && r.url().startsWith('http://127.0.0.1')) bucket.push(`HTTP ${r.status()}: ${r.url()}`); });
}

async function main() {
    const { chromium, devices } = require('playwright');
    const server = await serve();
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch();

    // ---------------------------------------------------------------- desktop
    console.log('\n[Desktop gameplay]');
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    const errors = [];
    watch(page, errors);
    await page.goto(`${base}/index.html`);
    await page.waitForFunction(() => window.GameApp && window.GameApp.renderer);

    check(await page.isVisible('#consent-banner'), 'Consent banner shown on first visit');
    await page.click('#consent-banner >> text=Essential only');
    check(!(await page.isVisible('#consent-banner')), 'Consent choice dismisses the banner');

    const noName = await page.$$eval('#main-menu button', bs => bs.filter(b => !(b.innerText.trim() || b.getAttribute('aria-label'))).length);
    check(noName === 0, 'Every main-menu button has an accessible name');

    await page.click('text=PLAY NOW');
    check(await page.isVisible('#briefing-modal'), 'Mission briefing appears before play');
    check((await page.textContent('#briefing-title')) === 'The Gathering Storm', 'Briefing shows Solaris Mission 1');
    const t0 = await page.evaluate(() => GameApp.stats.playTime);
    await page.waitForTimeout(400);
    check((await page.evaluate(() => GameApp.stats.playTime)) === t0, 'Simulation is paused during the briefing');
    await page.click('text=Begin Mission');
    await page.waitForTimeout(800);
    check((await page.evaluate(() => GameApp.stats.playTime)) > t0, 'Simulation runs after Begin Mission');
    check((await page.textContent('#objective-tracker')).includes('Reach 150 population'), 'Objective tracker lists mission objectives');

    // Build a hovel through the real UI
    const before = await page.evaluate(() => GameApp.buildings.length);
    await page.click('#action-tray >> text=Peasant Hovel');
    const target = await page.evaluate(() => {
        const r = GameApp.renderer;
        const s = r.worldToScreen(15.5, 24.5);
        const rect = r.canvas.getBoundingClientRect();
        return { x: rect.left + r.canvas.width / 2 + GameApp.camera.x + s.x * GameApp.camera.zoom, y: rect.top + r.canvas.height / 2 + GameApp.camera.y + s.y * GameApp.camera.zoom };
    });
    await page.mouse.click(target.x, target.y);
    check((await page.evaluate(() => GameApp.buildings.length)) === before + 1, 'Clicking the map with a build tool constructs a building');

    // Minimap recentering
    const cam0 = await page.evaluate(() => ({ ...GameApp.camera }));
    const mm = await page.$('#minimap-canvas');
    const box = await mm.boundingBox();
    await page.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.2);
    const cam1 = await page.evaluate(() => ({ ...GameApp.camera }));
    check(cam0.x !== cam1.x || cam0.y !== cam1.y, 'Clicking the minimap recenters the camera');

    // Speed controls
    await page.click('#speed-btn-5');
    check((await page.evaluate(() => GameApp.simSpeed)) === 5, '5x speed button works');
    await page.keyboard.press('p');
    check((await page.evaluate(() => GameApp.simSpeed)) === 0 && await page.isVisible('#pause-indicator'), 'P key pauses and shows the pause indicator');
    await page.keyboard.press('p');

    // Save -> reload -> load
    await page.evaluate(() => { GameApp.economy.res.gold = 4242; });
    await page.click('button[aria-label="Save or load game"]');
    await page.click('#save-slot-list >> text=Save >> nth=0');
    await page.reload();
    await page.waitForFunction(() => window.GameApp && window.GameApp.renderer);
    check(await page.isVisible('#main-menu') && !(await page.isVisible('#game-interface')), 'Full reload returns to the main menu');
    await page.click('text=Load Game');
    await page.click('#save-slot-list >> text=Load >> nth=0');
    await page.waitForTimeout(300);
    const loaded = await page.evaluate(() => ({ state: GameApp.state, gold: Math.floor(GameApp.economy.res.gold), mission: GameApp.currentMissionData && GameApp.currentMissionData.id }));
    check(loaded.state === 'playing' && loaded.gold >= 4242 && loaded.mission === 1, 'Saved game restores after a full page reload');

    // Settings persistence
    await page.click('button[aria-label="Settings"]');
    await page.check('#set-highContrast');
    await page.keyboard.press('Escape');
    await page.reload();
    await page.waitForFunction(() => window.GameApp && window.GameApp.settings);
    check(await page.evaluate(() => GameApp.settings.data.highContrast === true), 'Settings persist across reloads');

    // Skirmish + wave + combat
    await page.evaluate(() => { document.getElementById('skirmish-fog').checked = true; GameApp.launchSkirmish(); GameApp.triggerEnemyWave(); GameApp.setSpeed(5); });
    await page.waitForTimeout(2500);
    check(await page.evaluate(() => GameApp.units.some(u => u.isEnemy && u.waveId === 1)), 'Siege wave spawns in a skirmish');
    check(await page.evaluate(() => GameApp.fog.enabled && !GameApp.fog.isVisible(50, 50)), 'Fog of war hides the far map');

    // PWA offline
    await page.goto(`${base}/index.html`);
    const swReady = await page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return false;
        const reg = await navigator.serviceWorker.ready;
        return !!reg.active;
    });
    check(swReady, 'Service worker installs and activates');
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 5000 }).catch(() => {});
    await ctx.setOffline(true);
    let offlineOk = false;
    try {
        await page.reload();
        offlineOk = await page.waitForFunction(() => window.GameApp && window.GameApp.renderer, null, { timeout: 5000 }).then(() => true);
    } catch (e) { offlineOk = false; }
    check(offlineOk, 'Game reloads and boots while offline (PWA)');
    await ctx.setOffline(false);
    check(errors.length === 0, `No runtime errors or failed requests on desktop${errors.length ? ':\n    ' + errors.join('\n    ') : ''}`);
    await ctx.close();

    // ----------------------------------------------------------------- mobile
    console.log('\n[Mobile / touch]');
    const mctx = await browser.newContext({ ...devices['Pixel 7'] });
    const m = await mctx.newPage();
    const merr = [];
    watch(m, merr);
    await m.goto(`${base}/index.html`);
    await m.waitForFunction(() => window.GameApp && window.GameApp.renderer);
    await m.evaluate(() => { GameApp.setConsent('essential'); GameApp.startCampaign('frost', 1); GameApp.beginMission(); });
    await m.waitForTimeout(300);
    check(await m.isVisible('#touch-joystick'), 'Virtual joystick is shown on touch devices');
    const canvasBox = await (await m.$('#game-canvas')).boundingBox();
    check(canvasBox.height > 150, `Canvas keeps a usable play area on a phone (${Math.round(canvasBox.height)}px tall)`);
    const keep = await m.evaluate(() => {
        const r = GameApp.renderer;
        const s = r.worldToScreen(19.5, 29.5);
        const rect = r.canvas.getBoundingClientRect();
        return { x: rect.left + r.canvas.width / 2 + GameApp.camera.x + s.x * GameApp.camera.zoom, y: rect.top + r.canvas.height / 2 + GameApp.camera.y + s.y * GameApp.camera.zoom };
    });
    await m.touchscreen.tap(keep.x, keep.y);
    await m.waitForTimeout(200);
    check(await m.evaluate(() => GameApp.selectedEntity && GameApp.selectedEntity.type === 'keep'), 'Tap selects the keep');
    check(merr.length === 0, `No runtime errors on mobile${merr.length ? ':\n    ' + merr.join('\n    ') : ''}`);
    await mctx.close();

    // -------------------------------------------------------------- marketing
    console.log('\n[Marketing site]');
    const wctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const w = await wctx.newPage();
    const werr = [];
    watch(w, werr);
    await w.goto(`${base}/marketing/index.html`);
    await w.waitForTimeout(500);
    check((await w.title()).includes('Citadel of Legends'), 'Landing page loads');
    await w.click('#tab-frost');
    check((await w.textContent('#faction-name')) === 'Frostbound Covenant', 'Faction explorer switches factions');
    check((await w.$$eval('#faction-units tr', r => r.length)) === 3, 'Faction explorer renders live unit stats from config.js');
    check((await w.$$eval('#mission-grid .mission', r => r.length)) === 9, 'Campaign grid renders all 9 missions');
    await w.fill('#signup-email', 'not-an-email');
    await w.click('#signup button[type=submit]');
    check((await w.textContent('#signup-status')).includes('valid email'), 'Signup form validates email');
    await w.fill('#signup-email', 'player@example.com');
    await w.check('#signup-consent');
    await w.click('#signup button[type=submit]');
    check((await w.textContent('#signup-status')).includes('Signups open at launch'), 'Unconfigured signup never fakes success');
    await w.goto(`${base}/marketing/presskit.html`);
    check((await w.$$('img')).length >= 10, 'Press kit renders its image assets');
    check(werr.length === 0, `No errors or broken assets on marketing pages${werr.length ? ':\n    ' + werr.join('\n    ') : ''}`);
    await wctx.close();

    await browser.close();
    server.close();
    console.log(`\nE2E RESULTS: ${passed} PASSED, ${failed} FAILED\n`);
    process.exit(failed ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
