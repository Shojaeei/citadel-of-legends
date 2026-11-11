#!/usr/bin/env node
/* Dev-only: rasterizes icons/icon.svg into the PNG sizes required by the PWA
 * manifest, iOS and web portals. Requires Playwright (Chromium).
 * Usage: node scripts/generate_icons.js */
const path = require('path');
const fs = require('fs');

async function main() {
    const { chromium } = require('playwright');
    const root = path.resolve(__dirname, '..');
    const svg = fs.readFileSync(path.join(root, 'icons/icon.svg'), 'utf8');
    const targets = [
        { file: 'icons/icon-192.png', size: 192, pad: 0 },
        { file: 'icons/icon-512.png', size: 512, pad: 0 },
        // Maskable icons need content inside the central 80% safe zone.
        { file: 'icons/icon-maskable-512.png', size: 512, pad: 0.12, bg: '#0c0a09' },
        { file: 'icons/apple-touch-icon.png', size: 180, pad: 0 },
        { file: 'icons/favicon-32.png', size: 32, pad: 0 }
    ];
    const browser = await chromium.launch();
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    for (const t of targets) {
        const inner = Math.round(t.size * (1 - t.pad * 2));
        const html = `<html><body style="margin:0;background:${t.bg || 'transparent'};width:${t.size}px;height:${t.size}px;display:flex;align-items:center;justify-content:center">
            <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`;
        await page.setViewportSize({ width: t.size, height: t.size });
        await page.setContent(html);
        await page.screenshot({ path: path.join(root, t.file), omitBackground: !t.bg });
        console.log('wrote', t.file);
    }

    // Press-kit PNGs: logo (with bundled fonts) and faction crests.
    const os = require('os');
    const fontCss = `@font-face{font-family:'MedievalSharp';src:url('file://${path.join(root, 'assets/fonts/medievalsharp-latin.woff2')}')}
        @font-face{font-family:'Cinzel';font-weight:400 900;src:url('file://${path.join(root, 'assets/fonts/cinzel-latin-var.woff2')}')}`;
    const press = [
        { src: 'marketing/assets/logo.svg', out: 'marketing/assets/logo.png', w: 1920, h: 480, bg: null },
        { src: 'marketing/assets/logo.svg', out: 'marketing/assets/logo-dark-bg.png', w: 1920, h: 480, bg: '#0c0a09' },
        { src: 'marketing/assets/crest-solaris.svg', out: 'marketing/assets/crest-solaris.png', w: 600, h: 720 },
        { src: 'marketing/assets/crest-frost.svg', out: 'marketing/assets/crest-frost.png', w: 600, h: 720 },
        { src: 'marketing/assets/crest-obsidian.svg', out: 'marketing/assets/crest-obsidian.png', w: 600, h: 720 }
    ];
    for (const p of press) {
        const svgText = fs.readFileSync(path.join(root, p.src), 'utf8').replace('<svg ', `<svg width="${p.w}" height="${p.h}" `);
        const tmp = path.join(os.tmpdir(), `citadel-press-${Date.now()}.html`);
        fs.writeFileSync(tmp, `<html><head><style>${fontCss} body{margin:0;background:${p.bg || 'transparent'}}</style></head><body>${svgText}</body></html>`);
        await page.setViewportSize({ width: p.w, height: p.h });
        await page.goto('file://' + tmp);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(150);
        await page.screenshot({ path: path.join(root, p.out), omitBackground: !p.bg });
        fs.unlinkSync(tmp);
        console.log('wrote', p.out);
    }
    await browser.close();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
