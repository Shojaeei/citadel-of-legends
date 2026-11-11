# Launch Checklist — Owner Actions Required

Everything that could be built and verified in the repository is done. The items below need **the owner's accounts, identity or legal decisions** and cannot be completed by an engineer on your behalf. Work top to bottom; each item lists the exact file/setting to change.

## 1. Legal identity & documents (blocking)
- [ ] Decide the legal entity (sole proprietor / LLC / Ltd). Replace **`[STUDIO LEGAL NAME]`**, **`[POSTAL ADDRESS]`**, **`[JURISDICTION]`**, **`[VENUE]`**, **`[PRIVACY CONTACT EMAIL]`**, **`[SUPPORT EMAIL]`**, **`[PRESS EMAIL]`** in:
  `docs/PRIVACY.md`, `docs/TERMS.md`, `docs/EULA.md`, `marketing/index.html` (footer), `marketing/presskit.html`, `desktop/package.json` (`author`, `copyright`, `maintainer`).
- [ ] Fill **`[EMAIL PROVIDER]`** and **`[HOSTING PROVIDER]`** in `docs/PRIVACY.md` §3.3–3.4.
- [ ] Press kit & site identity: **`[STUDIO NAME]`**, **`[CITY, COUNTRY]`**, credits **`[NAME]`**, studio bio **`[ADD 1–2 SENTENCES ABOUT THE TEAM.]`** in `marketing/presskit.html`; EU/UK **`[REPRESENTATIVE DETAILS]`** in `docs/PRIVACY.md` §9 (only if you have no EU/UK establishment and Art. 27 applies).
- [ ] **Source-code licence decision.** The repository is public but has no `LICENSE` file, which means "all rights reserved" by default. Options:
  1. *Keep proprietary* (recommended for a commercial launch): add a `LICENSE` stating all rights reserved; the EULA governs builds.
  2. *Open source (MIT)*: add `LICENSE` (MIT) for code; keep the EULA for builds/artwork/trademarks; remove the "Open-source decision pending" notice in `docs/EULA.md`.
  3. *Source-available* (e.g. PolyForm Noncommercial).
- [ ] Have counsel review the three legal documents (they are templates, not legal advice).
- [ ] Optional: register "Citadel of Legends" as a trademark in your primary market before heavy marketing spend.

## 2. Accounts & storefronts
- [ ] **itch.io:** create the project page; upload `dist/citadel_of_legends_v1.0_web.zip` as HTML5 (viewport 1280×720, fullscreen button on, mobile-friendly on); upload desktop builds; enable pay-what-you-want (suggested 4.99). Set `BUSINESS_CONFIG.supporterUrl` and `wishlistUrl` in `js/monetization.js` to the real page URL.
- [ ] **Supporter codes:** `node scripts/generate_supporter_codes.js 500 --out supporter_codes.csv` → upload codes to itch.io as external keys → paste the printed hashes into `BUSINESS_CONFIG.supporterCodeHashes` → **remove the QA demo hash** (`AVALON-DEMO-0000`) → never commit the CSV.
- [ ] **CrazyGames / Poki / GameDistribution:** create developer accounts; submit `dist/..._crazygames.zip` / `dist/..._poki.zip`; for GameDistribution set `BUSINESS_CONFIG.gameDistributionId`. Verify the SDK calls in `js/monetization.js` against each portal's *current* SDK documentation during QA.
- [ ] **Discord:** create the server; replace `https://discord.gg/REPLACE_ME` in `js/monetization.js`, `marketing/index.html`, `marketing/presskit.html`.
- [ ] **Newsletter:** choose a provider with double opt-in (e.g. Buttondown, ConvertKit/Kit, Mailchimp); set the form endpoint in `marketing/index.html` → `<form id="signup" data-endpoint="...">`. The form shows an honest "signups open at launch" message until this is set.

## 3. Hosting & domains
- [ ] Register a domain; deploy `dist/citadel_of_legends_v1.0_website.zip` (landing page at `/`, game at `/play/`) to static hosting with HTTPS (Netlify, Cloudflare Pages, GitHub Pages…).
- [ ] Update absolute URLs in `marketing/index.html` Open Graph tags (`og:image` should be an absolute URL for best previews).
- [ ] Optional privacy-friendly analytics for the **landing page only** (e.g. server logs, Plausible). If added, update `docs/PRIVACY.md` first.

## 4. Desktop builds & signing
- [ ] `cd desktop && npm ci && npm run dist:win` (on Windows), `npm run dist:mac` (on macOS), `npm run dist:linux` (on Linux).
- [ ] **Windows:** obtain a code-signing certificate (OV/EV) to avoid SmartScreen warnings; configure `CSC_LINK`/`CSC_KEY_PASSWORD` env vars for electron-builder.
- [ ] **macOS:** Apple Developer Program membership; set `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` for notarisation (hardened runtime is already enabled).
- [ ] Attach installers to a GitHub Release and the itch.io page; publish `SHA256SUMS.txt`.

## 5. Final QA gate (before Phase A)
- [ ] `npm test` → 100% pass. `npm run test:e2e` → pass.
- [ ] Manual pass on Chrome, Firefox, Safari (macOS + iOS) and Edge: audio unlocks on first click, saves persist, PWA installs, offline reload works.
- [ ] Play every campaign mission start-to-finish once (`/win` in the dev console is available for smoke-testing unlocks only).
- [ ] Regenerate press media after any visual change: `npm run build:media`.

## 6. Launch
- [ ] Execute `docs/GTM_STRATEGY.md` phases A–D. Track KPIs weekly.
