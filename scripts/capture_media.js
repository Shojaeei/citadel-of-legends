#!/usr/bin/env node
/* ==========================================================================
   Citadel of Legends - Press & Store Media Capture (dev-only)
   --------------------------------------------------------------------------
   Drives the real game in headless Chromium (Playwright), stages scenes via
   the public GameApp API, and writes:
     marketing/assets/screenshots/*.png   1920x1080 gameplay screenshots
     marketing/assets/og-image.png        1200x630 social share card
     marketing/assets/gameplay.gif        looping gameplay capture (needs ffmpeg)
   Usage: node scripts/capture_media.js   (serves the repo on a random port)
   ========================================================================== */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'marketing/assets');
const SHOTS = path.join(OUT, 'screenshots');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.md': 'text/plain', '.gif': 'image/gif' };

function serve() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
            const file = path.resolve(ROOT, rel);
            if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                res.writeHead(404);
                res.end();
                return;
            }
            res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
            fs.createReadStream(file).pipe(res);
        });
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

/** Stage a believable mid-game scene for a faction. Runs in the page. */
function stageScene({ faction, wave, dragon }) {
    const g = window.GameApp;
    document.getElementById('skirmish-faction').value = faction;
    document.getElementById('skirmish-map').value = { solaris: 'valley', frost: 'tundra', obsidian: 'wasteland' }[faction];
    document.getElementById('skirmish-ai').value = 'normal';
    g.launchSkirmish();
    g.fog.enabled = false;
    const own = (t, x, y) => { if (g.isValidPlacement(x, y, BUILDINGS_DEF[t].w, BUILDINGS_DEF[t].h)) g.spawnBuilding(t, x, y, false, faction); };
    [[14, 24], [16, 24], [12, 30], [12, 32], [14, 34], [16, 34]].forEach(([x, y]) => own('hovel', x, y));
    own('sawyer', 20, 24); own('quarry', 22, 24); own('bakery', 24, 31); own('hunter', 21, 33); own('barracks', 22, 35);
    own('archery', 25, 26); own('tower', 26, 29); own('tower', 26, 33); own('cauldron', 27, 31);
    for (let y = 26; y <= 36; y++) if (y < 30 || y > 32) own('wall', 28, y); // gap at the bridge = kill zone
    own(faction === 'solaris' ? 'cathedral' : faction === 'frost' ? 'runestone' : 'crucible', 14, 31);
    const champion = { solaris: 'paladin', frost: 'giant', obsidian: 'vampire' }[faction];
    for (let i = 0; i < 6; i++) g.units.push(new Unit(i % 2 ? 'archer' : 'knight', 25 + Math.random() * 2, 28 + Math.random() * 6, false, faction));
    for (let i = 0; i < 3; i++) g.units.push(new Unit(champion, 26.5, 30 + i, false, faction));
    if (dragon) g.units.push(new Unit('dragon', 27, 30, false, faction));
    g.rebuildBuildingIndex();
    for (let i = 0; i < wave; i++) g.triggerEnemyWave();
    g.spawnQueue.forEach(q => { q.x -= 8; q.delay = 0; });
    g.camera.zoom = 1.15;
    g.centerCameraOn(29, 30);
    g.onWorldLoaded && g.minimap && g.minimap.markTerrainDirty();
    g.centerCameraOn(29, 30);
    return true;
}

async function main() {
    const { chromium } = require('playwright');
    fs.mkdirSync(SHOTS, { recursive: true });
    const server = await serve();
    const base = `http://127.0.0.1:${server.address().port}/index.html`;
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => {
        localStorage.setItem('citadel.consent.v1', JSON.stringify({ essential: true, ads: false, at: 'capture', version: 1 }));
        window.CITADEL_DISABLE_SW = true;
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(base);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SHOTS, '01_main_menu.png') });
    console.log('captured 01_main_menu.png');

    const scenes = [
        { file: '02_solaris_siege.png', faction: 'solaris', wave: 3, dragon: true, settle: 9000 },
        { file: '03_frost_bridge_battle.png', faction: 'frost', wave: 4, dragon: false, settle: 9000 },
        { file: '04_obsidian_dragonfire.png', faction: 'obsidian', wave: 3, dragon: true, settle: 9500 }
    ];
    for (const s of scenes) {
        await page.goto(base);
        await page.waitForTimeout(300);
        await page.evaluate(stageScene, s);
        await page.evaluate(() => window.GameApp.setSpeed(2));
        await page.waitForTimeout(s.settle);
        await page.evaluate(() => window.GameApp.centerCameraOn(29, 30));
        await page.screenshot({ path: path.join(SHOTS, s.file) });
        console.log(`captured ${s.file}`);
    }

    // Campaign briefing screenshot
    await page.goto(base);
    await page.evaluate(() => window.GameApp.startCampaign('frost', 2));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, '05_mission_briefing.png') });
    console.log('captured 05_mission_briefing.png');

    // Social card (1200x630) from the obsidian scene
    const card = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await card.addInitScript(() => {
        localStorage.setItem('citadel.consent.v1', JSON.stringify({ essential: true, ads: false, at: 'capture', version: 1 }));
        window.CITADEL_DISABLE_SW = true;
    });
    await card.goto(base);
    await card.evaluate(stageScene, { faction: 'solaris', wave: 3, dragon: true });
    await card.evaluate(() => window.GameApp.setSpeed(2));
    await card.waitForTimeout(8000);
    await card.evaluate(() => {
        window.GameApp.centerCameraOn(29, 30);
        const o = document.createElement('div');
        o.style.cssText = 'position:fixed;inset:0;z-index:999;display:flex;flex-direction:column;justify-content:flex-end;padding:40px;background:linear-gradient(to top, rgba(0,0,0,.85), rgba(0,0,0,0) 55%);pointer-events:none';
        o.innerHTML = '<div style="font-family:MedievalSharp;font-size:64px;color:#f59e0b;text-shadow:0 4px 10px #000">Citadel of Legends</div><div style="font-family:Cinzel;font-size:26px;color:#fde68a;letter-spacing:4px">SHATTERED REALMS &bull; PLAY FREE IN YOUR BROWSER</div>';
        document.body.appendChild(o);
        const gi = document.getElementById('game-interface');
        Array.from(gi.children).forEach(c => { if (!c.querySelector('#game-canvas')) c.style.display = 'none'; });
        ['objective-tracker', 'minimap-wrap', 'toast-banner'].forEach(id => { document.getElementById(id).style.display = 'none'; });
        window.GameApp.resizeCanvas();
        window.GameApp.centerCameraOn(27, 30);
    });
    await card.waitForTimeout(300);
    await card.screenshot({ path: path.join(OUT, 'og-image.png') });
    console.log('captured og-image.png');

    // Gameplay GIF: 48 frames @ 8 fps at 960x540
    const gifPage = await browser.newPage({ viewport: { width: 960, height: 540 } });
    await gifPage.addInitScript(() => {
        localStorage.setItem('citadel.consent.v1', JSON.stringify({ essential: true, ads: false, at: 'capture', version: 1 }));
        window.CITADEL_DISABLE_SW = true;
    });
    await gifPage.goto(base);
    await gifPage.evaluate(stageScene, { faction: 'obsidian', wave: 3, dragon: true });
    await gifPage.evaluate(() => { window.GameApp.camera.zoom = 1.0; window.GameApp.centerCameraOn(30, 30); });
    await gifPage.waitForTimeout(3500);
    const frameDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'citadel-gif-'));
    for (let i = 0; i < 48; i++) {
        await gifPage.screenshot({ path: path.join(frameDir, `f${String(i).padStart(3, '0')}.png`) });
        await gifPage.waitForTimeout(110);
    }
    try {
        const palette = path.join(frameDir, 'palette.png');
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '8', '-i', path.join(frameDir, 'f%03d.png'), '-vf', 'scale=720:-1:flags=lanczos,palettegen=max_colors=128', palette]);
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '8', '-i', path.join(frameDir, 'f%03d.png'), '-i', palette, '-lavfi', 'scale=720:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4', '-loop', '0', path.join(OUT, 'gameplay.gif')]);
        console.log('captured gameplay.gif');
    } catch (e) {
        console.warn('ffmpeg unavailable - skipped gameplay.gif (frames left in', frameDir, ')');
    }

    await browser.close();
    server.close();
    if (errors.length) {
        console.error('Page errors during capture:\n' + errors.join('\n'));
        process.exit(1);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
