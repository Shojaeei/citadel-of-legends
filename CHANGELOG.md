# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-11-11 — Gold Master

### Track 1 — Engine & Gameplay
#### Added
- **Radar minimap** (`js/minimap.js`): terrain-cached orthogonal radar, friendly/enemy/resource blips, live zoom-aware camera frustum, click & drag (mouse and touch) to recenter.
- **Fog of war** (`js/fog.js`): explored/visible layers, vision radii (Keep 12, Tower 10, units 5, flyers 7), 4 Hz recompute, box-blurred soft shroud, enemies hidden outside vision, RLE save encoding.
- **Persistence engine** (`js/save_system.js`): 3 manual slots + rolling auto-save (every 3 min and on each repelled wave), `.citadelsave` export/import, schema versioning and strict validation of imported files.
- **9-mission campaign** (`js/campaign.js`, `js/config.js`): titles and objectives per the PLANS table, briefings, live objective tracker, bonus objectives, persistent unlocks and bonus stars.
- **New content:** Boiling Pitch Cauldron defense, enemy Warlord generals, Bloodknight stealth, Runestone empowerment aura, cavalry waves, monument resource yields (honor/pitch) that were described but previously not implemented.
- **Audio mixer & soundscapes:** master/SFX/music buses with persistence; procedural faction ambience (birdsong, abbey chimes, arctic wind, glacial creaks, campfire crackle, subterranean hum, bubbling pitch, wolf howls); ad-break muting.
- **Particle FX** (`js/fx.js`): golden motes, snow, ash/cinders; sword sparks, blood, rubble dust, burning dragon-breath patches (with damage); adaptive quality on slow devices.
- **Performance:** spatial hash grid (`js/spatial.js`), binary-heap A* with octile heuristic and O(1) building lookups, throttled HUD updates, sub-stepped simulation at high speeds. 250+ units simulate well under the 60 FPS budget.
- **Accessibility & settings** (`js/settings.js`): high-contrast outlines, reduced motion, weather toggle, minimap toggle, rebindable keys with conflict swapping, game speed 0x/1x/2x/5x, focus-visible styles, 36px touch targets.
- **Touch controls** (`js/touch.js`): tap select/build, long-press command, one-finger pan, pinch zoom, two-finger pan, virtual joystick.
- **Siege AI:** troops breach walls when their route is sealed, retaliate against nearby defenders and resume marching on the keep.

#### Fixed
- Each new mission/skirmish started an additional `requestAnimationFrame` loop (simulation ran 2x, 3x… faster after "Next Mission"). Now a single app-lifetime loop.
- Waves spawned with `setTimeout`, ignoring pause/speed and impossible to save mid-wave. Now a simulation-time spawn queue.
- `centerOnKeep` ignored zoom; wheel zoom now anchors on the cursor.
- Friendly deaths never freed housing (population cap drifted).
- Faction speed bonus (Obsidian) was declared but never applied.
- Drag-to-pan and marquee selection fought each other; Shift+drag now selects, drag pans.
- Building labels cluttered dense settlements; now shown for keeps, selection, hover or zoom ≥ 1.6.
- Build tool stayed armed after recruiting a unit.

#### Changed
- Removed the runtime Tailwind CDN and Google Fonts: utilities are precompiled to `css/tailwind.css`, fonts self-hosted (OFL). The game now has zero runtime network dependencies.
- Units require their production building (archers → Archery Range, etc.).

### Track 2 — Commercial Business
- **Marketing site** (`marketing/index.html`) and **press kit** (`marketing/presskit.html`) with in-engine screenshots, gameplay GIF, OG card, logo and faction crests.
- **PWA**: `manifest.json`, offline service worker `sw.js`, icon set.
- **Release packaging** (`scripts/build_web_release.js`): reproducible itch.io/web, CrazyGames, Poki and website bundles with SHA-256 sums.
- **Desktop edition** (`desktop/`): hardened Electron shell (sandbox, context isolation, CSP, custom `app://` scheme) with Windows/macOS/Linux targets; tag-triggered release workflow.
- **Monetization** (`js/monetization.js`): portal SDK adapters, opt-in rewarded "Royal Respite", capped interstitials, Royal Supporter Edition with hashed codes and developer commentary.
- **Legal**: Privacy Policy (GDPR/CCPA/COPPA), Terms of Service, EULA, in-game consent banner.
- **GTM**: launch playbook with 10 copy templates, KPIs and risk register (`docs/GTM_STRATEGY.md`); owner launch checklist (`docs/LAUNCH_CHECKLIST.md`).

### Quality
- Unit/integration suite expanded from 31 to 300+ assertions (`tests/test_runner.js`); new Playwright end-to-end suite (`tests/e2e_smoke.js`); GitHub Actions CI.
- Removed three Windows-only browser scripts hardcoded to a local `C:\`/`d:\` path (superseded by the portable e2e suite).
