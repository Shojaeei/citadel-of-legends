#!/usr/bin/env node
/* ==========================================================================
   Citadel of Legends - Web Release Packager
   --------------------------------------------------------------------------
   Produces drag-and-drop upload bundles in dist/:
     citadel_of_legends_v<major.minor>_web.zip          itch.io / self-hosting (PWA, offline)
     citadel_of_legends_v<major.minor>_crazygames.zip   CrazyGames (SDK v3 adapter enabled)
     citadel_of_legends_v<major.minor>_poki.zip         Poki (SDK v2 adapter enabled)
     citadel_of_legends_v<major.minor>_website.zip      Marketing site + game under /play
   plus SHA256SUMS.txt and release-manifest.json.

   Every bundle has index.html at the archive root (portal requirement), no
   tests/tooling, and is byte-for-byte reproducible (fixed zip timestamps).
   Usage: node scripts/build_web_release.js [--out dist]
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createZip } = require('./zip');

const ROOT = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;
const SHORT = VERSION.split('.').slice(0, 2).join('.');

/** Files shipped with the playable game (relative to repo root). */
const GAME_FILES = [
    'index.html',
    'manifest.json',
    'sw.js',
    'css/tailwind.css',
    'css/style.css',
    'assets/fonts/cinzel-latin-var.woff2',
    'assets/fonts/medievalsharp-latin.woff2',
    'assets/fonts/OFL-Cinzel.txt',
    'assets/fonts/OFL-MedievalSharp.txt',
    'icons/icon.svg',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-maskable-512.png',
    'icons/apple-touch-icon.png',
    'icons/favicon-32.png',
    'docs/PRIVACY.md',
    'docs/TERMS.md',
    'docs/EULA.md',
    'LICENSE',
    'js/config.js',
    'js/spatial.js',
    'js/settings.js',
    'js/audio.js',
    'js/economy.js',
    'js/pathfinding.js',
    'js/entities.js',
    'js/fog.js',
    'js/fx.js',
    'js/campaign.js',
    'js/save_system.js',
    'js/minimap.js',
    'js/touch.js',
    'js/monetization.js',
    'js/renderer.js',
    'js/devconsole.js',
    'js/game.js'
];

function listDir(rel) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) return [];
    const out = [];
    for (const name of fs.readdirSync(abs)) {
        const r = path.posix.join(rel, name);
        const st = fs.statSync(path.join(ROOT, r));
        if (st.isDirectory()) out.push(...listDir(r));
        else out.push(r);
    }
    return out.sort();
}

function read(rel) {
    return fs.readFileSync(path.join(ROOT, rel));
}

/** Inject a portal flag before the first game script. */
function portalIndex(portal, { disableSw = false } = {}) {
    let html = read('index.html').toString('utf8');
    const flags = [`window.CITADEL_PORTAL = ${JSON.stringify(portal)};`];
    if (disableSw) flags.push('window.CITADEL_DISABLE_SW = true;');
    const marker = '<script src="js/config.js"></script>';
    if (!html.includes(marker)) throw new Error('index.html script marker not found');
    html = html.replace(marker, `<script>${flags.join(' ')}</script>\n    ${marker}`);
    return Buffer.from(html, 'utf8');
}

function versionedSw() {
    const sw = read('sw.js').toString('utf8');
    return Buffer.from(sw.replace(/const CACHE_VERSION = '[^']*';/, `const CACHE_VERSION = 'citadel-v${VERSION}';`), 'utf8');
}

function gameEntries(prefix = '', overrides = {}) {
    return GAME_FILES.map(f => ({
        name: prefix + f,
        data: overrides[f] || (f === 'sw.js' ? versionedSw() : read(f))
    }));
}

function websiteEntries() {
    const rewrite = (buf) => Buffer.from(buf.toString('utf8')
        .replace(/\.\.\/index\.html/g, 'play/index.html')
        .replace(/\.\.\/docs\//g, 'docs/')
        .replace(/\.\.\/icons\//g, 'play/icons/')
        .replace(/\.\.\/assets\//g, 'play/assets/')
        .replace(/\.\.\/js\//g, 'play/js/'), 'utf8');
    const entries = [
        { name: 'index.html', data: rewrite(read('marketing/index.html')) },
        { name: 'presskit.html', data: rewrite(read('marketing/presskit.html')) },
        ...listDir('marketing/assets').map(f => ({ name: f.replace(/^marketing\//, ''), data: read(f) })),
        { name: 'docs/PRIVACY.md', data: read('docs/PRIVACY.md') },
        { name: 'docs/TERMS.md', data: read('docs/TERMS.md') },
        { name: 'docs/EULA.md', data: read('docs/EULA.md') },
        { name: 'LICENSE', data: read('LICENSE') },
        ...gameEntries('play/')
    ];
    return entries;
}

function main() {
    const outArg = process.argv.indexOf('--out');
    const outDir = path.resolve(ROOT, outArg > -1 ? process.argv[outArg + 1] : 'dist');
    fs.mkdirSync(outDir, { recursive: true });

    const missing = GAME_FILES.filter(f => !fs.existsSync(path.join(ROOT, f)));
    if (missing.length) throw new Error(`Missing release files: ${missing.join(', ')}`);

    const bundles = [
        { file: `citadel_of_legends_v${SHORT}_web.zip`, target: 'itch.io / self-hosted PWA', entries: gameEntries() },
        { file: `citadel_of_legends_v${SHORT}_crazygames.zip`, target: 'CrazyGames (SDK v3)', entries: gameEntries('', { 'index.html': portalIndex('crazygames', { disableSw: true }) }) },
        { file: `citadel_of_legends_v${SHORT}_poki.zip`, target: 'Poki (SDK v2)', entries: gameEntries('', { 'index.html': portalIndex('poki', { disableSw: true }) }) },
        { file: `citadel_of_legends_v${SHORT}_website.zip`, target: 'Marketing website + /play', entries: websiteEntries() }
    ];

    const manifest = { name: pkg.name, version: VERSION, builtFrom: 'scripts/build_web_release.js', bundles: [] };
    const sums = [];
    for (const b of bundles) {
        const zip = createZip(b.entries);
        fs.writeFileSync(path.join(outDir, b.file), zip);
        const sha = crypto.createHash('sha256').update(zip).digest('hex');
        sums.push(`${sha}  ${b.file}`);
        manifest.bundles.push({ file: b.file, target: b.target, files: b.entries.length, bytes: zip.length, sha256: sha });
        console.log(`  ${b.file.padEnd(44)} ${String(b.entries.length).padStart(3)} files  ${(zip.length / 1024).toFixed(1).padStart(8)} KiB  -> ${b.target}`);
    }
    fs.writeFileSync(path.join(outDir, 'SHA256SUMS.txt'), sums.join('\n') + '\n');
    fs.writeFileSync(path.join(outDir, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log(`Release v${VERSION} written to ${path.relative(ROOT, outDir) || '.'}/`);
    return manifest;
}

if (require.main === module) {
    try {
        main();
    } catch (e) {
        console.error(`Build failed: ${e.message}`);
        process.exit(1);
    }
}

module.exports = { main, GAME_FILES, VERSION };
