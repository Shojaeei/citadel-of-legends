# Privacy Policy — Citadel of Legends: Shattered Realms

**Effective date:** 11 November 2026 · **Version:** 1.0

> **Template notice:** This policy was drafted to match the game's actual v1.0 data flows. Bracketed placeholders (e.g. `[STUDIO LEGAL NAME]`) must be completed, and the document should be reviewed by qualified counsel in your jurisdiction before publication. It is not legal advice.

This policy explains how **[STUDIO LEGAL NAME]** ("we", "us") handles information when you play *Citadel of Legends: Shattered Realms* (the "Game") in a web browser, as an installed web app (PWA), as a desktop application, or when you visit our website and press kit (the "Site").

---

## 1. The short version

- **We do not run servers that receive your gameplay data.** The Game runs entirely on your device.
- **We do not use analytics, tracking pixels, advertising identifiers, or fingerprinting** in the Game or on the Site.
- **Your saves and settings stay in your browser's local storage** on your device. We never see them.
- **Web portals are different.** If you play on an ad-supported portal (e.g. CrazyGames, Poki, GameDistribution), that portal loads its own software, which may show ads and process data under **the portal's own privacy policy**.
- **We do not sell or share personal information**, as those terms are defined under the CCPA/CPRA.

## 2. Information stored on your device (not sent to us)

The Game uses your browser's `localStorage` (or the equivalent storage in the desktop app). This is **strictly necessary** to provide features you request and is not used for tracking.

| Storage key | Purpose | Contents | Retention |
| :--- | :--- | :--- | :--- |
| `citadel.save.slot1..3`, `citadel.save.auto` | Manual and automatic saves | Game state (buildings, units, resources, mission progress) | Until you delete the slot or clear browser data |
| `citadel.settings.v1` | Your preferences | Volume levels, accessibility toggles, key bindings | Until cleared |
| `citadel.campaign.progress` | Campaign unlocks | Which missions are unlocked / bonus stars | Until cleared |
| `citadel.consent.v1` | Your privacy-banner choice | `essential`/`ads` flags and a timestamp | Until cleared |
| `citadel.supporter.v1` | Royal Supporter perk flag | `true` once a valid code is redeemed | Until cleared |

**Exported save files** (`.citadelsave`) are created only when you click *Export* and are saved wherever you choose. They contain game state only.

**Supporter codes** are verified **on your device** by comparing a one-way SHA-256 hash; the code is never transmitted to us.

**Offline cache.** When installed as a PWA, a service worker caches the Game's own files so it can run offline. It never caches or intercepts third-party requests.

You can delete all of the above at any time from your browser settings ("Clear site data") or from the in-game *Royal Archives* (save slot delete).

## 3. Information processed by third parties

### 3.1 Web game portals
When you play the Game hosted on a third-party portal, the portal operates the web page around the Game and, for ad-supported portals, loads its own SDK. Depending on the portal, this may involve cookies, device identifiers, IP addresses and ad-measurement data. **The portal is responsible for that processing**, including obtaining any consent required in your region through its own consent tool. Please read the privacy policy of the portal you are using.

Our Game interacts with portal SDKs only to: signal gameplay start/stop, request an ad at natural breaks (between missions), and request an **optional** rewarded ad when *you* click "Royal Respite". We receive only a success/failure result — never personal data.

### 3.2 Purchases and tips
Optional purchases ("Royal Supporter Edition") are processed by the storefront you choose (e.g. itch.io). We do not receive or store your payment card details. The storefront may share with us the information needed to fulfil your purchase (such as an order ID and the email you provide to the storefront), which we use only to deliver your purchase and provide support.

### 3.3 Newsletter / community waitlist (Site only)
If you voluntarily submit your email address on the Site, it is processed by our email service provider **[EMAIL PROVIDER]** solely to send the updates you requested. We use double opt-in, every email contains an unsubscribe link, and we delete your address within 30 days of unsubscribing. Legal basis (GDPR): your consent, Art. 6(1)(a).

### 3.4 Hosting
The Site and self-hosted builds are served by **[HOSTING PROVIDER]**, which, like any web server, processes IP addresses and request logs to deliver pages and protect against abuse. Legal basis: legitimate interests, Art. 6(1)(f). Retention: per the host's standard log retention (typically ≤ 30 days).

### 3.5 Fonts
Fonts are bundled with the Game and Site. **No requests are made to Google Fonts or other font CDNs.**

## 4. Children's privacy (COPPA and equivalents)
The Game is suitable for a general audience and **does not collect personal information from anyone**, including children under 13 (or under 16 in the EEA/UK). The in-game experience has no chat with other players, no accounts and no user profiles. The Site's newsletter form asks users to confirm they are **16 or older**. If you believe a child has submitted personal information to us, contact us and we will delete it. Ad-supported portals are responsible for serving age-appropriate, non-personalised ads where required by law.

## 5. Your rights
Depending on where you live (e.g. EEA/UK GDPR, California CCPA/CPRA, other US state laws), you may have rights to access, correct, delete, or port your personal information, to object to or restrict processing, and to withdraw consent at any time. Because the Game stores data only on your device, you can exercise most of these rights directly by deleting local data. For newsletter or purchase data, contact us at **[PRIVACY CONTACT EMAIL]**. You may also lodge a complaint with your local data-protection authority.

**California:** We do not sell or share personal information and do not use sensitive personal information. We will not discriminate against you for exercising your rights.

## 6. Security
The Game treats imported save files as untrusted input: they are size-limited, type-checked and validated before use and are never executed. The desktop build runs with Electron's context isolation and sandboxing enabled and no Node.js access in the game window.

## 7. International transfers
Where our service providers process data outside your country, we rely on appropriate safeguards such as the European Commission's Standard Contractual Clauses.

## 8. Changes
We will post any changes on this page and update the effective date. Material changes will be highlighted in the Game's release notes.

## 9. Contact
**[STUDIO LEGAL NAME]** · **[POSTAL ADDRESS]** · **[PRIVACY CONTACT EMAIL]**
EU/UK representative (if required): **[REPRESENTATIVE DETAILS]**
