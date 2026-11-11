# Gameplay & Strategy Guide: Citadel of Legends: Shattered Realms

Master the arts of fortress architecture, resource economics, and siege warfare.

---

## 1. The Stronghold Economic Cycle

In *Citadel of Legends*, your castle operates as a living medieval engine where peasant satisfaction directly fuels your military machine.

```
       [ Hovels ] ------------> [ Castle Population ]
           |                           |
           v                           v
  [ Housing Capacity ]      [ Workers & Taxpayers ]
                               |             |
                 +-------------+             +--------------+
                 |                                          |
                 v                                          v
      [ Industry & Resource Mines ]                [ Granary Consumption ]
       - Sawyer (Ironwood Timber)                  - Normal / Double Rations
       - Basalt Quarry (Stone Blocks)              - Prevents Starvation
       - Mythril Mine (Iron Ore)                            |
       - Tar Rig (Brimstone Pitch)                          v
                 |                                 [ High Popularity ]
                 v                                          |
     [ Arms & Military Garrison ] <-------------------------+
```

### Popularity & Peasant Migration
- **Popularity > 75 (Rejoicing):** New peasants flock to your Keep. Your workforce expands automatically.
- **Popularity 50–74 (Content):** Population remains stable.
- **Popularity 30–49 (Unhappy):** Immigration ceases; citizens are uneasy.
- **Popularity < 30 (Revolting):** Peasants pack their belongings and abandon your castle, crippling your industry.

### Taxation & Rations Strategy
- **Early Game:** Keep taxes at `0` (No Taxes) and rations at `Normal`. Focus on building `Ironwood Sawyer` and `Hunter's Lodge` to build a food surplus.
- **Mid Game:** Build `Crown Bakery` and `Hovel` clusters. Once food is abundant, switch to `Extra Rations` (+6 Popularity), allowing you to raise taxes to `High Taxes` without causing peasant revolt!
- **Crisis Relief:** If popularity collapses, issue a **Royal Gift** (`taxes = -2`). Spending 15 Gold grants an instant +12 Popularity boost to stop peasant flight.

---

## 2. Building Compendium

| Building | Footprint | Primary Cost | Role & Production |
| :--- | :---: | :--- | :--- |
| **Royal Citadel Keep** | $3 \times 3$ | Free (Spawned) | Seat of power, peasant rally point, generates tax revenue. |
| **Peasant Hovel** | $1 \times 1$ | 20 Wood | Increases maximum castle population capacity by $+5$. |
| **Resource Stockpile** | $2 \times 2$ | 25 Wood | Stores raw materials (timber, stone, iron ore, pitch). |
| **Castle Granary** | $2 \times 2$ | 25 Wood | Stores and distributes food supplies to the population. |
| **Ironwood Sawyer** | $1 \times 1$ | 15 Wood | Employs 1 woodcutter. Generates $+6\text{ Timber/sec}$. |
| **Basalt Quarry** | $2 \times 2$ | 30 Wood | Employs 2 stonecutters. Generates $+5\text{ Stone/sec}$. |
| **Mythril Mine** | $2 \times 2$ | 40 Wood, 15 Stone | Employs 2 miners. Extracts $+3\text{ Mythril Iron/sec}$. |
| **Brimstone Tar Rig** | $1 \times 1$ | 25 Wood, 5 Stone | Employs 1 pitch harvester. Siphons $+3\text{ Pitch/sec}$. |
| **Hunter's Lodge** | $1 \times 1$ | 20 Wood | Rangers hunt wild game for $+5\text{ Venison Food/sec}$. |
| **Crown Bakery** | $1 \times 1$ | 30 Wood, 10 Stone | Employs 2 bakers. High-efficiency food output ($+8\text{ Food/sec}$). |
| **Garrison Barracks** | $2 \times 2$ | 50 Wood, 30 Stone | Recruits infantry, halberdiers, and knights. |
| **Archery Range** | $2 \times 2$ | 45 Wood, 15 Stone | Trains runebow archers. |
| **Siege Workshop** | $2 \times 2$ | 65 Wood, 40 Stone, 20 Iron | Constructs heavy catapults and ballistas. |
| **Basalt Wall** | $1 \times 1$ | 4 Stone | Impassable defensive wall blocking enemy pathfinding. |
| **Fortified Watchtower** | $1 \times 1$ | 30 Stone, 5 Iron | High-durability bastion ($1400\text{ HP}$) providing defensive vantage. |
| **Castle Gatehouse** | $2 \times 1$ | 25 Wood, 50 Stone | Heavy portcullis allowing friendly passage while blocking foes. |
| **Cathedral of Light** *(Solaris)* | $2 \times 2$ | 80 Wood, 60 Stone, 20 Iron | Holy sanctuary generating $+4\text{ Honor/sec}$. |
| **Glacial Runestone** *(Frost)* | $2 \times 2$ | 60 Wood, 80 Stone, 20 Iron | Mystic megalith generating $+4\text{ Honor/sec}$. |
| **Blood Crucible** *(Obsidian)* | $2 \times 2$ | 70 Wood, 50 Stone, 25 Pitch | Sanguine monolith generating $+4\text{ Honor/sec}$. |
| **Dragon Roost Dais** | $2 \times 2$ | 100 Wood, 120 Stone, 40 Iron, 35 Honor | Ancient arcane aerie to summon your Faction Dragon. |

---

## 3. Military Units & Tactical Counters

| Unit | Role | Cost | HP / ATK / Range | Counters | Countered By |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Peasant** | Worker | 8 Gold | $60\text{ HP} / 6\text{ ATK} / 1.1$ | In emergency, swarms single raiders | Everything |
| **Runebow Archer** | Ranged | 20 Gold, 15 Wood | $90\text{ HP} / 18\text{ ATK} / 6.5$ | Slow infantry, unarmored foes | Knights, Werewolves |
| **Iron Halberdier** | Heavy Infantry | 28 Gold, 12 Iron | $180\text{ HP} / 28\text{ ATK} / 1.2$ | Cavalry, Giants, Werewolves | Archers, Catapults |
| **Sun-Blade Knight** | Melee Champion | 55 Gold, 25 Iron | $300\text{ HP} / 48\text{ ATK} / 1.2$ | Archers, infantry lines | Halberdiers, Dragon Fire |
| **Avalon Paladin** *(Solaris)* | Holy Healer | 65 Gold, 25 Iron, 15 Honor | $360\text{ HP} / 52\text{ ATK} / 1.3$ | Melee combatants (Heals $+14\text{ HP}$ aura) | Dragon Fire, Catapults |
| **Frost Valkyrie** *(Frost)* | Flying Skirmisher | 60 Gold, 20 Iron, 15 Honor | $280\text{ HP} / 55\text{ ATK} / 2.2$ | Siege units, terrain-blocked foes | Archers in towers |
| **Vampire Bloodknight** *(Obsidian)* | Stealth Drain Bruiser | 70 Gold, 20 Pitch, 15 Honor | $320\text{ HP} / 58\text{ ATK} / 1.3$ | Isolated warriors ($35\%$ lifesteal); unseen by towers until it strikes | Halberdier swarms |
| **Frost Giant** | Siege Brute | 75 Gold, 35 Iron, 15 Stone | $650\text{ HP} / 75\text{ ATK} / 1.6$ | Walls, gatehouses, infantry | Archers from towers |
| **Night-Stalker Werewolf** | Shock Raider | 60 Gold, 15 Pitch | $240\text{ HP} / 60\text{ ATK} / 1.2$ | Archers, isolated peasants | Halberdier walls |
| **Siege Catapult** | Long-Range Siege | 90 Gold, 50 Wood, 15 Stone | $350\text{ HP} / 110\text{ ATK} / 9.0$ | Castle walls, towers, Keep (AoE Splash) | Fast melee flankers |
| **Faction Dragon** | Mythic Flying Apex | 250 Gold, 60 Honor | $1400\text{ HP} / 140\text{ ATK} / 5.5$ | Ground armies, fortifications (AoE Fire) | Massed Runebow Archers |

---

> **Recruitment requirements (v1.0):** Archers need an Archery Range; Halberdiers and Knights a Barracks; Catapults a Siege Workshop; Dragons a Dragon Roost; Paladins, Valkyries and Bloodknights need their faction monument (Cathedral, Runestone, Blood Crucible). Units are recruited instantly at their building.

---

## 4. Faction Deep Dives

### ☀️ Solaris Order (King Arthur)
* **Specialty:** Superior chivalry, holy knights, and agricultural abundance.
* **Bonuses:** $+20\%$ Tax Income multiplier, $+15\%$ Food Production rate.
* **Signature Unit:** **Sun-Blade Knight** (High armor, swift charges).
* **Mythic Weapon:** **Solaris Dragon** (Cleansing solar fire breath).
* **Recommended Strategy:** Rapidly expand Hovels and Bakeries to maintain `Rejoicing` status. Generate heavy tax revenue to field large legions of Sun-Blade Knights.

### ❄️ Frostbound Covenant (Siegfried)
* **Specialty:** Rugged northern mountain endurance and stonecraft.
* **Bonuses:** $+30\%$ Stone extraction from Quarries, $+20\%$ Iron ore extraction from Mines.
* **Signature Unit:** **Frost Giant** (Massive health pool, pulverizes gatehouses and walls).
* **Mythic Weapon:** **Ice Wyvern** (Freezing breath that chills enemy attackers).
* **Recommended Strategy:** Fortify your choke points with thick basalt walls and watchtowers. Use your surplus stone to build formidable defenses while massing Frost Giants.

### 🦇 Obsidian Scourge (Count Vlad Dracula)
* **Specialty:** Blood, terror, boiling pitch, and predatory beasts.
* **Bonuses:** $+40\%$ Brimstone Tar extraction, $+15\%$ Unit movement speed.
* **Signature Unit:** **Night-Stalker Werewolf** (Devastating burst speed and lethal claws).
* **Mythic Weapon:** **Abyss Dragon** (Dark shadow fire that melts siege engines).
* **Recommended Strategy:** Harness pitch rigs early to fund Werewolf packs. Harass enemy resource camps and flank siege catapults before they reach your castle walls.

---

## 5. The Nine-Mission Campaign

Each mission opens with a war-council briefing; the simulation is paused until you press **Begin Mission**. The objective tracker (top-right) shows live progress. Completing a mission unlocks the next; achieving its bonus earns a ★ on the campaign map.

| Faction | # | Mission | Primary Objectives | Bonus ★ | Tips |
| :--- | :---: | :--- | :--- | :--- | :--- |
| Solaris | 1 | The Gathering Storm | Hovel, Granary, Sawyer & Hunter's Lodge; reach 150 population; hoard 800 food | Zero starvation | No sieges. Popularity ≥ 90 attracts up to two settlers per tick — keep rations Normal and build Bakeries early. |
| Solaris | 2 | Siege of Camelot's Gate | Survive 5 siege waves | Keep all 3 outer towers standing | Repair towers between waves; save 5 Pitch for each wave. |
| Solaris | 3 | Dragon's Dawn | Consecrate the Cathedral; recruit the Solaris Dragon; destroy Blackfang Keep | Slay the Blackfang Warlord with your Dragon | Lure the Warlord out with archers, then strike with the dragon. |
| Frostbound | 1 | The Glacial Trail | Quarry 500 basalt; 3 Hunter's Lodges | Build zero Hovels | You start with 15 housing — enough if you stay lean. |
| Frostbound | 2 | Frostpeak Pass Ambush | Muster 2 Frost Giants; summon 2 Valkyries; repel 4 cavalry charges | 25 kills in the bridge bottleneck | Build the Runestone first (Valkyries require it); fight at the bridge. |
| Frostbound | 3 | The Ice Wyvern's Domain | Raise the Wyvern Aerie; hatch the Ice Wyvern; vanquish the Northern Warlord | Finish in under 12 minutes | Rush the Roost; Honor from the Runestone pays for the Wyvern. |
| Obsidian | 1 | Transylvanian Reckoning | Harvest 300 brimstone; build 4 Boiling Pitch Cauldrons | Never lower tax below High | Taxes start at High — feed generously to offset unrest. |
| Obsidian | 2 | Blood Crucible Bastion | Raise 3 Bloodknights; raze the enemy garrison barracks | Heal 1,000 HP via lifesteal | Bloodknights are invisible to towers until they strike — slip past the defences. |
| Obsidian | 3 | Eclipse of the Abyss | Build 3 catapults; summon the Abyss Dragon; breach the Imperial Citadel | Destroy all 3 enemy gatehouses | Catapults outrange towers; let them crack the gatehouses first. |

---

## 6. Defences & Siege Behaviour (v1.0)

* **Boiling Pitch Cauldron** (20 Stone, 10 Iron, 10 Pitch): automatically scalds invaders within 2.5 tiles for 40 damage, consuming 1 Pitch per pour.
* **Pour Boiling Pitch** (`F` / 🔥 button): 75 damage to every invader within 4 tiles of your walls, towers, gates, cauldrons and keep (5 Pitch).
* **Siege AI:** enemy waves path around obstacles. If your walls seal every route, they **breach the nearest wall** — leave a gatehouse kill-zone rather than relying on a solid wall. Troops sieging a building will turn on defenders within 3.5 tiles.
* **Fog of War:** your Keep sees 12 tiles, towers 10, units 5, flyers 7. You cannot build in unexplored territory; enemy units are only visible inside your vision.

## 7. Controls & Settings

| Action | Mouse / Keyboard (default, rebindable) | Touch |
| :--- | :--- | :--- |
| Select / build | Left-click | Tap |
| Move / attack | Right-click | Long-press |
| Pan camera | Drag, WASD, arrow keys | One-finger drag, two-finger drag, virtual joystick |
| Zoom | Mouse wheel, `+` / `-` | Pinch |
| Box-select army | Shift + drag | — |
| Select all military | `Q` | ⚔️ Army button |
| Pause / speed | `P`, `[` / `]`, or 0x/1x/2x/5x buttons | Speed buttons |
| Quick save / load | `K` / `L` (slot 1) | 💾 button |
| Minimap | `M` toggles; click/drag the radar to move | Tap/drag the radar |

**Settings (⚙):** master / effects / music volume, high-contrast outlines, weather particles, reduced motion, minimap visibility and full key rebinding (conflicts swap automatically). Settings and saves are stored only on your device.

**Saving:** three manual slots plus an auto-save every 3 minutes and after each repelled wave. Use *Export* to download a `.citadelsave` file and *Import* to restore it on any device.
