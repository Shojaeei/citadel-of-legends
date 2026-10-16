# Citadel of Legends: Shattered Realms

> **Tactical Medieval Castle Simulation & Fantasy Warfare**  
> *Inspired by the classic Stronghold series and Stronghold Legends.*

![Citadel of Legends Banner](https://img.shields.io/badge/Status-Phase%202%20Active-emerald?style=for-the-badge)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-amber?style=for-the-badge)
![HTML5 Canvas](https://img.shields.io/badge/Engine-HTML5%202.5D%20Canvas-blue?style=for-the-badge)
![Web Audio](https://img.shields.io/badge/Audio-Procedural%20Web%20Audio%20Synth-purple?style=for-the-badge)

---

## 🏰 Overview

**Citadel of Legends: Shattered Realms** is a browser-based tactical castle simulation and real-time strategy (RTS) game. Players construct thriving medieval stronghold settlements, manage granary rations and royal taxes, defend their castle walls with archers and siege engines, and unleash mythical beasts like dragons, giants, and werewolves across 3 distinct faction sagas.

### 🌟 Key Features
* **Zero External Engine Dependencies:** Runs completely native in any browser using HTML5 Canvas 2D and the Web Audio API without needing build tools, webpack, or external heavy game engines.
* **Three Asymmetric Factions:**
  * **Solaris Order (King Arthur):** Chivalric realm featuring Sun-Blade Knights, prolific bakeries, and the Solaris Dragon.
  * **Frostbound Covenant (Siegfried):** Northern clan with basalt quarries, mountain Frost Giants, and Ice Wyverns.
  * **Obsidian Scourge (Count Vlad Dracula):** Ruthless dread lords commanding boiling tar defenses, Night-Stalker Werewolves, and the Abyss Dragon.
* **Deep Castle Economy:** Real-time production of timber, basalt stone, mythril iron ore, brimstone pitch, gold, and food. Manage peasant popularity, granary rations, and royal taxes.
* **True 2.5D Isometric Engine:** 3D stepped architectural buildings, crenelated battlements, conical watchtowers, dynamic depth sorting, and frustum culling.
* **A\* Pathfinding & Siege Battles:** Real-time grid-based pathfinding, troop movement orders, wall destruction, catapult sieges, and defensive warfare.
* **In-Game Developer Console & Chat:** Built-in development console (`~` key) for debugging, issuing commands, monitoring game states, and logging combat chatter.

---

## 🎮 How to Play

### Quick Start
1. Simply double-click [`index.html`](file:///d:/Citadel%20of%20Legends/index.html) (or [`citadel_of_legends_shattered_realms.html`](file:///d:/Citadel%20of%20Legends/citadel_of_legends_shattered_realms.html)) in any browser (Chrome, Edge, Firefox, Safari).
2. Alternatively, start a lightweight local web server:
   ```bash
   python -m http.server 8080
   # Open http://localhost:8080 in your browser
   ```

### Controls
| Control | Action |
| :--- | :--- |
| **Left Click** | Construct selected building / Select unit or building / Click UI buttons |
| **Right Click** | Cancel selected build tool / Issue move or attack command to selected unit |
| **Left Drag** | Pan the camera across the isometric map (with drag threshold) |
| **Mouse Wheel / +/-** | Zoom in and zoom out smoothly |
| **WASD / Arrow Keys** | Pan camera |
| **Spacebar** | Instantly center camera on your Citadel Keep |
| **Keys 1, 2, 3, 4** | Switch construction tabs: Buildings, Military, Defenses, Mythic |
| **Escape** | Deselect tool or close modal windows |
| **Tilde (~) / Button** | Toggle Developer Chat & Debug Console |

---

## 📂 Project Architecture

```
d:/Citadel of Legends/
├── index.html                           # Primary modern game entry point
├── citadel_of_legends_shattered_realms.html # Synced backward-compatible entry point
├── css/
│   └── style.css                        # Parchment UI styling, Tailwind hooks, animations
├── js/
│   ├── config.js                        # Game constants, building/unit definitions, factions, sagas
│   ├── audio.js                         # Procedural Web Audio synthesizer (SFX & faction music)
│   ├── economy.js                       # Resources, rations, famine, taxes, popularity & migration
│   ├── entities.js                      # Building, Unit, Projectile, and Particle classes
│   ├── pathfinding.js                   # A* grid pathfinding, impassability matrix & waypoints
│   ├── renderer.js                      # 2.5D Isometric renderer, 3D architectural prisms, culling
│   ├── devconsole.js                    # In-game developer chat, command parser & debug inspector
│   └── game.js                          # Main controller, input handling, loop, AI & siege mechanics
├── docs/
│   ├── ARCHITECTURE.md                  # Detailed technical architecture & pipeline breakdown
│   ├── GAMEPLAY_GUIDE.md                # Economy strategy, military counters & campaign manual
│   └── DEVLOG.md                        # Development tracking log & dev chat transcript
└── .gitignore                           # Git ignore rules
```

---

## 🛠️ Documentation Links
* [Technical Architecture Guide](file:///d:/Citadel%20of%20Legends/docs/ARCHITECTURE.md)
* [Comprehensive Gameplay & Strategy Guide](file:///d:/Citadel%20of%20Legends/docs/GAMEPLAY_GUIDE.md)
* [Development Log & Chat Records](file:///d:/Citadel%20of%20Legends/docs/DEVLOG.md)

---
*Citadel of Legends: Shattered Realms &copy; 2026. Built with precision and passion.*
