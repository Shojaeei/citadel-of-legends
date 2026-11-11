#!/usr/bin/env node
/* Copies the shipping game files (single list shared with the web packager)
 * into desktop/app/ so electron-builder can bundle them. */
const fs = require('fs');
const path = require('path');
const { GAME_FILES } = require('../../scripts/build_web_release.js');

const ROOT = path.resolve(__dirname, '../..');
const DEST = path.resolve(__dirname, '../app');
fs.rmSync(DEST, { recursive: true, force: true });
for (const rel of GAME_FILES) {
    const out = path.join(DEST, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.copyFileSync(path.join(ROOT, rel), out);
}
console.log(`Staged ${GAME_FILES.length} files into desktop/app/`);
