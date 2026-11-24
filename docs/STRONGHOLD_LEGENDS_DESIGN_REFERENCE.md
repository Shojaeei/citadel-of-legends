# Stronghold Legends — Core Design Reference & Architecture Guide for Citadel of Legends

> Saved from user design brief to anchor future gameplay, faction asymmetry, territorial estate control, hero abilities, and map design across upcoming milestones.

## 1. Core Game Identity & Structural Shifts
* **Streamlined Castle Sim:** No crime, torture/policing, rats, or waste micromanagement — keep player focus on castle defense, battlefield tactics, hero micro, and territorial map control.
* **Biome-Locked Economies:** Good (lush forests & meadows — full food/wheat/bakery chain), Ice (snow-covered tundra — no Wheat/Bakeries/Vineyards, relies on orchards/dairy/meat/estates), Evil (cracked volcanic wasteland — no Wheat/Bakeries/Vineyards, relies on hunting/pig farms/estates).
* **Dual-Resource Military:** Standard human troops cost **Gold + Weapons/Resources** (and peasants); Legendary creatures & Heroes cost **Gold + Honor** (generated via feasts, statues, religious buildings, and combat).

## 2. Three-Campaign Narrative Structure (Good / Ice / Evil)
1. **Solaris Order (Good — Easy):** King Arthur & Round Table Knights (unique singular named heroes with active abilities + Green Dragon).
2. **Frostbound Covenant (Ice — Medium):** Dietrich & Siegfried across frozen mountain peaks (mass-trainable White Wolves, White Witches, Shield Maidens, Dwarves, Polar Bears, Frost Giants + Ice Queen Hero + Ice Dragon).
3. **Obsidian Scourge (Evil — Hard):** Count Vlad Dracul across scorched wastelands (mass-trainable Saxon Warriors, Hellhounds, Bats, Werewolves, Demons, Vampiric Creepers, Sorcerers + Black Dragon).

## 3. Critical Gameplay Systems to Implement Next
1. **Active Hero & Special Unit Cooldown Powers:** Merlin Lightning Blast, Galahad AoE Heal Aura, Percival Shockwave, Ice Queen Freeze Nova, Sorcerer Ground Fire.
2. **Timed Dragon Summons + Anti-Air Dragon Harpoons:** Dragons are devastating temporary timed summons that fly over walls; dedicated **Dragon Harpoon Towers** and massed Crossbowmen provide early accessible counter-play.
3. **Territorial Estate System (Anti-Turtling):**
   - **Village Estates:** Capture circles on the 4x valley map guarding Iron, Stone, and Farmland nodes; carter posts ship resources back to the Keep.
   - **Castle Estates:** Capturable forward mini-forts toggled between **Economic**, **Defensive**, and **Aggressive** AI stances.
4. **Asymmetric Mythic Siege Bypasses:** Wall-scaling Werewolves, flying Witches/Bats/Dragons, masonry-crushing Dwarves/Polar Bears/Giants, and defender-converting Vampiric Creepers.
5. **Skirmish Trails & Distinct AI Lord Personalities:** Structured skirmish ladders (*Valley of Flowers*, *The Long March*, *Road to Hell*), *King of the Hill* / *Economic War* modes, and scripted AI lords with unique army compositions and aggression curves.

## 4. Engineering Priorities Highlighted
* **Wide Gatehouses & Clean Collision Radii:** Prevent giant + wolf + archer bottlenecks on narrow ramparts and bridges.
* **Accessible Early Anti-Air:** Ensure Harpoon Towers & Archers/Crossbows counter flying harassment cleanly.
* **Shared Economic Baseline + Concentrated Asymmetry:** Keep core buildings/barracks shared while concentrating faction identity into 1 Legendary Structure, 6-7 Mythic Units/Heroes, 1 Timed Dragon, and biome economy rules.
