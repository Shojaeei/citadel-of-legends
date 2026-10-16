# Development Log & Chat Records: Citadel of Legends: Shattered Realms

This document tracks developer notes, system audits, architectural decisions, and development chat history across development milestones.

---

## 📅 Milestone 1: Comprehensive Review & Bug Audit (Phase 0)

### Initial State
The project started as a monolithic 1,122-line file (`citadel_of_legends_shattered_realms.html`).
A thorough code review identified the following critical vulnerabilities and design deficits:
1. **Mouse Pan vs Building Placement Collision:** `mousedown` directly called `tryPlaceBuilding()`, causing accidental building placement every time the user attempted to pan the camera.
2. **Missing Placement Collision Validation:** Buildings lacked boundary, occupancy, and terrain checks, allowing construction on water, rocks, or overlapping footprints.
3. **Incomplete Unit Recruitment Costs:** `trainUnit()` only deducted gold and wood, allowing infinite recruitment of Dragons, Werewolves, and Giants without Iron, Pitch, or Honor.
4. **Economy Simulation Loopholes:** Granaries never consumed food (preventing starvation or realistic rationing), and negative tax policies (Royal Gift) did not deduct gold or apply proper popularity bonuses.
5. **Broken Frustum Culling:** Unprojected world coordinates were checked against screen pixel dimensions, causing erratic tile clipping during panning and zooming.

---

## 📅 Milestone 2: Modular Restructuring & Engine Overhaul (Phase 1)

### Changes Implemented
- **Modular Directory Layout:** Extracted inline code into dedicated files:
  - `css/style.css`: Medieval parchment themes, scrollbars, and responsive UI.
  - `js/config.js`: Centralized definitions for buildings, units, factions, and missions.
  - `js/audio.js`: Zero-dependency Web Audio procedural synthesizer.
  - `js/economy.js`: Real-time food consumption, starvation penalty, taxes, and dynamic immigration/emigration.
  - `js/entities.js`: Object-oriented `Building`, `Unit`, `Projectile`, and `Particle` classes.
  - `js/renderer.js`: 2.5D isometric engine with 3D stepped architectural prisms, frustum culling, and hover ghost previews.
  - `js/game.js`: Input thresholding (6px drag threshold), keyboard navigation, and main loop.
- **Automated Headless Testing:** Node.js integration tests verified building placement, water collision rejection, unit training costs, and economy updates with 100% pass rate.

---

## 📅 Milestone 3: Documentation, Git Dev Tracking & Dev Chat (Phase 1.5)

### Actions Taken
- Initialized local Git repository on `main` branch with comprehensive `.gitignore`.
- Authored technical documentation:
  - `README.md`: Project overview, features, and controls.
  - `docs/ARCHITECTURE.md`: Technical pipeline, coordinate mathematics, and audio synth breakdown.
  - `docs/GAMEPLAY_GUIDE.md`: Full building compendium, troop counters, and faction guides.
  - `docs/DEVLOG.md`: Engineering journal and chat transcript.
- Built an **In-Game Developer Console & Chat Interface** (`js/devconsole.js`):
  - Accessible via `~` key or UI header button.
  - Live dev chat log with cheat commands (`/gold`, `/spawn`, `/wave`, `/speed`, `/killall`).

---

## 📅 Milestone 4: Phase 2 Core Tactical Warfare & Siege Engine

### Objectives & Deliverables
1. **$A^*$ Grid Pathfinding Engine (`js/pathfinding.js`):**
   - Tile passability matrix with collision awareness for buildings, walls, and water.
   - Units calculate intelligent waypoint paths around walls and cross river bridges.
   - Flying units (Faction Dragons) fly unrestricted over ground obstacles.
2. **AI Lord Castle & Periodic Siege Invasions:**
   - Enemy AI Fortress generated on the eastern shore across the river.
   - Autonomous wave spawner launching timed incursions toward the player's Keep.
   - Scaling difficulty tiers (Easy, Normal, Hard).
3. **Siege Warfare & Destructible Defenses:**
   - Catapults and giants attack and demolish enemy walls, towers, and gatehouses.
   - Defensive watchtowers automatically target hostile raiders within range.
4. **Victory & Defeat Resolution:**
   - Destruction of Enemy Keep triggers Victory Modal with campaign mission progression.
   - Loss of Player Keep triggers Defeat Modal with restart option.
5. **Multi-Unit Command & Box Selection:**
   - Ability to select individual or multiple units and issue coordinated attack/move orders.

### Status: Complete & Verified
- `js/pathfinding.js` successfully routes units around walls and across bridges.
- `js/devconsole.js` live with `/gold`, `/spawn`, `/wave`, `/god`, `/win` and chat logging.
- AI Lord siege waves active with automated countdown timer, rush wave button, and victory/defeat screens.
- Automated headless test suite passing 100%.

---

## 💬 Development Chat Transcript & Decision Records

### ADR-001: Zero External Dependencies vs NPM Tooling
- **Decision:** Keep the engine runnable directly in the browser as pure client-side HTML5/JS without requiring node build steps (`npm run build`, bundlers, or frameworks).
- **Rationale:** Ensures maximum portability, instantaneous launch by double-clicking `index.html` on any machine, and zero friction for users and modders.

### ADR-002: Procedural Web Audio Synth vs Static Audio Assets
- **Decision:** Synthesize all sound effects (anvils, chops, sword clashes, bow twangs, dragon roars) and faction ambient music via the Web Audio API.
- **Rationale:** Keeps repository size lightweight (<1 MB total), avoids missing asset 404s or CORS blocks on `file://` protocols, and allows real-time dynamic pitch modulation.

### ADR-003: Isometric Projection Mathematics
- **Decision:** Adopt a $2:1$ dimetric isometric standard ($64\times 32\text{ px}$ tiles) with inverse screen-to-world unprojection that factors in camera translation and zoom dynamically.
- **Rationale:** Provides optimal retro Stronghold aesthetic while allowing accurate mouse tile hit testing even at extreme zoom levels.
