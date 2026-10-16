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
| **Paladin Champion** *(Solaris)* | Holy Healer | 70 Gold, 20 Iron, 15 Honor | $380\text{ HP} / 35\text{ ATK} / 1.2$ | Melee combatants (Heals $+14\text{ HP}$ aura) | Dragon Fire, Catapults |
| **Valkyrie Shieldmaiden** *(Frost)* | Flying Skirmisher | 65 Gold, 15 Iron, 15 Honor | $280\text{ HP} / 42\text{ ATK} / 1.2$ | Siege units, terrain-blocked foes | Archers in towers |
| **Vampire Bloodknight** *(Obsidian)* | Drain Bruiser | 75 Gold, 10 Pitch, 15 Honor | $320\text{ HP} / 52\text{ ATK} / 1.2$ | Isolated warriors ($35\%$ lifesteal) | Halberdier swarms |
| **Frost Giant** | Siege Brute | 75 Gold, 35 Iron, 15 Stone | $650\text{ HP} / 75\text{ ATK} / 1.6$ | Walls, gatehouses, infantry | Archers from towers |
| **Night-Stalker Werewolf** | Shock Raider | 60 Gold, 15 Pitch | $240\text{ HP} / 60\text{ ATK} / 1.2$ | Archers, isolated peasants | Halberdier walls |
| **Siege Catapult** | Long-Range Siege | 90 Gold, 50 Wood, 15 Stone | $350\text{ HP} / 110\text{ ATK} / 9.0$ | Castle walls, towers, Keep (AoE Splash) | Fast melee flankers |
| **Faction Dragon** | Mythic Flying Apex | 250 Gold, 60 Honor | $1400\text{ HP} / 140\text{ ATK} / 5.5$ | Ground armies, fortifications (AoE Fire) | Massed Runebow Archers |

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
